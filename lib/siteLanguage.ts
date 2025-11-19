export type SiteLanguage = 'zh' | 'en';

export const SITE_LANGUAGE_STORAGE_KEY = 'site_lang';
const LEGACY_LANGUAGE_KEY = 'ddz_lang';
export const SITE_LANGUAGE_EVENT = 'site-language-change';

export function readSiteLanguage(): SiteLanguage | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored =
      window.localStorage.getItem(SITE_LANGUAGE_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_LANGUAGE_KEY);
    return stored === 'zh' || stored === 'en' ? stored : null;
  } catch (err) {
    console.warn('[siteLanguage] read failed', err);
    return null;
  }
}

export function writeSiteLanguage(lang: SiteLanguage) {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(SITE_LANGUAGE_STORAGE_KEY, lang);
      window.localStorage.setItem(LEGACY_LANGUAGE_KEY, lang);
    } catch (err) {
      console.warn('[siteLanguage] write failed', err);
    }
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
  }
}

export function emitSiteLanguageChange(lang: SiteLanguage) {
  if (typeof window === 'undefined') return;
  const event = new CustomEvent<SiteLanguage>(SITE_LANGUAGE_EVENT, { detail: lang });
  window.dispatchEvent(event);
}

export function subscribeSiteLanguage(listener: (lang: SiteLanguage) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleCustom = (event: Event) => {
    const detail = (event as CustomEvent<SiteLanguage | undefined>).detail;
    if (detail === 'zh' || detail === 'en') {
      listener(detail);
    }
  };

  const handleStorage = (event: StorageEvent) => {
    if (!event.key) return;
    if (event.key !== SITE_LANGUAGE_STORAGE_KEY && event.key !== LEGACY_LANGUAGE_KEY) return;
    const next = event.newValue;
    if (next === 'zh' || next === 'en') {
      listener(next);
    }
  };

  window.addEventListener(SITE_LANGUAGE_EVENT, handleCustom as EventListener);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(SITE_LANGUAGE_EVENT, handleCustom as EventListener);
    window.removeEventListener('storage', handleStorage);
  };
}
