import { describe, expect, it } from "vitest";
import { createFakeDeps } from "../testUtils/fakeDeps.js";
import { resolveLocation } from "./regionResolution.js";

const DELHI_STATE = { regionId: "IN-DL", level: "state", parentRegionId: null, lat: 28.7041, lng: 77.1025, population: 16787941 };
const CENTRAL_DELHI = {
  regionId: "dl-central-delhi",
  level: "district",
  parentRegionId: "IN-DL",
  lat: 28.6519,
  lng: 77.2315,
  population: 582320,
};
const SOUTH_DELHI = {
  regionId: "dl-south-delhi",
  level: "district",
  parentRegionId: "IN-DL",
  lat: 28.5245,
  lng: 77.2066,
  population: 2731929,
};

const SAO_PAULO_STATE = {
  regionId: "BR-SP",
  countryCode: "BR",
  level: "estado",
  parentRegionId: null,
  lat: -23.5505,
  lng: -46.6333,
  population: 46024937,
};
const SAO_PAULO_CITY = {
  regionId: "br-sao-paulo",
  countryCode: "BR",
  level: "município",
  parentRegionId: "BR-SP",
  lat: -23.5505,
  lng: -46.6333,
  population: 12325232,
};

describe("resolveLocation", () => {
  it("resolves nothing when coordinates are absent", async () => {
    const deps = createFakeDeps();
    const result = await resolveLocation(deps.referenceData, null, null, "IN");
    expect(result).toEqual({ geohash: null, adminRegionId: null, stateId: "UNRESOLVED", population: null });
  });

  it("resolves to the nearest district and its state ancestor when no regions are seeded", async () => {
    const deps = createFakeDeps(); // regionCentroids defaults to []
    const result = await resolveLocation(deps.referenceData, 28.6139, 77.209, "IN");
    expect(result.adminRegionId).toBeNull();
    expect(result.stateId).toBe("UNRESOLVED");
    expect(result.geohash).toBeTruthy(); // still computed even with no reference data
  });

  it("matches a coordinate to the nearest seeded district by real Haversine distance", async () => {
    const deps = createFakeDeps();
    deps.regionCentroids.push(DELHI_STATE, CENTRAL_DELHI, SOUTH_DELHI);

    // A point much closer to Central Delhi's centroid than South Delhi's.
    const result = await resolveLocation(deps.referenceData, 28.66, 77.23, "IN");

    expect(result.adminRegionId).toBe("dl-central-delhi");
    expect(result.stateId).toBe("IN-DL");
    expect(result.population).toBe(582320);
  });

  it("picks the other district when the point is closer to it", async () => {
    const deps = createFakeDeps();
    deps.regionCentroids.push(DELHI_STATE, CENTRAL_DELHI, SOUTH_DELHI);

    const result = await resolveLocation(deps.referenceData, 28.52, 77.2, "IN");

    expect(result.adminRegionId).toBe("dl-south-delhi");
  });

  // docs/CROSS_BORDER_AND_DPG.md: a BR submission must resolve against BR
  // regions only, even though every seeded IN district is closer in raw
  // Haversine terms (São Paulo is nowhere near any seeded Indian centroid) —
  // this test would fail loudly (wrong-country match) without the scoping.
  it("scopes nearest-centroid matching to the submission's country", async () => {
    const deps = createFakeDeps();
    deps.regionCentroids.push(DELHI_STATE, CENTRAL_DELHI, SOUTH_DELHI, SAO_PAULO_STATE, SAO_PAULO_CITY);

    const result = await resolveLocation(deps.referenceData, -23.55, -46.63, "BR");

    expect(result.adminRegionId).toBe("br-sao-paulo");
    expect(result.stateId).toBe("BR-SP");
  });
});
