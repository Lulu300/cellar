import { afterEach } from 'vitest';
import { getLocale, overwriteGetLocale, type Locale } from '#lib/paraglide/runtime.js';

const detectLocale = getLocale;

/** Makes the code under test speak `locale`, as the language cookie would, until the test ends. */
export function useLocale(locale: Locale) {
    overwriteGetLocale(() => locale);
}

afterEach(() => overwriteGetLocale(detectLocale));

/** Intl separates French numbers and units with narrow no-break spaces: plain spaces here. */
export const plain = (text: string) => text.replace(/\s/g, ' ');
