/*@preserve Copyright (C) 2019-2021 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env node */

define("build/Dependencies", ["fs", "request", "js/Utils"], (fs, request, Utils) => {

	const Fs = fs.promises;

	/**
	 * Dependency analysis, used in build-dist.js. Analyses dependencies
	 * found in Javascript files that use requirejs.
	 *
	 * The dependency analysis duplicates many of the functions of r.js.
	 * I wrote it while trying to work out what r.js was doing!
	 */
	class Dependencies {

		constructor(options) {
			this.show = options.show;
			// Map of module id to a set of module id's that it depends on
			this.depends_on = {};
			this.found_at = {};
			this.debug = options.debug || function(){};
			this.configs = {};
		}
		
    getRJSConfig(js) {
		  let m = /\nconst\s*rjs_config\s*=\s*({.*?});/s.exec(js);
		  let cfg;
      var min = this.debug ? "" : ".min";
      if (m) {
			  eval(`cfg=${m[1]}`);
			  return cfg;
      }
		  m = /\nrequirejs\.config\((.*?)\);/s.exec(js);
		  if (m) {
			  eval(`cfg=${m[1]}`);
			  return cfg;
		  }
		  return undefined;
    }

		// Add a dependency to the depends_on
		addDependency(dependant, dependee) {
			let d = this.depends_on[dependant];
			if (!d)
				this.depends_on[dependant] = d = {};
			if (dependee && !d[dependee]) {
				if (this.show) this.debug(dependant, "depends on", dependee);
				d[dependee] = true;
			}
		}

		// Expand paths from config.paths in the id. Paths must start
		// the id, and the longest match is done first. Finally add
		// the baseUrl if the path is relative, and .js extension to
		// create the module path.
		getModulePath(module, config) {
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
		get(path) {
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
		getConfig(module) {
			const path = this.getModulePath(module, {});

			if (this.configs[path])
				return Promise.resolve(this.configs[path]);
			
			return this.get(path)
			.catch(e => {
				console.error(`Failed to load config from ${path}`, e);
			})
			.then(data => {
        const cfg = this.getRJSConfig(data.toString());
        if (!cfg) throw `No requirejs found in ${module}`;
			  this.configs[path] = cfg;
        return cfg;
      });
		}

		/**
		 * Load the code for the given module. The module must have
		 * been found during dependecy analysis.
		 * @param {string} the module path
		 * @return {Promise} a promise that resolves to the {string} code
		 */
		getCode(module) {
			return this.get(this.found_at[module]);
		}

		// Analyse the dependencies found in the given block of code. This
		// is not a general solution - the code is not parsed, just
		// processed by regexps. Looks for:
		// define("...", [...]
		// requirejs("...", [...]
		// /* dynamic-dependencies [...]
		_extractFromCode(module, config, js) {
			this.addDependency(module);
      
			// Look for config
      config = Utils.extend(config, this.getRJSConfig(js) || {});

      const shim = config.shim;
      if (shim) {
        for (const dependant of Object.keys(shim)) {
          const deps = (Array.isArray(shim[dependant]))
                ? shim[dependant] :  shim[dependant].deps;
          for (const dependee of deps)
            this.addDependency(dependant, dependee);
        }
      }

			const promises = [];
			// Look for requirejs or define in a format we can analyse
			// Also supports /* dynamic-dependencies [...] */
			const re = /(?:(?:requirejs|define)\s*\(\s*(?:"[^"]*"\s*,\s*)?|\/\*\*?\s*dynamic-dependencies\s*)\[\s*(.*?)\s*\]/gs;
      let m;
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
						this.addDependency(module, dep);
						promises.push(this.extractFromModule(dep, config));
					}
				}
			}
			return Promise.all(promises);
		}

		/**
		 * Analyse the dependencies found in the code in the module
		 * @param {string} module module name e.g. js/main
		 * @param {object} config requirejs config
		 */
		extractFromModule(module, config) {
			if (this.found_at[module])
				return Promise.resolve();

			const path = this.getModulePath(module, config);
			this.debug("Analysing dependencies for", module, "at", path);
			this.found_at[module] = path;
			return this.get(path)
			.catch(e => console.log("Failed to load", path, e))
			.then(js => this._extractFromCode(module, config, js))
			.then(() => config);
		}

		// Partial ordering
		_sort(key, stack, visited) {
			if (!stack) stack = [];
			if (!visited) visited = {};
			visited[key] = true;
			for (let d in this.depends_on[key]) {
				if (!visited[d])
					this._sort(d, stack, visited);
			}
			//this.debug("Embed",key);
			stack.push(key);
			return stack;
		}

		/**
		 * Generate a single monolithic code module for all the modules in
		 * the dependency tree.
		 * @return {Promise} Promise that resolves to a monolithic code string
		 */
		generateFlatJS(root) {
			const js = this._sort(root);

			this.debug(`Generating monolithic JS ${js}`);

			const proms = [];
			for (let module of js) {
				proms.push(
					this.getCode(module)
					.catch(e => {
						console.log(`Failed to load ${module}`, e);
					})
					.then(src => {
						if (!src) {
							console.log(`Warning: empty module ${module}`);
							return "";
						}
            if (this.debug) this.debug(module, this.found_at[module]);
						let codes = src.toString();
						// Make sure all define's have an id
						codes = codes.replace(
							/((?:^|\W)define\s*\(\s*)([^"'\s])/,
							`$1"${module}", $2`);
						// Make sure there's a define specifying this module
						const check = new RegExp(
							"(?:^|\\W)(define\\s*\\(\\s*[\"']" + module + "[\"'])", "m");
						if (!check.test(codes)) {
							// If not, add one
							//debug("Adding ID to", module);
							codes = `define("${module}",()=>{\n${codes}\n});`;
						}
						return codes;
					}));
			}
      
			return Promise.all(proms)
			.then(code => {
				code.push(`requirejs(['${root}']);`);
				return code.join("\n");
			});
		}
	}
	return Dependencies;
});
