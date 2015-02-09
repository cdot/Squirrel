// AbstractStore implementation reading data from a JSON file on disk.
// The File object has to be passed to the constructor.
// @param file a javascript File or Blob object
// See https://developer.mozilla.org/en-US/docs/Web/API/FileReader
function FileStore(file) {
    this.cache = null;
    this.file = file;
}

FileStore.prototype = Object.create(AbstractStore.prototype);

// Implements: AbstractStore
FileStore.prototype.getData = function(key, ok, fail) {
    var ukey = this.user + ':' + key,
    store, reader;
    if (!this.user) {
        fail.call(this, "Not logged in");
        return;
    }
    if (this.cache === null) {
	store = this;
	reader = new FileReader();
	reader.onload = function(evt) {
            store.cache = JSON.parse(reader.result);
	    if (typeof(store.cache[ukey] !== 'undefined'))
		ok.call(store, store.cache[ukey]);
	    else
		fail.call(store, key + ' not present in ' + this.file.name);
	};
	reader.onerror = function() {
	    fail.call(store, this.file.name + " read failed");
	};
	reader.onabort = reader.onerror;
	reader.readAsBinaryString(this.file);
    } else if (typeof(this.cache[ukey] !== 'undefined'))
	ok.call(this, this.cache[ukey]);
    else
	fail.call(this, key + ' not present');
};
