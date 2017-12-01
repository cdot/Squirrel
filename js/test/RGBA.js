var assert = require('chai').assert;
var RGBA = require("../RGBA");

// Sample colours, from https://en.wikipedia.org/wiki/HSL_and_HSV
var testMap = [
    {
        hash: "#FFFFFF",
        complement: "#FFFFFF",
        inverse: "#000000",
        rgb: [ 1.000, 1.000, 1.000 ],
        hsl: [ 0.0, 0.000, 1.000 ],
        hsv: [ 0.0, 0.000, 1.000],
    }, {
        hash: "#808080",
        complement: "#808080",
        inverse: "#808080",
        rgb: [ 0.500, 0.500, 0.500 ],
        hsl: [ 0.0, 0.000, 0.500 ],
        hsv: [ 0.0, 0.000, 0.500],
    }, {
        hash: "#000000",
        complement: "#000000",
        inverse: "#FFFFFF",
        rgb: [ 0.000, 0.000, 0.000 ],
        hsl: [ 0.0, 0.000, 0.000 ],
        hsv: [ 0.0, 0.000, 0.000],
    }, {
        hash: "#FF0000",
        complement: "#00FFFF",
        inverse: "#00FFFF",
        rgb: [ 1.000, 0.000, 0.000 ],
        hsl: [ 0.0, 1.000, 0.500 ],
        hsv: [ 0.0, 1.000, 1.000],
    }, {
        hash: "#BFBF00",
        complement: "#0000BF",
        inverse: "#4040FF",
        rgb: [ 0.750, 0.750, 0.000 ],
        hsl: [ 60.0, 1.000, 0.375 ],
        hsv: [ 60.0, 1.000, 0.750],
    }, {
        hash: "#008000",
        complement: "#800080",
        inverse: "#FF80FF",
        rgb: [ 0.000, 0.500, 0.000 ],
        hsl: [ 120.0, 1.000, 0.250 ],
        hsv: [ 120.0, 1.000, 0.500],
    }, {
        hash: "#80FFFF",
        complement: "#FF8080",
        inverse: "#800000",
        rgb: [ 0.500, 1.000, 1.000 ],
        hsl: [ 180.0, 1.000, 0.750 ],
        hsv: [ 180.0, 0.500, 1.000],
    }, {
        hash: "#8080FF",
        complement: "#FFFF80",
        inverse: "#808000",
        rgb: [ 0.500, 0.500, 1.000 ],
        hsl: [ 240.0, 1.000, 0.750 ],
        hsv: [ 240.0, 0.500, 1.000],
    }, {
        hash: "#BF40BF",
        complement: "#40BF40",
        inverse: "#40BF40",
        rgb: [ 0.750, 0.250, 0.750 ],
        hsl: [ 300.0, 0.500, 0.500 ],
        hsv: [ 300.0, 0.667, 0.750],
    }, {
        hash: "#A0A424",
        complement: "#2824A4",
        inverse: "#5F5BDB",
        rgb: [ 0.628, 0.643, 0.142 ],
        hsl: [ 61.8, 0.638, 0.393 ],
        hsv: [ 61.8, 0.779, 0.643],
    }, {
        hash: "#411BEA",
        complement: "#C4EA1B",
        inverse: "#BEE415",
        rgb: [ 0.255, 0.104, 0.918 ],
        hsl: [ 251.1, 0.832, 0.511 ],
        hsv: [ 251.1, 0.887, 0.918],
    }, {
        hash: "#1EAC41",
        complement: "#AC1E89",
        inverse: "#E153BE",
        rgb: [ 0.116, 0.675, 0.255 ],
        hsl: [ 134.9, 0.707, 0.396 ],
        hsv: [ 134.9, 0.828, 0.675],
    }, {
        hash: "#F0C80E",
        complement: "#0E35F0",
        inverse: "#0F37F1",
        rgb: [ 0.941, 0.785, 0.053 ],
        hsl: [ 49.5, 0.893, 0.497 ],
        hsv: [ 49.5, 0.944, 0.941],
    }, {
        hash: "#B430E5",
        complement: "#61E530",
        inverse: "#4BCF1A",
        rgb: [ 0.704, 0.187, 0.897 ],
        hsl: [ 283.7, 0.775, 0.542 ],
        hsv: [ 283.7, 0.792, 0.897],
    }, {
        hash: "#ED7651",
        complement: "#51C8ED",
        inverse: "#1289AE",
        rgb: [ 0.931, 0.463, 0.316 ],
        hsl: [ 14.3, 0.817, 0.624 ],
        hsv: [ 14.3, 0.661, 0.931],
    }, {
        hash: "#FEF888",
        complement: "#888EFE",
        inverse: "#010777",
        rgb: [ 0.998, 0.974, 0.532 ],
        hsl: [ 56.9, 0.991, 0.765 ],
        hsv: [ 56.9, 0.467, 0.998],
    }, {
        hash: "#19CB97",
        complement: "#CB194D",
        inverse: "#E63468",
        rgb: [ 0.099, 0.795, 0.591 ],
        hsl: [ 162.4, 0.779, 0.447 ],
        hsv: [ 162.4, 0.875, 0.795],
    }, {
        hash: "#362698",
        complement: "#889826",
        inverse: "#C9D967",
        rgb: [ 0.211, 0.149, 0.597 ],
        hsl: [ 248.3, 0.601, 0.373 ],
        hsv: [ 248.3, 0.750, 0.597],
    }, {
        hash: "#7E7EB8",
        complement: "#B7B87E",
        inverse: "#818147",
        rgb: [ 0.495, 0.493, 0.721 ],
        hsl: [ 240.5, 0.290, 0.607 ],
        hsv: [ 240.5, 0.316, 0.721],
    }
];

assert.nearly = function(a, b) {
    var x = a - b;
    if (x < 0) x = -x;
    assert(x < 0.1, b + " != " + a);
}

describe('Utils', function() {
    function testIt(i) {
        it("should convert " + testMap[i].hash, function() {
            //console.log(i + " " + testMap[i].hash);
            var tm = testMap[i];
            var rgb = new RGBA(tm.rgb[0], tm.rgb[1], tm.rgb[2]);
            assert.equal(tm.hash, rgb.toString());
            
            var hrgb = new RGBA(tm.hash);
            assert.equal(tm.rgb.r, rgb[0]);
            assert.equal(tm.rgb.g, rgb[1]);
            assert.equal(tm.rgb.b, rgb[2]);
                
            var hsv = rgb.toHSV();
            assert.nearly(tm.hsv[0], hsv[0]);
            assert.nearly(tm.hsv[1], hsv[1]);
            assert.nearly(tm.hsv[2], hsv[2]);

            var reco = RGBA.fromHSV(tm.hsv[0], tm.hsv[1], tm.hsv[2]);
            assert.nearly(rgb.r, reco.r);
            assert.nearly(rgb.g, reco.g);
            assert.nearly(rgb.b, reco.b);

            reco = RGBA.fromHSV(tm.hsv);
            assert.nearly(rgb.r, reco.r);
            assert.nearly(rgb.g, reco.g);
            assert.nearly(rgb.b, reco.b);

            var hsl = rgb.toHSL();
            assert.nearly(tm.hsl[0], hsl[0]);
            assert.nearly(tm.hsl[1], hsl[1]);
            assert.nearly(tm.hsl[2], hsl[2]);
            reco = RGBA.fromHSL(tm.hsl[0], tm.hsl[1], tm.hsl[2]);
            assert.nearly(rgb.r, reco.r);
            assert.nearly(rgb.g, reco.g);
            assert.nearly(rgb.b, reco.b);
            
            reco = RGBA.fromHSL(tm.hsl);
            assert.nearly(rgb.r, reco.r);
            assert.nearly(rgb.g, reco.g);
            assert.nearly(rgb.b, reco.b);

            var comp = rgb.complement();
            var inv = rgb.inverse();
            console.log(rgb.toString() + "~" + comp.toString()
                        + "~" +inv.toString());
            assert.equal(tm.complement, comp.toString());
            assert.equal(tm.inverse, inv.toString());

            var comp = rgb.complement();
            assert.equal(tm.complement, comp.toString());

            rgb.a = 0.5;
            assert.equal("rgba(" +
                         Math.round(tm.rgb[0] * 255) + "," +
                         Math.round(tm.rgb[1] * 255) + "," +
                         Math.round(tm.rgb[2] * 255) + "," +
                         "0.5)", rgb.toString());

            rgb = new RGBA(rgb.toString());
            assert.nearly(rgb.r, tm.rgb[0]);
            assert.nearly(rgb.g, tm.rgb[1]);
            assert.nearly(rgb.b, tm.rgb[2]);
            assert.equal(rgb.a, 0.5);

            rgb = new RGBA(tm.rgb);
            assert.equal(tm.rgb.r, rgb[0]);
            assert.equal(tm.rgb.g, rgb[1]);
            assert.equal(tm.rgb.b, rgb[2]);

        });
    }
    
    for (var i = 0; i < testMap.length; i++) {
        testIt(i);
    }

    it("should parse hsl", function() {
        var hsl = "hsl(155, 0.1, 50%)";
        var rgb = new RGBA(hsl);
        assert.equal("#738C82", rgb.toString());
    });

    it("should parse hsla", function() {
        var hsl = "hsla(155, 10%, 0.5, 0.3)";
        var rgb = new RGBA(hsl);
        console.log(rgb.toString());
        assert.equal("rgba(115,140,130,0.3)", rgb.toString());
    });
});
