// Shared by the Vite plugin (dev, build, tests) and `paraglide-js compile` (check, prepare).
/** @type {import('@inlang/paraglide-js').ParaglideConfig} */
export default {
    outdir: './src/lib/paraglide',
    // No URL prefix: the language comes from the cookie that the language switch sets, then from
    // the browser's languages. Pages render on the server in that language.
    strategy: ['cookie', 'preferredLanguage', 'baseLocale'],
    cookieName: 'cellar_locale',
    // Lets the bundler drop the server-only code from the client
    isServer: 'import.meta.env.SSR'
};
