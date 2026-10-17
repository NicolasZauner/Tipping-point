// Turns the Vite single-file build into the shape the claude.ai Artifact tool publishes:
// the platform wraps the file in its own <!doctype><html><head><body> skeleton, so we ship
// only <title>, metas, <style> and the content. Module scripts move to the end of the content
// (they are deferred anyway) so they run after #root exists.
// Usage: node scripts/to-artifact.mjs [in=dist/index.html] [out=dist/artifact.html]
import { readFileSync, writeFileSync } from "node:fs";

const [inPath = "dist/index.html", outPath = "dist/artifact.html"] = process.argv.slice(2);
const html = readFileSync(inPath, "utf8");

const head = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1];
const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1];
if (head === undefined || body === undefined) throw new Error(`${inPath}: no <head> or <body>`);

const take = (re, src) => [...src.matchAll(re)].map((m) => m[0]);
const title = take(/<title>[\s\S]*?<\/title>/gi, head);
const metas = take(/<meta\s[^>]*name="(?:claude:[^"]+|description)"[^>]*>/gi, head);
const styles = take(/<style[^>]*>[\s\S]*?<\/style>/gi, head);
const scripts = take(/<script[^>]*>[\s\S]*?<\/script>/gi, head);
if (title.length !== 1) throw new Error("expected exactly one <title>");
if (scripts.length === 0) throw new Error("expected the bundled module script in <head>");

const out = [...title, ...metas, ...styles, body.trim(), ...scripts].join("\n") + "\n";
writeFileSync(outPath, out);
console.log(`${outPath}: ${(out.length / 1024).toFixed(1)} kB`);
