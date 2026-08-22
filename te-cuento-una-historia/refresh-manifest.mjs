import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const codeRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(codeRoot, "../../../..");
const payloadRoot = path.join(repoRoot, "public/lab/te-cuento-una-historia");
const excluded = new Set(["PROJECT-MANIFEST.json", "SHA256SUMS.txt"]);

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

const allFiles = await walk();
const records = [];
for (const relative of allFiles.filter((file) => !excluded.has(file))) {
  const bytes = await readFile(path.join(payloadRoot, relative));
  records.push({
    path: relative,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}

const manifest = {
  schema: "te-cuento-una-historia/public-payload-v1",
  scope: "/public/lab/te-cuento-una-historia",
  status: "ready_for_pablo",
  generatedAt: new Date().toISOString(),
  counts: { files: records.length, stories: 68, illustrations: 68, sceneIllustrations: 4, mediaEmbeds: 10, mappedCues: 68 },
  excluded: [
    {
      slug: "charlas-con-el-sr-moon",
      reason: "Posteo normal; Pablo indicó que no forma parte de los relatos de la obra.",
    },
    {
      slug: "chau-2009",
      reason: "Saludo de fin de año; Pablo indicó que no es un relato de la obra.",
    },
    {
      slug: "un-ultimo-adios-a-cyd-charisse",
      reason: "Efeméride funeraria compuesta sólo por las fechas 1921–2008; Pablo indicó que no es un relato de la obra.",
    },
    {
      slug: "hombrecito-mirando-al-manana",
      reason: "Reflexión de una sola frase asociada a una imagen, sin forma de cuento, relato, poema o historia; Pablo indicó retirarla.",
    },
  ],
  files: records,
};

await Promise.all([
  writeFile(path.join(payloadRoot, "PROJECT-MANIFEST.json"), `${JSON.stringify(manifest, null, 2)}\n`),
  writeFile(path.join(payloadRoot, "SHA256SUMS.txt"), `${records.map((file) => `${file.sha256}  ${file.path}`).join("\n")}\n`),
]);
console.log(JSON.stringify(manifest.counts));
