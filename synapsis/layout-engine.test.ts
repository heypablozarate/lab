import { describe, expect, it } from "vitest";
import galaxyFixture from "@/content/data/synapsis/galaxy.json";

import {
  BRAIN_BOTTOM,
  BRAIN_STEM_JOIN,
  BRAIN_TOP,
  brainProfileBounds,
  computeLayout,
  nodeVisualRadius,
  type GalaxyData,
  type GalaxyEdge,
  type GalaxyNode,
} from "./layout-engine";

function syntheticGalaxy(): GalaxyData {
  const clusters = [
    { id: "alpha", label: "Alpha", rationale: "test" },
    { id: "beta", label: "Beta", rationale: "test" },
    { id: "gamma", label: "Gamma", rationale: "test" },
  ];
  const nodes: GalaxyNode[] = [];
  for (let i = 0; i < 60; i += 1) {
    const cluster = clusters[i % clusters.length].id;
    nodes.push({
      id: `${cluster}-${i}`,
      title: `Node ${i}`,
      url: `https://example.com/${i}`,
      normalizedUrl: `example.com/${i}`,
      sources: ["manual"],
      type: "link",
      description: "",
      tags: [cluster],
      relevance: (i % 10) + 1,
      cluster,
      addedAt: "2026-07-03",
      status: "active",
    });
  }
  const edges: GalaxyEdge[] = [];
  for (let i = 0; i < 40; i += 1) {
    edges.push({
      source: nodes[i].id,
      target: nodes[(i + 3) % nodes.length].id,
      provenance: "manual",
      rationale: "test edge",
      weight: 0.8,
    });
  }
  return { version: 2, updatedAt: "2026-07-03", metadata: galaxyFixture.metadata, nodes, edges, clusters };
}

function distance(positions: number[], index: number) {
  const x = positions[index * 3];
  const y = positions[index * 3 + 1];
  const z = positions[index * 3 + 2];
  return Math.hypot(x, y, z);
}

describe("synapsis layout engine", () => {
  it("is fully deterministic for the same graph", () => {
    const data = syntheticGalaxy();
    const a = computeLayout(data);
    const b = computeLayout(data);
    expect(a.positions).toEqual(b.positions);
    expect(a.radii).toEqual(b.radii);
    expect(a.edgeIndices).toEqual(b.edgeIndices);
  });

  it("produces finite positions for every node and index maps for every edge", () => {
    const data = syntheticGalaxy();
    const layout = computeLayout(data);
    expect(layout.positions).toHaveLength(data.nodes.length * 3);
    expect(layout.positions.every((v) => Number.isFinite(v))).toBe(true);
    expect(layout.edgeIndices).toHaveLength(data.edges.length * 2);
    expect(layout.edgeIndices.every((i) => i >= 0 && i < data.nodes.length)).toBe(true);
  });

  it("places high-relevance nodes closer to the center than low-relevance ones", () => {
    const data = syntheticGalaxy();
    const layout = computeLayout(data);
    const central: number[] = [];
    const peripheral: number[] = [];
    data.nodes.forEach((node, i) => {
      if (node.relevance >= 9) central.push(distance(layout.positions, i));
      if (node.relevance <= 2) peripheral.push(distance(layout.positions, i));
    });
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(central)).toBeLessThan(mean(peripheral));
  });

  it("sizes node radius with relevance (base + k * relevance)", () => {
    expect(nodeVisualRadius(10)).toBeGreaterThan(nodeVisualRadius(5));
    expect(nodeVisualRadius(5)).toBeGreaterThan(nodeVisualRadius(1));
    expect(nodeVisualRadius(1)).toBeGreaterThan(0);
  });

  it("keeps clusters spatially coherent (closer to own centroid than to others)", () => {
    const data = syntheticGalaxy();
    const layout = computeLayout(data);
    const centroids = new Map<string, [number, number, number, number]>();
    data.nodes.forEach((node, i) => {
      const c = centroids.get(node.cluster) ?? [0, 0, 0, 0];
      c[0] += layout.positions[i * 3];
      c[1] += layout.positions[i * 3 + 1];
      c[2] += layout.positions[i * 3 + 2];
      c[3] += 1;
      centroids.set(node.cluster, c);
    });
    let own = 0;
    let other = 0;
    let ownCount = 0;
    let otherCount = 0;
    data.nodes.forEach((node, i) => {
      const p = [layout.positions[i * 3], layout.positions[i * 3 + 1], layout.positions[i * 3 + 2]];
      for (const [clusterId, c] of centroids) {
        const d = Math.hypot(p[0] - c[0] / c[3], p[1] - c[1] / c[3], p[2] - c[2] / c[3]);
        if (clusterId === node.cluster) {
          own += d;
          ownCount += 1;
        } else {
          other += d;
          otherCount += 1;
        }
      }
    });
    expect(own / ownCount).toBeLessThan(other / otherCount);
  });

  it("pulls connected nodes closer than unconnected pairs on average", () => {
    const data = syntheticGalaxy();
    const layout = computeLayout(data);
    const pairDistance = (a: number, b: number) =>
      Math.hypot(
        layout.positions[a * 3] - layout.positions[b * 3],
        layout.positions[a * 3 + 1] - layout.positions[b * 3 + 1],
        layout.positions[a * 3 + 2] - layout.positions[b * 3 + 2],
      );
    let connected = 0;
    for (let e = 0; e < layout.edgeIndices.length; e += 2) {
      connected += pairDistance(layout.edgeIndices[e], layout.edgeIndices[e + 1]);
    }
    connected /= layout.edgeIndices.length / 2;

    let random = 0;
    let randomCount = 0;
    for (let a = 0; a < data.nodes.length; a += 7) {
      for (let b = a + 1; b < data.nodes.length; b += 11) {
        random += pairDistance(a, b);
        randomCount += 1;
      }
    }
    expect(connected).toBeLessThan(random / randomCount);
  });
  it("preserves each node's position when editorial arrays reorder or empty categories are added", () => {
    const data = syntheticGalaxy();
    const expected = computeLayout(data);
    const reordered = computeLayout({ ...data, nodes: [...data.nodes].reverse(), edges: [...data.edges].reverse(), clusters: [...data.clusters].reverse() });
    for (const node of data.nodes) {
      const a = expected.indexById[node.id] * 3;
      const b = reordered.indexById[node.id] * 3;
      expect(reordered.positions.slice(b, b + 3)).toEqual(expected.positions.slice(a, a + 3));
    }
    expect(computeLayout({ ...data, clusters: [...data.clusters, { id: "empty", label: "Empty", rationale: "test" }] }).positions).toEqual(expected.positions);
  });

  it("keeps a populated benchmark spatial, bounded and visually separated in XY", () => {
    const seed = syntheticGalaxy();
    const data = { ...seed, edges: [], nodes: Array.from({ length: 500 }, (_, i) => ({ ...seed.nodes[i % seed.nodes.length], id: `benchmark-${i}` })) };
    const layout = computeLayout(data);
    const depths = layout.positions.filter((_, i) => i % 3 === 2);
    expect(Math.max(...depths) - Math.min(...depths)).toBeGreaterThan(9);
    const nearest: number[] = [];
    for (let i = 0; i < data.nodes.length; i += 1) {
      const [x, y, z] = layout.positions.slice(i * 3, i * 3 + 3);
      expect(Math.abs(x)).toBeLessThanOrEqual(42);
      expect(y).toBeGreaterThanOrEqual(BRAIN_BOTTOM);
      expect(y).toBeLessThanOrEqual(BRAIN_TOP);
      expect(Math.abs(z)).toBeLessThanOrEqual(8);
      expect(layout.radii[i]).toBeGreaterThanOrEqual(0.15);
      expect(layout.radii[i]).toBeLessThanOrEqual(0.3);
      let distance = Infinity;
      for (let j = 0; j < data.nodes.length; j += 1) {
        if (i === j) continue;
        distance = Math.min(distance, Math.hypot(x - layout.positions[j * 3], y - layout.positions[j * 3 + 1]));
      }
      nearest.push(distance);
    }
    // Depth must not disguise screen-space collisions in dense territories.
    nearest.sort((a, b) => a - b);
    expect(nearest[Math.floor(nearest.length * 0.1)]).toBeGreaterThan(0.6);
  });

  it("keeps every point inside one continuous asymmetric side profile", () => {
    const seed = syntheticGalaxy();
    const clusters = Array.from({ length: 8 }, (_, index) => ({ id: `territory-${index}`, label: `Territory ${index}`, rationale: "test" }));
    const nodes = Array.from({ length: 320 }, (_, index) => ({
      ...seed.nodes[index % seed.nodes.length],
      id: `brain-${index}`,
      cluster: clusters[index % clusters.length].id,
    }));
    const layout = computeLayout({ ...seed, clusters, nodes, edges: [] });
    let head = 0;
    const stemXs: number[] = [];
    const headXs: number[] = [];
    nodes.forEach((_, index) => {
      const x = layout.positions[index * 3];
      const y = layout.positions[index * 3 + 1];
      const radius = layout.radii[index];
      const [left, right] = brainProfileBounds(y);
      expect(y).toBeGreaterThanOrEqual(BRAIN_BOTTOM + radius - 1e-9);
      expect(y).toBeLessThanOrEqual(BRAIN_TOP - radius + 1e-9);
      expect(x).toBeGreaterThanOrEqual(left + radius - 1e-9);
      expect(x).toBeLessThanOrEqual(right - radius + 1e-9);
      if (y > BRAIN_STEM_JOIN) {
        head += 1;
        headXs.push(x);
      } else {
        stemXs.push(x);
      }
    });
    const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
    expect(head).toBeGreaterThan(nodes.length * 0.75);
    expect(stemXs.length).toBeGreaterThan(nodes.length * 0.05);
    expect(stemXs.length).toBeLessThan(nodes.length * 0.28);
    expect(mean(stemXs)).toBeGreaterThan(mean(headXs) + 4);
    const headWidth = brainProfileBounds(2);
    const lowerStemWidth = brainProfileBounds(-32);
    expect(headWidth[1] - headWidth[0]).toBeGreaterThan((lowerStemWidth[1] - lowerStemWidth[0]) * 3);
  });

  it("makes the real corpus describe a filled side profile with crown, body and stem", () => {
    const data = galaxyFixture as GalaxyData;
    const layout = computeLayout(data);
    let contour = 0;
    let crown = 0;
    let centralBody = 0;
    const stemXs: number[] = [];
    data.nodes.forEach((_, index) => {
      const x = layout.positions[index * 3];
      const y = layout.positions[index * 3 + 1];
      const radius = layout.radii[index];
      const [left, right] = brainProfileBounds(y);
      const center = (left + right) * 0.5;
      const shellDistance = Math.min(x - left - radius, right - radius - x);
      if (shellDistance < 4) contour += 1;
      if (y > 20) crown += 1;
      if (y > BRAIN_STEM_JOIN && Math.abs(x - center) < 7) centralBody += 1;
      if (y < -22) stemXs.push(x);
    });
    expect(contour).toBeGreaterThan(data.nodes.length * 0.14);
    expect(contour).toBeLessThan(data.nodes.length * 0.5);
    expect(crown).toBeGreaterThan(8);
    expect(centralBody).toBeGreaterThan(data.nodes.length * 0.08);
    expect(stemXs.length).toBeGreaterThan(5);
    expect(stemXs.reduce((sum, x) => sum + x, 0) / stemXs.length).toBeGreaterThan(6);
  });

  it("handles empty and single-category graphs without non-finite coordinates", () => {
    const data = syntheticGalaxy();
    expect(computeLayout({ ...data, nodes: [], edges: [] }).positions).toEqual([]);
    const one = computeLayout({ ...data, nodes: data.nodes.map((node) => ({ ...node, cluster: data.clusters[0].id })) });
    expect(one.positions.every(Number.isFinite)).toBe(true);
    expect(nodeVisualRadius(-1)).toBe(nodeVisualRadius(1));
    expect(nodeVisualRadius(100)).toBe(nodeVisualRadius(10));
  });

});
