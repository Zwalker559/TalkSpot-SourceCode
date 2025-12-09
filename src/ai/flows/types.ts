import { z } from 'zod';

export const ResetPasswordInputSchema = z.object({
  uid: z.string().describe('The UID of the user whose password needs to be reset.'),
  newPassword: z.string().min(6).describe('The new password for the user. Must be at least 6 characters.'),
});
export type ResetPasswordInput = z.infer<typeof ResetPasswordInputSchema>;
