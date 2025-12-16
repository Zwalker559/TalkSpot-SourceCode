
'use server';

import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import admin from '@/firebase/admin';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import {
  CreateAuditLogSchema,
  DisplayNameChangeLogSchema,
  ClearAuditLogsSchema,
  DeleteUserFullySchema,
  GlobalNoticeSchema,
  RepairOrphanedUsersSchema,
  type CreateAuditLogInput,
} from './types';

// Ensure Firebase Admin is initialized
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = getFirestore();

/**
 * Creates a new audit log entry in Firestore.
 * This is a secure server-side action.
 */
export async function createAuditLog(input: CreateAuditLogInput) {
  try {
    const validatedInput = CreateAuditLogSchema.parse(input);

    // If creating a promotion, add it to Firestore here and get the ID
    if (validatedInput.action === 'promotion.create' && validatedInput.details) {
        const promoData = { ...validatedInput.details, createdAt: Timestamp.now() };
        const promoRef = await db.collection('Sponsorships').add(promoData);
        // We can add the new ID to the details if we want to log it
        validatedInput.details.newPromotionId = promoRef.id;
    }

    await db.collection('audit_logs').add({
      ...validatedInput,
      timestamp: Timestamp.now(),
    });

    // Revalidate the admin page to show the new log instantly
    revalidatePath('/admin');
    return { success: true };
  } catch (error) {
    console.error('Error creating audit log:', error);
    // In a real app, you'd want more robust error handling/logging
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid audit log input: ${error.message}`);
    }
    throw new Error('Failed to create audit log entry.');
  }
}


/**
 * Logs a user changing their own display name.
 */
export async function logDisplayNameChange(input: z.infer<typeof DisplayNameChangeLogSchema>) {
   try {
    const { uid, oldDisplayName, newDisplayName } = DisplayNameChangeLogSchema.parse(input);
     await createAuditLog({
        actorUid: uid,
        actorDisplayName: newDisplayName, // Log with the new name
        action: 'user.edit.display_name_self',
        targetInfo: { type: 'user', uid: uid, displayName: newDisplayName },
        details: { from: oldDisplayName, to: newDisplayName }
    });
    return { success: true };
  } catch (error) {
    console.error('Error logging display name change:', error);
    return { success: false };
  }
}


/**
 * Deletes all documents from the audit_logs collection.
 * This is a highly destructive and privileged action.
 */
export async function clearAuditLogs(input: z.infer<typeof ClearAuditLogsSchema>) {
    const { actorUid } = ClearAuditLogsSchema.parse(input);

    // Security check: Only the Owner can perform this action.
    const { isPrivileged } = await isPrivilegedUser(actorUid, 'Owner');
    if (!isPrivileged) {
        throw new Error('Permission Denied: You must be an Owner to clear audit logs.');
    }

    try {
        const auditLogsCollection = db.collection('audit_logs');
        const snapshot = await auditLogsCollection.limit(500).get(); // Process in batches
        
        if (snapshot.empty) {
            return { success: true, message: 'No logs to clear.' };
        }

        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        
        await createAuditLog({
            actorUid: actorUid,
            actorDisplayName: (await admin.auth().getUser(actorUid)).displayName || 'Owner',
            action: 'audit.clear',
            targetInfo: { type: 'system' }
        });


        // If there are more logs, this function can be called again.
        // For simplicity, we'll just clear up to 500 at a time.
        const remaining = (await auditLogsCollection.limit(1).get()).size > 0;
        
        revalidatePath('/admin');
        return { success: true, hasMore: remaining };

    } catch (error) {
        console.error('Error clearing audit logs:', error);
        throw new Error('An unexpected error occurred while clearing logs.');
    }
}


/**
 * Fully deletes a user from Firebase Authentication and all related Firestore data.
 * This is a highly destructive server-side action.
 */
export async function deleteUserFully(input: z.infer<typeof DeleteUserFullySchema>) {
    const { uidToDelete, actorUid } = DeleteUserFullySchema.parse(input);
    const batch = db.batch();

    try {
        const actor = await admin.auth().getUser(actorUid);
        const userToDelete = await admin.auth().getUser(uidToDelete);

        await createAuditLog({
            actorUid: actor.uid,
            actorDisplayName: actor.displayName || 'Admin',
            action: 'user.delete',
            targetInfo: { type: 'user', uid: userToDelete.uid, displayName: userToDelete.displayName || userToDelete.email }
        });

        // 1. Delete user from Firebase Authentication
        await admin.auth().deleteUser(uidToDelete);

        // 2. Delete user's main document
        const userDocRef = db.collection('users').doc(uidToDelete);
        batch.delete(userDocRef);

        // 3. Delete user's lookup document
        const userLookupDocRef = db.collection('user_lookups').doc(uidToDelete);
        batch.delete(userLookupDocRef);
        
        // 4. Delete user's password recovery document
        const passwordRecoveryDocRef = db.collection('password_recovery').doc(uidToDelete);
        batch.delete(passwordRecoveryDocRef);

        // 5. Find and delete all conversations the user is a part of
        const conversationsQuery = db.collection('conversations').where('participants', 'array-contains', uidToDelete);
        const conversationsSnapshot = await conversationsQuery.get();
        
        const deletePromises: Promise<any>[] = [];
        conversationsSnapshot.forEach(convoDoc => {
            // Delete all messages in the conversation's subcollection and the conversation doc itself
            deletePromises.push(
                db.recursiveDelete(convoDoc.ref)
            );
        });
        
        // 6. Find and delete chat requests involving the user
        const requestsFromQuery = db.collection('requests').where('from', '==', uidToDelete);
        const requestsToQuery = db.collection('requests').where('to', '==', uidToDelete);
        
        const [requestsFromSnapshot, requestsToSnapshot] = await Promise.all([
            requestsFromQuery.get(),
            requestsToQuery.get(),
        ]);
        
        requestsFromSnapshot.forEach(doc => batch.delete(doc.ref));
        requestsToSnapshot.forEach(doc => batch.delete(doc.ref));


        // Wait for all recursive deletions to be planned/finished
        await Promise.all(deletePromises);
        
        // Commit all batched writes
        await batch.commit();

        revalidatePath('/admin');
        return { success: true, message: 'User has been fully deleted.' };

    } catch (error: any) {
        console.error(`Critical error during full deletion of user ${uidToDelete}:`, error);
        // If Auth deletion fails, the rest won't run, which is good.
        // If Firestore deletion fails, the user is in a partial state.
        throw new Error(`Failed to fully delete user: ${error.message}`);
    }
}

async function isPrivilegedUser(uid: string, requiredRole: 'Owner' | 'Co-Owner'): Promise<{ isPrivileged: boolean; displayName: string | null; role: string | null }> {
    const actorDoc = await db.collection('users').doc(uid).get();
    if (!actorDoc.exists) {
        return { isPrivileged: false, displayName: null, role: null };
    }
    const role = actorDoc.data()?.role;

    let hasPermission = false;
    if (requiredRole === 'Owner') {
        hasPermission = role === 'Owner';
    } else if (requiredRole === 'Co-Owner') {
        hasPermission = ['Owner', 'Co-Owner'].includes(role);
    }

    return { isPrivileged: hasPermission, displayName: actorDoc.data()?.displayName, role };
}


/**
 * Sends or updates the global notice. Only callable by an Owner or Co-Owner.
 */
export async function sendGlobalNotice(input: z.infer<typeof GlobalNoticeSchema>) {
    const { actorUid, message } = GlobalNoticeSchema.parse(input);

    const { isPrivileged, displayName } = await isPrivilegedUser(actorUid, 'Co-Owner');
    if (!isPrivileged) {
        throw new Error('Permission Denied: You must be an Owner or Co-Owner to send a global notice.');
    }

    try {
        const noticeRef = db.collection('site_config').doc('global_notice');
        await noticeRef.set({
            message,
            active: true,
            updatedAt: Timestamp.now(),
            updatedBy: displayName,
        }, { merge: true });

        await createAuditLog({
            actorUid,
            actorDisplayName: displayName!,
            action: 'notice.send',
            details: { message }
        });

        // Revalidate all pages to show the notice immediately
        revalidatePath('/', 'layout');
        return { success: true, message: 'Global notice has been sent.' };
    } catch (error) {
        console.error('Error sending global notice:', error);
        throw new Error('Failed to send notice.');
    }
}


/**
 * Clears the global notice. Only callable by an Owner or Co-Owner.
 */
export async function clearGlobalNotice(input: { actorUid: string }) {
    const { actorUid } = input;
    const { isPrivileged, displayName } = await isPrivilegedUser(actorUid, 'Co-Owner');
    if (!isPrivileged) {
        throw new Error('Permission Denied: You must be an Owner or Co-Owner to clear the notice.');
    }

    try {
        const noticeRef = db.collection('site_config').doc('global_notice');
        await noticeRef.set({ active: false }, { merge: true });
        
        await createAuditLog({
            actorUid,
            actorDisplayName: displayName!,
            action: 'notice.clear',
        });

        revalidatePath('/', 'layout');
        return { success: true, message: 'Global notice has been cleared.' };
    } catch (error) {
        console.error('Error clearing global notice:', error);
        throw new Error('Failed to clear notice.');
    }
}

/**
 * Finds and removes orphaned Firestore user data for users that no longer exist in Auth.
 */
export async function repairOrphanedUsers(input: z.infer<typeof RepairOrphanedUsersSchema>): Promise<{ deletedCount: number }> {
    const { actorUid } = RepairOrphanedUsersSchema.parse(input);

    // 1. Security Check
    const { isPrivileged, displayName, role } = await isPrivilegedUser(actorUid, 'Co-Owner');
    if (!isPrivileged) {
        throw new Error('Permission Denied: You must be an Owner or Co-Owner to perform this action.');
    }

    try {
        // 2. Fetch all Auth UIDs
        const listUsersResult = await admin.auth().listUsers(1000);
        const authUids = new Set(listUsersResult.users.map(userRecord => userRecord.uid));

        // 3. Fetch all Firestore User UIDs
        const usersCollection = db.collection('users');
        const firestoreUsersSnapshot = await usersCollection.get();
        const firestoreUids = new Set(firestoreUsersSnapshot.docs.map(doc => doc.id));

        // 4. Find the difference
        const orphanedUids = Array.from(firestoreUids).filter(uid => !authUids.has(uid));

        if (orphanedUids.length === 0) {
            return { deletedCount: 0 };
        }

        // 5. Delete orphaned data in batches
        const batch = db.batch();
        orphanedUids.forEach(uid => {
            const userDocRef = db.collection('users').doc(uid);
            const userLookupDocRef = db.collection('user_lookups').doc(uid);
            const passwordRecoveryDocRef = db.collection('password_recovery').doc(uid);
            
            batch.delete(userDocRef);
            batch.delete(userLookupDocRef);
            batch.delete(passwordRecoveryDocRef);
        });

        await batch.commit();

        // 6. Log the action
        await createAuditLog({
            actorUid,
            actorDisplayName: displayName!,
            action: 'system.repair_orphaned_users',
            details: {
                count: orphanedUids.length,
                orphanedUids: orphanedUids,
            }
        });
        
        revalidatePath('/admin');
        return { deletedCount: orphanedUids.length };

    } catch (error) {
        console.error('Error repairing orphaned users:', error);
        throw new Error('An unexpected error occurred during the repair process.');
    }
}
