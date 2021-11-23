/*@preserve Copyright (C) 2019-2021 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env node */

const requirejs = require("requirejs");
requirejs.config({
	baseUrl: `${__dirname}/..`
});

/**
 * Interactive translation support. Pass a language code to translate
 * to that language. Only untranslated strings are processed.
 */

requirejs(["build/Locales"], Locales => {

    const debug = console.debug;
    const locales = new Locales(debug);

	const lang = process.argv[2] || "all";
	console.log(`Translate to ${lang}`);

	locales.loadStrings()
    .then(() => locales.loadTranslations())
    .then(() => {
        if (lang === "all")
                return locales.updateTranslations();
			else
                return locales.updateTranslation(lang);
        });
});
