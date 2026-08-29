import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dataset = JSON.parse(readFileSync(new URL("../public/data/compatibility.v1.json", import.meta.url), "utf8"));

describe("public dataset", () => {
  it("uses explicit lack-of-data instead of inventing observations", () => {
    expect(dataset.records.length).toBeGreaterThan(0);
    expect(dataset.records.every((record: { capability: string }) => record.capability === "lack-of-data")).toBe(true);
  });

  it("requires a meaningful contribution batch", () => {
    expect(dataset.minimumContributionSize).toBeGreaterThanOrEqual(20);
  });
});
