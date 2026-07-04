// Deterministic constellation layout for Galaxia de Intereses.
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
  rationale: string;
  weight: number;
};

export type GalaxyCluster = {
  id: string;
  label: string;
  rationale: string;
};

export type GalaxyData = {
  version: number;
  updatedAt: string;
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
const DIST_MIN = 6;
const DIST_MAX = 26;
const FLATTEN_Y = 0.62;
const CLUSTER_COHESION = 0.62;
const JITTER = 0.12;
const EDGE_PASS_ITERATIONS = 10;
const EDGE_PASS_STEP = 0.022;

const NODE_RADIUS_BASE = 0.16;
const NODE_RADIUS_K = 0.055;

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

  return { positions, radii, edgeIndices, indexById };
}
