import { createHash } from "node:crypto";
import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const files = [
  "index.html",
  "selfie-capture.js",
  "inspiration.html",
  "inspiration.js",
  "inspiration.css",
  "inspiration-data.js",
  "intention-flow.js",
  "intention-flow.css",
  "keepsakes.html",
  "sound-library.js",
  "sound-library.css",
  "styles.css",
  "release.css",
  "minute-before.css",
  "app.js",
  "participant.html",
  "participant.js",
  "record-guides.html",
  "supplements-data.js",
  "supplements-library.html",
  "supplements-library.js",
  "youtube-library-data.js",
  "movement-wave.js",
  "closing-songs-data.js"
];

await mkdir(dist, { recursive: true });
for (const file of files) await cp(resolve(root, file), resolve(dist, file));
await cp(resolve(root, "assets"), resolve(dist, "assets"), { recursive: true });

const hashes = {};
async function hashDirectory(directory, prefix = "") {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix + entry.name;
    if (entry.isDirectory()) await hashDirectory(resolve(directory, entry.name), relative + "/");
    else if (relative !== "release-manifest.json") hashes[relative] = createHash("sha256").update(await readFile(resolve(directory, entry.name))).digest("hex");
  }
}
await hashDirectory(dist);
await writeFile(resolve(dist, "release-manifest.json"), JSON.stringify({release: "2026-11-03-inspiration-opening8", files: hashes}, null, 2));
