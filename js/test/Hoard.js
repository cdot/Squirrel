/*eslint-env node, mocha */
var Fs = require("fs");
var assert = require('chai').assert;
var Hoard = require("../Hoard");
var Utils = require("../Utils");

describe('Hoard', function() {
    it('should merge', function() {
	var hoard = new Hoard();
	var cloud = Fs.readFileSync("raw.js");
	cloud = JSON.parse(Utils.ArrayBufferToString(cloud));
	hoard.merge_from_cloud(cloud, null, null, null);
    });
});
