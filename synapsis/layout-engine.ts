// Deterministic constellation layout for Synapsis.
//
// Editorial territories distributed across a restrained side-profile brain
// field, with continuous spatial depth. Stable id hashes build airy local
// clouds; bounded edge attraction and XY separation run only on the server. No
// runtime physics or per-node positions. Input ordering does not change the
// resulting spatial identity.

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

const DEPTH_HALF_RANGE = 8;
const EDGE_PASS_ITERATIONS = 4;
const EDGE_PASS_STEP = 0.008;
const SEPARATION_PASS_ITERATIONS = 10;
const SEPARATION_STEP = 0.35;
const MAX_LAYOUT_DRIFT = 4;
export const BRAIN_BOTTOM = -38;
export const BRAIN_TOP = 27;
export const BRAIN_STEM_JOIN = -17;

export function nodeVisualRadius(relevance: number): number {
  const t = (Math.min(10, Math.max(1, relevance)) - 1) / 9;
  return 0.15 + t * 0.15;
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

// Eight territory slots distribute the real editorial clusters through one
// continuous side-profile silhouette. They are positional, not anatomical:
// editorial categories do not claim a relationship to regions of the brain.
// The two smallest current territories occupy the lower transition and stem,
// keeping those clusters coherent instead of scattering every category through
// a decorative tail.
const BRAIN_TERRITORY_SLOTS: Vec3[] = [
  [-21, 8, 0],
  [-6, 16, 0],
  [14, 17, 0],
  [11, -32, 0],
  [9, -21, 0],
  [-21, -5, 0],
  [23, 4, 0],
  [6, -14, 0],
];

const BRAIN_SLOT_FILL_ORDER = [5, 1, 6, 0, 2, 7, 4, 3];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(min: number, max: number, value: number) {
  const t = clamp((value - min) / Math.max(1e-6, max - min), 0, 1);
  return t * t * (3 - 2 * t);
}

export function brainProfileBounds(y: number): [number, number] {
  const clampedY = clamp(y, BRAIN_BOTTOM, BRAIN_TOP);
  if (clampedY <= BRAIN_STEM_JOIN) {
    const t = smoothstep(BRAIN_BOTTOM, BRAIN_STEM_JOIN, clampedY);
    const center = 12 - 4 * t;
    const halfWidth = 2.4 + 14.6 * Math.pow(t, 0.78);
    return [center - halfWidth, center + halfWidth];
  }

  const t = clamp((clampedY - BRAIN_STEM_JOIN) / (BRAIN_TOP - BRAIN_STEM_JOIN), 0, 1);
  const center = 8 * Math.pow(1 - t, 2) - 2 * t;
  const fullness = Math.pow(Math.max(0, Math.sin(Math.PI * t)), 0.58);
  const halfWidth = 9 + 22 * fullness + 8 * (1 - t);
  const posterior = halfWidth * (1.03 + 0.05 * smoothstep(0.18, 0.72, t));
  const forehead = halfWidth * (0.95 + 0.07 * smoothstep(0.12, 0.58, t) * (1 - smoothstep(0.82, 1, t)));
  return [center - posterior, center + forehead];
}

function brainDepthHalfRange(x: number, y: number) {
  const [left, right] = brainProfileBounds(y);
  const center = (left + right) * 0.5;
  const halfWidth = Math.max(1, (right - left) * 0.5);
  const lateralClearance = Math.sqrt(Math.max(0, 1 - Math.abs(x - center) / halfWidth));
  const headT = clamp((y - BRAIN_STEM_JOIN) / (BRAIN_TOP - BRAIN_STEM_JOIN), 0, 1);
  const stemFullness = smoothstep(BRAIN_BOTTOM, BRAIN_STEM_JOIN, y);
  const verticalFullness = y <= BRAIN_STEM_JOIN
    ? 0.2 + 0.8 * stemFullness
    : 0.2 + 0.8 * Math.pow(Math.max(0, Math.sin(Math.PI * headT)), 0.35);
  return DEPTH_HALF_RANGE * (0.3 + 0.7 * lateralClearance * verticalFullness);
}

function territorySlots(count: number): Vec3[] {
  if (count === BRAIN_TERRITORY_SLOTS.length) return BRAIN_TERRITORY_SLOTS;
  if (count < BRAIN_TERRITORY_SLOTS.length) {
    return BRAIN_SLOT_FILL_ORDER.slice(0, count).map((index) => BRAIN_TERRITORY_SLOTS[index]);
  }
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: count }, (_, index) => {
    if (index < BRAIN_TERRITORY_SLOTS.length) return BRAIN_TERRITORY_SLOTS[index];
    const radius = Math.sqrt((index + 0.5) / count);
    const y = Math.sin(golden * index) * radius * 20 + 2;
    const [left, right] = brainProfileBounds(y);
    const center = (left + right) * 0.5;
    const halfWidth = (right - left) * 0.5;
    return [center + Math.cos(golden * index) * radius * halfWidth * 0.72, y, 0];
  });
}

function clusterCentroids(clusters: GalaxyCluster[], counts: Map<string, number>): Map<string, Vec3> {
  const occupied = clusters.filter((cluster) => counts.has(cluster.id))
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const centroids = new Map<string, Vec3>();
  const slots = territorySlots(occupied.length);
  occupied.forEach((cluster, i) => {
    centroids.set(cluster.id, occupied.length === 1 ? [0, 0, 0] : slots[i]);
  });
  return centroids;
}

function confineNodeToBrain(
  positions: number[],
  nodeIndex: number,
  radius: number,
  anchorPositions?: number[],
) {
  const offset = nodeIndex * 3;
  let x = positions[offset];
  let y = positions[offset + 1];
  if (anchorPositions) {
    const dx = x - anchorPositions[offset];
    const dy = y - anchorPositions[offset + 1];
    const drift = Math.hypot(dx, dy);
    if (drift > MAX_LAYOUT_DRIFT) {
      const scale = MAX_LAYOUT_DRIFT / drift;
      x = anchorPositions[offset] + dx * scale;
      y = anchorPositions[offset + 1] + dy * scale;
    }
  }
  y = clamp(y, BRAIN_BOTTOM + radius, BRAIN_TOP - radius);
  const [profileLeft, profileRight] = brainProfileBounds(y);
  const left = profileLeft + radius;
  const right = profileRight - radius;
  x = left <= right ? clamp(x, left, right) : (profileLeft + profileRight) * 0.5;
  positions[offset] = x;
  positions[offset + 1] = y;
  const depth = brainDepthHalfRange(x, y);
  positions[offset + 2] = clamp(positions[offset + 2], -depth, depth);
}

export function computeLayout(data: GalaxyData): GalaxyLayout {
  const { nodes, edges, clusters } = data;
  const counts = new Map<string, number>();
  for (const node of nodes) counts.set(node.cluster, (counts.get(node.cluster) ?? 0) + 1);
  const centroids = clusterCentroids(clusters, counts);
  const order = nodes.map((_, i) => i).sort((a, b) => nodes[a].id < nodes[b].id ? -1 : nodes[a].id > nodes[b].id ? 1 : 0);
  const positions = new Array<number>(nodes.length * 3);
  const radii = new Array<number>(nodes.length);
  const indexById: Record<string, number> = {};

  nodes.forEach((node, i) => {
    indexById[node.id] = i;
    radii[i] = nodeVisualRadius(node.relevance);

    const centroid = centroids.get(node.cluster) ?? [0, 0, 0];
    const share = (counts.get(node.cluster) ?? 1) / Math.max(1, nodes.length);
    const t = (Math.min(10, Math.max(1, node.relevance)) - 1) / 9;
    const theta = hash01(node.id, 1) * Math.PI * 2;
    const radial = Math.sqrt(hash01(node.id, 2)) * (1 - t * 0.2);
    // Larger territories get room proportional to their population, without
    // reserving space for empty editorial categories.
    const cloudX = counts.size === 1 ? 34 : 10 + Math.sqrt(share) * 8;
    const cloudY = counts.size === 1 ? 22 : 8 + Math.sqrt(share) * 5;
    const centrality = 1 - t * 0.18;
    positions[i * 3] = centroid[0] * centrality + Math.cos(theta) * radial * cloudX;
    positions[i * 3 + 1] = centroid[1] * centrality + Math.sin(theta) * radial * cloudY;
    positions[i * 3 + 2] = ((hash01(node.id, 3) * 2 - 1) * 0.7 + (hash01(node.cluster, 11) * 2 - 1) * 0.3) * DEPTH_HALF_RANGE;
    confineNodeToBrain(positions, i, radii[i]);

    if (centroid[1] < BRAIN_STEM_JOIN - 8 && hash01(node.id, 37) < 0.35) {
      positions[i * 3 + 1] = BRAIN_BOTTOM + radii[i] + 0.6 + hash01(node.id, 41) * 5;
      confineNodeToBrain(positions, i, radii[i]);
    }
    if (centroid[1] < -8) {
      const foregroundDepth = brainDepthHalfRange(positions[i * 3], positions[i * 3 + 1]);
      positions[i * 3 + 2] = foregroundDepth * (0.2 + hash01(node.id, 43) * 0.7);
    }

    // The outline must be occupied, not merely clipped. Reserve a restrained
    // subset for the contour so the profile stays dense inside instead of
    // becoming a hollow ring.
    if (counts.size > 1 && hash01(node.id, 23) < 0.23) {
      const [left, right] = brainProfileBounds(positions[i * 3 + 1]);
      const center = (left + right) * 0.5;
      const side = Math.sign(centroid[0] - center) || (hash01(node.id, 17) < 0.5 ? -1 : 1);
      const inset = 0.8 + hash01(node.id, 29) * 2.4;
      const shellX = side < 0 ? left + radii[i] + inset : right - radii[i] - inset;
      positions[i * 3] = positions[i * 3] * 0.15 + shellX * 0.85;
      confineNodeToBrain(positions, i, radii[i]);
    }
  });
  const anchorPositions = positions.slice();

  const edgeIndices: number[] = [];
  for (const edge of edges) {
    const a = indexById[edge.source];
    const b = indexById[edge.target];
    if (a === undefined || b === undefined) continue;
    edgeIndices.push(a, b);
  }

  // Post-hash edge pass: connected nodes drift toward each other proportional
  // to edge weight. Fixed iteration count and order → still deterministic.
  const orderedEdges = [...edges].sort((a, b) => {
    const left = [a.source, a.target].sort().join("\u0000");
    const right = [b.source, b.target].sort().join("\u0000");
    return left < right ? -1 : left > right ? 1 : 0;
  });
  for (let iter = 0; iter < EDGE_PASS_ITERATIONS; iter += 1) {
    let e = 0;
    for (const edge of orderedEdges) {
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
    nodes.forEach((_, index) => confineNodeToBrain(
      positions,
      index,
      radii[index],
      anchorPositions,
    ));
    if (e === 0) break;
  }

  // Deterministic spacing pass: keep dense real-data clusters from reading as
  // one pile while preserving the stable no-runtime-physics contract.
  for (let iter = 0; iter < SEPARATION_PASS_ITERATIONS; iter += 1) {
    for (let ai = 0; ai < order.length; ai += 1) {
      const a = order[ai];
      for (let bi = ai + 1; bi < order.length; bi += 1) {
        const b = order[bi];
        const ax = positions[a * 3];
        const ay = positions[a * 3 + 1];
        const bx = positions[b * 3];
        const by = positions[b * 3 + 1];
        let dx = bx - ax;
        let dy = by - ay;
        let dist = Math.hypot(dx, dy);
        if (dist < 1e-6) {
          dx = hash01(`${nodes[a].id}:${nodes[b].id}`, 7) * 2 - 1;
          dy = hash01(`${nodes[a].id}:${nodes[b].id}`, 8) * 2 - 1;
          dist = Math.hypot(dx, dy) || 1;
        }
        const minDistance = 1.1 + radii[a] + radii[b];
        if (dist >= minDistance) continue;
        const push = ((minDistance - dist) / dist) * SEPARATION_STEP;
        positions[a * 3] -= dx * push;
        positions[a * 3 + 1] -= dy * push;
        positions[b * 3] += dx * push;
        positions[b * 3 + 1] += dy * push;
      }
    }
    nodes.forEach((_, index) => confineNodeToBrain(
      positions,
      index,
      radii[index],
      anchorPositions,
    ));
  }
  return { positions, radii, edgeIndices, indexById };
}
