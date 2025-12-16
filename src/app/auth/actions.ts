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

const CreateAuditLogSchema = z.object({
  actorUid: z.string(),
  actorDisplayName: z.string(),
  action: z.enum([
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
      'audit.clear',
      'notice.send',
      'notice.clear',
      'system.repair_orphaned_users'
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
async function createAuditLog(input: CreateAuditLogInput | { action: 'user.create', [key: string]: any }) {
  try {
     // If creating a promotion, add it to Firestore here and get the ID
    if (input.action === 'promotion.create' && input.details) {
        const promoData = { ...input.details, createdAt: Timestamp.now() };
        const promoRef = await db.collection('Sponsorships').add(promoData);
        // We can add the new ID to the details if we want to log it
        input.details.newPromotionId = promoRef.id;
    }

    await db.collection('audit_logs').add({
      ...input,
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
      action: 'user.create' as any, // Cast to any to satisfy base schema
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
