/*@preserve Copyright (C) 2018-2019 Crawford Currie http://c-dot.co.uk license MIT*/
/* eslint-env browser,jquery */

/**
 * Support for running node modules in the browser. NOT USED for node.js
 * @param {type} file
 * @returns {require.cm}
 */
function require(file) {
    console.log("REQUIRE ", file);
    if (typeof module === "undefined")
        file = file.replace(/^\.\.\//g, "");
    if (!/\.js$/.test(file))
        file += ".js";
    return $.getScript(file).then((d) => {
        console.log(file, " returned");
        return d;
    }).catch((e) => {
        console.error("COULD NOT REQUIRE ", file);
        return $.getScript(file).then((d) => {
            console.log(file, " returned");
            return d;
        });
    });
}
