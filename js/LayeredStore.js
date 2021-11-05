/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,node */

define("js/LayeredStore", ["js/AbstractStore", "js/Serror"], function(AbstractStore, Serror) {

    /**
     * A LayeredStore is an AbstractStore where actual store services are provided
     * by another underlying AbstractStore. A LayeredStore is used where data to
     * be stored/read is to be preprocessed, for example through encryption.
     * To the AbstractStore constructor params options we add the 'understore'
     * option (required) which must be a function that will construct
     * the underlying store to be used as the engine, using parameters passed
     * down.
	 * @extends AbstractStore
     */
    class LayeredStore extends AbstractStore {

		/**
		 * See {@link AbstractStore} for other constructor options
		 * @param {object} options 
		 * @param {AbstractStore} options.understore Store this is layered
		 * on top of
		 */
        constructor(options) {
            let us = options.understore;
            super(options);
            Serror.assert(us instanceof AbstractStore);
            this.understore = us;
        }

		/**
		 * @inheritdoc
		 */
        init() {
            return this.understore.init();
        }

		/**
		 * @inheritdoc
		 */
        option(k, v) {
            return this.understore.option(k, v);
        }

		/**
		 * @inheritdoc
		 */
        status() {
            return this.understore.status();
        }

		/**
		 * @inheritdoc
		 */
        read(path) {
            return this.understore.read(path);
        }

		/**
		 * @inheritdoc
		 */
        write(path, data) {
            return this.understore.write(path, data);
        }

		/**
		 * @inheritdoc
		 */
        reads(path) {
            return this.understore.reads(path);
        }

		/**
		 * @inheritdoc
		 */
        writes(path, s) {
            return this.understore.writes(path, s);
        }
    }

    return LayeredStore;
});
