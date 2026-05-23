import en from "@/lib/i18n/locales/en";
import zhTW from "@/lib/i18n/locales/zh-TW";

export const DEFAULT_LOCALE = "zh-TW";
export const EN_LOCALE = "en";
export const SUPPORTED_LOCALES = [DEFAULT_LOCALE, EN_LOCALE];

const DICTIONARIES = {
  [DEFAULT_LOCALE]: zhTW,
  [EN_LOCALE]: en,
};

const EN_PREFIX = "/en";

export function normalizeLocale(locale) {
  return locale === EN_LOCALE ? EN_LOCALE : DEFAULT_LOCALE;
}

export function getDictionary(locale = DEFAULT_LOCALE) {
  return DICTIONARIES[normalizeLocale(locale)];
}

export function localeFromPathname(pathname = "") {
  const path = pathname || "";
  return path === EN_PREFIX || path.startsWith(`${EN_PREFIX}/`) ? EN_LOCALE : DEFAULT_LOCALE;
}

export function stripLocalePrefix(pathname = "") {
  const path = pathname || "/";
  if (path === EN_PREFIX) return "/";
  if (path.startsWith(`${EN_PREFIX}/`)) return path.slice(EN_PREFIX.length) || "/";
  return path || "/";
}

export function localizePath(pathname = "/", locale = DEFAULT_LOCALE) {
  const normalizedLocale = normalizeLocale(locale);
  const cleanPath = stripLocalePrefix(pathname) || "/";
  if (normalizedLocale === EN_LOCALE) {
    return cleanPath === "/" ? EN_PREFIX : `${EN_PREFIX}${cleanPath}`;
  }
  return cleanPath;
}

export function alternateLocale(locale = DEFAULT_LOCALE) {
  return normalizeLocale(locale) === EN_LOCALE ? DEFAULT_LOCALE : EN_LOCALE;
}

export function localizedLoginPath(locale = DEFAULT_LOCALE, next = "") {
  const loginPath = localizePath("/login", locale);
  if (!next) return loginPath;
  return `${loginPath}?next=${encodeURIComponent(next)}`;
}

export function withLocaleProps(locale = DEFAULT_LOCALE) {
  const normalizedLocale = normalizeLocale(locale);
  return {
    locale: normalizedLocale,
    dictionary: getDictionary(normalizedLocale),
  };
}
