/*@preserve Copyright (C) 2019-2021 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env node */

const requirejs = require("requirejs");
requirejs.config({
	baseUrl: `${__dirname}/..`
});

/**
 * Analyse .js and .html to extract TX.tx strings
 */

requirejs(["request", "fs", "jsdom", "js/Utils", "build/Locales", "build/Dependencies"], (request, fs, jsdom, Utils, Locales, Dependencies) => {

	const Fs = fs.promises;

    const debug = console.debug;
    const dependencies = new Dependencies({debug: () => {}, show: true});
    const locales = new Locales(debug);

    // Analyse dependencies for dynamically-loaded dialog modules
	function analyseDialogs(cfg) {
        return Fs.readdir("dialogs")
        .then(entries => {
			const promises = [];
			for (let entry of entries) {
				if (/\.js$/.test(entry)) {
					const module = `dialogs/${entry.replace(".js", "")}`;
					dependencies.addDependency("js/main", module);
					promises.push(dependencies.extractFromModule(module, cfg));
				}
			}
			return Promise.all(promises);
        });
	}

    // Analyse dependencies for dynamically-loaded *Store and *Layer modules
	// except those that are not marked with /* eslint-env browser */
	function analyseStores(cfg) {
        return Fs.readdir("js")
        .then(entries => {
			const promises = [];
            for (let entry of entries) {
                if (/(Store|Layer)\.js$/.test(entry)) {
					promises.push(
						Fs.readFile(`js/${entry}`)
						.then(b => {
							const s = b.toString();
							if (/\/*\s+eslint-env[^*]*browser/.test(s)) {
								const module = `js/${entry.replace(".js", "")}`;
								dependencies.addDependency("js/main", module);
								return dependencies.extractFromModule(
									module, cfg);
							}
							debug(`Ignore ${entry}`);
							return Promise.resolve();
						}));
                }
            }
			return Promise.all(promises);
		});
    }

	locales.loadStrings()
	.then(() => Promise.all([
		dependencies.getConfig("js/main")
		.then(cfg => Promise.all([
			dependencies.extractFromModule("js/main", cfg),
			analyseDialogs(cfg),
			analyseStores(cfg)
		]))
		.then(() => dependencies.generateFlatJS("js/main"))
		.then(js => locales.js(js, "js/main")),

		dependencies.getConfig("js/help")
		.then(cfg => dependencies.extractFromModule("js/help", cfg))
		.then(() => dependencies.generateFlatJS("js/help"))
		.then(js => locales.js(js, "js/help")),

		Fs.readFile("help.html")
		.then(data => locales.html(data.toString(), `help.html`)),

		Fs.readFile("index.html")
		.then(data => locales.html(data.toString(), `index.html`)),
		
		Fs.readdir("dialogs")
		.then(entries => {
			const ps = [];
			for (let entry of entries) {
				if (/\.html$/.test(entry)) {
					entry = `dialogs/${entry}`;
					ps.push(
						Fs.readFile(entry)
						.then(
							data => locales.html(data.toString(), entry)));
				}
			}
			return Promise.all(ps);
		})
    ]))
	.then(() => locales.saveStrings());
});
