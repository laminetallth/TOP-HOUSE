// Build senza dipendenze esterne (solo il compilatore TypeScript).
//  dist/                  → app modulare (moduli ES nativi) da pubblicare su hosting statico
//  dist-single/my-empire.html → un unico file autosufficiente, comodo per anteprime e uso offline
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const tsc = (args) => execSync(`tsc ${args}`, { stdio: 'inherit' });
const html = readFileSync('index.html', 'utf8');
const css = readFileSync('src/styles.css', 'utf8');

// 1) Build modulare
rmSync('dist', { recursive: true, force: true });
tsc('-p tsconfig.json');
cpSync('public', 'dist', { recursive: true });
writeFileSync('dist/styles.css', css);
writeFileSync('dist/index.html', html
  .replace('<!--STYLES-->', '<link rel="stylesheet" href="styles.css" />')
  .replace('<!--SCRIPT-->', '<script type="module" src="js/main.js"></script>'));

// 2) File singolo: tutti i moduli in un bundle AMD con un caricatore minimo in linea
rmSync('dist-single', { recursive: true, force: true });
mkdirSync('dist-single', { recursive: true });
tsc('--project tsconfig.json --module amd --moduleResolution node10 --outFile dist-single/bundle.js --sourceMap false --removeComments --outDir null --ignoreDeprecations 6.0');
const bundle = readFileSync('dist-single/bundle.js', 'utf8');
const loader = `var __defs={},__mods={};function define(n,d,f){__defs[n]={d:d,f:f};}
function __require(n){if(__mods[n])return __mods[n].exports;var def=__defs[n];if(!def)throw new Error('Modulo mancante: '+n);var m={exports:{}};__mods[n]=m;
var a=def.d.map(function(x){return x==='require'?__require:x==='exports'?m.exports:__require(x);});var r=def.f.apply(null,a);if(r!==undefined)m.exports=r;return m.exports;}`;
const icon = readFileSync('public/icon.svg', 'utf8');
const single = html
  .replace('<link rel="icon" href="icon.svg" type="image/svg+xml" />', `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(icon)}" />`)
  .replace('<link rel="manifest" href="manifest.webmanifest" />\n', '')
  .replace('<!--STYLES-->', () => `<style>\n${css}\n</style>`)
  // Funzioni di sostituzione: evitano che le sequenze "$" del codice vengano interpretate.
  .replace('<!--SCRIPT-->', () => `<script>\n${loader}\n${bundle.replace(/<\/script/gi, '<\\/script')}\n__require('main');\n</script>`);
writeFileSync('dist-single/my-empire.html', single);
rmSync('dist-single/bundle.js');
console.log('Build completata: dist/ e dist-single/my-empire.html');
