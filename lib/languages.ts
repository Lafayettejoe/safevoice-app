// The only place a language can be enabled or disabled. Safe to import in the
// browser and on the server.
//
// Known gap (documented in the README): Phase 1 audio prompts are placeholders
// and the cross-language parity test is out of scope, so audioReady and
// parityTestPassed are false. The selector shows languages where enabled is true.

export const LANGUAGES = {
    en: { enabled: true, audioReady: false, parityTestPassed: false },
    ha: { enabled: true, audioReady: false, parityTestPassed: false },
    pcm: { enabled: false, audioReady: false, parityTestPassed: false },
    yo: { enabled: false, audioReady: false, parityTestPassed: false },
    ig: { enabled: false, audioReady: false, parityTestPassed: false },
} as const;

export type LanguageCode = keyof typeof LANGUAGES;

export const DEFAULT_LANGUAGE: LanguageCode = "en";

// Each language is shown in its own language, so a survivor can find hers.
export const LANGUAGE_LABELS: Record<LanguageCode, string> = {
    en: "English",
    ha: "Hausa",
    pcm: "Naijá",
    yo: "Yorùbá",
    ig: "Igbo",
};

// How each code is stored in the database (the Language enum).
const DB_VALUES = {
    en: "ENGLISH",
    ha: "HAUSA",
    pcm: "PIDGIN",
    yo: "YORUBA",
    ig: "IGBO",
} as const;

export type LanguageDbValue = (typeof DB_VALUES)[LanguageCode];

export function isLanguageCode(value: string): value is LanguageCode {
    return value in LANGUAGES;
}

export function enabledLanguages(): LanguageCode[] {
    return Object.keys(LANGUAGES)
        .filter(isLanguageCode)
        .filter((code) => LANGUAGES[code].enabled);
}

export function isEnabledLanguage(value: string): value is LanguageCode {
    return isLanguageCode(value) && LANGUAGES[value].enabled;
}

export function languageToDb(code: LanguageCode): LanguageDbValue {
    return DB_VALUES[code];
}

// If the database holds a language that is not switched on, use English.
export function languageFromDb(value: string): LanguageCode {
    const match = enabledLanguages().find((code) => DB_VALUES[code] === value);
    return match ?? DEFAULT_LANGUAGE;
}