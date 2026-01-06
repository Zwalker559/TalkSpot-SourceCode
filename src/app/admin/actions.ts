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
  UserCreationLogSchema,
} from './types';

// Ensure Firebase Admin is initialized
if (!admin.apps.length) {
  // This check is a failsafe; the admin module should handle initialization.
}
const db = getFirestore();

/**
 * Creates a new audit log entry in Firestore.
 * This is a secure server-side action.
 */
export async function createAuditLog(input: CreateAuditLogInput) {
  try {
    const validatedInput = CreateAuditLogSchema.parse(input);

    await db.collection('audits').add({
      ...validatedInput,
      timestamp: Timestamp.now(),
    });

    // Revalidate the admin page to show the new log instantly
    revalidatePath('/admin');
    return { success: true };
  } catch (error) {
    console.error('Error creating audit log:', error);
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid audit log input: ${error.message}`);
    }
    throw new Error('Failed to create audit log entry.');
  }
}


/**
 * Logs the creation of a new user.
 */
export async function logUserCreation(input: z.infer<typeof UserCreationLogSchema>) {
  try {
    const { uid, email, displayName, provider } = UserCreationLogSchema.parse(input);
    await createAuditLog({
      actorUid: uid,
      actorDisplayName: displayName,
      action: 'user.create',
      targetInfo: { type: 'user', uid: uid, displayName: displayName },
      details: { email, provider }
    });
    return { success: true };
  } catch (error) {
    console.error('Error logging user creation:', error);
    // Fail silently on the client, but log error on the server
    return { success: false };
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
 * Deletes all documents from the audits collection.
 * This is a highly destructive and privileged action.
 */
export async function clearAuditLogs(input: z.infer<typeof ClearAuditLogsSchema>) {
    const { actorUid } = ClearAuditLogsSchema.parse(input);

    const { isPrivileged, displayName } = await isPrivilegedUser(actorUid, 'Owner');
    if (!isPrivileged || !displayName) {
        throw new Error('Permission Denied: You must be an Owner to clear audit logs.');
    }

    try {
        const auditLogsCollection = db.collection('audits');
        const snapshot = await auditLogsCollection.limit(500).get();
        
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
            actorDisplayName: displayName,
            action: 'audit.clear',
            targetInfo: { type: 'system' }
        });

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
 * This is a highly destructive server-side action, rewritten to be more resilient.
 */
export async function deleteUserFully(input: z.infer<typeof DeleteUserFullySchema>) {
    const { uidToDelete } = DeleteUserFullySchema.parse(input);
    
    try {
        await admin.auth().deleteUser(uidToDelete);

        const batch = db.batch();

        batch.delete(db.collection('users').doc(uidToDelete));
        batch.delete(db.collection('user_lookups').doc(uidToDelete));
        batch.delete(db.collection('password_recovery').doc(uidToDelete));
        
        await batch.commit();

        const conversationsQuery = db.collection('conversations').where('participants', 'array-contains', uidToDelete);
        const conversationsSnapshot = await conversationsQuery.get();
        
        if (conversationsSnapshot && !conversationsSnapshot.empty) {
            for (const convoDoc of conversationsSnapshot.docs) {
                const messagesSnapshot = await convoDoc.ref.collection('messages').get();
                if (messagesSnapshot && !messagesSnapshot.empty) {
                    const messageBatch = db.batch();
                    messagesSnapshot.forEach(msgDoc => {
                        messageBatch.delete(msgDoc.ref);
                    });
                    await messageBatch.commit();
                }
                await convoDoc.ref.delete();
            }
        }
        
        const requestsFromQuery = db.collection('requests').where('from', '==', uidToDelete);
        const requestsToQuery = db.collection('requests').where('to', '==', uidToDelete);
        
        const [requestsFromSnapshot, requestsToSnapshot] = await Promise.all([
            requestsFromQuery.get(),
            requestsToQuery.get(),
        ]);
        
        const requestBatch = db.batch();
        if (requestsFromSnapshot && !requestsFromSnapshot.empty) {
            requestsFromSnapshot.forEach(doc => requestBatch.delete(doc.ref));
        }
        if (requestsToSnapshot && !requestsToSnapshot.empty) {
            requestsToSnapshot.forEach(doc => requestBatch.delete(doc.ref));
        }
        await requestBatch.commit();
        
        revalidatePath('/admin');
        return { success: true, message: 'User has been fully deleted.' };

    } catch (error: any) {
        console.error(`Critical error during full deletion of user ${uidToDelete}:`, error);
        throw new Error(`Failed to fully delete user: ${error.message}`);
    }
}

async function isPrivilegedUser(uid: string, requiredRole: 'Owner' | 'Co-Owner'): Promise<{ isPrivileged: boolean; displayName: string | null; role: string | null }> {
    try {
        const actorDoc = await db.collection('users').doc(uid).get();
        if (!actorDoc.exists) {
            console.warn(`isPrivilegedUser check failed: User document for UID ${uid} does not exist.`);
            return { isPrivileged: false, displayName: null, role: null };
        }
        const userData = actorDoc.data();
        const role = userData?.role;
        const displayName = userData?.displayName || null;
    
        let hasPermission = false;
        if (requiredRole === 'Owner') {
            hasPermission = role === 'Owner';
        } else if (requiredRole === 'Co-Owner') {
            hasPermission = ['Owner', 'Co-Owner'].includes(role);
        }
    
        return { isPrivileged: hasPermission, displayName, role };
    } catch (error) {
        console.error(`Error in isPrivilegedUser for UID ${uid}:`, error);
        return { isPrivileged: false, displayName: null, role: null };
    }
}


/**
 * Sends or updates the global notice. Only callable by an Owner or Co-Owner.
 */
export async function sendGlobalNotice(input: z.infer<typeof GlobalNoticeSchema>) {
    const { actorUid, message } = GlobalNoticeSchema.parse(input);

    const { isPrivileged, displayName } = await isPrivilegedUser(actorUid, 'Co-Owner');
    if (!isPrivileged || !displayName) {
        throw new Error('Permission Denied: You must be an Owner or Co-Owner to send a global notice.');
    }

    try {
        const noticeRef = db.collection('announcements').doc('global');
        await noticeRef.set({
            message,
            active: true,
            updatedAt: Timestamp.now(),
            updatedBy: displayName,
        }, { merge: true });

        await createAuditLog({
            actorUid,
            actorDisplayName: displayName,
            action: 'notice.send',
            details: { message }
        });

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
    if (!isPrivileged || !displayName) {
        throw new Error('Permission Denied: You must be an Owner or Co-Owner to clear the notice.');
    }

    try {
        const noticeRef = db.collection('announcements').doc('global');
        await noticeRef.set({ active: false }, { merge: true });
        
        await createAuditLog({
            actorUid,
            actorDisplayName: displayName,
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

    const { isPrivileged, displayName } = await isPrivilegedUser(actorUid, 'Co-Owner');
    if (!isPrivileged || !displayName) {
        throw new Error('Permission Denied: You must be an Owner or Co-Owner to perform this action.');
    }

    try {
        const listUsersResult = await admin.auth().listUsers(1000);
        const authUids = new Set(listUsersResult.users.map(userRecord => userRecord.uid));

        const usersCollection = db.collection('users');
        const firestoreUsersSnapshot = await usersCollection.get();
        const firestoreUids = new Set(firestoreUsersSnapshot.docs.map(doc => doc.id));

        const orphanedUids = Array.from(firestoreUids).filter(uid => !authUids.has(uid));

        if (orphanedUids.length === 0) {
            return { deletedCount: 0 };
        }

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

        await createAuditLog({
            actorUid,
            actorDisplayName: displayName,
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
