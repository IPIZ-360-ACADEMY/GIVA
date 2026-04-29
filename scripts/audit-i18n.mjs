import { readFileSync } from "fs";

const keysRaw = readFileSync("docs/all-i18n-keys-used.txt", "utf16le");
const keys = keysRaw.split(/\r?\n/).map(k => k.trim()).filter(k => k.includes("."));
const i18n = readFileSync("src/utils/i18n.js", "utf8");

const missing = keys.filter(k => !i18n.includes(`"${k}"`));
console.log(`Total keys: ${keys.length} | Missing: ${missing.length}`);
missing.forEach(k => console.log(` - ${k}`));
