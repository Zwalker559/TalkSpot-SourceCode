'use server';
/**
 * @fileOverview A server-side action for securely resetting a user's password.
 *
 * - resetPassword - A function that handles the password reset process.
 */
import { z } from 'zod';
import admin from '@/firebase/admin';

export const ResetPasswordInputSchema = z.object({
  uid: z
    .string()
    .describe('The UID of the user whose password needs to be reset.'),
  newPassword: z
    .string()
    .min(6)
    .describe(
      'The new password for the user. Must be at least 6 characters.'
    ),
});
export type ResetPasswordInput = z.infer<typeof ResetPasswordInputSchema>;

/**
 * Directly updates a user's password using the Firebase Admin SDK.
 * This is a standard Next.js Server Action.
 * @param input - The UID of the user and the new password.
 * @returns A promise that resolves to an object indicating success or failure.
 */
export async function resetPassword(
  input: ResetPasswordInput
): Promise<{ success: boolean; message: string }> {
  try {
    // Validate input against the Zod schema
    const { uid, newPassword } = ResetPasswordInputSchema.parse(input);

    await admin.auth().updateUser(uid, {
      password: newPassword,
    });

    console.log(`Successfully updated password for user: ${uid}`);
    return { success: true, message: 'Password updated successfully.' };
  } catch (error: any) {
    console.error(`Failed to update password for user ${input.uid}:`, error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: `Invalid input: ${error.errors.map((e) => e.message).join(', ')}`,
      };
    }

    // Re-throw the error to be caught by the client-side .catch() block
    // This ensures the client knows the operation failed.
    throw new Error(error.message || 'An unknown server error occurred.');
  }
}
