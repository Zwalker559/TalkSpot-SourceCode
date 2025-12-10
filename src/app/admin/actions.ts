
'use server';

import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import admin from '@/firebase/admin';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

// Ensure Firebase Admin is initialized
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = getFirestore();

const CreateAuditLogSchema = z.object({
  actorUid: z.string(),
  actorDisplayName: z.string(),
  action: z.enum([
      'user.create',
      'user.edit.display_name',
      'user.edit.display_name_self',
      'user.edit.texting_id',
      'user.edit.role',
      'user.edit.status.suspended',
      'user.edit.status.activated',
      'user.edit.password_reset',
      'user.delete',
      'promotion.create',
      'promotion.edit',
      'promotion.delete',
      'audit.clear'
  ]),
  targetInfo: z.object({
    type: z.string(),
    uid: z.string().optional(),
    displayName: z.string().optional(),
  }).optional(),
  details: z.record(z.any()).optional(),
});

type CreateAuditLogInput = z.infer<typeof CreateAuditLogSchema>;

/**
 * Creates a new audit log entry in Firestore.
 * This is a secure server-side action.
 */
export async function createAuditLog(input: CreateAuditLogInput) {
  try {
    const validatedInput = CreateAuditLogSchema.parse(input);
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
 * Logs the creation of a new user.
 */
const UserCreationLogSchema = z.object({
  uid: z.string(),
  email: z.string().email(),
  displayName: z.string(),
  provider: z.string(),
});
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
const DisplayNameChangeLogSchema = z.object({
  uid: z.string(),
  oldDisplayName: z.string(),
  newDisplayName: z.string(),
});
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


const ClearAuditLogsSchema = z.object({
  actorUid: z.string()
});
/**
 * Deletes all documents from the audit_logs collection.
 * This is a highly destructive and privileged action.
 */
export async function clearAuditLogs(input: z.infer<typeof ClearAuditLogsSchema>) {
    const { actorUid } = ClearAuditLogsSchema.parse(input);

    // Security check: Only the Owner can perform this action.
    const actorDoc = await db.collection('users').doc(actorUid).get();
    if (!actorDoc.exists || actorDoc.data()?.role !== 'Owner') {
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
