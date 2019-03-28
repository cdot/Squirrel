/*@preserve Copyright (C) 2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env node */

/**
 * Build script for Squirrel. This basically duplicates many of the functions
 * of r.js, but in a more accessible and understandable way. I wrote it while
 * trying to work out what r.js was doing!
 */
let requirejs = require("requirejs");

requirejs(["request", "getopts", "fs-extra", "uglify-es", "clean-css", "jsdom"], function(request, getopts, fs, uglify, cleancss, jsdom) {

    let options = getopts(process.argv.slice(2), {
        boolean: ["release"]
    });

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
        
    let depends_on = {};

    function addDependency(dependant, dependee) {
        let d = depends_on[dependant];
        if (!d)
            depends_on[dependant] = d = {};
        if (dependee && !d[dependee]) {
            console.debug(dependant, "depends on", dependee);
            d[dependee] = true;
        }
    }
    
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
            console.debug(id,"has no dependencies");
            return Promise.resolve();
        }
            
        let deps;
        eval("deps=" + m[1]);
        if (typeof deps === "string")
            deps = [deps];
            
        let promises = [];
        for (let i in deps) {
            let dep = deps[i];
            if (/^\.\.\//.test(dep))
                dep = dep.replace("../", id.replace(/[^\/]*\/[^\/]*$/, ""));
            else if (/^\.\//.test(dep))
                dep = dep.replace("./", id.replace(/\/[^\/]*$/, "/"));
            addDependency(id, dep);
            promises.push(analyse(dep, config));
        }
        return Promise.all(promises);
    }

    function analyse(id, config) {
        if (found_at[id])
            return Promise.resolve();

        let path = resolveID(id, config);
        found_at[id] = path;
        return get(path)
        .then((js) => {
            return analyseDependencies(id, config, js);
        });
    }

    function treeSort(key, visited, stack) {
        visited[key] = true;
        for (d in depends_on[key]) {
            if (!visited[d])
                treeSort(d, visited, stack);
        }
        //console.log("Embed",key);
        stack.push(key);
    }          

    function generateJS() {
        let visited = {};
        let js = [];
        let k;

        for (k in depends_on) {
            if (!visited[k])
                treeSort(k, visited, js);
        }

        let proms = [];
        for (k in js) {
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
                        //console.debug("Adding ID to", id);
                        codes = codes + "\ndefine(\"" + id
                        + "\",function(){});\n";
                    }
                    return codes;
                }));
        }
        
        return Promise.all(proms)
        .then((code) => {
            code.push("requirejs(['js/main']);");
            let codes = code.join("\n");
            return (options.release)
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
          
    fs.readFile("index.html")
    .then((html) => {
        global.document = new jsdom.JSDOM(html);
        global.window = document.window;
        global.$ = global.jQuery = require("jquery");
        
        let compressed_js;
        let promises = [];

        // Analyse and generate shared JS
        promises.push(
            getConfig("js/main")
            .then((config) => {
                return analyse("js/main", config)
                .then(() => {
                    return fs.readdir("dialogs");
                })
                .then((entries) => {
                    let proms = [];
                    for (let i in entries) {
                        let entry = entries[i];
                        if (/\.js$/.test(entry)) {
                            proms.push(analyse(
                                "dialogs/" + entry.replace(".js", ""),
                                config));
                        }
                    }
                    return Promise.all(proms);
                })
                .then(() => {
                    return fs.readdir("js");
                })
                .then((entries) => {
                    let proms = [];
                    for (let i in entries) {
                        let entry = entries[i];
                        if (/Store\.js$/.test(entry)
                            && entry !== "FileStore.js") {
                            proms.push(analyse(
                                "js/" + entry.replace(".js", ""),
                                config));
                        }
                    }
                    return Promise.all(proms);
                });
            })
            .then(() => {
                return generateJS();
            })
            .then((js) => {
                return mkpath("dist/js")
                .then(() => {
                    return fs.writeFile("dist/js/main.js", js);
                });
            }));
        
        // HTML for all the dialogs. Embed in index.html.
        promises.push(
            listDir("dialogs", "html")
            .then((files) => {
                let proms = [];
                for (let i in files) {
                    let f = files[i];
                    proms.push(
                        fs.readFile(f)
                        .then((data) => {
                            $("body").append(data.toString());
                        }));
                }
                return Promise.all(proms);
            }));

        // Merge CSS files
        promises.push(
            listDir("css", "css")
            .then((files) => {
                let proms = [];
                for (let i in files) {
                    let f = files[i];
                    if (i == 0) {
                        $("link[href='" + f + "']")
                        .attr("href", "css/combined.min.css");
                    } else {
                        $("link[href='" + f + "']").remove();
                    }
                    proms.push(
                        fs.readFile(f)
                        .then((data) => {
                            return data.toString();
                        }));
                }
                return Promise.all(proms)
                .then((all) => {
                    return new cleancss({
                        compatibility: "ie8",
                        returnPromise: true
                    }).minify(all.join(''))
                    .then((css) => {
                        return mkpath("dist/css")
                        .then(() => {
                            return fs.writeFile("dist/css/combined.min.css",
                                                css.styles);
                        });
                    });
                });
            }));
 
        promises.push(
            mkpath("dist/images")
            .then(() => {
                return listDir("images");
            })
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
            }));

        promises.push(new Promise((resolve)  => {
            $("meta[name='build-date']").attr("content", new Date());
            resolve();
        }));
        
        return Promise.all(promises);
    })
    .then(() => {
        let index = "<!DOCTYPE html>\n" + $("html").html();
        return fs.writeFile("dist/index.html", index);
    })
    .catch((e) => {
        console.log("Failure:", e.stack);
    });
})
