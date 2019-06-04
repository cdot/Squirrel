/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env node */

const DESCRIPTION =
      "DESCRIPTION\nBuild script for Squirrel.\n";

// This basically duplicates many of the functions * of r.js,
// but in a more manageable way. I wrote it while trying to work
// out what r.js was doing!
let requirejs = require("requirejs");

requirejs(["request", "node-getopt", "fs-extra", "uglify-es", "clean-css", "html-minifier", "jsdom", "js/Locales"], function(request, getopt, fs, uglify, MinifyCSS, MinifyHTML, jsdom, Locales) {

    let opts = getopt
        .create([
            [ "d", "debug", "Debug" ],
            [ "D", "deps", "Show dependencies" ],
            [ "h", "help", "Display this help" ],
            [ "l", "language=ARG", "Language for translation" ],
            [ "t", "translate=ARG", "Re-translate strings below this confidence level (1 for all strings, 0 for untranslated only)" ]
        ])
        .bindHelp()
        .setHelp(DESCRIPTION + "[[OPTIONS]]")
        .parseSystem();

    opts = opts.options;
    let debug = opts.debug ? console.debug : false;
    let dependencies = opts.deps;
    
    function extend(a, b) {
        let join = {};
        if (!a)
            return b;
        if (!b)
            return a;
        
        for (k in a) {
            if (a.hasOwnProperty(k))
                join[k] = a[k];
        }
        for (k in b) {
             if (b.hasOwnProperty(k))
                 join[k] = b[k];
        }
        return join;
    }

    // Map of module id to a set of module id's that it depends on
    let depends_on = {};

    // Add a dependency to the depends_on
    function addDependency(dependant, dependee) {
        let d = depends_on[dependant];
        if (!d)
            depends_on[dependant] = d = {};
        if (dependee && !d[dependee]) {
            if (dependencies) console.debug(dependant, "depends on", dependee);
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
            let order = [];
            for (let i in config.paths)
                order.push({ key: i, path: config.paths[i] });
            config.order = order.sort((a,b) => {
                return a.key.length > b.key.length ? -1
                : a.key.length < b.key.length ? 1 : 0;
            });
        }

        if (config.order) {
            for (let o of config.order) {
                let re = new RegExp("^" + o.key + "(/|$)");
                let m = re.exec(path);
                if (m) {
                    path = path.replace(re, o.path + m[1]);
                }
            }
        }

        if (config.baseUrl && !/^\//.test(path))
            path = config.baseUrl + "/" + path;
        if (!/\.js$/.test(path))
            path = path + ".js";
        
        return path;
    }

    // Get the file or URL referenced by the given path. URLs are
    // recognised by starting with http and/or //
    function get(path) {
        if (/^(https?:)?\/\//.test(path)) {
            if (!/^http/.test(path))
                path = "https:" + path;

            return new Promise((resolve, reject) => {
                request
                .get(path)
                .on('response', (response) => {
                    if (response.statusCode !== 200) {
                        reject(new Serror(
                            response.statusCode,
                            path + ": " + response.statusCode));
                        return;
                    }
                    let body = '';
                    response.on('data', (chunk) => {
                        body += chunk;
                    });
                    response.on('end', () => {
                        resolve(body);
                    });
                });
            });
        } else
            return fs.readFile(path);
    }

    // Load the requirejs.config from the given ID
    function getConfig(module) {
        return get(getModulePath(module, {}))
        .catch((e) => {
            console.log("Failed to load config", e);
        })
        .then((data) => {
            let m = /\nrequirejs\.config\((.*?)\);/s.exec(data);
            if (m) {
                let cfg;
                eval("cfg="+m[1]);
                return cfg;
            }
            return {};
        });
    }

    let found_at = {};

    // Analyse the dependencies described in the given block of code. This
    // is npot a general solution - the code is not parsed, just
    // processed by regexps.
    function analyseDependencies(module, config, js) {
        addDependency(module);
        
        // Look for config
        let m = /\nrequirejs\.config\((.*?)\);/s.exec(js);
        if (m) {
            let cfg;
            eval("cfg=" + m[1]);
            config = extend(config, cfg);
            delete config.order;
        }

        let promises = [];
        // Look for require or define in a format we can analyse
        let re = /(?:(?:requirejs|define)\s*\(\s*(?:"[^"]*"\s*,\s*)?|let\s*deps\s*=\s*)\[\s*(.*?)\s*\]/gs;
        while ((m = re.exec(js)) !== null) {
            
            let deps = m[1].split(/\s*,\s*/);
            for (let dep of deps) {
                let m2 = /^(["'])(.+)\1$/.exec(dep);
                if (m2) {
                    dep = m2[2];
                    // Deal with relative paths, as encountered in menu.js
                    if (/^\.\.\//.test(dep))
                        dep = dep.replace("../", module.replace(/[^\/]*\/[^\/]*$/, ""));
                    else if (/^\.\//.test(dep))
                        dep = dep.replace("./", module.replace(/\/[^\/]*$/, "/"));
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

        let path = getModulePath(module, config);
        if (dependencies) console.debug("Analysing dependencies for", module, "at", path);
        found_at[module] = path;
        return get(path)
        .catch((e) => {
            console.log("Failed to load", path, e);
        })
        .then((js) => {
            return analyseDependencies(module, config, js);
        })
        .then(() => {
            return config;
        });
    }

    // Support for partial ordering
    function treeSort(key, stack, visited) {
        if (!stack) stack = [];
        if (!visited) visited = {};
        visited[key] = true;
        for (d in depends_on[key]) {
            if (!visited[d])
                treeSort(d, stack, visited);
        }
        //if (debug) debug("Embed",key);
        stack.push(key);
        return stack;
    }          

    // Generate a single monolithic code module for all the modules in
    // the dependency tree.
    function generateJS(root) {
        let js = treeSort(root);

        let proms = [];
        for (let module of js) {
            proms.push(
                get(found_at[module])
                .catch((e) => {
                    console.log("Failed to load", module,"from",found_at[module], e);
                })
                .then((src) => {
                    let codes = src.toString();
                    // Make sure all define's have an id
                    codes = codes.replace(
                        /((?:^|\W)define\s*\(\s*)([^"'\s])/,
                        "$1\"" + module + "\", $2");
                    // Make sure there's a define specifying this module
                    let check = new RegExp(
                        "(^|\\W)define\\s*\\(\\s*[\"']" + module + "[\"']", "m");
                    if (!check.test(codes)) {
                        // If not, add one
                        //if (debug) debug("Adding ID to", module);
                        codes = codes + "\ndefine(\"" + module
                        + "\",function(){});\n";
                    }
                    return codes;
                }));
        }
        
        return Promise.all(proms)
        .then((code) => {
            code.push("requirejs(['" + root + "']);");
            let codes = code.join("\n");
            let cod = uglify.minify(codes, {
                        ie8: true
            });
            if (cod.error) {
                console.error("Error:", cod.error);
                return fs.writeFile("dist/" + root + ".bad_js", codes);
            }
            return Promise.all([
                locales.js(codes, root + ".js").then((c) => {
                    if (debug)
                        debug("Extracted",c,"new strings from",root + ".js");
                }),
                fs.writeFile("dist/" + root + ".js", cod.code)
            ]);
        });
    }
    
    function listDir(dir, ext) {
        ext = ext || "[^.]*";
        let re = new RegExp("\." + ext + "$");
        return fs.readdir(dir)
        .then((entries) => {
            let files = [];
            for (let entry of entries) {
                if (re.test(entry))
                    files.push(dir + "/" + entry);
            }
            return files;
        });
    }

    // Make the path to a directory
    function mkpath(file) {
        let m = /^(.+)\/(.*?)$/.exec(file);
        let p = (m) ? mkpath(m[1]) : Promise.resolve()
        return p.then(() => {
            return fs.stat(file);
        })
        .then((stat) => {
            if (stat.isDirectory())
                return Promise.resolve();
            return fs.mkdir(file);
        })
        .catch(() => {
            return fs.mkdir(file);
        });
    }

    function processJS() {
        return Promise.all([
            
            // Analyse dependencies rooted at js/help.js
            getConfig("js/help")
            .then((cfg) => {
                return analyse("js/help", cfg);
            }),

            // Analyse dependencies rooted at js/main.js
            getConfig("js/main")
            .then((cfg) => {
                let deps = [ analyse("js/main", cfg) ];
                
                Promise.all([
                    // Analyse dependencies for dynamically-loaded
                    // dialog modules (they are becoming statically
                    // loaded)
                    fs.readdir("dialogs")
                    .then((entries) => {
                        for (let entry of entries) {
                            if (/\.js$/.test(entry)) {
                                let module = "dialogs/" + entry.replace(".js", "");
                                addDependency("js/main", module);
                                deps.push(analyse(module, cfg));
                            }
                        }
                        
                    }),
                    
                    // Analyse dependencies for *Store and *Layer modules, except those
                    // that are not marked as /* eslint-env browser */
                    fs.readdir("js")
                    .then((entries) => {
                        for (let entry of entries) {
                            if (/(Store|Layer)\.js$/.test(entry)
                                && entry !== "FileStore.js") {
                                let module = "js/" + entry.replace(".js", "");
                                addDependency("js/main", module);
                                deps.push(analyse(module, cfg));
                            }
                        }
                    })
                ])
                .then(() => Promise.all(deps));
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
        .then((files) => {
            let proms = [];
            for (let f of files) {
                if (regex.test(f))
                    proms.push(
                        fs.readFile(f)
                        .then((data) => {
                            return fs.writeFile("dist/" + f, data);
                        }));
            }
            return Promise.all(proms);
        });
    }

    function processCSS(module, document) {
        // Merge and minify CSS
        let proms = [], i = 0;
        let fn = "css/" + module + ".css";

        let links = document.getElementsByTagName("link");
        let remove = [];
        for (let link of links) {
            if (link.id || link.getAttribute("rel") != "stylesheet")
                continue;
            let f = link.getAttribute("href");
           if (i++ == 0)
                link.setAttribute("href", fn);
            else
                remove.push(link);
            proms.push(
                fs.readFile(f)
                .then((data) => {
                    return data.toString();
                }));
        }
        for (let link of remove)
            link.remove();
        
        Promise.all(proms)
        .then((all) => {
            let allCss = all.join('\n');
            return new MinifyCSS({
                compatibility: "ie8",
                returnPromise: true
            })
            .minify(allCss)
            .then((mini) => {
                return fs.writeFile("dist/" + fn, mini.styles);
            });
        });
    }
          
    function processHTML(module) {
        let window, document;
        // Load and parse the root HTML. We know this is in index.html. We
        // further know this loads js/main.js as the main module.
        return jsdom.JSDOM.fromFile(module + ".html")
        .then((dom) => {
            window = dom.window;
            document = window.document;
            // Rewrite meta tags as required
            let metas = document.getElementsByTagName("meta");
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
            .then((files) => {
                let proms = [];
                for (let f of files) {
                    proms.push(
                        fs.readFile(f)
                        .then((data) => {
                            let div = document.createElement("div");
                            div.innerHTML = data.toString();
                            document.body.append(div.firstChild);
                        }));
                }
                return Promise.all(proms);
            })
        })
        .then(() => {
            // The HTML is complete, process the CSS
            return processCSS(module, document);
        })
        .then(() => {
            // Generate new HTML
            let index = "<!DOCTYPE html>\n" +
                document.querySelector("html").innerHTML;
            return locales.html(index, module + ".html")
            .then((c) => {
                if (debug)
                    debug("Extracted",c,"new strings from", module + ".html");
                let re = new RegExp("(href=([\"'])css/" + module + ")(\\.css\\2)");
                let mindex = MinifyHTML.minify(index, {
                    collapseWhitespace: true,
                    removeComments: true
                });
                return fs.writeFile("dist/" + module + ".html", mindex);
            });
            $("head").empty();
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
            if (debug) debug("Saving strings");
            return locales.saveStrings();
        });
    }

    function target_translate(improve, lang) {
        // Update translations
        if (debug) debug("Updating translations");
        return locales.loadStrings()
        .then(() => {
            return locales.loadTranslations();
        })
        .then(() => {
            if (lang)
                locales.updateTranslation(lang, improve);
            else
                locales.updateTranslations(improve);
        })
        .then(() => {
            if (debug) debug("Saving translations");
            return locales.saveTranslations();
        });
    }

    let locales = new Locales(debug);
    let promise = locales.loadStrings();
    
    if (typeof opts.translate !== "undefined")
        promise = promise.then(target_translate(opts.translate, opts.language));
    else
        promise = promise.then(target_release());
})
