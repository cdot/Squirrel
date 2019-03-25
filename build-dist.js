let requirejs = require("requirejs");

requirejs(["fs-extra", "uglify-es", "clean-css", "jsdom"], function(fs, uglify, cleancss, jsdom, jQuery) {

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
    
    function simplifyPath(path) {
        path = path.replace(/\/[^\/]*\/\.\./g, "");
        return path.replace("\.\/", "");
    }
    
    let depends_on = {};

    function addDependency(dependant, dependee) {
        dependant = simplifyPath(dependant);
        dependee = simplifyPath(dependee);
        let d = depends_on[dependant];
        if (!d) d = {};
        d[dependee] = true;
        depends_on[dependant] = d;
        //console.log(dependant,"depends on",d);
    }
    
    function resolvePaths(deps, config) {
        let ndeps = [];

        for (let i in deps) {
            let dep = deps[i];
            let changed = true;
            while (changed) {
                changed = false;
                for (k in config.paths) {
                    let re = new RegExp("^" + k + "(/|$)");
                    if (re.test(dep)) {
                        dep = dep.replace(re, config.paths[k] + "/");
                        changed = true;
                    }
                }
            }
            if (config.baseUrl && !/^\//.test(dep))
                dep = config.baseUrl + "/" + dep;

            ndeps.push(dep);
        }
        return ndeps;
    }

    function getConfig(file) {
        return fs.readFile(file)
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

    let processedJS = {};
    
    function analyseJS(path, config) {
        if (processedJS[simplifyPath(path.join("/"))])
            return Promise.resolve();
        processedJS[simplifyPath(path.join("/"))] = true;

        //console.debug("Analysing", path.join("/"));
        return fs.readFile(path.join("/"))
        .then((data) => {
            // Do we want to pack this file? if we do, it will be marked
            // with eslint-env browser
            if (!/\n\/\*\s*eslint-env\s[^\n]*browser/.test(data)) {
                console.debug(path.join("/"),"has no eslint-env browser");
                return Promise.resolve();
            }

            let m = /\nrequirejs\.config\((.*?)\);/s.exec(data);
            if (m) {
                let cfg;
                eval("cfg=" + m[1]);
                config = extend(config, cfg);
            }

            m = /\n(?:(?:requirejs|define)\(|let deps\s*=\s*)(\[.*?\])/s
            .exec(data);
            
            if (!m) {
                console.debug(path.join("/"),"has no dependencies");
                return Promise.resolve();
            }
            
            let deps;
            eval("deps=" + m[1]);
            if (typeof deps === "string")
                deps = [deps];
            if (config && config.paths)
                deps = resolvePaths(deps, config);
            
            let promises = [];
            for (let i in deps) {
                let dep = deps[i];
                if (/^\/\//.test(dep)) {
                    // Network dependency
                    addDependency(dep, "HTTP");
                    addDependency(path.join("/"), dep);
                } else {
                    let js = dep + ".js";
                    promises.push(
                        fs.stat(js)
                        .then((stat) => {
                            addDependency(path.join("/"), js);
                            return analyseJS(js.split("/"), config);
                        })
                        .catch((e) => {
                            console.log("Could not find",
                                        dep+" from",path.join("/"));
                            return Promise.resolve();
                        }));
                }
            }
            return Promise.all(promises);
        });
    }

    function analyseDir(dir, config) {
        return fs.readdir(dir.join("/"))
        .then((entries) => {
            let promises = [];
            for (let i in entries) {
                let entry = entries[i];
                if (entry === "node_modules"
                    || entry == "test"
                    || entry == "build"
                    || entry == "dist"
                    || entry.indexOf(".") === 0)
                    continue;
                let path = dir.slice();
                path.push(entry);
                if (/\.js$/.test(entry))
                    promises.push(analyseJS(path, config));
                else
                    promises.push(
                        fs.stat(path.join("/"))
                        .then((stat) => {
                            if (stat.isDirectory())
                                return analyseDir(path, config);
                            return Promise.resolve();
                        }));
            }
            return Promise.all(promises);
        });
    }

    function treeSort(key, visited, stack) {
        visited[key] = true;
        for (d in depends_on[key]) {
            if (!visited[d])
                treeSort(d, visited, stack);
        }
        stack.push(key);
    }          

    function generateJS() {
        let visited = {};
        let js = [];
        let k;

        for (k in depends_on) {
            if (depends_on[k].HTTP) {
                console.log("HTTP:", k);
                visited[k] = true;
            }
        }
        
        for (k in depends_on) {
            if (!visited[k])
                treeSort(k, visited, js);
        }

        let proms = [];
        
        for (k in js) {
            let f = js[k];
            if (!/^\/\//.test(f)) {
                proms.push(
                    fs.readFile(f)
                    .then((src) => {
                        return src.toString();
                    }));
            }
        }
        return Promise.all(proms)
        .then((code) => {
            return uglify.minify(code.join(''), {
                ie8: true
            });
        })
        .then((result) => {
            return result.code;
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
        console.log("mkpath", file);
        let m = /^(.+)\/(.*?)$/.exec(file);
        let p = (m) ? mkpath(m[1]) : Promise.resolve()
        return p.then(() => {
            return fs.stat(file);
        })
        .then((stat) => {
            if (stat.isDirectory())
                return Promise.resolve();
            console.log("mkdir",file);
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
            getConfig("js/main.js")
            .then((config) => {
                return analyseDir(["."], config);
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
//        let head = "<head>" + $("head").html() + "</head>";
//        let body = "<body>" + $("body").html() + "</head>";
        return fs.writeFile("dist/index.html", $("html").html());
    })
    .catch((e) => {
        console.log("Failure:", e, e.stack);
    });
})
