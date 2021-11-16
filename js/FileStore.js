/*@preserve Copyright (C) 2017-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env node */

define("js/FileStore", [
	"fs", "js/AbstractStore", "js/Serror"
], (fs, AbstractStore, Serror) => {

	const Fs = fs.promises;

    /**
     * A store engine using file store, used with node.js.
     * Uses 'url' to set the base path
     * @extends AbstractStore
     */
    class FileStore extends AbstractStore {

		/**
		 * {@link AbstractStore} for an explanation of parameters.
		 * Sets `options.needs_path`
		 */
        constructor(p) {
            super(p);
            this.type = "FileStore";
            this.option("needs_path", true);
        }

		/**
		 * @override
		 */
        read(path) {
            if (this.debug) this.debug("read", path);
            return Fs.readFile(`${this.option("path")}/${path}`)
            .catch(e => {
                if (/ENOENT/.test(e.message))
                    throw new Serror(404, `${path} ${e.message}`);
                throw e;
            });
        }

		/**
		 * @override
		 */
        reads(path) {
			return this.read(path);
		}

		/**
		 * @override
		 */
        write(path, data) {
            if (this.debug) this.debug("write", path);
            // data is an Uint8Array so is already bytes
            return Fs.writeFile(`${this.option("path")}/${path}`, data);
        }

		/**
		 * @override
		 */
		writes(path, s) {
			return this.write(path, s);
		}
    }

    return FileStore;
});
