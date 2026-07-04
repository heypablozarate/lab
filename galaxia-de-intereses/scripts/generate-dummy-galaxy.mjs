// Generates the deterministic F1 dummy dataset (500 nodes) for the Galaxia de
// Intereses acceptance benchmark. Seeded PRNG: same seed → same JSON, so the
// committed file is reproducible. Schema: kickoff v2 (sources as array, every
// edge carries provenance + rationale + weight).
//
// Usage: node scripts/generate-dummy-galaxy.mjs   (from the experiment folder)

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SEED = 20260703;
const NODE_COUNT = 500;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(SEED);
const pick = (list) => list[Math.floor(rand() * list.length)];

const clusters = [
  { id: "ai-governance", label: "AI Governance", rationale: "Cómo se regula, gobierna y despliega la AI en organizaciones." },
  { id: "design-systems", label: "Design Systems", rationale: "Sistemas, tokens y operaciones de diseño a escala." },
  { id: "typography", label: "Typography", rationale: "Tipografía, layout editorial y craft tipográfico." },
  { id: "creative-coding", label: "Creative Coding", rationale: "WebGL, shaders y experimentos generativos." },
  { id: "design-leadership", label: "Design Leadership", rationale: "Gestión, liderazgo y madurez de equipos de diseño." },
  { id: "interfaces", label: "Interfaces", rationale: "Interaction design, prototipos y detalles de UI." },
  { id: "tools", label: "Tools", rationale: "Herramientas, plugins y automatización del workflow." },
  { id: "culture", label: "Culture", rationale: "Ensayos, historia del diseño y cultura de internet." },
];

const topicsByCluster = {
  "ai-governance": ["AI policy", "model evals", "agent safety", "AI en banca", "prompt ops", "LLM audits"],
  "design-systems": ["design tokens", "RAMS", "component APIs", "theming", "docs de sistema", "DesignOps"],
  typography: ["Neue Haas", "grillas suizas", "variable fonts", "editorial web", "kerning", "specimens"],
  "creative-coding": ["shaders", "three.js", "generative art", "GLSL", "particles", "audio reactive"],
  "design-leadership": ["design maturity", "org design", "metrics", "rituales", "hiring", "playbooks"],
  interfaces: ["micro-interactions", "motion", "prototyping", "spatial UI", "canvas UIs", "haptics"],
  tools: ["Figma plugins", "CLI tools", "automation", "MCP", "scrapers", "userscripts"],
  culture: ["Flash era", "net art", "ensayos", "arqueología web", "manifiestos", "blogs"],
};

const sources = ["x", "github", "safari", "manual"];
const types = ["link", "repo", "image", "idea"];
const hosts = ["ejemplo.com", "notas.dev", "archivo.net", "lab.studio", "papers.site", "blog.work"];

const nodes = [];
for (let i = 0; i < NODE_COUNT; i += 1) {
  const cluster = clusters[Math.floor(rand() * clusters.length)];
  const topic = pick(topicsByCluster[cluster.id]);
  const host = pick(hosts);
  const slug = `${cluster.id}-${String(i).padStart(3, "0")}`;
  // Skew relevance so the center of the galaxy stays sparse: mostly 3-6, few 9-10.
  const relevance = Math.max(1, Math.min(10, Math.round(1 + Math.pow(rand(), 1.6) * 9)));
  const source = pick(sources);
  nodes.push({
    id: slug,
    title: `${topic} — nota ${String(i).padStart(3, "0")}`,
    url: `https://${host}/${slug}`,
    normalizedUrl: `${host}/${slug}`,
    sources: [source],
    type: source === "github" ? "repo" : pick(types),
    description: `Item dummy del benchmark F1 sobre ${topic}.`,
    tags: [topic.toLowerCase().replace(/\s+/g, "-"), cluster.id],
    relevance,
    cluster: cluster.id,
    addedAt: "2026-07-03",
    status: "active",
  });
}

// Edges: 1-2 intra-cluster links per node plus a smaller set of inter-cluster
// bridges, so the layout has both local structure and the cross-links the
// intelligence pass will care about.
const edges = [];
const seen = new Set();
function addEdge(a, b, provenance, rationale) {
  if (a.id === b.id) return;
  const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
  if (seen.has(key)) return;
  seen.add(key);
  edges.push({
    source: a.id,
    target: b.id,
    provenance,
    rationale,
    weight: Math.round((0.3 + rand() * 0.7) * 100) / 100,
  });
}

const byCluster = new Map(clusters.map((c) => [c.id, nodes.filter((n) => n.cluster === c.id)]));
for (const node of nodes) {
  const peers = byCluster.get(node.cluster);
  const links = 1 + Math.floor(rand() * 2);
  for (let l = 0; l < links; l += 1) {
    addEdge(node, pick(peers), "manual", `Ambos tratan ${pick(topicsByCluster[node.cluster])} dentro de ${node.cluster}.`);
  }
}
const bridgeCount = Math.floor(NODE_COUNT * 0.24);
for (let i = 0; i < bridgeCount; i += 1) {
  const a = pick(nodes);
  const b = pick(nodes);
  if (a.cluster === b.cluster) continue;
  addEdge(a, b, "ai-approved", `Puente no evidente entre ${a.cluster} y ${b.cluster}.`);
}

const galaxy = {
  version: 2,
  updatedAt: "2026-07-03",
  nodes,
  edges,
  clusters,
};

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "data", "galaxy.dummy.json");
writeFileSync(out, `${JSON.stringify(galaxy, null, 2)}\n`);
console.log(`galaxy.dummy.json → ${nodes.length} nodes, ${edges.length} edges, ${clusters.length} clusters`);
