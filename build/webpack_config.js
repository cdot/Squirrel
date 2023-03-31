// Base webpack config, shared by all packed modules
import path from "path";
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import webpack from "webpack";
import { promises as fs } from "fs";

function copyFile(from, to) {
  const a_from = path.normalize(path.join(__dirname, from));
  const a_to = path.normalize(path.join(__dirname, to));
  return fs.cp(a_from, a_to, {
    recursive: true,
    force: true,
    // filter: f => { console.debug("copy", f); return true; },
    dereference: true
  })
  .catch(e => {
    // cp works, but throws all sorts of wierd errors for no
    // apparent reason before completing.
    console.error("wierd", from, e);
  });
}

function relink(from, to, content) {
  const re = new RegExp(`(<link[^>]*href=")${from}`, "g");
  return content.replace(
    re,
    (m, preamble) => `${preamble}${to}`);
}

function processHTML(html) {
  return fs.readFile(`${__dirname}/../${html}.html`)
  .then(content => {
    content = content.toString();

    // Strip out the importmap, not needed any more
    content = content.replace(/<script type="importmap".*?<\/script>/, "");

    content = relink("../node_modules/jquery-ui/dist/themes",
                     "../dist/css/themes",
                     content);

    content = content.replace(
      /src="src\/(?:[a-z/]*\/)([a-z]+\.js")/,
      'src="./$1');

    return fs.writeFile(`${__dirname}/../dist/${html}.html`, content);
  });
}

copyFile("../css", "../dist/css")
.then(() => copyFile("../node_modules/jquery-ui/dist/themes", "../dist/css/themes"))
.then(() => copyFile("../html", "../dist/html"))
.then(() => copyFile("../images", "../dist/images"))
.then(() => copyFile("../i18n", "../dist/i18n"))
.then(() => processHTML("index", "main"))
.then(() => processHTML("help", "help"));

export default {
  entry: {
    main: `${__dirname}/../src/browser/main.js`,
    help: `${__dirname}/../src/browser/help.js`
  },
  mode: "production",
  output: {
    path: `${__dirname}/../dist`,
    filename: "[name].js",
    globalObject: "window"
  },
  resolve: {
    extensions: [ '.js' ],
      alias: {
        "pngjs": path.resolve(
          __dirname, "../node_modules/pngjs/browser.js"),
        "ui-contextmenu": path.resolve(
          __dirname, "../node_modules/ui-contextmenu/jquery.ui-contextmenu.js")
      }
  },
  plugins: [
    new webpack.ProvidePlugin({
      $: 'jquery',
      jQuery: 'jquery'
    }),
    new webpack.IgnorePlugin({
      checkResource(resource) {
        // FileStore.js is server-side only
        return /FileStore\.js$/.test(resource);
      }
    })
  ]
}


