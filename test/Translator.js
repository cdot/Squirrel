/* eslint-env node, mocha */
/* global Cookies:writable, document:writable */

if (typeof module !== "undefined") {
    requirejs = require('requirejs');
    let jsdom = require('jsdom');
	/*eslint-disable no-global-assign*/
    document = new jsdom.JSDOM('<!doctype html><html><body></body></html>');
    let window = document.window;
    global.document = window.document;
    global.window = window;

    global.jQuery = require('jquery')(window);
    global.$ = jQuery;
    global.Cookies = Cookies = {
        // TODO: save a .rc
        vals: {},
        get: (k) => {
            return Cookies.vals[k];
        },
        set: (k, v) => {
            Cookies.vals[k] = v;
        },
        remove: (k) => {
            delete Cookies.vals[k];
        }
    };
	/*eslint-enable no-global-assign*/
}

requirejs.config({
    baseUrl: ".."
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

requirejs(["js/Translator", "test/TestRunner"], function(Translator, TestRunner) {
    let tr = new TestRunner("Translator");
    let assert = tr.assert;

    tr.addTest("Works with simple English", function() {
        let TX = Translator.instance({
            translations: TRANSLATIONS,
            debug: console.debug
        });
        TX.language("pc").then(() => {
            assert.equal(TX.tx("Fat"), "Stocky");
            assert.equal(TX.tx("Skinny"), "Slim");
        });
    });

    tr.addTest("Works with templates", function() {
        let TX = Translator.instance({
            translations: TRANSLATIONS
        });
        TX.language("pc").then(() => {
            assert.equal(TX.tx("$1 tomahto$?($1!=1,s,)", 1), "1 tomayto");
            assert.equal(TX.tx("$1 tomahto$?($1!=1,s,)", 2), "2 tomaytos");
        });
    });

    tr.addTest("Works in an English DOM", function() {
        let TX = Translator.instance({url:server_url});
        let en = '<div class="TX_html">Stupid</div>';
        document.body.innerHTML = en;
        return TX.language("en", document)
        .then(() => {
            assert.equal(document.body.innerHTML, en);
        });
    });

    tr.addTest("Works in a translated DOM", function() {
        let TX = Translator.instance({
            translations: TRANSLATIONS
        });
        let en = '<div class="TX_title TX_text" title="Fat">Skinny</div>';
        let pc = '<div class="TX_title TX_text" title="Stocky">Slim</div>'
        document.body.innerHTML = en;
        return TX.language("pc", document)
        .then(() => {
            assert.equal(document.body.innerHTML, pc);
        });
    });

    tr.addTest("Translates HTML", function() {
        let TX = Translator.instance({
            translations: TRANSLATIONS
        });
        let en = '<div class="TX_html"><em>Stupid</em></div>';
        let pc = '<div class="TX_html"><a name="silly">Twit</a></div>'
        document.body.innerHTML = en;
        return TX.language("pc", document)
        .then(() => {
            assert.equal(document.body.innerHTML, pc);
        });
    });

    tr.addTest("Can change language", function() {
        let TX = Translator.instance({url:server_url});
        let en = '<div class="TX_title TX_text" title="Add">Length</div>';
        let fr = '<div class="TX_title TX_text" title="Ajouter">Longueur</div>'
        let de = '<div class="TX_title TX_text" title="Hinzufügen">Länge</div>'
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

    tr.run();
});
