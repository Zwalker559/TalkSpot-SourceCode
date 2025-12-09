
'use server';
/**
 * @fileOverview A server-side flow for securely resetting a user's password.
 *
 * - resetPassword - A function that handles the password reset process.
 * - ResetPasswordInput - The input type for the resetPassword function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import admin from '@/firebase/admin';


export const ResetPasswordInputSchema = z.object({
  uid: z.string().describe('The UID of the user whose password needs to be reset.'),
  newPassword: z.string().min(6).describe('The new password for the user. Must be at least 6 characters.'),
});
export type ResetPasswordInput = z.infer<typeof ResetPasswordInputSchema>;

// This is not a typical Genkit flow with prompts, but a server-side action.
// We use defineFlow to leverage Genkit's server-side execution environment.
const resetPasswordFlow = ai.defineFlow(
  {
    name: 'resetPasswordFlow',
    inputSchema: ResetPasswordInputSchema,
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  },
  async ({ uid, newPassword }) => {
    try {
      await admin.auth().updateUser(uid, {
        password: newPassword,
      });
      console.log(`Successfully updated password for user: ${uid}`);
      return { success: true, message: 'Password updated successfully.' };
    } catch (error: any) {
      console.error(`Failed to update password for user ${uid}:`, error);
      // It's better to throw a specific error or return a structured error response
      // For now, we will return a failure message that the client can handle.
      return { success: false, message: error.message || 'An unknown server error occurred.' };
    }
  }
);


export async function resetPassword(input: ResetPasswordInput): Promise<{ success: boolean, message: string }> {
    const result = await resetPasswordFlow(input);
    if (!result.success) {
        // Throw an error to be caught by the client-side .catch() block
        throw new Error(result.message);
    }
    return result;
}
