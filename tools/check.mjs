// Pre-release checks (`npm run check`, also run by the release workflows):
// every script parses, every JSON file is valid, and every NEONHUB.* key the
// code and templates use exists in lang/en.json.
import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
let failed = 0;
const fail = (msg) => {
  failed++;
  console.error(`✗ ${msg}`);
};

async function files(dir, ext) {
  const out = [];
  if (!existsSync(path.join(root, dir))) return out;
  for (const e of await readdir(path.join(root, dir), { withFileTypes: true, recursive: true })) {
    if (e.isFile() && e.name.endsWith(ext)) out.push(path.join(e.parentPath ?? e.path, e.name));
  }
  return out;
}

// Neon Hub, then the Full Borg module (full-borg/, its own Foundry module): each checked against its own lang file.
const MODULES = [
  { dir: "", prefix: "NEONHUB" },
  { dir: "full-borg", prefix: "FULLBORG" }
];
const scripts = [];
const json = [];
const used = new Set();
for (const { dir, prefix } of MODULES) {
  const at = (p) => path.join(dir, p);
  // Scripts parse
  const own = (await files(at("scripts"), ".js")).filter((f) => dir || !f.startsWith(path.join(root, "full-borg")));
  scripts.push(...own);
  for (const file of own) {
    try {
      execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
    } catch (err) {
      fail(`${path.relative(root, file)}: ${err.stderr?.toString().trim()}`);
    }
  }

  // JSON is valid
  const ownJson = [path.join(root, at("module.json")), ...(await files(at("lang"), ".json")), ...(await files(at("packs/_source"), ".json"))];
  json.push(...ownJson);
  for (const file of ownJson) {
    try {
      JSON.parse(await readFile(file, "utf8"));
    } catch (err) {
      fail(`${path.relative(root, file)}: ${err.message}`);
    }
  }

  // Localization keys used are defined (keys built at runtime end in "." and are skipped)
  const flat = (obj, p = "") => Object.entries(obj).flatMap(([k, v]) => (v && typeof v === "object" ? flat(v, `${p}${k}.`) : [`${p}${k}`]));
  const defined = new Set(flat(JSON.parse(await readFile(path.join(root, at("lang/en.json")), "utf8"))));
  const templates = await files(at("templates"), ".hbs");
  const re = new RegExp(`${prefix}\\.[A-Za-z0-9_.]*[A-Za-z0-9_]`, "g");
  for (const file of [...own, ...templates]) {
    const text = await readFile(file, "utf8");
    for (const m of text.matchAll(re)) {
      used.add(m[0]);
      const isPrefix = [...defined].some((d) => d.startsWith(`${m[0]}.`));
      if (!defined.has(m[0]) && !isPrefix) fail(`${at("lang/en.json")} is missing ${m[0]}`);
    }
    // ApplicationV2 handles these data-action names itself and never calls the app's own handler.
    const code = text.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
    for (const m of code.matchAll(/data-action="(close|tab|toggleControls)"/g)) fail(`${path.relative(root, file)}: data-action="${m[1]}" is reserved by ApplicationV2`);
  }
}

console.log(`${scripts.length} scripts, ${json.length} JSON files, ${used.size} localization keys checked`);
if (failed) {
  console.error(`${failed} problem(s)`);
  process.exit(1);
}
