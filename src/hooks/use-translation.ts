
'use client';

import { useState, useEffect, useCallback } from 'react';

type Translations = { [key: string]: any };

export function useTranslation(language: string = 'en') {
  const [translations, setTranslations] = useState<Translations>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadTranslations() {
      setIsLoading(true);
      try {
        const module = await import(`@/locales/${language}.json`);
        setTranslations(module.default);
      } catch (error) {
        console.warn(`Could not load translations for language: ${language}. Falling back to English.`);
        try {
          const fallbackModule = await import(`@/locales/en.json`);
          setTranslations(fallbackModule.default);
        } catch (fallbackError) {
            console.error("Could not load fallback English translations.", fallbackError)
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadTranslations();
  }, [language]);

  const t = useCallback((key: string): string => {
    const keys = key.split('.');
    let result: any = translations;
    for (const k of keys) {
      result = result?.[k];
      if (result === undefined) {
        // In a real app, you might want to log this missing key
        return key;
      }
    }
    return result as string;
  }, [translations]);

  return { t, isLoading };
}
