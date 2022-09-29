/*@preserve Copyright (C) 2019-2021 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env node */
/* eslint-disable no-eval */
/* eslint-disable no-use-before-define */

let requirejs = require("requirejs");
requirejs.config({
	baseUrl: `${__dirname}/..`
});

requirejs([
  "fs", "uglify-js", "clean-css", "html-minifier", "jsdom",
  "js/Utils", "build/Dependencies"
], (
  fs, uglify, MinifyCSS, MinifyHTML, jsdom,
  Utils, Dependencies
) => {

	const Fs = fs.promises;

  const target_dir = process.argv[2];
  if (!target_dir)
    throw Error("target_dir required");
  const debug = process.argv[3] === 'debug' ? console.debug : () => {};
  const dependencies = new Dependencies({debug: debug, show: true});

  /**
	 * List files in the directory matching the regexp
	 * @param {string} dir the directory to scan
	 * @param {RegExp} re regular expression to match
	 * @return the file path including the directory
	 */
  function listDir(dir, re) {
    re = re || /.*/;
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

  /**
	 * Make the path to a directory
	 * @param {string} dir the path
	 * @return {Promise} a promise to make the path
	 */
  function mkpath(path) {
    const m = /^(.+)\/(.*?)$/.exec(path);
    const p = (m) ? mkpath(m[1]) : Promise.resolve();
    return p.then(() => {
      return Fs.stat(path);
    })
    .then(stat => {
      if (stat.isDirectory())
        return Promise.resolve();
      return Fs.mkdir(path);
    })
    .catch(() => {
      return Fs.mkdir(path);
    });
  }

  /**
	 * Analyse dependencies for dynamically-loaded
   * dialog modules (they are becoming statically
   * loaded)
	 * @param {object} cfg requirejs config
	 * @return {Promise} a promise that resolves when all finished
	 */
	function analyseDialogs(cfg) {
    return Fs.readdir("js/dialogs")
    .then(entries => {
			const promises = [];
			for (let entry of entries) {
				if (/\.js$/.test(entry)) {
					const module = `js/dialogs/${entry.replace(".js", "")}`;
					dependencies.addDependency("js/main", module);
					promises.push(dependencies.extractFromModule(module, cfg));
				}
			}
			return Promise.all(promises);
    });
	}

	/**
   * Analyse dependencies for dynamically-loaded *Store and *Layer modules
	 * (they are becoming statically loaded) except those that are not
	 * marked with eslint-env browser
	 * @param {object} cfg requirejs config
	 * @return {Promise} a promise that resolves when all finished
	 */
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

	/**
	 * Write a monolithic code file for the code rooted at module
	 * @param {string} module module name e.g. js/main
	 */
	function generateMonolithicJS(module) {
    return dependencies.generateFlatJS(module)
		.then(code => {
      const debugging = typeof debug === "function";
      if (debugging) debug(`Uglifying ${target_dir}/${module}.js`);
      const res = uglify.minify(code, {
        compress: debugging ? false : {},
        keep_fargs: debugging,
        keep_fnames: debugging,
        mangle: !debugging,
        warnings: debugging
      });
      if (res.warnings)
        console.debug(res.warnings);
			return Fs.writeFile(`${target_dir}/${module}.js`, debugging ? code : res.code);
		});
	}

	/**
	 * Copy files matching the regex into ${target_dir}/dir
	 * @param {string} dir diretcory to copy
	 * @param {RegExp} regex matching files to copy
	 */
  function processDir(dir, regex) {
    return listDir(dir)
    .then(files => {
      const proms = [];
      for (let f of files) {
        if (regex.test(f))
          proms.push(
            Fs.readFile(f)
            .then(data => Fs.writeFile(`${target_dir}/${f}`, data)));
      }
      return Promise.all(proms);
    });
  }

	/**
	 * Analyse a DOM document and identify local links. Eliminate duplicates.
	 * Then compress before writing.
	 */
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
        .then(data => data.toString()));
    }
    for (let link of remove)
      link.remove();
    
    return Promise.all(proms)
    .then(all => {
      const allCss = all.join('\n');
      return new MinifyCSS({
        compatibility: "ie8",
        returnPromise: true
      })
      .minify(allCss)
      .then(mini => {
        return Fs.writeFile(`${target_dir}/${fn}`, mini.styles);
      });
    });
  }
  
  /**
	 * Load and parse the root HTML. We know this is in index.html. We
   * further know this loads js/main.js as the main module.
	 * @param {string} module root path e.g. "index"
	 */
  function processHTML(module) {
    let window, document;
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
      return listDir("html/dialogs", /\.html$/)
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
      //let re = new RegExp(`(href=(["'])css/${module})(\\.css\\2)`);
      const mindex = MinifyHTML.minify(index, {
        collapseWhitespace: !this.debug,
        removeComments: !this.debug
      });
      return Fs.writeFile(`${target_dir}/${module}.html`, mindex);
    });
  }

  Promise.all([
    mkpath(`${target_dir}/js`),
    mkpath(`${target_dir}/images`),
    mkpath(`${target_dir}/css`),
    mkpath(`${target_dir}/i18n`),
  ])

  .then(() => {
    return Promise.all([

      dependencies.getConfig("js/help")
			.then(cfg => {
        cfg.module = "js/help";
        return dependencies.extractFromModule("js/help", cfg);
      })
			.then(() => generateMonolithicJS("js/help")),

			dependencies.getConfig("js/main")
			.then(cfg => {
        cfg.module = "js/main";
        return Promise.all([
				  dependencies.extractFromModule("js/main", cfg),
				  analyseDialogs(cfg),
				  analyseStores(cfg)
			  ]);
      })
			.then(() => generateMonolithicJS("js/main")),

      processDir("images", /\.(svg|png|icon|gif)$/),

      processDir("i18n", /\.json$/),

      processHTML("index"),

      processHTML("help")
    ]);
  });
})
