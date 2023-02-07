/*@preserve Copyright (C) 2017-2023 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env node */

import { promises as Fs } from "fs";
import { AbstractStore } from "../stores/AbstractStore.js";
import { Serror } from "../common/Serror.js";

/**
 * A store engine using file store, used with node.js.
 * Uses 'path' to set the base path
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
    if (this.debug) this.debug("FileStore: read", path);
    if (this.option("path"))
      path = `${this.option("path")}/${path}`;
    return Fs.readFile(path)
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
    if (this.debug) this.debug("FileStore: write", path);
    if (this.option("path"))
      path = `${this.option("path")}/${path}`;
    // data is an Uint8Array so is already bytes
    return Fs.writeFile(path, data);
  }

	/**
	 * @override
	 */
	writes(path, s) {
		return this.write(path, s);
	}
}

export { FileStore }
