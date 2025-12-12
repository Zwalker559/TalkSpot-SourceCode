
'use server';
/**
 * @fileOverview A self-hosted translation service using Hugging Face Transformers.js.
 * This file implements a translation server action based on the user's original Python implementation.
 *
 * - translate - A function that handles the text translation.
 */

import { pipeline, type Pipeline } from '@xenova/transformers';
import { LRUCache } from 'lru-cache';
import {
  TranslateInput,
  TranslateInputSchema,
  TranslateOutput,
} from './types';

// Model map identical to the user's Python implementation.
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

// --- Singleton class to manage translator pipelines ---
// This robust singleton ensures we only load each model into memory once and await its readiness.
class TranslatorSingleton {
  private static task: string = 'translation';
  private static modelPromises: Map<string, Promise<Pipeline>> = new Map();

  static async getInstance(model: string): Promise<Pipeline> {
    if (!this.modelPromises.has(model)) {
      // If a promise for this model doesn't exist, create it.
      // The promise will resolve with the fully loaded pipeline instance.
      this.modelPromises.set(
        model,
        new Promise(async (resolve, reject) => {
          try {
            // The { quantized: false } is crucial for stable server-side performance.
            const instance = await pipeline(this.task, model, { quantized: false });
            console.log(`Successfully loaded translation model: ${model}`);
            resolve(instance);
          } catch (error) {
            console.error(`Failed to load model ${model}:`, error);
            // If loading fails, remove the promise to allow for a retry on a subsequent call.
            this.modelPromises.delete(model);
            reject(error);
          }
        })
      );
    }
    // Return the promise. Subsequent calls for the same model will get the same promise,
    // effectively waiting for the model to be loaded if it's the first time.
    return this.modelPromises.get(model)!;
  }
}

// --- In-memory LRU cache for translation results ---
const translationCache = new LRUCache<string, string>({
  max: 500, // Max number of items in cache
  ttl: 1000 * 60 * 60, // 1 hour
});

/**
 * Translates text using a self-hosted Hugging Face model.
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

  // Check cache first
  const cacheKey = `${modelKey}:${text}`;
  if (translationCache.has(cacheKey)) {
    return { translatedText: translationCache.get(cacheKey)! };
  }

  try {
    const translator = await TranslatorSingleton.getInstance(modelName);

    // The Helsinki-NLP models determine source and target from the model name itself.
    // They expect only the text to be translated.
    const result = await translator(text);

    // The result is an array, we need the first element.
    const translatedText = Array.isArray(result) && result.length > 0
      ? result[0].translation_text
      : (result as any).translation_text; // Fallback for unexpected structure

    if (typeof translatedText !== 'string' || !translatedText) {
        throw new Error(`Translation pipeline returned an unexpected result structure: ${JSON.stringify(result)}`);
    }
      
    // Store result in cache
    translationCache.set(cacheKey, translatedText);

    return { translatedText };
  } catch (error: any) {
    console.error('Translation pipeline failed:', error);
    // Throw a generic error to the client to avoid leaking implementation details.
    throw new Error('Failed to translate the message due to a server error.');
  }
}
