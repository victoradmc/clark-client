import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import type { Locale } from "../data/clarkApi";
import { en } from "./locales/en";
import { ptBR } from "./locales/pt-BR";

export const SUPPORTED_LOCALES: Locale[] = ["en", "pt-BR"];
export const DEFAULT_LOCALE: Locale = "pt-BR";

// No browser-language detection plugin — the ticket is explicit that the
// starting language is always the signed-in Account's saved preference
// (App.tsx sets it once the profile loads), defaulting to Portuguese before
// that (e.g. on the Login screen, where no Account is known yet).
void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    "pt-BR": { translation: ptBR },
  },
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  interpolation: { escapeValue: false },
});

export default i18n;
