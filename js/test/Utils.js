var assert = require('chai').assert;

// Sample colours, from https://en.wikipedia.org/wiki/HSL_and_HSV
var testMap = [
    {
        hash: "#FFFFF",
        rgb: [ 1.000, 1.000, 1.000 ],
        hsl: [ 0.0, 0.000, 1.000 ],
        hsv: [ 0.0, 0.000, 1.000],
    }, {
        hash: "#808080",
        rgb: [ 0.500, 0.500, 0.500 ],
        hsl: [ 0.0, 0.000, 0.500 ],
        hsv: [ 0.0, 0.000, 0.500],
    }, {
        hash: "#000000",
        rgb: [ 0.000, 0.000, 0.000 ],
        hsl: [ 0.0, 0.000, 0.000 ],
        hsv: [ 0.0, 0.000, 0.000],
    }, {
        hash: "#FF0000",
        rgb: [ 1.000, 0.000, 0.000 ],
        hsl: [ 0.0, 1.000, 0.500 ],
        hsv: [ 0.0, 1.000, 1.000],
    }, {
        hash: "#BFBF00",
        rgb: [ 0.750, 0.750, 0.000 ],
        hsl: [ 60.0, 1.000, 0.375 ],
        hsv: [ 60.0, 1.000, 0.750],
    }, {
        hash: "#008000",
        rgb: [ 0.000, 0.500, 0.000 ],
        hsl: [ 120.0, 1.000, 0.250 ],
        hsv: [ 120.0, 1.000, 0.500],
    }, {
        hash: "#80FFFF",
        rgb: [ 0.500, 1.000, 1.000 ],
        hsl: [ 180.0, 1.000, 0.750 ],
        hsv: [ 180.0, 0.500, 1.000],
    }, {
        hash: "#8080FF",
        rgb: [ 0.500, 0.500, 1.000 ],
        hsl: [ 240.0, 1.000, 0.750 ],
        hsv: [ 240.0, 0.500, 1.000],
    }, {
        hash: "#BF40BF",
        rgb: [ 0.750, 0.250, 0.750 ],
        hsl: [ 300.0, 0.500, 0.500 ],
        hsv: [ 300.0, 0.667, 0.750],
    }, {
        hash: "#A0A424",
        rgb: [ 0.628, 0.643, 0.142 ],
        hsl: [ 61.8, 0.638, 0.393 ],
        hsv: [ 61.8, 0.779, 0.643],
    }, {
        hash: "#411BEA",
        rgb: [ 0.255, 0.104, 0.918 ],
        hsl: [ 251.1, 0.832, 0.511 ],
        hsv: [ 251.1, 0.887, 0.918],
    }, {
        rgb: [ 0.116, 0.675, 0.255 ],
        hsl: [ 134.9, 0.707, 0.396 ],
        hsv: [ 134.9, 0.828, 0.675],
    }, {
        rgb: [ 0.941, 0.785, 0.053 ],
        hsl: [ 49.5, 0.893, 0.497 ],
        hsv: [ 49.5, 0.944, 0.941],
    }, {
        hash: "#B430E5",
        rgb: [ 0.704, 0.187, 0.897 ],
        hsl: [ 283.7, 0.775, 0.542 ],
        hsv: [ 283.7, 0.792, 0.897],
    }, {
        hash: "#ED7651",
        rgb: [ 0.931, 0.463, 0.316 ],
        hsl: [ 14.3, 0.817, 0.624 ],
        hsv: [ 14.3, 0.661, 0.931],
    }, {
        hash: "#FEF888",
        rgb: [ 0.998, 0.974, 0.532 ],
        hsl: [ 56.9, 0.991, 0.765 ],
        hsv: [ 56.9, 0.467, 0.998],
    }, {
        rgb: [ 0.099, 0.795, 0.591 ],
        hsl: [ 162.4, 0.779, 0.447 ],
        hsv: [ 162.4, 0.875, 0.795],
    }, {
        hash: "#362698",
        rgb: [ 0.211, 0.149, 0.597 ],
        hsl: [ 248.3, 0.601, 0.373 ],
        hsv: [ 248.3, 0.750, 0.597],
    }, {
        hash: "#7E7EB8",
        rgb: [ 0.495, 0.493, 0.721 ],
        hsl: [ 240.5, 0.290, 0.607 ],
        hsv: [ 240.5, 0.316, 0.721],
    }
];

describe('Utils', function() {
    it("should convert colours", function() {
        for (var i = 0; i < testMap.length; i++) {
            var tm = testMap[i];
            var rgb = new RGBA(tm.rgb);
            assert.equal(tm.rgb.r, rgb[0]);
            assert.equal(tm.rgb.g, rgb[1]);
            assert.equal(tm.rgb.b, rgb[2]);
            var hsv = rgb.toHS("V");
            assert.equal(tm.hsv[0], hsv[0]);
            assert.equal(tm.hsv[1], hsv[1]);
            assert.equal(tm.hsv[2], hsv[2]);
            var hsl = rgb.toHS("L");
            assert.equal(tm.hsl[0], hsl[0]);
            assert.equal(tm.hsl[1], hsl[1]);
            assert.equal(tm.hsl[2], hsl[2]);
            var reco = RGBA.fromHS("V");
            assert.equals(rgb, reco);
            reco = RGBA.fromHS("L");
            assert.equals(rgb, reco);
        }
    });
});
