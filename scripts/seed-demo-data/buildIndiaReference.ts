// Extends scripts/seed-demo-data/source/*.csv from the original 3 states / 6 districts to all 36
// Indian states and union territories plus ~40 major districts, and a wider slice of Brazil, so the
// national view, the state-onboarding demo and the "Depth & Reach" story have real geography behind them.
//
// What is real: state and district names, 2011-Census populations (rounded) and centroids (approximate),
// and state literacy rates (Census 2011). What is illustrative: every other index (road density, water
// access, health facilities, poverty) is derived from literacy with a deterministic jitter, and every
// investment record is synthetic. All of it is labelled as sample data in the CSVs and in the UI.
//
// Deterministic and idempotent: run it again and the CSVs come out identical.
// Run: ./node_modules/.bin/tsx seed-demo-data/buildIndiaReference.ts
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "source");

// [iso, name, population, lat, lng, literacy %]
const STATES: [string, string, number, number, number, number][] = [
  ["AN", "Andaman and Nicobar Islands", 380581, 11.7401, 92.6586, 86.6],
  ["AP", "Andhra Pradesh", 49577103, 15.9129, 79.74, 67.0],
  ["AR", "Arunachal Pradesh", 1383727, 28.218, 94.7278, 65.4],
  ["AS", "Assam", 31205576, 26.2006, 92.9376, 72.2],
  ["BR", "Bihar", 104099452, 25.0961, 85.3131, 61.8],
  ["CH", "Chandigarh", 1055450, 30.7333, 76.7794, 86.0],
  ["CT", "Chhattisgarh", 25545198, 21.2787, 81.8661, 70.3],
  ["DN", "Dadra and Nagar Haveli and Daman and Diu", 585764, 20.3974, 72.8328, 76.2],
  ["DL", "Delhi", 16787941, 28.7041, 77.1025, 86.2],
  ["GA", "Goa", 1458545, 15.2993, 74.124, 88.7],
  ["GJ", "Gujarat", 60439692, 22.2587, 71.1924, 78.0],
  ["HR", "Haryana", 25351462, 29.0588, 76.0856, 75.6],
  ["HP", "Himachal Pradesh", 6864602, 31.1048, 77.1734, 82.8],
  ["JK", "Jammu and Kashmir", 12541302, 33.7782, 76.5762, 67.2],
  ["JH", "Jharkhand", 32988134, 23.6102, 85.2799, 66.4],
  ["KA", "Karnataka", 61095297, 15.3173, 75.7139, 75.4],
  ["KL", "Kerala", 33406061, 10.8505, 76.2711, 94.0],
  ["LA", "Ladakh", 274289, 34.1526, 77.577, 77.2],
  ["LD", "Lakshadweep", 64473, 10.5667, 72.6417, 91.8],
  ["MP", "Madhya Pradesh", 72626809, 22.9734, 78.6569, 69.3],
  ["MH", "Maharashtra", 112374333, 19.7515, 75.7139, 82.3],
  ["MN", "Manipur", 2855794, 24.6637, 93.9063, 76.9],
  ["ML", "Meghalaya", 2966889, 25.467, 91.3662, 74.4],
  ["MZ", "Mizoram", 1097206, 23.1645, 92.9376, 91.6],
  ["NL", "Nagaland", 1978502, 26.1584, 94.5624, 79.6],
  ["OD", "Odisha", 41974218, 20.9517, 85.0985, 72.9],
  ["PY", "Puducherry", 1247953, 11.9416, 79.8083, 85.8],
  ["PB", "Punjab", 27743338, 31.1471, 75.3412, 75.8],
  ["RJ", "Rajasthan", 68548437, 27.0238, 74.2179, 66.1],
  ["SK", "Sikkim", 610577, 27.533, 88.5122, 81.4],
  ["TN", "Tamil Nadu", 72147030, 11.1271, 78.6569, 80.1],
  ["TS", "Telangana", 35193978, 18.1124, 79.0193, 66.5],
  ["TR", "Tripura", 3673917, 23.9408, 91.9882, 87.2],
  ["UP", "Uttar Pradesh", 199812341, 26.8467, 80.9462, 67.7],
  ["UK", "Uttarakhand", 10086292, 30.0668, 79.0193, 78.8],
  ["WB", "West Bengal", 91276115, 22.9868, 87.855, 76.3],
];

// [region_id, name, state iso, population, lat, lng]
const DISTRICTS: [string, string, string, number, number, number][] = [
  ["tn-chennai", "Chennai", "TN", 4646732, 13.0827, 80.2707],
  ["tn-coimbatore", "Coimbatore", "TN", 3458045, 11.0168, 76.9558],
  ["tn-madurai", "Madurai", "TN", 3038252, 9.9252, 78.1198],
  ["wb-kolkata", "Kolkata", "WB", 4496694, 22.5726, 88.3639],
  ["wb-howrah", "Howrah", "WB", 4850029, 22.5958, 88.2636],
  ["ts-hyderabad", "Hyderabad", "TS", 3943323, 17.385, 78.4867],
  ["ts-warangal", "Warangal", "TS", 3512576, 17.9689, 79.5941],
  ["gj-ahmedabad", "Ahmedabad", "GJ", 7214225, 23.0225, 72.5714],
  ["gj-surat", "Surat", "GJ", 6081322, 21.1702, 72.8311],
  ["rj-jaipur", "Jaipur", "RJ", 6626178, 26.9124, 75.7873],
  ["rj-jodhpur", "Jodhpur", "RJ", 3685681, 26.2389, 73.0243],
  ["up-lucknow", "Lucknow", "UP", 4589838, 26.8467, 80.9462],
  ["up-varanasi", "Varanasi", "UP", 3676841, 25.3176, 82.9739],
  ["up-kanpur-nagar", "Kanpur Nagar", "UP", 4581268, 26.4499, 80.3319],
  ["br-patna", "Patna", "BR", 5838465, 25.5941, 85.1376],
  ["br-gaya", "Gaya", "BR", 4391418, 24.7914, 85.0002],
  ["mp-bhopal", "Bhopal", "MP", 2371061, 23.2599, 77.4126],
  ["mp-indore", "Indore", "MP", 3276697, 22.7196, 75.8577],
  ["kl-thiruvananthapuram", "Thiruvananthapuram", "KL", 3301427, 8.5241, 76.9366],
  ["kl-ernakulam", "Ernakulam", "KL", 3282388, 9.9816, 76.2999],
  ["od-khordha", "Khordha", "OD", 2251673, 20.2961, 85.8245],
  ["od-cuttack", "Cuttack", "OD", 2618708, 20.4625, 85.883],
  ["jh-ranchi", "Ranchi", "JH", 2914253, 23.3441, 85.3096],
  ["as-kamrup-metropolitan", "Kamrup Metropolitan", "AS", 1253938, 26.1445, 91.7362],
  ["uk-dehradun", "Dehradun", "UK", 1696694, 30.3165, 78.0322],
  ["ct-raipur", "Raipur", "CT", 4063872, 21.2514, 81.6296],
  ["ap-visakhapatnam", "Visakhapatnam", "AP", 4288113, 17.6868, 83.2185],
  ["pb-ludhiana", "Ludhiana", "PB", 3498739, 30.901, 75.8573],
  ["hr-gurugram", "Gurugram", "HR", 1514432, 28.4595, 77.0266],
  ["hp-shimla", "Shimla", "HP", 813384, 31.1048, 77.1734],
  ["ga-north-goa", "North Goa", "GA", 818008, 15.4909, 73.8278],
  ["jk-srinagar", "Srinagar", "JK", 1269751, 34.0837, 74.7973],
  ["mn-imphal-west", "Imphal West", "MN", 517992, 24.817, 93.9368],
];

const BR_ESTADOS: [string, string, number, number, number][] = [
  ["BR-MG", "Minas Gerais", 20539989, -18.5122, -44.555],
  ["BR-RJ", "Rio de Janeiro", 16055174, -22.9068, -43.1729],
  ["BR-BA", "Bahia", 14136417, -12.5797, -41.7007],
  ["BR-PE", "Pernambuco", 9058931, -8.0476, -34.877],
  ["BR-RS", "Rio Grande do Sul", 10882965, -30.0346, -51.2177],
  ["BR-CE", "Ceará", 8794957, -3.7319, -38.5267],
];
const BR_MUNICIPIOS: [string, string, string, number, number, number][] = [
  ["br-belo-horizonte", "Belo Horizonte", "BR-MG", 2315560, -19.9167, -43.9345],
  ["br-rio-de-janeiro", "Rio de Janeiro", "BR-RJ", 6211423, -22.9068, -43.1729],
  ["br-salvador", "Salvador", "BR-BA", 2418005, -12.9714, -38.5014],
  ["br-recife", "Recife", "BR-PE", 1488920, -8.0476, -34.877],
  ["br-porto-alegre", "Porto Alegre", "BR-RS", 1332570, -30.0346, -51.2177],
  ["br-fortaleza", "Fortaleza", "BR-CE", 2428708, -3.7319, -38.5267],
];

// Small deterministic PRNG so regenerating never churns the CSVs.
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);
const clamp = (n: number, lo = 0.05, hi = 0.99) => Math.min(hi, Math.max(lo, n));
const r2 = (n: number) => Number(n.toFixed(2));

const readCsv = (name: string) => readFileSync(join(SRC, name), "utf8").trim().split(/\r?\n/);

function main() {
  // ---------- admin regions ----------
  const regionLines = readCsv("admin_regions.csv");
  const header = regionLines[0];
  const existingIds = new Set(regionLines.slice(1).map((l) => l.split(",")[0]));
  const rows: string[] = [];
  const add = (id: string, country: string, level: string, name: string, parent: string, pop: number, lat: number, lng: number, boundary: string) => {
    if (existingIds.has(id)) return;
    existingIds.add(id);
    rows.push([id, country, level, name, parent, pop, boundary, lat, lng].join(","));
  };

  add("IN", "IN", "country", "India", "", 1210854977, 22.9734, 78.6569, "bq://pramaan.reference.in_admin_boundaries/country/IN");
  add("BR", "BR", "country", "Brasil", "", 203062512, -14.235, -51.9253, "bq://pramaan.reference.br_admin_boundaries/country/BR");
  for (const [iso, name, pop, lat, lng] of STATES) {
    add(`IN-${iso}`, "IN", "state", name, "IN", pop, lat, lng, `bq://pramaan.reference.in_admin_boundaries/state/${iso}`);
  }
  for (const [id, name, iso, pop, lat, lng] of DISTRICTS) {
    add(id, "IN", "district", name, `IN-${iso}`, pop, lat, lng, `bq://pramaan.reference.in_admin_boundaries/district/${id}`);
  }
  for (const [id, name, pop, lat, lng] of BR_ESTADOS) {
    add(id, "BR", "estado", name, "BR", pop, lat, lng, `bq://pramaan.reference.br_admin_boundaries/estado/${id.slice(3)}`);
  }
  for (const [id, name, parent, pop, lat, lng] of BR_MUNICIPIOS) {
    add(id, "BR", "município", name, parent, pop, lat, lng, `bq://pramaan.reference.br_admin_boundaries/municipio/${id.slice(3)}`);
  }

  // Existing states gain the country as their parent, which is what makes a national jurisdiction possible.
  const updated = regionLines.slice(1).map((line) => {
    const cols = line.split(",");
    if (cols[2] === "state" && cols[4] === "") cols[4] = "IN";
    if (cols[2] === "estado" && cols[4] === "") cols[4] = "BR";
    return cols.join(",");
  });
  writeFileSync(join(SRC, "admin_regions.csv"), [header, ...updated, ...rows].join("\n") + "\n");

  // ---------- infra index ----------
  const infraLines = readCsv("infra_index.csv");
  const infraHeader = infraLines[0];
  const haveInfra = new Set(infraLines.slice(1).map((l) => l.split(",")[0]));
  const infra: string[] = [];
  const SRC_NAME = "Illustrative sample derived from Census 2011 literacy";
  const SRC_URL = "https://censusindia.gov.in/";
  const LICENCE = "Government Open Data Licence - India";
  const literacyByIso = new Map(STATES.map(([iso, , , , , lit]) => [iso, lit / 100]));

  const emit = (regionId: string, country: string, stateShort: string, literacy: number, salt: string) => {
    if (haveInfra.has(regionId)) return;
    const r = rng(hash(`${regionId}:${salt}`));
    // Everything except literacy is a noisy function of it: better-educated places tend to have better services.
    const dev = literacy + (r() - 0.5) * 0.08;
    const values: [string, number][] = [
      ["literacy_rate", clamp(literacy)],
      ["road_density", clamp(dev * 0.75 + (r() - 0.5) * 0.25)],
      ["water_access", clamp(dev * 0.9 + (r() - 0.5) * 0.2)],
      ["health_facility_ratio", clamp(dev * 0.6 + (r() - 0.5) * 0.25, 0.05, 0.9)],
      ["poverty_index", clamp((1 - dev) * 0.7 + (r() - 0.5) * 0.15)],
    ];
    for (const [type, value] of values) infra.push([regionId, country, stateShort, type, r2(value), SRC_NAME, SRC_URL, LICENCE, 2025].join(","));
  };

  for (const [iso, , , , , lit] of STATES) emit(`IN-${iso}`, "IN", iso, lit / 100, "state");
  for (const [id, , iso] of DISTRICTS) {
    const r = rng(hash(id));
    // Big-city districts are usually a bit better served than their state average.
    emit(id, "IN", iso, clamp((literacyByIso.get(iso) ?? 0.75) + 0.03 + (r() - 0.5) * 0.06), "district");
  }
  const brLiteracy = 0.93;
  for (const [id] of BR_ESTADOS) emit(id, "BR", id.slice(3), brLiteracy + (rng(hash(id))() - 0.5) * 0.04, "estado");
  for (const [id, , parent] of BR_MUNICIPIOS) emit(id, "BR", parent.slice(3), brLiteracy + 0.02 + (rng(hash(id))() - 0.5) * 0.03, "município");
  writeFileSync(join(SRC, "infra_index.csv"), [infraHeader, ...infraLines.slice(1), ...infra].join("\n") + "\n");

  // ---------- investment records ----------
  const invLines = readCsv("investment_record.csv");
  const invHeader = invLines[0];
  const haveInv = new Set(invLines.slice(1).map((l) => l.split(",")[0]));
  const inv: string[] = [];
  const CATS: [string, string, string, string][] = [
    ["roads", "Road Maintenance Scheme", "PMGSY", "INR"],
    ["water", "Water Supply Scheme", "JJM", "INR"],
    ["sanitation", "Sanitation Upgrade Scheme", "AMRUT", "INR"],
    ["health", "Primary Health Centre Scheme", "NHM", "INR"],
    ["education", "School Infrastructure Scheme", "SAMAGRA", "INR"],
  ];
  const addInv = (regionId: string, country: string, stateShort: string, seedKey: string, currency: string) => {
    const r = rng(hash(`inv:${seedKey}`));
    const n = r() < 0.25 ? 0 : 1 + Math.floor(r() * 2); // some districts have no investment record at all (a full data gap)
    for (let i = 0; i < n; i++) {
      const [cat, scheme, id, cur] = CATS[Math.floor(r() * CATS.length)];
      const fy = r() < 0.5 ? "2023-24" : "2024-25";
      const investmentId = `inv-${regionId}-${cat}-${fy.replace("20", "").replace("-", "")}`;
      if (haveInv.has(investmentId)) continue;
      haveInv.add(investmentId);
      const amount = Math.round((3 + r() * 20) * 100_000);
      const month = String(3 + Math.floor(r() * 9)).padStart(2, "0");
      const date = `${fy.slice(0, 4)}-${month}-15`;
      inv.push([investmentId, regionId, country, stateShort, `Sample ${scheme}`, id, amount, currency === "BRL" ? "BRL" : cur, cat, fy, date, "synthetic_demo"].join(","));
    }
  };
  for (const [id, , iso] of DISTRICTS) addInv(id, "IN", iso, id, "INR");
  for (const [id, , parent] of BR_MUNICIPIOS) addInv(id, "BR", parent.slice(3), id, "BRL");
  writeFileSync(join(SRC, "investment_record.csv"), [invHeader, ...invLines.slice(1), ...inv].join("\n") + "\n");

  console.log(`regions +${rows.length}, infra rows +${infra.length}, investments +${inv.length}`);
}

main();
