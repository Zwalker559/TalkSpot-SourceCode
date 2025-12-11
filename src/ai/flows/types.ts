import { z } from 'zod';

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

export const TranslateInputSchema = z.object({
  text: z.string().describe('The text to translate.'),
  targetLanguage: z
    .string()
    .describe('The language to translate the text into.'),
  sourceLanguage: z
    .string()
    .optional()
    .describe('The source language of the text.'),
});
export type TranslateInput = z.infer<typeof TranslateInputSchema>;

export const TranslateOutputSchema = z.object({
  translatedText: z.string().describe('The translated text.'),
});
export type TranslateOutput = z.infer<typeof TranslateOutputSchema>;
