/*eslint-env node, mocha */

if (typeof assert === "undefined")
    assert = require("chai").assert;
if (typeof Translator === "undefined")
    Translator = require("../src/Translator");
if (typeof document === "undefined")
    require('jsdom-global')();

const server_url = "http://cdot.github.io/Squirrel/locale/";

const TRANSLATIONS = {
    pc: {
        Fat: { m: 1, s: "Stocky"},
        Skinny: { m: 1, s: "Slim" },
        "$1 tomahto$?($1!=1,s,)": { m: 1, s: "$1 tomayto$?($1!=1,s,)" },
        "<em>Stupid</em>": { m: 1, s: "<a name='silly'>Twit</a>" }
    }
};

describe("Translator", function() {
    it("Works with simple English", function() {
        Translator.init({
            translations: TRANSLATIONS
        });
        Translator.setLanguage("pc").then(() => {
            assert.equal(Translator.tx("Fat"), "Stocky");
            assert.equal(Translator.tx("Skinny"), "Slim");
        });
    });
    
    it("Works with templates", function() {
        Translator.init({
            translations: TRANSLATIONS
        });
        Translator.setLanguage("pc").then(() => {
            assert.equal(Translator.tx("$1 tomahto$?($1!=1,s,)", 1), "1 tomayto");
            assert.equal(Translator.tx("$1 tomahto$?($1!=1,s,)", 2), "2 tomaytos");
        });
    });

    it("Works in an English DOM", function() {
        Translator.init({url:server_url});
        var en = '<div class="TX_html">Stupid</div>';
        document.body.innerHTML = en;
        return Translator.setLanguage("en", document)
            .then(() => {
                assert.equal(document.body.innerHTML, en);
            });
    });

    it("Works in a translated DOM", function() {
        Translator.init({
            translations: TRANSLATIONS
        });
        var en = '<div class="TX_title TX_text" title="Fat">Skinny</div>';
        var pc = '<div class="TX_title TX_text" title="Stocky">Slim</div>'
        document.body.innerHTML = en;
        return Translator.setLanguage("pc", document)
            .then(() => {
                assert.equal(document.body.innerHTML, pc);
            });
    });
    
    it("Translates HTML", function() {
        Translator.init({
            translations: TRANSLATIONS
        });
        var en = '<div class="TX_html"><em>Stupid</em></div>';
        var pc = '<div class="TX_html"><a name="silly">Twit</a></div>'
        document.body.innerHTML = en;
        return Translator.setLanguage("pc", document)
            .then(() => {
                assert.equal(document.body.innerHTML, pc);
            });
    });
    
    it("Can change language", function() {
        Translator.init({url:server_url});
        var en = '<div class="TX_title TX_text" title="Add">Length</div>';
        var fr = '<div class="TX_title TX_text" title="Ajouter">Longueur</div>'
        var de = '<div class="TX_title TX_text" title="Hinzufügen">Länge</div>'
        document.body.innerHTML = en;
        return Translator
            .setLanguage("fr", document)
            .then(() => {
                assert.equal(document.body.innerHTML, fr);
            })
            .then(() => {
                return Translator.setLanguage("de", document);
            })
            .then(() => {
                assert.equal(document.body.innerHTML, de);
            })
            .then(() => {
                return Translator.setLanguage("fr", document);
            })
            .then(() => {
                assert.equal(document.body.innerHTML, fr);
            })
            .then(() => {
                return Translator.setLanguage("en", document);
            })
            .then(() => {
                assert.equal(document.body.innerHTML, en);
            })

    });
});
