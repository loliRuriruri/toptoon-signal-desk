import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const outputRoot = resolve(projectRoot, "dist-public");

if (outputRoot !== `${projectRoot}${sep}dist-public`) {
  throw new Error("Refusing to prepare an unexpected public output path");
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

for (const filename of ["index.html", "app.js", "styles.css"]) {
  await cp(join(projectRoot, filename), join(outputRoot, filename));
}
await cp(join(projectRoot, "public-worker.js"), join(outputRoot, "_worker.js"));

const characterData = JSON.parse(await readFile(join(projectRoot, "data", "characters.json"), "utf8"));
const marketBySite = { KR: "kr", JP: "jp", GLOBAL: "global", TW: "tw" };
const imageMap = {};
const copiedImages = new Set();
await mkdir(join(outputRoot, "assets", "shared"), { recursive: true });
for (const record of characterData.records || []) {
  const market = marketBySite[record.site] || "global";
  const filename = String(record.local_image || "").split("/").pop();
  if (!filename) continue;
  const source = join(projectRoot, "assets", market, filename);
  const bytes = await readFile(source);
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 20);
  const publicName = `${hash}${extname(filename).toLowerCase()}`;
  const publicPath = `assets/shared/${publicName}`;
  imageMap[`${market}/${filename}`] = publicPath;
  if (!copiedImages.has(publicName)) {
    await writeFile(join(outputRoot, publicPath), bytes);
    copiedImages.add(publicName);
  }
}
await mkdir(join(outputRoot, "data"), { recursive: true });
for (const filename of ["characters.js", "character-activity.js", "stats.js", "validation.js", "official-signals.js", "ai-diagnosis.js"]) {
  await cp(join(projectRoot, "data", filename), join(outputRoot, "data", filename));
}

await writeFile(join(outputRoot, "_headers"), `/*
  Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'
  Referrer-Policy: strict-origin-when-cross-origin
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()

/assets/*
  Cache-Control: public, max-age=604800

/data/*
  Cache-Control: public, max-age=300
`, "utf8");

await writeFile(join(outputRoot, "robots.txt"), "User-agent: *\nAllow: /\n", "utf8");

await writeFile(join(outputRoot, "data", "image-map.js"), `window.TOPTOON_IMAGE_MAP=${JSON.stringify(imageMap)};\n`, "utf8");

const indexPath = join(outputRoot, "index.html");
const index = await readFile(indexPath, "utf8");
if (!index.includes("TOPTOON CHAT TRACKER")) throw new Error("Public index validation failed");
const versionHash = createHash("sha256");
for (const filename of ["styles.css", "app.js", "data/stats.js", "data/validation.js", "data/official-signals.js", "data/ai-diagnosis.js", "data/character-activity.js", "data/characters.js", "data/image-map.js"]) {
  versionHash.update(await readFile(join(outputRoot, filename)));
}
const publicVersion = versionHash.digest("hex").slice(0, 12);
let versionedIndex = index.replace(
  '<script src="data/characters.js"></script>',
  '<script src="data/image-map.js"></script>\n    <script src="data/characters.js"></script>'
);
for (const asset of ["styles.css", "app.js", "data/stats.js", "data/validation.js", "data/official-signals.js", "data/ai-diagnosis.js", "data/character-activity.js", "data/image-map.js", "data/characters.js"]) {
  versionedIndex = versionedIndex.replaceAll(`="${asset}"`, `="${asset}?v=${publicVersion}"`);
}
await writeFile(indexPath, versionedIndex, "utf8");

console.log(`Public read-only build created: ${outputRoot} (${copiedImages.size} unique images, version ${publicVersion})`);
