import { describe, expect, it } from "vitest";

import { LABEL_REVEAL_DELAY_MS, shouldHideLabels, snapLabelCoordinate } from "./label-position";

describe("snapLabelCoordinate", () => {
  it("snaps DOM labels to whole CSS pixels at DPR 1", () => {
    expect(snapLabelCoordinate(12.49, 1)).toBe(12);
    expect(snapLabelCoordinate(12.5, 1)).toBe(13);
  });

  it("preserves half-pixel positions on DPR 2 displays", () => {
    expect(snapLabelCoordinate(12.24, 2)).toBe(12);
    expect(snapLabelCoordinate(12.26, 2)).toBe(12.5);
  });

  it("falls back safely when DPR is invalid", () => {
    expect(snapLabelCoordinate(7.6, 0)).toBe(8);
    expect(snapLabelCoordinate(7.6, Number.NaN)).toBe(8);
  });
});

describe("shouldHideLabels", () => {
  it("keeps labels hidden during direct manipulation", () => {
    expect(shouldHideLabels(1_000, 0, true, false)).toBe(true);
  });

  it("keeps labels hidden during authored camera motion", () => {
    expect(shouldHideLabels(1_000, 0, false, true)).toBe(true);
  });

  it("holds labels off until inertial movement has settled", () => {
    const revealAfter = 1_000 + LABEL_REVEAL_DELAY_MS;
    expect(shouldHideLabels(revealAfter - 1, revealAfter, false, false)).toBe(true);
    expect(shouldHideLabels(revealAfter, revealAfter, false, false)).toBe(false);
  });
});
