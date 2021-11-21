/*@preserve Copyright (C) 2019-2021 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env node */
/* eslint-disable no-eval */
/* eslint-disable no-use-before-define */

const DESCRIPTION = [
    "DESCRIPTION",
	"Build script for Squirrel.",
	"Default behaviour is to build a release in the dist/ directory.",
	"With the -t option, updates translations using the js/Locales module to auto-translate new strings.",
	"",
	"USAGE",
	"node build-dist.js <options>",
	"",
	"OPTIONS",
	"[[OPTIONS]]" ];

let requirejs = require("requirejs");

requirejs(["request", "node-getopt", "fs", "uglify-js", "clean-css", "html-minifier", "jsdom", "js/Locales"], function(request, getopt, fs, uglify, MinifyCSS, MinifyHTML, jsdom, Locales) {

	const Fs = fs.promises;

    const opts = getopt
        .create([
            [ 'd', "debug", "Debug" ],
            [ 'D', "deps", "Show dependencies" ],
            [ 'h', "help", "Display this help" ],
            [ 'l', "language=ARG", "Target language for translation" ]
        ])
        .bindHelp()
        .setHelp(DESCRIPTION.join("\n"))
          .parseSystem()
	.options;

    const debug = opts.debug ? console.debug : () => {};
    const dependencies = opts.deps;

	/**
	 * Like jquery extend
	 */
    function extend(a, b) {
        const join = {};
		let k;
        if (!a)
            return b;
        if (!b)
            return a;
        
        for (k in a) {
            if (Object.prototype.hasOwnProperty.call(a, k))
                join[k] = a[k];
        }
        for (k in b) {
            if (Object.prototype.hasOwnProperty.call(b, k))
                 join[k] = b[k];
        }
        return join;
    }

	// The dependency analysis duplicates many of the functions of r.js,
	// but in a more manageable way. I wrote it while trying to work
	// out what r.js was doing!

    // Map of module id to a set of module id's that it depends on
    const depends_on = {};

    // Add a dependency to the depends_on
    function addDependency(dependant, dependee) {
        let d = depends_on[dependant];
        if (!d)
            depends_on[dependant] = d = {};
        if (dependee && !d[dependee]) {
            if (dependencies) debug(dependant, "depends on", dependee);
            d[dependee] = true;
        }
    }

    // Expand paths from config.paths in the id. Paths must start
    // the id, and the longest match is done first. Finally add
    // the baseUrl if the path is relative, and .js extension to
    // create the module path.
    function getModulePath(module, config) {
        let path = module;
        
        if (config && config.paths && !config.order) {
            const order = [];
            for (let i in config.paths)
                order.push({ key: i, path: config.paths[i] });
            config.order = order.sort(
				(a, b) => a.key.length > b.key.length ? -1
                : a.key.length < b.key.length ? 1 : 0);
        }

        if (config.order) {
            for (let o of config.order) {
                const re = new RegExp(`^${o.key}(/|$)`);
                const m = re.exec(path);
                if (m) {
                    path = path.replace(re, o.path + m[1]);
                }
            }
        }

        if (config.baseUrl && !/^\//.test(path))
            path = `${config.baseUrl}/${path}`;
        if (!/\.js$/.test(path))
            path = path + ".js";
        
        return path;
    }

    // Get the file or URL referenced by the given path. URLs are
    // recognised by starting with http and/or //
    function get(path) {
		//console.log(`GET ${path}`);
        if (/^(https?:)?\/\//.test(path)) {
            if (!/^http/.test(path))
                path = `https:${path}`;

            return new Promise((resolve, reject) => {
                request
                .get(path)
                .on('response', response => {
                    if (response.statusCode !== 200) {
                        reject(`${path}: ${response.statusCode}`);
                        return;
                    }
                    let body = "";
                    response.on('data', chunk => {
                        body += chunk;
                    });
                    response.on('end', () => {
                        resolve(body);
                    });
                });
            });
        } else
            return Fs.readFile(path);
    }

    // Load the requirejs.config from the given ID
    function getConfig(module) {
        return get(getModulePath(module, {}))
        .catch(e => {
            console.log("Failed to load config", e);
        })
        .then(data => {
            const m = /\nrequirejs\.config\((.*?)\);/s.exec(data);
            if (m) {
                let cfg;
                eval(`cfg=${m[1]}`);
                return cfg;
            } else
				throw `No requirejs found in ${module} ${data}`;
        });
    }

    const found_at = {};

    // Analyse the dependencies described in the given block of code. This
    // is not a general solution - the code is not parsed, just
    // processed by regexps. Looks for:
	// define("...", [...]
	// requirejs("...", [...]
	// /* dynamic-dependencies [...]
    function analyseDependencies(module, config, js) {
        addDependency(module);
        
        // Look for config
        let m = /\nrequirejs\.config\((.*?)\);/.exec(js);
        if (m) {
            let cfg;
            eval(`cfg=${m[1]}`);
            config = extend(config, cfg);
            delete config.order;
        }

        const promises = [];
        // Look for requirejs or define in a format we can analyse
		// Also supports /* dynamic-dependencies [...] */
        const re = /(?:(?:requirejs|define)\s*\(\s*(?:"[^"]*"\s*,\s*)?|\/\*\*?\s*dynamic-dependencies\s*)\[\s*(.*?)\s*\]/gs;
        while ((m = re.exec(js)) !== null) {
            
            const deps = m[1].split(/\s*,\s*/);
            for (let dep of deps) {
                const m2 = /^(["'])(.+)\1$/.exec(dep);
                if (m2) {
                    dep = m2[2];
                    // Deal with relative paths, as encountered in menu.js
                    if (/^\.\.\//.test(dep))
                        dep = dep.replace("../", module.replace(/[^/]*\/[^/]*$/, ""));
                    else if (/^\.\//.test(dep))
                        dep = dep.replace("./", module.replace(/\/[^/]*$/, "/"));
					//debug(module, "depends on", dep);
                    addDependency(module, dep);
                    promises.push(analyse(dep, config));
                }
            }
        }
        return Promise.all(promises);
    }

    // Analyse the code in the module
    function analyse(module, config) {
        if (found_at[module])
            return Promise.resolve();

        const path = getModulePath(module, config);
        debug("Analysing dependencies for", module, "at", path);
        found_at[module] = path;
        return get(path)
        .catch(e => console.log("Failed to load", path, e))
        .then(js => analyseDependencies(module, config, js))
        .then(() => {
            return config;
        });
    }

    // Support for partial ordering
    function treeSort(key, stack, visited) {
        if (!stack) stack = [];
        if (!visited) visited = {};
        visited[key] = true;
        for (let d in depends_on[key]) {
            if (!visited[d])
                treeSort(d, stack, visited);
        }
        //debug("Embed",key);
        stack.push(key);
        return stack;
    }          

    // Generate a single monolithic code module for all the modules in
    // the dependency tree.
    function generateJS(root) {
        const js = treeSort(root);

		debug("Generate monolithic JS", js);

        const proms = [];
        for (let module of js) {
            proms.push(
                get(found_at[module])
                .catch(e => {
                    console.log("Failed to load", module,"from",found_at[module], e);
                })
                .then(src => {
					if (!src)
						return "";
                    let codes = src.toString();
                    // Make sure all define's have an id
                    codes = codes.replace(
                        /((?:^|\W)define\s*\(\s*)([^"'\s])/,
                        `$1"${module}", $2`);
                    // Make sure there's a define specifying this module
                    const check = new RegExp(
                        "(^|\\W)define\\s*\\(\\s*[\"']" + module + "[\"']", "m");
                    if (!check.test(codes)) {
                        // If not, add one
                        //debug("Adding ID to", module);
                        codes = codes + "\ndefine('" + module
                        + "',function(){});\n";
                    }
                    return codes;
                }));
        }
        
        return Promise.all(proms)
        .then(code => {
            code.push(`requirejs(['${root}']);`);
            const codes = code.join("\n");
			//console.log("Uglify",codes);
			// See https://www.npmjs.com/package/uglify-js for options
            //const cod = uglify.minify(codes, { ie: true });
            //if (cod.error) {
            //    console.error("Error:", cod.error);
            //    return Fs.writeFile(`dist/${root}.bad_js`, codes);
            //}
			// cod = cod.codel
			const cod = codes;
            return Promise.all([
                locales.js(codes, root + ".js").then(c => {
                    debug(`Extracted ${c} new strings from ${root}.js`);
                }),
                Fs.writeFile(`dist/${root}.js`, cod)
            ]);
        });
    }
    
    function listDir(dir, ext) {
        ext = ext || "[^.]*";
        const re = new RegExp(`\\.${ext}$`);
        return Fs.readdir(dir)
        .then(entries => {
            const files = [];
            for (let entry of entries) {
                if (re.test(entry))
                    files.push(`${dir}/${entry}`);
            }
            return files;
        });
    }

    // Make the path to a directory
    function mkpath(file) {
        const m = /^(.+)\/(.*?)$/.exec(file);
        const p = (m) ? mkpath(m[1]) : Promise.resolve();
        return p.then(() => {
            return Fs.stat(file);
        })
        .then(stat => {
            if (stat.isDirectory())
                return Promise.resolve();
            return Fs.mkdir(file);
        })
        .catch(() => {
            return Fs.mkdir(file);
        });
    }

    function processJS() {
        return Promise.all([
            
            // Analyse dependencies rooted at js/help.js
            getConfig("js/help")
            .then(cfg => analyse("js/help", cfg)),

            // Analyse dependencies rooted at js/main.js
            getConfig("js/main")
            .then(cfg => {
                const deps = [ analyse("js/main", cfg) ];
                
                return Promise.all([
                    // Analyse dependencies for dynamically-loaded
                    // dialog modules (they are becoming statically
                    // loaded)
                    Fs.readdir("dialogs")
                    .then(entries => {
                        for (let entry of entries) {
                            if (/\.js$/.test(entry)) {
                                const module = `dialogs/${entry.replace(".js", "")}`;
                                addDependency("js/main", module);
                                deps.push(analyse(module, cfg));
                            }
                        }
                        
                    }),
                    
                    // Analyse dependencies for *Store and *Layer modules,
					// except those that are not marked as
					// /* eslint-env browser */
                    Fs.readdir("js")
                    .then(entries => {
                        for (let entry of entries) {
                            if (/(Store|Layer)\.js$/.test(entry)) {
								Fs.readFile(`js/${entry}`)
								.then(b => {
									const s = b.toString();
									if (/\/*\s+eslint-env[^*]*browser/.test(s)) {
										const module = `js/${entry.replace(".js", "")}`;
										addDependency("js/main", module);
										deps.push(analyse(module, cfg));
									} else
										debug(`Ignore ${entry}`);
								});
                            }
                        }
                    })
                ]);
            })
        ])
        // Generate JS for all dependencies
        .then(() => {
            return Promise.all([
                generateJS("js/help"),
                generateJS("js/main")
            ]);
        });
    }

    function processDir(dir, regex) {
        // Copy images
        return listDir("images")
        .then(files => {
            const proms = [];
            for (let f of files) {
                if (regex.test(f))
                    proms.push(
                        Fs.readFile(f)
                        .then(data => Fs.writeFile(`dist/${f}`, data)));
            }
            return Promise.all(proms);
        });
    }

    function processCSS(module, document) {
        // Merge and minify CSS
        const proms = [];
		let i = 0;
        const fn = `css/${module}.css`;

        const links = document.getElementsByTagName("link");
        const remove = [];
        for (let link of links) {
            if (link.id || link.getAttribute("rel") != "stylesheet")
                continue;
            const f = link.getAttribute("href");
           if (i++ == 0)
                link.setAttribute("href", fn);
            else
                remove.push(link);
            proms.push(
                Fs.readFile(f)
                .then(data => {
                    return data.toString();
                }));
        }
        for (let link of remove)
            link.remove();
        
        Promise.all(proms)
        .then(all => {
            const allCss = all.join('\n');
            return new MinifyCSS({
                compatibility: "ie8",
                returnPromise: true
            })
            .minify(allCss)
            .then(mini => {
                return Fs.writeFile(`dist/${fn}`, mini.styles);
            });
        });
    }
          
    function processHTML(module) {
        let window, document;
        // Load and parse the root HTML. We know this is in index.html. We
        // further know this loads js/main.js as the main module.
        return jsdom.JSDOM.fromFile(`${module}.html`)
        .then(dom => {
            window = dom.window;
            document = window.document;
            // Rewrite meta tags as required
            const metas = document.getElementsByTagName("meta");
            for (let meta of metas) {
                if (meta.content === "BUILD_DATE")
                    meta.content = new Date();
                else if (/^cache-control$/i.test(meta.name)
                         && /^max-age/i.test(meta.content))
                    // Ten years in seconds
                    meta.content = "max-age=315360000";
            }
        })
        .then(() => {
            if (module !== "index")
                return Promise.resolve();
            
            // Get HTML for all the dialogs, and embed in index.html.
            return listDir("dialogs", "html")
            .then(files => {
                const proms = [];
				/*eslint-disable no-loop-func*/
                for (let f of files) {
                    proms.push(
                        Fs.readFile(f)
                        .then(data => {
                            const div = document.createElement("div");
                            div.innerHTML = data.toString();
                            document.body.append(div.firstChild);
                        }));
                }
				/*eslint-enable no-loop-func*/
                return Promise.all(proms);
            });
        })
        .then(() => {
            // The HTML is complete, process the CSS
            return processCSS(module, document);
        })
        .then(() => {
            // Generate new HTML
            const index = `<!DOCTYPE html>\n${document.querySelector("html").innerHTML}`;
            return locales.html(index, `${module}.html`)
            .then(c => {
                debug(`Extracted ${c} new strings from ${module}.html`);
                //let re = new RegExp(`(href=(["'])css/${module})(\\.css\\2)`);
                const mindex = MinifyHTML.minify(index, {
                    collapseWhitespace: true,
                    removeComments: true
                });
                return Fs.writeFile(`dist/${module}.html`, mindex);
            });
        });
    }

    function target_release() {

        return Promise.all([
            mkpath("dist/js"),
            mkpath("dist/images"),
            mkpath("dist/css"),
            mkpath("dist/locale"),
        ])
    
        .then(() => {
            return Promise.all([
                processDir("images", /\.(svg|png|icon|gif)$/),
                processDir("locale", /\.json$/),
                processJS("main"),
                processJS("help"),
                processHTML("index"),
                processHTML("help")
            ]);
        })
        
        .then(() => {
            // The strings have been updated during the processing
            debug("Saving strings");
            return locales.saveStrings();
        });
    }

    function target_translate(lang) {
        // Update translations
        debug("Updating translations");
        return locales.loadStrings()
        .then(() => {
            return locales.loadTranslations();
        })
        .then(() => {
            if (lang === "all")
                return locales.updateTranslations();
			else
                return locales.updateTranslation(lang);
        });
    }

    const locales = new Locales(debug);
    let promise = locales.loadStrings();
    
    if (typeof opts.language !== 'undefined')
        promise = promise.then(() => target_translate(opts.language));
    else
        promise = promise.then(() => target_release());
	promise
	.catch(e => {
		console.log("Error: ", e);
	});
})
