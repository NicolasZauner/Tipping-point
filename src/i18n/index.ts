import { create } from "zustand";
import { readStored, writeStored } from "../platform/storage";
import { de } from "./de";
import { en, type Key } from "./en";

export type Lang = "en" | "de";
export type { Key };

const dictionaries: Record<Lang, Record<Key, string>> = { en, de };
const LANG_KEY = "tipping-point:lang";

function initialLang(): Lang {
  const stored = readStored<unknown>(LANG_KEY, null);
  if (stored === "en" || stored === "de") return stored;
  const nav = typeof navigator === "undefined" ? "" : navigator.language;
  return nav.toLowerCase().startsWith("de") ? "de" : "en";
}

type LangState = { lang: Lang; setLang: (l: Lang) => void };
export const useLang = create<LangState>((set) => ({
  lang: initialLang(),
  setLang: (lang) => {
    writeStored(LANG_KEY, lang);
    if (typeof document !== "undefined") document.documentElement.lang = lang;
    set({ lang });
  },
}));

/** Looks up a string and fills {placeholders}. A missing placeholder value is left visible. */
export function translate(lang: Lang, key: Key, vars?: Record<string, string | number>): string {
  const template = dictionaries[lang][key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) =>
    name in vars ? String(vars[name]) : m,
  );
}

export function useT() {
  const lang = useLang((s) => s.lang);
  return (key: Key, vars?: Record<string, string | number>) => translate(lang, key, vars);
}

/** Number formatting follows the language: 0.8413 / 0,8413. */
export function formatNumber(lang: Lang, value: number, digits: number): string {
  return new Intl.NumberFormat(lang === "de" ? "de-DE" : "en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}
