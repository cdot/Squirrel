/*Copyright (C) 2019-2022 The Xanado Project https://github.com/cdot/Xanado
License MIT. See README.md at the root of this distribution for full copyright
and license information. Author Crawford Currie http://c-dot.co.uk*/
/* eslint-env node */

/**
 * Check that strings occur in code and translations files
 * Pass the language code of any single language to check (qqq
 * and en are always checked)
 */
const requirejs = require("requirejs");

requirejs.config({
  baseUrl: `${__dirname}/..`,
  nodeRequire: require
});

const readline = require('readline/promises');

requirejs([
  "fs", "path"
], (
  fs, Path
) => {

  const Fs = fs.promises;

  const basePath = Path.normalize(Path.join(__dirname, ".."));

  // Map language code (or qqq) to ids found in that
  // language file. ids map to the language translation
  // @type {Object.<string,Object<string,>>}
  const strings = {};

  // @type {Object.<string, Object.<string,boolean>>}
  // map string to a set of files where it was found.
  // Seed with @metadata which is
  // always in .json files
  const found_in_code = { "@metadata": "all .json" };
  // map file path to contents
  const fileContents = {};

  // Indexed on string ID, map to set of types identified for it from
  // usages in code
  const types = {};

  // Add string to found list
  function addID(id, file, type) {
    if (!found_in_code[id])
      found_in_code[id] = {};
    found_in_code[id][file] = type;

    if (!types[id])
      types[id] = [];
    if (!(type in types[id]))
        types[id].push(type);
  }

  // Recursively load all files with given extension into fileContents
  // return a promise that resolves to a flat list of files loaded
  function load(file, ext) {
    if (Array.isArray(file)) {
      return Promise.all(file.map(f => load(f, ext)))
      .then(files => files.flat());
    }
    if (ext.test(file)) {
      return Fs.readFile(file)
      .then(buff => fileContents[file] = buff.toString())
      .then(() => [ file ]);
    }
    return Fs.readdir(file)
    .then(files => files.filter(f => !/^#/.test(f)))
    .then(files => load(files.map(f => Path.join(file, f)), ext))
    .then(files => files.flat())
    .catch(e => []);
  }

  // Scan file for occurrences of re in the given files
  // and add them to found_in_code list
  function scan(files, re, id_idx, type_idx) {
    let m;
    for (const file of files) {
      while ((m = re.exec(fileContents[file]))) {
        if (!m[id_idx])
          throw Error(m + " in " + file);
        const type = type_idx ? m[type_idx] : '*';
        const id = m[id_idx].replace(/^\[.*\]/, "");
        addID(id, file, type);
      }
    }
  }

  // check the paramers of string 'id' match in qqqString and the langString
  function checkParameters(id, qqqString, langString, mess) {
    if (/^_.*_$/.test(qqqString))
        return;
    let m, rea = /(\$\d+)/g;
    while ((m = rea.exec(qqqString))) {
      let p = m[1];
      const reb = new RegExp(`\\${p}([^\\d]|\$)`);
      if (!reb.test(langString))
        mess.push(`\t"${id}": ${p} not found in "${langString}"`);
    }
    while ((m = rea.exec(langString))) {
      let p = m[1];
      const reb = new RegExp(`\\${p}([^\\d]|\$)`);
      if (!reb.test(qqqString))
        mess.push(`\t"${id}": ${p} unexpected in "${langString}"`);
    }
  }

  // Prompt to change the id of string
  // return -2 to abort the run, -1 to ask again, 0 for no change, 1
  // if the string was changed
  async function changeLabel(lang, id, probably) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    console.log(`${id}:${types[id]} = "${strings[lang][id]}" in ${lang}`);
    const q = `Change ID "${id}"${probably ? (' to "'+probably+'"') : ""} in ${lang}? `;
    return rl.question(q)
    .then(answer => {
      rl.close();
      switch (answer) {
      case "q": case "Q": // quit
        return -2;
      case undefined: case "": case "n": case "N":
        return 0;
      case 'y': case 'Y':
        if (probably) {
          answer = probably;
          break;
        }
      }
      if (strings[lang][answer]) {
        console.error(`${answer} is already used in ${lang}`);
        return -1; // conflict, try again
      }
      console.log(`\tChanging "${id}" to "${answer}" in ${lang}`);
      for (const lang in strings) {
        strings[lang][answer] = strings[lang][id];
        delete strings[lang][id];
      }
      const rs = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(["'])${rs}\\1`, "g");
      const filesChanged = {};
      for (const file in fileContents) {
        const m = /i18n\/([^#].*)\.json$/.exec(file);
        if (m) {
          // A i18n/.json file. If the label is changed in qqq, change it everywhere.
          // If it's just changing local to a single lang, only change it there
          if (lang === "qqq" || m[1] === lang) {
            fileContents[file] = JSON.stringify(strings[m[1]], null, "  ");
            filesChanged[file] = true;
          }
        } else if (lang === "qqq" && re.test(fileContents[file])) {
          // Another file, only change the label when qqq is changing
          fileContents[file] =
          fileContents[file].replace(re, `"${answer}"`);
          filesChanged[file] = true;
        }
      }
      return Promise.all(
        Object.keys(filesChanged)
        .map(file => Fs.writeFile(file, fileContents[file])))
      .then(() => 1);
    });
  }

  async function shortenIDs() {
    for (const id in strings.qqq) {
      if (id.length > 20 && !/^Types\./.test(strings.qqq[id])) {
        console.error(`"${id}" is too long for a label`);
        let go = -1;
        while (go === -1) {
          await changeLabel("qqq", id)
          .then(g => go = g);
        }
        if (go === -2)
          break;
      }
    }
  }

  const picked_lang = process.argv[2];
  
  Promise.all([
    // load with scan to extract strings
    load(["index.html", "help.html", "html"], /\.html$/)
    .then(files => {
      scan(files, /data-i18n(-\w+)?=(["'])(.*?)\2/g, 3, 1);
    }),
    load("js", /\.js$/)
    .then(files => scan(files, /\.i18n\s*\(\s*(["'])(.*?)\1/g, 2)),
    load("js", /\.js$/)
    .then(files => scan(files, /\/\*i18n\*\/\s*(["'])(.*?)\1/g, 2)),
    // just to get fileContents
    load("test", /\.ut$/),
    load("i18n", /\.json$/),
    Fs.readdir(Path.join(basePath, "i18n"))
    .then(lingos => Promise.all(
      lingos.filter(f => /\.json$/.test(f))
      .map(l => l.replace(/\.json$/, ""))
      .filter(l => (!picked_lang || (
        l === picked_lang || l === "qqq" || l === "en")))
      .map(lingo => Fs.readFile(Path.join(basePath, "i18n", `${lingo}.json`))
           .then(json => {
             strings[lingo] = JSON.parse(json);
           })
           .catch(e => {
             console.error(`Parse error reading ${lingo}`);
             throw e;
           }))))
  ])
  .then(async () => {   
    let qqqError = false;

    //for (const id of Object.keys(types).sort()) {
    //  console.log(`${id} = ${types[id]}`);
    //}

    // Check strings are in qqq and add to en if necessary
    for (const id of Object.keys(found_in_code).sort()) {
      if (!strings.qqq[id]) {
        console.error(`"${id}" not found in qqq`);
        strings.qqq[id] = id; // placeholder
        qqqError = true;
      }
    }

    // Check strings in qqq.json occur at least once in html/js
    for (const id of Object.keys(strings.qqq)
               .filter(s => !found_in_code[s])) {
      console.error(
        `"${id}" was found in qqq, but is not used in code`);
      delete strings.qqq[id];
      qqqError = true;
    }

    if (qqqError)
      throw Error("qqq.json must be correct");

    for (const lang of Object.keys(strings).filter(l => l !== "qqq")) {
      let mess = [];

      // Check that all keys in qqq are also in other language
      for (const id of Object.keys(strings.qqq)) {
        if (!strings[lang][id])
          mess.push(`\t${id}:${types[id]} : qqq "${strings.qqq[id]}" en "${strings.en[id]}"`);
      }
      if (mess.length > 0)
        console.error("----", lang, "is missing translations for:\n",
                      mess.join("\n"));

      // check that the same parameters are present in translated strings
      let messes = 0;
      for (const id of Object.keys(strings[lang])) {
        if (strings.qqq[id] && strings[lang][id]) {
          mess = [];
          checkParameters(id, strings.en[id], strings[lang][id], mess);
          if (mess.length > 0) {
            messes++;
            if (messes == 1)
              console.error("----", lang, "has parameter inconsistencies:");
            console.error(mess.join("\n"));
          }
        }
      }

      for (const id of Object.keys(strings[lang])) {
        if (!strings.qqq[id]) {
          console.error(`${lang}: id "${id}" was not found in qqq`);
          for (const en_id in strings.en) {
            if (strings.en[en_id] === id) {
              console.error(`${id} is the English translation for id ${en_id}`);
              await changeLabel(lang, id, en_id);
            }
          }
        }
      }

      if (lang !== "en") {
        mess = [];
        for (const id of Object.keys(strings[lang])) {
          if (strings[lang][id] == strings.en[id] && strings.en[id].length > 1)
            mess.push(`\t${id} : "${strings.en[id]}"`);
        }
        if (mess.length > 0)
          console.error(
            "----",
            lang,
            "has strings that are the same as in English\n",
            mess.join("\n"));
      }
    }
  })
  .then(() => shortenIDs());
});
