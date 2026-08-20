// Deterministic constellation layout for Synapsis.
//
// dsaints-style: no runtime physics. Node positions derive from a hash of the
// node id, relevance sets distance to center (inverse) and visual size
// (direct), clusters gravitate toward shared angular sectors, and edge weight
// nudges connected nodes together in a fixed post-hash pass. Same graph in →
// same constellation out, always. Runs server-side at build; the client only
// renders the result.

export type GalaxyNode = {
  id: string;
  title: string;
  url: string;
  normalizedUrl: string;
  sources: string[];
  type: string;
  description: string;
  tags: string[];
  relevance: number;
  cluster: string;
  addedAt: string;
  status: string;
};

export type GalaxyEdge = {
  source: string;
  target: string;
  provenance: string;
  rationale?: string;
  weight: number;
};

export type GalaxyCluster = {
  id: string;
  label: string;
  rationale: string;
};

export type GalaxyMetadata = {
  title: string;
  metadataTitle: string;
  description: string;
  serverContext: string;
  inLanguage?: string;
  interfaceCopy: SynapsisInterfaceCopy;
  keywords: string[];
};

export type SynapsisInterfaceCopy = {
  loadingLabel: string;
  countTemplate: string;
  backLabel: string;
  searchLabel: string;
  emptyResultsLabel: string;
  lightModeLabel: string;
  darkModeLabel: string;
  themeLabelTemplate: string;
  switchThemeAriaTemplate: string;
  detailAriaTemplate: string;
  closeLabel: string;
  relevanceLabel: string;
  openLinkLabel: string;
  connectionsHeading: string;
  aiApprovedLabel: string;
  manualLabel: string;
};

export type GalaxyData = {
  version: number;
  updatedAt: string;
  metadata: GalaxyMetadata;
  nodes: GalaxyNode[];
  edges: GalaxyEdge[];
  clusters: GalaxyCluster[];
};

export type GalaxyLayout = {
  /** xyz per node, flat — feeds the InstancedMesh directly. */
  positions: number[];
  /** Visual radius per node (base + k * relevance). */
  radii: number[];
  /** Node index pairs per edge — feeds the LineSegments position buffer. */
  edgeIndices: number[];
  indexById: Record<string, number>;
};

// World-space distances: relevance 10 sits near DIST_MIN, relevance 1 near
// DIST_MAX. The ellipsoid is flattened on Y so it reads as a galaxy, not a ball.
// Keep the shell airy enough that real-data clusters do not visually clump.
const DIST_MIN = 10;
const DIST_MAX = 44;
const FLATTEN_Y = 0.62;
const CLUSTER_COHESION = 0.48;
const JITTER = 0.2;
const EDGE_PASS_ITERATIONS = 6;
const EDGE_PASS_STEP = 0.012;
const SEPARATION_PASS_ITERATIONS = 5;
const SEPARATION_STEP = 0.06;

const NODE_RADIUS_BASE = 0.15;
const NODE_RADIUS_K = 0.052;

export function nodeVisualRadius(relevance: number): number {
  return NODE_RADIUS_BASE + NODE_RADIUS_K * relevance;
}

// dsaints hash: frac(sin(seed) * 10000), seeded from a djb2 of the id plus a
// per-channel salt so x/y/z decorrelate.
function hash01(id: string, salt: number): number {
  let h = 5381 + salt * 7919;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 33) ^ id.charCodeAt(i);
  }
  const s = Math.sin(h >>> 0) * 10000;
  return s - Math.floor(s);
}

type Vec3 = [number, number, number];

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

// Evenly distributed cluster centroid directions via the golden spiral, in
// declared cluster order so the sectors are stable across builds.
function clusterDirections(clusters: GalaxyCluster[]): Map<string, Vec3> {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const dirs = new Map<string, Vec3>();
  const count = Math.max(clusters.length, 1);
  clusters.forEach((cluster, i) => {
    const y = count === 1 ? 0 : 1 - (2 * (i + 0.5)) / count;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    dirs.set(cluster.id, normalize([Math.cos(theta) * r, y, Math.sin(theta) * r]));
  });
  return dirs;
}

export function computeLayout(data: GalaxyData): GalaxyLayout {
  const { nodes, edges, clusters } = data;
  const centroids = clusterDirections(clusters);
  const positions = new Array<number>(nodes.length * 3);
  const radii = new Array<number>(nodes.length);
  const indexById: Record<string, number> = {};

  nodes.forEach((node, i) => {
    indexById[node.id] = i;
    radii[i] = nodeVisualRadius(node.relevance);

    // Hash-random direction on the sphere.
    const u = hash01(node.id, 1);
    const v = hash01(node.id, 2);
    const theta = u * Math.PI * 2;
    const phi = Math.acos(2 * v - 1);
    const random: Vec3 = [
      Math.sin(phi) * Math.cos(theta),
      Math.cos(phi),
      Math.sin(phi) * Math.sin(theta),
    ];

    // Pull the direction toward the cluster's angular sector.
    const centroid = centroids.get(node.cluster) ?? random;
    const dir = normalize([
      random[0] * (1 - CLUSTER_COHESION) + centroid[0] * CLUSTER_COHESION,
      random[1] * (1 - CLUSTER_COHESION) + centroid[1] * CLUSTER_COHESION,
      random[2] * (1 - CLUSTER_COHESION) + centroid[2] * CLUSTER_COHESION,
    ]);

    // Relevance → inverse distance to center, with a hash jitter so equal
    // relevance doesn't collapse into shells.
    const t = (Math.min(10, Math.max(1, node.relevance)) - 1) / 9;
    const jitter = 1 + (hash01(node.id, 3) * 2 - 1) * JITTER;
    const dist = (DIST_MAX - t * (DIST_MAX - DIST_MIN)) * jitter;

    positions[i * 3] = dir[0] * dist;
    positions[i * 3 + 1] = dir[1] * dist * FLATTEN_Y;
    positions[i * 3 + 2] = dir[2] * dist;
  });

  const edgeIndices: number[] = [];
  for (const edge of edges) {
    const a = indexById[edge.source];
    const b = indexById[edge.target];
    if (a === undefined || b === undefined) continue;
    edgeIndices.push(a, b);
  }

  // Post-hash edge pass: connected nodes drift toward each other proportional
  // to edge weight. Fixed iteration count and order → still deterministic.
  for (let iter = 0; iter < EDGE_PASS_ITERATIONS; iter += 1) {
    let e = 0;
    for (const edge of edges) {
      const a = indexById[edge.source];
      const b = indexById[edge.target];
      if (a === undefined || b === undefined) continue;
      const k = EDGE_PASS_STEP * edge.weight;
      for (let axis = 0; axis < 3; axis += 1) {
        const pa = positions[a * 3 + axis];
        const pb = positions[b * 3 + axis];
        const delta = (pb - pa) * k * 0.5;
        positions[a * 3 + axis] = pa + delta;
        positions[b * 3 + axis] = pb - delta;
      }
      e += 2;
    }
    if (e === 0) break;
  }

  // Deterministic spacing pass: keep dense real-data clusters from reading as
  // one pile while preserving the stable no-runtime-physics contract.
  for (let iter = 0; iter < SEPARATION_PASS_ITERATIONS; iter += 1) {
    for (let a = 0; a < nodes.length; a += 1) {
      for (let b = a + 1; b < nodes.length; b += 1) {
        const ax = positions[a * 3];
        const ay = positions[a * 3 + 1];
        const az = positions[a * 3 + 2];
        const bx = positions[b * 3];
        const by = positions[b * 3 + 1];
        const bz = positions[b * 3 + 2];
        let dx = bx - ax;
        let dy = by - ay;
        let dz = bz - az;
        let dist = Math.hypot(dx, dy, dz);
        if (dist < 1e-6) {
          dx = hash01(`${nodes[a].id}:${nodes[b].id}`, 7) * 2 - 1;
          dy = hash01(`${nodes[a].id}:${nodes[b].id}`, 8) * 2 - 1;
          dz = hash01(`${nodes[a].id}:${nodes[b].id}`, 9) * 2 - 1;
          dist = Math.hypot(dx, dy, dz) || 1;
        }
        const minDistance = 2.15 + radii[a] + radii[b];
        if (dist >= minDistance) continue;
        const push = ((minDistance - dist) / dist) * SEPARATION_STEP;
        positions[a * 3] -= dx * push;
        positions[a * 3 + 1] -= dy * push;
        positions[a * 3 + 2] -= dz * push;
        positions[b * 3] += dx * push;
        positions[b * 3 + 1] += dy * push;
        positions[b * 3 + 2] += dz * push;
      }
    }
  }

  return { positions, radii, edgeIndices, indexById };
}
