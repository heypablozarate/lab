import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const codeRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(codeRoot, "../../../..");
const payloadRoot = path.join(repoRoot, "public/lab/te-cuento-una-historia");
const META_FILES = new Set(["PROJECT-MANIFEST.json", "SHA256SUMS.txt"]);
const EXPECTED_AUDIO = [
  "assets/audio/city-traffic-walla-horns-v003.mp3",
  "assets/audio/climax-loop-source-403956f-44100.mp3",
  "assets/audio/pablo-loop-source-447615f-44100.mp3",
];
const REACTION_IDS = new Set([
  "rear_skyline_left", "rear_skyline_left_leaf_2", "rear_skyline_left_leaf_3", "rear_skyline_left_leaf_4",
  "rear_skyline_right", "rear_skyline_right_leaf_2", "rear_skyline_right_leaf_3", "rear_skyline_right_leaf_4",
  "mid_right_dome", "mid_right_terminal", "mid_right_church", "mid_right_church_leaf_2", "mid_right_church_leaf_3",
  "mid_left_clock_door", "mid_left_right_tower", "mid_left_hall_wedge", "front_deck_left",
  "front-left-train-fascia", "front-left-train-fascia-leaf-2", "front-left-train-fascia-leaf-3",
  "front-left-stair-west", "front-left-stair-west-leaf-2", "front-left-stair-east", "front-left-stair-east-leaf-2", "front-left-stair-east-leaf-3",
  "near-right-back-facades", "near-right-back-facades-leaf-2", "near-right-back-facades-leaf-3", "near-right-clock-tower",
  "obelisk_cross_left", "obelisk_cross", "far-left-03", "far-left-04", "far-right-03",
  "near-left-03-page-print", "near-left-04", "near-left-05", "near-left-06", "near-left-08", "taxi-page-print",
]);

async function walk(directory = payloadRoot) {
  const result = [];
  for (const name of await readdir(directory)) {
    const absolute = path.join(directory, name);
    const info = await stat(absolute);
    if (info.isDirectory()) result.push(...await walk(absolute));
    else result.push(path.relative(payloadRoot, absolute));
  }
  return result.sort();
}

const [manifest, corpus, hotspots, storyScenes, storyMedia, sumsText, files] = await Promise.all([
  readFile(path.join(payloadRoot, "PROJECT-MANIFEST.json"), "utf8").then(JSON.parse),
  readFile(path.join(payloadRoot, "data/corpus.json"), "utf8").then(JSON.parse),
  readFile(path.join(payloadRoot, "data/hotspots.json"), "utf8").then(JSON.parse),
  readFile(path.join(payloadRoot, "data/story-scenes.json"), "utf8").then(JSON.parse),
  readFile(path.join(payloadRoot, "data/story-media.json"), "utf8").then(JSON.parse),
  readFile(path.join(payloadRoot, "SHA256SUMS.txt"), "utf8"),
  walk(),
]);

const failures = [];
const payloadFiles = files.filter((file) => !META_FILES.has(file));
if (manifest.schema !== "te-cuento-una-historia/public-payload-v1") failures.push("manifest-schema");
if (manifest.scope !== "/public/lab/te-cuento-una-historia") failures.push("manifest-scope");
for (const stalePath of ["assets", "data", "rig-poses.json", "PROJECT-MANIFEST.json", "SHA256SUMS.txt"]) {
  try {
    await stat(path.join(codeRoot, stalePath));
    failures.push(`duplicate-source-payload:${stalePath}`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
const manifestPaths = manifest.files.map((file) => file.path).sort();
const sumEntries = new Map(sumsText.trim().split("\n").filter(Boolean).map((line) => {
  const match = line.match(/^([a-f0-9]{64})  (.+)$/u);
  return match ? [match[2], match[1]] : [line, "invalid"];
}));

if (JSON.stringify(payloadFiles) !== JSON.stringify(manifestPaths)) failures.push("manifest-file-set");
if (JSON.stringify(payloadFiles) !== JSON.stringify([...sumEntries.keys()].sort())) failures.push("sums-file-set");
for (const file of manifest.files) {
  const bytes = await readFile(path.join(payloadRoot, file.path));
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (bytes.length !== file.bytes) failures.push(`bytes:${file.path}`);
  if (hash !== file.sha256) failures.push(`hash:${file.path}`);
  if (sumEntries.get(file.path) !== hash) failures.push(`sums:${file.path}`);
}

const corpusSlugs = corpus.entries.map((entry) => entry.slug);
const hotspotSlugs = hotspots.entries.map((entry) => entry.slug);
const sceneSlugs = storyScenes.entries.map((entry) => entry.slug);
const mediaSlugs = storyMedia.entries.map((entry) => entry.slug);
const unique = (values) => new Set(values).size === values.length;
const pngInfo = (buffer) => {
  if (buffer.toString("ascii", 1, 4) !== "PNG") return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    colorType: buffer.readUInt8(25),
  };
};
if (corpus.entries.length !== 68 || corpus.stories !== 68 || !unique(corpusSlugs)) failures.push("corpus-stories");
if (corpus.illustrations !== 68) failures.push("corpus-illustrations");
if (JSON.stringify(corpus.entries.map((entry) => entry.order)) !== JSON.stringify(Array.from({ length: 68 }, (_, index) => index + 1))) failures.push("corpus-orders");
if (corpus.entries.some((entry) => entry.cueStatus !== "mapped")) failures.push("corpus-cue-status");
if (hotspots.entries.length !== 68 || !unique(hotspotSlugs)) failures.push("hotspots-count");
if (JSON.stringify(hotspots.entries.map((entry) => entry.order)) !== JSON.stringify(Array.from({ length: 68 }, (_, index) => index + 1))) failures.push("hotspot-orders");
if (JSON.stringify([...corpusSlugs].sort()) !== JSON.stringify([...hotspotSlugs].sort())) failures.push("hotspot-slugs");
if (hotspots.master?.width !== 1920 || hotspots.master?.height !== 1200) failures.push("hotspot-master");
if (!unique(sceneSlugs) || sceneSlugs.some((slug) => !corpusSlugs.includes(slug))) failures.push("scene-slugs");
if (storyMedia.entries.length !== 10 || !unique(mediaSlugs) || mediaSlugs.some((slug) => !corpusSlugs.includes(slug))) failures.push("media-slugs");

const declaredIllustrations = corpus.entries
  .flatMap((entry) => Object.values(entry.illustrations ?? {}))
  .map((relative) => relative.replace(/^\.\//u, ""))
  .sort();
const packagedIllustrations = files
  .filter((file) => /^assets\/stories\/[^/]+\/(?:ink|paper)\.png$/u.test(file))
  .sort();
if (JSON.stringify(declaredIllustrations) !== JSON.stringify(packagedIllustrations)) failures.push("story-illustration-file-set");

const storyBodies = new Map();
for (const entry of corpus.entries) {
  const storyText = await readFile(path.join(payloadRoot, entry.file.replace(/^\.\//u, "")), "utf8");
  storyBodies.set(entry.slug, storyText.replace(/^---[\s\S]*?---\s*/u, ""));
}

const youtubeIds = storyMedia.entries.map((entry) => entry.youtubeId);
if (!unique(youtubeIds)) failures.push("media-youtube-ids");
for (const entry of storyMedia.entries) {
  if (![entry.slug, entry.anchor, entry.youtubeId, entry.title, entry.provenance].every((value) => typeof value === "string" && value.trim())) {
    failures.push(`media-fields:${entry.slug}`);
    continue;
  }
  if (!/^[A-Za-z0-9_-]{11}$/u.test(entry.youtubeId)) failures.push(`media-youtube-id:${entry.slug}`);
  if (!storyBodies.get(entry.slug)?.includes(entry.anchor)) failures.push(`media-anchor:${entry.slug}`);
}

const expectedStoryLinks = [
  ["breves-historias-de-cabezas-tristemente-celebres", "breves-historias-famosas-de-fantasmas"],
  ["cronicas-absurdas-licor-de-mi-agonia", "delirios-de-un-artista-a-medianoche"],
  ["experiencias-religiosas-de-las-equivocaciones-celestiales", "buenas-noches-%c2%bfcomo-le-va"],
  ["la-importancia-de-ser-don-ernesto", "don-ernesto-y-el-joven-depresion"],
  ["puertas", "la-habitacion-numero-setenta-y-ocho-de-magos-y-hechiceros"],
];
for (const [source, target] of expectedStoryLinks) {
  if (!storyBodies.get(source)?.includes(`](story:${target})`)) failures.push(`missing-story-link:${source}:${target}`);
}

let sceneIllustrations = 0;
for (const entry of storyScenes.entries) {
  if (!Array.isArray(entry.scenes) || entry.scenes.length === 0) failures.push(`scenes:${entry.slug}`);
  const story = corpus.entries.find((candidate) => candidate.slug === entry.slug);
  const storyText = story
    ? await readFile(path.join(payloadRoot, story.file.replace(/^\.\//u, "")), "utf8")
    : "";
  const ids = entry.scenes?.map((scene) => scene.id) ?? [];
  if (!unique(ids)) failures.push(`scene-ids:${entry.slug}`);
  for (const scene of entry.scenes ?? []) {
    sceneIllustrations += 1;
    if (![scene.id, scene.anchor, scene.src, scene.alt].every((value) => typeof value === "string" && value.trim())) {
      failures.push(`scene-fields:${entry.slug}`);
      continue;
    }
    if (!storyText.includes(`### ${scene.anchor}`)) failures.push(`scene-anchor:${entry.slug}:${scene.id}`);
    try {
      if ((await stat(path.join(payloadRoot, scene.src.replace(/^\.\//u, "")))).size === 0) failures.push(`scene-empty:${entry.slug}:${scene.id}`);
    } catch {
      failures.push(`scene-missing:${entry.slug}:${scene.id}`);
    }
  }
}
if (sceneIllustrations !== 4) failures.push("scene-illustrations");

let internalLinkCount = 0;
for (const entry of corpus.entries) {
  const selectedVariant = entry.illustrationVariant ?? "ink";
  const illustrationEntries = Object.entries(entry.illustrations ?? {});
  if (illustrationEntries.length !== 1 || illustrationEntries[0]?.[0] !== selectedVariant) {
    failures.push(`illustration-contract:${entry.slug}`);
  }
  const selectedPath = entry.illustrations?.[selectedVariant];
  for (const relative of [entry.file, selectedPath]) {
    if (typeof relative !== "string") { failures.push(`path:${entry.slug}`); continue; }
    const absolute = path.join(payloadRoot, relative.replace(/^\.\//u, ""));
    try { if ((await stat(absolute)).size === 0) failures.push(`empty:${relative}`); }
    catch { failures.push(`missing:${relative}`); }
  }
  if (typeof selectedPath === "string") {
    const selectedBytes = await readFile(path.join(payloadRoot, selectedPath.replace(/^\.\//u, "")));
    const selectedPng = pngInfo(selectedBytes);
    if (!selectedPng || selectedPng.width * 5 !== selectedPng.height * 4) failures.push(`active-illustration-ratio:${entry.slug}`);
    if (!selectedPng || ![4, 6].includes(selectedPng.colorType)) failures.push(`active-illustration-alpha:${entry.slug}`);
  }
  const storyText = await readFile(path.join(payloadRoot, entry.file.replace(/^\.\//u, "")), "utf8");
  const storyBody = storyBodies.get(entry.slug) ?? "";
  if (/^\s*>/mu.test(storyText)) failures.push(`blockquote-marker:${entry.slug}`);
  if (/!\[[^\]]*\]\(/u.test(storyText)) failures.push(`legacy-image:${entry.slug}`);
  if (/^\s*(?:\*—|—\*)/mu.test(storyText)) failures.push(`italic-dialogue:${entry.slug}`);
  if (/\(\([^\n]*\)\)/u.test(storyText)) failures.push(`double-parenthesis:${entry.slug}`);
  if (/^—[^\n]*\. —[a-záéíóúñ]/mu.test(storyText)) failures.push(`dialogue-punctuation:${entry.slug}`);
  if (/https?:\/\//u.test(storyBody)) failures.push(`visible-url:${entry.slug}`);
  if (/\[[^\]]+\]\((?!story:)[^)]+\)/u.test(storyBody)) failures.push(`external-markdown-link:${entry.slug}`);
  for (const [blockIndex, block] of storyBody.split(/\n\s*\n/u).entries()) {
    const withoutStrong = block.replace(/\*\*[\s\S]*?\*\*/gu, "");
    const emphasisMarkers = withoutStrong.match(/(?<!\\)\*/gu) ?? [];
    if (emphasisMarkers.length % 2 !== 0) failures.push(`unbalanced-emphasis:${entry.slug}:${blockIndex + 1}`);
  }
  const internalTargets = [...storyBody.matchAll(/\[[^\]]+\]\(story:([a-z0-9%_-]+)\)/gu)].map((match) => match[1]);
  internalLinkCount += internalTargets.length;
  if (internalTargets.some((slug) => !corpusSlugs.includes(slug))) failures.push(`broken-story-link:${entry.slug}`);
  if (/^\*\*-\s*[IVXLCDM]+\s*-\*\*/mu.test(storyBody)) failures.push(`styled-roman-heading:${entry.slug}`);

  if (entry.slug !== "del-tengo-eso-y-quiero-aquello") {
    const withoutMoonLinks = storyBody.replace(/\[[^\]]*(?:Sebastian Moon|Sr\. Moon)[^\]]*\]\(story:del-tengo-eso-y-quiero-aquello\)/gu, "");
    if (/(?:Sebastian Moon|Sr\. Moon)/u.test(withoutMoonLinks)) failures.push(`unlinked-moon:${entry.slug}`);
  }
}
if (internalLinkCount !== 17) failures.push("internal-link-count");

if (storyBodies.get("apesta-a-espiritu-adolescente-de-lo-que-nos-dejo-cobain")?.includes(">")) failures.push("apesta-raw-angle-marker");
if (storyBodies.get("consideraciones-sobre-la-belleza")?.includes("*")) failures.push("belleza-visible-asterisk");
if (/Otros rastros de Sebastian Moon/u.test(storyBodies.get("del-tengo-eso-y-quiero-aquello") ?? "")) {
  failures.push("generated-moon-trail");
}

const moonPortrait = corpus.entries.find((entry) => entry.slug === "del-tengo-eso-y-quiero-aquello");
if (
  moonPortrait?.portraitOf !== "sebastian-moon"
  || moonPortrait?.illustrationVariant !== "paper"
  || moonPortrait?.illustrationAlt !== "Retrato en tinta de Sebastian Moon, sosteniendo una moneda frente a su mano vacía."
  || moonPortrait?.illustrations?.paper !== "./assets/stories/del-tengo-eso-y-quiero-aquello/paper.png"
  || Object.keys(moonPortrait?.illustrations ?? {}).length !== 1
) failures.push("sebastian-moon-portrait-contract");

for (const entry of hotspots.entries) {
  const numbers = [entry.x, entry.y, entry.width, entry.height];
  if (!numbers.every((value) => Number.isFinite(value) && value > 0)) failures.push(`geometry:${entry.slug}`);
  if (entry.x - entry.width / 2 < 0 || entry.y - entry.height / 2 < 0 || entry.x + entry.width / 2 > 1920 || entry.y + entry.height / 2 > 1200) failures.push(`bounds:${entry.slug}`);
  if (!Array.isArray(entry.reactions) || entry.reactions.length === 0 || entry.reactions.some((id) => !REACTION_IDS.has(id))) failures.push(`reactions:${entry.slug}`);
}
for (let index = 0; index < hotspots.entries.length; index += 1) {
  const first = hotspots.entries[index];
  for (let next = index + 1; next < hotspots.entries.length; next += 1) {
    const second = hotspots.entries[next];
    const overlapsX = Math.abs(first.x - second.x) * 2 < first.width + second.width;
    const overlapsY = Math.abs(first.y - second.y) * 2 < first.height + second.height;
    if (overlapsX && overlapsY) failures.push(`hotspot-overlap:${first.slug}:${second.slug}`);
  }
}

const audio = files.filter((file) => file.startsWith("assets/audio/")).sort();
if (JSON.stringify(audio) !== JSON.stringify(EXPECTED_AUDIO)) failures.push("audio-set");
if (files.some((file) => file.toLowerCase().endsWith(".wav"))) failures.push("wav-present");
const excludedStorySlugs = ["charlas-con-el-sr-moon", "chau-2009", "un-ultimo-adios-a-cyd-charisse", "hombrecito-mirando-al-manana"];
if (corpus.entries.some((entry) => excludedStorySlugs.includes(entry.slug))) failures.push("excluded-story-present");
if (files.some((file) => excludedStorySlugs.some((slug) => file.includes(slug)))) failures.push("excluded-story-files");
if (manifest.counts.files !== payloadFiles.length || manifest.counts.stories !== 68 || manifest.counts.illustrations !== 68 || manifest.counts.sceneIllustrations !== 4 || manifest.counts.mediaEmbeds !== 10 || manifest.counts.mappedCues !== 68) failures.push("manifest-counts");

if (failures.length) {
  console.error(JSON.stringify({ status: "FAIL", failures: [...new Set(failures)] }, null, 2));
  process.exit(1);
}
const audioBytes = manifest.files
  .filter((file) => file.path.startsWith("assets/audio/"))
  .reduce((total, file) => total + file.bytes, 0);
console.log(JSON.stringify({ status: "PASS", files: payloadFiles.length, stories: 68, illustrations: 68, sceneIllustrations: 4, mediaEmbeds: 10, hotspots: 68, audioBytes }, null, 2));
