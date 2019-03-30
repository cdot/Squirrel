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
            [ "c", "compress", "Enable compression (for release)" ],
            [ "d", "debug", "Debug dependencies" ],
            [ "h", "help", "Display this help" ],
            [ "t", "translate", "Try to improve translations" ]
        ])
        .bindHelp()
        .setHelp(DESCRIPTION + "[[OPTIONS]]")
        .parseSystem();

    opts = opts.options;
    let debug = opts.debug ? console.debug : function() {};
    
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
            debug(dependant, "depends on", dependee);
            d[dependee] = true;
        }
    }

    // Expand paths from config.paths in the id. Paths must start
    // the id, and the longest match is done first. Finally add
    // the baseUrl if the path is relative, and .js extension to
    // create the module path.
    function resolveID(id, config) {
        let path = id;
        
        if (config && config.paths) {
            let order = [];
            for (let i in config.paths)
                order.push({ key: i, path: config.paths[i] });
            order = order.sort((a,b) => {
                return a.key.length > b.key.length ? -1
                : a.key.length < b.key.length ? 1 : 0;
            });

            for (let i in order) {
                let re = new RegExp("^" + order[i].key + "(/|$)");
                let m = re.exec(path);
                if (m) {
                    path = path.replace(re, order[i].path + m[1]);
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
                        reject(new Error(path + ": " + response.statusCode));
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

    // Load the requirejhs.config from the given ID
    function getConfig(path) {
        return get(resolveID(path, {}))
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
    function analyseDependencies(id, config, js) {
        addDependency(id);
        let m = /\nrequirejs\.config\((.*?)\);/s.exec(js);
        if (m) {
            let cfg;
            eval("cfg=" + m[1]);
            config = extend(config, cfg);
        }

        m = /(?:(?:requirejs|define)\s*\(\s*(?:"[^"]*"\s*,\s*)?|let\s*deps\s*=\s*)(\[.*?\])/s
        .exec(js);
            
        if (!m) {
            debug(id,"has no dependencies");
            return Promise.resolve();
        }
            
        let deps;
        eval("deps=" + m[1]);
        if (typeof deps === "string")
            deps = [deps];
            
        let promises = [];
        for (let i in deps) {
            let dep = deps[i];
            // Deal with relative paths, as encountered in menu.js
            if (/^\.\.\//.test(dep))
                dep = dep.replace("../", id.replace(/[^\/]*\/[^\/]*$/, ""));
            else if (/^\.\//.test(dep))
                dep = dep.replace("./", id.replace(/\/[^\/]*$/, "/"));
            addDependency(id, dep);
            promises.push(analyse(dep, config));
        }
        return Promise.all(promises);
    }

    // Analyse the code in the module reference by the given id
    function analyse(id, config) {
        if (found_at[id])
            return Promise.resolve();

        let path = resolveID(id, config);
        found_at[id] = path;
        return get(path)
        .then((js) => {
            return analyseDependencies(id, config, js);
        })
        .then(() => config);
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
        //debug("Embed",key);
        stack.push(key);
        return stack;
    }          

    // Generate a single monolithic code module for all the modules in
    // the dependency tree.
    function generateJS(root) {
        let js = treeSort(root);

        let proms = [];
        for (let k in js) {
            let id = js[k];
            proms.push(
                get(found_at[id])
                .then((src) => {
                    let codes = src.toString();
                    // Make sure all define's have a module id
                    codes = codes.replace(
                        /((?:^|\W)define\s*\(\s*)([^"'\s])/,
                        "$1\"" + id + "\", $2");
                    // Make sure there's a define specifying this module
                    let check = new RegExp(
                        "(^|\\W)define\\s*\\(\\s*[\"']" + id + "[\"']", "m");
                    if (!check.test(codes)) {
                        // If not, add one
                        //debug("Adding ID to", id);
                        codes = codes + "\ndefine(\"" + id
                        + "\",function(){});\n";
                    }
                    return codes;
                }));
        }
        
        return Promise.all(proms)
        .then((code) => {
            code.push("requirejs(['" + root + "']);");
            let codes = code.join("\n");
            return (opts.release)
            ? uglify.minify(codes, {
                ie8: true
            })
            : codes;
        });
    }
    
    function listDir(dir, ext) {
        ext = ext || "[^.]*";
        let re = new RegExp("\." + ext + "$");
        return fs.readdir(dir)
        .then((entries) => {
            let files = [];
            for (let i in entries) {
                let entry = entries[i];
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
                        for (let i in entries) {
                            let entry = entries[i];
                            if (/\.js$/.test(entry)) {
                                let id = "dialogs/" + entry.replace(".js", "");
                                addDependency("js/main", id);
                                deps.push(analyse(id, cfg));
                            }
                        }
                        
                    }),
                    
                    // Analyse dependencies for *Store modules, except those
                    // that are not marked as /* eslint-env browser */
                    fs.readdir("js")
                    .then((entries) => {
                        for (let i in entries) {
                            let entry = entries[i];
                            if (/Store\.js$/.test(entry)
                                && entry !== "FileStore.js") {
                                let id = "js/" + entry.replace(".js", "");
                                addDependency("js/main", id);
                                deps.push(analyse(id, cfg));
                            }
                        }
                    })
                ])
                .then(() => Promise.all(deps));
            })
        ])

        // Generate monolithic JS for all dependencies
        .then(() => {
            return Promise.all([
                generateJS("js/help")
                .then((js) => {
                    return locales.js(js)
                    .then(() => {
                        return fs.writeFile("dist/js/help.js", js);
                    });
                }),
                
                generateJS("js/main")
                .then((js) => {
                    return locales.js(js)
                    .then(() => {
                        return fs.writeFile("dist/js/main.js", js);
                    });
                })
            ]);
        });
    }

    function processImages() {
        // Copy images
        return listDir("images")
        .then((files) => {
            let proms = [];
            for (let i in files) {
                let f = files[i];
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
        let i = 0;
        let proms = [];

        let links = document.getElementsByTagName("link");
        for (let link of links) {
            if (link.id || link.getAttribute("rel") != "stylesheet")
                continue;
            let f = link.getAttribute("href");
            if (i++ == 0)
                link.setAttribute("href", "css/" + module + ".min.css");
            else
                link.remove();
            proms.push(
                fs.readFile(f)
                .then((data) => {
                    return data.toString();
                }));
        }
        
        Promise.all(proms)
        .then((all) => {
            let allCss = all.join('\n');
            if (opts.compress) {
                return new MinifyCSS({
                    compatibility: "ie8",
                    returnPromise: true
                }).minify(allCss)
                .then((css) => {
                    return css.styles;
                });
            }
            else
                return allCss;
        })
        .then((css) => {
            return fs.writeFile("dist/css/" + module + ".min.css",
                                css);
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
                for (let i in files) {
                    let f = files[i];
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
            debug("Extracting strings from",module+".html");
            return locales.html(index)
            .then(() => {
                if (opts.compress)
                    index = MinifyHTML.minify(index, {
                        collapseWhitespace: true,
                        removeComments: true
                    });
                return fs.writeFile("dist/" + module + ".html", index);
            });
            $("head").empty();
        });
    }

    let locales = new Locales();

    locales.loadTranslations()

    .then(() => {
        return Promise.all([
            mkpath("dist/js"),
            mkpath("dist/images"),
            mkpath("dist/css"),
            mkpath("dist/locale"),
        ]);
    })

    .then(() => {
        return Promise.all([
            processImages(),
            processJS("main"),
            processJS("help"),
            processHTML("index"),
            processHTML("help")
        ]);
    })

    .then(() => {
        // Update translations
        debug("Updating translations");
        return locales.updateTranslations(opts.translate)
        .then(() => {
            return locales.saveTranslations();
        });
    })
    .then(() => {

        debug("Saving translations");
        return locales.saveTranslations("dist");
    })
    .catch((e) => {
        
        console.error("Failure:", e);
    });
})
