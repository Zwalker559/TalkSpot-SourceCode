
'use server';
/**
 * @fileOverview A self-hosted translation service using Hugging Face Transformers.js.
 * This replaces the Genkit-based flow with a direct implementation.
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

// Model map similar to the Python implementation
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
// This ensures we only load each model into memory once.
class Translator {
  static instance: Pipeline | null = null;
  static task: string = 'translation';
  static model: string | null = null;

  static async getInstance(model: string) {
    if (this.model !== model || this.instance === null) {
      this.model = model;
      // NOTE: We disable quantization for server-side usage for better performance/accuracy trade-off
      this.instance = await pipeline(this.task, model, { quantized: false });
    }
    return this.instance;
  }
}

// --- In-memory cache for translation results ---
const options = {
  max: 500, // Max number of items in cache
  ttl: 1000 * 60 * 60, // 1 hour
};
const translationCache = new LRUCache<string, string>(options);

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
  // A more advanced version could detect the source language.
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
    const translator = await Translator.getInstance(modelName);
    const result = await translator(text, {
      tgt_lang: targetLanguage,
      src_lang: sourceLanguage,
    });

    const translatedText = Array.isArray(result)
      ? result[0].translation_text
      : result.translation_text;

    // Store result in cache
    translationCache.set(cacheKey, translatedText);

    return { translatedText };
  } catch (error: any) {
    console.error('Translation pipeline failed:', error);
    throw new Error('Failed to translate the message due to a server error.');
  }
}
