/*@preserve Copyright (C) 2015-2019 Crawford Currie http://c-dot.co.uk license MIT*/

/* global AbstractStore:true */
define(["js/AbstractStore"], function(AbstractStore) {

    /**
     * @class
     * A LayeredStore is an AbstractStore where actual store services are provided
     * by another underlying AbstractStore. A LayeredStore is used where data to
     * be stored/read is to be preprocessed, for example through encryption.
     * To the AbstractStore constructor params options we add the 'understore'
     * option (required) which must be a function that will construct
     * the underlying store to be used as the engine, using parameters passed
     * down.
     */
    class LayeredStore extends AbstractStore {

        constructor(p) {
            if (typeof p.understore === "undefined")
                throw new Error("LayeredStore requires an understore");
            console.log(p.understore);
            p.type = p.type + "/" + p.understore.options.type;
            super(p);
            this.understore = p.understore;
        }

        init() {
            return this.understore.init();
        }

        option(k, v) {
            return this.understore.option(k, v);
        }

        status() {
            return this.understore.status();
        }

        read(path) {
            return this.understore.read(path);
        }

        write(path, data) {
            return this.understore.write(path, data);
        }
    }

    return LayeredStore;
});
