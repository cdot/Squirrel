// StorageEngine implementation reading data from a JSON file on disk.
// The File object has to be passed to the constructor.
// @param file a javascript File or Blob object
// See https://developer.mozilla.org/en-US/docs/Web/API/FileReader
function FileStorageEngine(file) {
    this.cache = null;
    this.file = file;
}

FileStorageEngine.prototype = Object.create(StorageEngine.prototype);

// Implements: StorageEngine
FileStorageEngine.prototype.getData = function(key, ok, fail) {
    if (this.cache === null) {
	var store = this;
	var reader = new FileReader();
	reader.onload = function(evt) {
            store.cache = JSON.parse(reader.result);
	    if (typeof(store.cache[key] !== 'undefined'))
		ok.call(store, store.cache[key]);
	    else
		fail.call(store, key + ' not present in ' + this.file.name);
	};
	reader.onerror = function() {
	    fail.call(store, this.file.name + " read failed");
	};
	reader.onabort = reader.onerror;
	reader.readAsBinaryString(this.file);
    } else if (typeof(this.cache[key] !== 'undefined'))
	ok.call(this, this.cache[key]);
    else
	fail.call(this, key + ' not present');
};
