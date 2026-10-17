// Blocks a publish when the built file or the repo breaks a hard rule. Run by `npm run check`.
// 1. size budget  2. nothing loads from the network (the artifact frame blocks it anyway)
// 3. none of the names that must stay anonymous, anywhere in the repo
// 4. the former employer's name stays out of the app, its sources and its tests (Nico's framing:
//    "inspired by models I built in consulting"); the private plan in docs/ may name it
// 5. the artifact-shaped file exists and is sane
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const MAX_BYTES = 3 * 1024 * 1024;
// Stored only as SHA-256 of the lowercase word or word pair, so this file can't leak them if the
// repo goes public. Same list as Cut-in: two interviewees and their employers.
const ANONYMOUS = new Set([
  "31f8e0bc67bce7b4809d39a1e8002e9896b16af00e6bdda51540f9bcd6833c97",
  "c8711d542164f6907cf935b509da989db272e2309ce2ee77d9e6637a6ae6d599",
  "60e5f55a1e11c46f160b87ef8ba7d289ed5b7c162a8588f7ce71d2dce9e6e486",
  "09e47d7bf4dab7810128c83abf2eb3e1103775c3818f5bee37971dafaf14882a",
  "9c15e816069946fbd20bed0935dd9d8e34d64034d657a2b852f8b66ad91af5b6",
  "3410a9c7364d54845815597dff06a96ae9c38f5e27acab05549a243d7c249cdf",
]);
// The former employer, kept out of everything a viewer or a public reader of the code could see.
const NOT_IN_APP = new Set(["3e808ece8227f5d4fda47690aed90895fc56881b6335d39ace7e8078b240164c"]);

const sha = (s) => createHash("sha256").update(s).digest("hex");
function hits(text, hashes) {
  const words = text.toLowerCase().match(/[a-z0-9äöüß]+/g) ?? [];
  const found = new Set();
  for (let i = 0; i < words.length; i++) {
    if (hashes.has(sha(words[i]))) found.add(`word #${i}`);
    if (i + 1 < words.length && hashes.has(sha(`${words[i]} ${words[i + 1]}`)))
      found.add(`pair #${i}`);
  }
  return [...found];
}
const NETWORK = [
  /<(?:script|img|link|iframe|source|video|audio)\b[^>]*\b(?:src|href)="https?:\/\//i,
  /url\(\s*['"]?https?:\/\//i,
  /@import\s+url\(\s*['"]?https?:/i,
];

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const isBinary = (f) => /\.(woff2?|png|jpg|gif|ico|pdf|xlsx)$/i.test(f);

const failures = [];
const built = ["dist/index.html", "dist/artifact.html"];
for (const f of built) {
  if (!existsSync(f)) {
    failures.push(`${f} missing (run the build and scripts/to-artifact.mjs)`);
    continue;
  }
  const text = readFileSync(f, "utf8");
  const bytes = Buffer.byteLength(text);
  if (bytes > MAX_BYTES) failures.push(`${f}: ${bytes} bytes > ${MAX_BYTES}`);
  for (const re of NETWORK) if (re.test(text)) failures.push(`${f}: network load matches ${re}`);
  if (hits(text, ANONYMOUS).length) failures.push(`${f}: contains a name that must stay anonymous`);
  if (hits(text, NOT_IN_APP).length) failures.push(`${f}: names the former employer`);
}

const rootDocs = ["CLAUDE.md", "README.md", "CHANGELOG.md", "CONTEXT.md"];
// Anonymity: everything in the repo, since any of it may one day be public.
for (const f of [
  ...walk("src"),
  ...walk("docs"),
  ...walk("tests"),
  ...walk("scripts"),
  ...rootDocs,
]) {
  if (!existsSync(f) || isBinary(f) || f.endsWith("prepublish-check.mjs")) continue;
  if (hits(readFileSync(f, "utf8"), ANONYMOUS).length)
    failures.push(`${f}: contains a name that must stay anonymous`);
}
// Former employer: the app, its tests and the root docs. docs/ (the private plan) may name it.
for (const f of [...walk("src"), ...walk("tests"), ...rootDocs]) {
  if (!existsSync(f) || isBinary(f)) continue;
  if (hits(readFileSync(f, "utf8"), NOT_IN_APP).length)
    failures.push(`${f}: names the former employer`);
}

if (existsSync("dist/artifact.html")) {
  const a = readFileSync("dist/artifact.html", "utf8");
  if (/<!doctype|<html|<head|<body/i.test(a))
    failures.push("artifact.html still has document skeleton tags");
  if (!/^<title>/.test(a)) failures.push("artifact.html must start with <title>");
}
if (failures.length) {
  console.error("prepublish-check FAILED:\n- " + failures.join("\n- "));
  process.exit(1);
}
console.log(`prepublish-check ok (${built.join(", ")})`);
