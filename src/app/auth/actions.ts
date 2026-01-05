
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

// Schemas specific to auth actions
const UserCreationLogSchema = z.object({
  uid: z.string(),
  email: z.string().email(),
  displayName: z.string(),
  provider: z.string(),
});

// This is a self-contained schema just for the user creation audit log.
const AuthAuditLogSchema = z.object({
  actorUid: z.string(),
  actorDisplayName: z.string(),
  action: z.literal('user.create'),
  targetInfo: z.object({
    type: z.literal('user'),
    uid: z.string(),
    displayName: z.string(),
  }),
  details: z.record(z.any()).optional(),
});
type AuthAuditLogInput = z.infer<typeof AuthAuditLogSchema>;

/**
 * Creates a new audit log entry in Firestore, specifically for auth events.
 * This is a secure server-side action, isolated from other admin actions.
 */
async function createAuthAuditLog(input: AuthAuditLogInput) {
  try {
    const validatedInput = AuthAuditLogSchema.parse(input);
    await db.collection('audits').add({
      ...validatedInput,
      timestamp: Timestamp.now(),
    });
    // We don't need to revalidate paths here as it doesn't affect the admin UI immediately.
  } catch (error) {
    console.error('Error creating auth audit log:', error);
    // This action should fail silently from the client's perspective.
  }
}


/**
 * Logs the creation of a new user.
 */
export async function logUserCreation(input: z.infer<typeof UserCreationLogSchema>) {
  try {
    const { uid, email, displayName, provider } = UserCreationLogSchema.parse(input);
    await createAuthAuditLog({
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
