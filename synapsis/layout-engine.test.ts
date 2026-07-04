import { describe, expect, it } from "vitest";

import {
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
  return { version: 2, updatedAt: "2026-07-03", nodes, edges, clusters };
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
});
