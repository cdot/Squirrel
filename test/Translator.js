/*eslint-env node, mocha */

if (typeof module !== "undefined") {
    requirejs = require('requirejs');
    require('jsdom-global')();
}

requirejs.config({
    baseUrl: "..",
    paths: {
        js: "src",
        jsjq: "src/jquery",
        test: "test"
    }
});

const server_url = "http://cdot.github.io/Squirrel/locale/";

const TRANSLATIONS = {
    pc: {
        Fat: { m: 1, s: "Stocky"},
        Skinny: { m: 1, s: "Slim" },
        "$1 tomahto$?($1!=1,s,)": { m: 1, s: "$1 tomayto$?($1!=1,s,)" },
        "<em>Stupid</em>": { m: 1, s: "<a name='silly'>Twit</a>" }
    }
};

var Translator;

describe("Translator", function() {
    before(function(done) {
        return requirejs(["js/Translator", "chai"], function(m, chai) {
            Translator = m;
            assert = chai.assert;
            done();
        });
    });

    it("Works with simple English", function() {
        let TX = Translator.instance({
            translations: TRANSLATIONS,
            debug: console.debug
        });
        TX.language("pc").then(() => {
            assert.equal(TX.tx("Fat"), "Stocky");
            assert.equal(TX.tx("Skinny"), "Slim");
        });
    });
    
    it("Works with templates", function() {
        let TX = Translator.instance({
            translations: TRANSLATIONS
        });
        TX.language("pc").then(() => {
            assert.equal(TX.tx("$1 tomahto$?($1!=1,s,)", 1), "1 tomayto");
            assert.equal(TX.tx("$1 tomahto$?($1!=1,s,)", 2), "2 tomaytos");
        });
    });

    it("Works in an English DOM", function() {
        let TX = Translator.instance({url:server_url});
        var en = '<div class="TX_html">Stupid</div>';
        document.body.innerHTML = en;
        return TX.language("en", document)
            .then(() => {
                assert.equal(document.body.innerHTML, en);
            });
    });

    it("Works in a translated DOM", function() {
        let TX = Translator.instance({
            translations: TRANSLATIONS
        });
        var en = '<div class="TX_title TX_text" title="Fat">Skinny</div>';
        var pc = '<div class="TX_title TX_text" title="Stocky">Slim</div>'
        document.body.innerHTML = en;
        return TX.language("pc", document)
            .then(() => {
                assert.equal(document.body.innerHTML, pc);
            });
    });
    
    it("Translates HTML", function() {
        let TX = Translator.instance({
            translations: TRANSLATIONS
        });
        var en = '<div class="TX_html"><em>Stupid</em></div>';
        var pc = '<div class="TX_html"><a name="silly">Twit</a></div>'
        document.body.innerHTML = en;
        return TX.language("pc", document)
            .then(() => {
                assert.equal(document.body.innerHTML, pc);
            });
    });

    it("Can change language", function() {
        let TX = Translator.instance({url:server_url});
        var en = '<div class="TX_title TX_text" title="Add">Length</div>';
        var fr = '<div class="TX_title TX_text" title="Ajouter">Longueur</div>'
        var de = '<div class="TX_title TX_text" title="Hinzufügen">Länge</div>'
        document.body.innerHTML = en;
        return TX
            .language("fr", document)
            .then(() => {
                assert.equal(document.body.innerHTML, fr);
            })
            .then(() => {
                return TX.language("de", document);
            })
            .then(() => {
                assert.equal(document.body.innerHTML, de);
            })
            .then(() => {
                return TX.language("fr", document);
            })
            .then(() => {
                assert.equal(document.body.innerHTML, fr);
            })
            .then(() => {
                return TX.language("en", document);
            })
            .then(() => {
                assert.equal(document.body.innerHTML, en);
            })

    });
});
