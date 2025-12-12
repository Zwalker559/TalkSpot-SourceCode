'use server';
/**
 * @fileOverview A translation service using the Hugging Face Inference API.
 * This file implements a server action for text translation.
 *
 * - translate - A function that handles the text translation.
 */
import { HfInference } from '@huggingface/inference';
import {
  TranslateInput,
  TranslateInputSchema,
  TranslateOutput,
} from './types';

// Initialize the Inference Client.
// It will automatically use the HF_TOKEN from your environment variables.
const hf = new HfInference(process.env.HF_TOKEN);

// Model map identical to your original implementation.
const MODEL_MAP: Record<string, string> = {
  'en-fr': 'Helsinki-NLP/opus-mt-en-fr',
  'fr-en': 'Helsinki-NLP/opus-mt-fr-en',
  'en-es': 'Helsinki-NLP/opus-mt-en-es',
  'es-en': 'Helsinki-NLP/opus-mt-es-en',
  'en-de': 'Helsinki-NLP/opus-mt-en-de',
  'de-en': 'Helsinki-NLP/opus-mt-de-en',
  'en-it': 'Helsinki-NLP/opus-mt-en-it',
  'it-en': 'Helsinki-NLP/opus-mt-it-en',
  'en-pt': 'Helsinki-NLP/opus-mt-en-pt',
  'pt-en': 'Helsinki-NLP/opus-mt-pt-en',
  'en-nl': 'Helsinki-NLP/opus-mt-en-nl',
  'nl-en': 'Helsinki-NLP/opus-mt-nl-en',
  'en-ru': 'Helsinki-NLP/opus-mt-en-ru',
  'ru-en': 'Helsinki-NLP/opus-mt-ru-en',
  'en-ja': 'Helsinki-NLP/opus-mt-en-jap',
  'ja-en': 'Helsinki-NLP/opus-mt-jap-en',
};

/**
 * Translates text using the Hugging Face Inference API.
 * This is a standard Next.js Server Action.
 * @param input - The text to translate and the target language.
 * @returns The translated text.
 */
export async function translate(
  input: TranslateInput
): Promise<TranslateOutput> {
  const { text, targetLanguage } = TranslateInputSchema.parse(input);

  // For this implementation, we'll assume source is always English ('en')
  const sourceLanguage = input.sourceLanguage || 'en';

  const modelKey = `${sourceLanguage}-${targetLanguage}`;
  const modelName = MODEL_MAP[modelKey];

  if (!modelName) {
    throw new Error(
      `Translation from ${sourceLanguage} to ${targetLanguage} is not supported.`
    );
  }

  try {
    const result = await hf.translation({
      model: modelName,
      inputs: text,
    });

    // The InferenceClient directly returns the translated text in the `translation_text` property.
    const translatedText = (result as any).translation_text;

    if (typeof translatedText !== 'string' || !translatedText) {
      console.error('Hugging Face API returned an unexpected result structure:', result);
      throw new Error(
        `Translation API returned an unexpected result structure.`
      );
    }

    return { translatedText };
  } catch (error: any) {
    console.error('Hugging Face API call failed:', error);
    // Throw a generic error to the client to avoid leaking implementation details.
    throw new Error('Failed to translate the message due to a server error.');
  }
}
