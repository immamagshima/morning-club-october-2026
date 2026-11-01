import { cp, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const files = [
  "index.html",
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
