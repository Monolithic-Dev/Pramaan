// Catalogue of Indian central schemes an infrastructure issue could be funded from. It exists so a
// ranked citizen issue can be connected to a real funding route: the gap this product closes is
// between what citizens report and the national programmes that could pay for the fix.
//
// Sharing ratios are the *typical* central share for a general-category state as published in the
// scheme guidelines; they differ for North-Eastern / Himalayan states, Union Territories and by
// city size. Every match carries guideline_note so the UI never presents them as sanctioned
// figures: an officer must confirm against the current guidelines before committing funds.

export interface Scheme {
  id: string;
  name: string;
  short: string;
  ministry: string;
  /** Issue categories (see CATEGORIES in the web app) this scheme can fund. */
  categories: string[];
  settlement: "urban" | "rural" | "both";
  /** Typical central share of project cost, 0..1. */
  centre_share: number;
  summary: string;
  /** Words in an issue's subcategory/description that make this scheme a closer fit. */
  keywords: string[];
  /** The national mission or priority the scheme serves, for the alignment view. */
  priority: string;
  requires_mp_recommendation?: boolean;
  guideline_note: string;
}

const NOTE_STD = "Typical sharing for a general-category state; NE/Himalayan states and UTs differ. Confirm against current guidelines.";

export const SCHEMES: Scheme[] = [
  {
    id: "pmgsy",
    name: "Pradhan Mantri Gram Sadak Yojana",
    short: "PMGSY",
    ministry: "Ministry of Rural Development",
    categories: ["roads"],
    settlement: "rural",
    centre_share: 0.6,
    summary: "All-weather road connectivity to unconnected rural habitations and upgrade of through routes.",
    keywords: ["road", "bridge", "connectivity", "village", "habitation", "culvert"],
    priority: "Rural connectivity",
    guideline_note: NOTE_STD,
  },
  {
    id: "mgnregs",
    name: "Mahatma Gandhi National Rural Employment Guarantee Scheme",
    short: "MGNREGS",
    ministry: "Ministry of Rural Development",
    categories: ["roads", "water", "other"],
    settlement: "rural",
    centre_share: 0.75,
    summary: "Wage employment on rural assets: village roads, water conservation, ponds and drainage. The centre pays wages in full and most of the material cost.",
    keywords: ["pond", "drain", "conservation", "watershed", "path", "village road", "flood"],
    priority: "Rural livelihoods and asset creation",
    guideline_note: "Only works on the permissible list qualify; wage share is 100% central, material is shared. Confirm the work is admissible.",
  },
  {
    id: "jjm",
    name: "Jal Jeevan Mission",
    short: "JJM",
    ministry: "Ministry of Jal Shakti",
    categories: ["water"],
    settlement: "rural",
    centre_share: 0.5,
    summary: "Functional household tap connections and source strengthening so every rural household gets safe water.",
    keywords: ["tap", "pipeline", "borewell", "supply", "drinking", "handpump", "tank"],
    priority: "Har Ghar Jal",
    guideline_note: NOTE_STD,
  },
  {
    id: "amrut2",
    name: "AMRUT 2.0",
    short: "AMRUT 2.0",
    ministry: "Ministry of Housing and Urban Affairs",
    categories: ["water", "sanitation"],
    settlement: "urban",
    centre_share: 0.33,
    summary: "Universal water supply and sewerage/septage coverage in urban local bodies, plus water-body rejuvenation.",
    keywords: ["sewer", "sewage", "septic", "pipeline", "supply", "waterlogging", "lake", "drain"],
    priority: "Urban water and sewerage",
    guideline_note: "Central share varies with city size (roughly a quarter for the largest cities up to half for the smallest). Confirm the city band.",
  },
  {
    id: "sbmu2",
    name: "Swachh Bharat Mission (Urban) 2.0",
    short: "SBM-U 2.0",
    ministry: "Ministry of Housing and Urban Affairs",
    categories: ["sanitation"],
    settlement: "urban",
    centre_share: 0.33,
    summary: "Garbage-free cities: solid waste processing, community and public toilets, used-water management.",
    keywords: ["garbage", "waste", "toilet", "litter", "dump", "sweeping", "sanitation"],
    priority: "Swachh Bharat",
    guideline_note: "Central share varies with city size. Confirm the city band.",
  },
  {
    id: "sbmg",
    name: "Swachh Bharat Mission (Gramin) Phase II",
    short: "SBM-G II",
    ministry: "Ministry of Jal Shakti",
    categories: ["sanitation"],
    settlement: "rural",
    centre_share: 0.6,
    summary: "ODF-Plus villages: sustained toilet use plus solid and liquid waste management at village level.",
    keywords: ["toilet", "waste", "drain", "greywater", "village", "open defecation"],
    priority: "Swachh Bharat",
    guideline_note: NOTE_STD,
  },
  {
    id: "nhm",
    name: "National Health Mission",
    short: "NHM",
    ministry: "Ministry of Health and Family Welfare",
    categories: ["health_infra"],
    settlement: "both",
    centre_share: 0.6,
    summary: "Strengthening sub-centres, primary and community health centres, and district hospitals.",
    keywords: ["clinic", "phc", "hospital", "health centre", "sub-centre", "ambulance", "doctor"],
    priority: "Universal health coverage",
    guideline_note: NOTE_STD,
  },
  {
    id: "pmabhim",
    name: "PM Ayushman Bharat Health Infrastructure Mission",
    short: "PM-ABHIM",
    ministry: "Ministry of Health and Family Welfare",
    categories: ["health_infra"],
    settlement: "both",
    centre_share: 0.6,
    summary: "Health and wellness centres, critical-care blocks, laboratories and surveillance capacity.",
    keywords: ["wellness", "lab", "icu", "critical", "block", "diagnostic"],
    priority: "Ayushman Bharat",
    guideline_note: NOTE_STD,
  },
  {
    id: "samagra",
    name: "Samagra Shiksha",
    short: "Samagra Shiksha",
    ministry: "Ministry of Education",
    categories: ["education_infra"],
    settlement: "both",
    centre_share: 0.6,
    summary: "School infrastructure: classrooms, laboratories, libraries, toilets, drinking water and ramps.",
    keywords: ["school", "classroom", "toilet", "library", "lab", "roof", "building", "desk"],
    priority: "Quality school education",
    guideline_note: NOTE_STD,
  },
  {
    id: "rdss",
    name: "Revamped Distribution Sector Scheme",
    short: "RDSS",
    ministry: "Ministry of Power",
    categories: ["electricity"],
    settlement: "both",
    centre_share: 0.6,
    summary: "Distribution network upgrades: feeders, transformers, smart meters and loss reduction, routed through the DISCOM.",
    keywords: ["transformer", "outage", "power cut", "voltage", "feeder", "line", "meter", "streetlight"],
    priority: "Reliable power for all",
    guideline_note: "Grant is routed through the DISCOM and tied to performance milestones; central share is a percentage of eligible cost.",
  },
  {
    id: "xvfc",
    name: "XV Finance Commission Grants to Local Bodies",
    short: "15th FC grants",
    ministry: "Ministry of Finance / State Finance Departments",
    categories: ["water", "sanitation", "health_infra", "roads", "education_infra", "other"],
    settlement: "both",
    centre_share: 1,
    summary: "Untied and tied grants to rural and urban local bodies, usable for basic services such as drinking water, sanitation and local roads.",
    keywords: ["panchayat", "municipal", "ward", "local body"],
    priority: "Local self-government",
    guideline_note: "Released to the local body, which decides the works: this is a route for the local body itself, not a separate application.",
  },
  {
    id: "mplads",
    name: "Members of Parliament Local Area Development Scheme",
    short: "MPLADS",
    ministry: "Ministry of Statistics and Programme Implementation",
    categories: ["roads", "water", "electricity", "sanitation", "health_infra", "education_infra", "other"],
    settlement: "both",
    centre_share: 1,
    summary: "Each MP recommends durable community assets in their constituency, funded in full from their annual entitlement.",
    keywords: [],
    priority: "Community assets",
    requires_mp_recommendation: true,
    guideline_note: "Needs a recommendation from the constituency's MP and must create a durable community asset.",
  },
  {
    id: "state_plan",
    name: "District Plan / State Capital Outlay",
    short: "District Plan",
    ministry: "State Planning Department",
    categories: ["roads", "water", "electricity", "sanitation", "health_infra", "education_infra", "other"],
    settlement: "both",
    centre_share: 0,
    summary: "State-funded works through the District Planning Committee: the fallback when no central scheme fits.",
    keywords: [],
    priority: "State priorities",
    guideline_note: "Fully state-funded; subject to the district plan approved by the District Planning Committee.",
  },
];

export const SCHEME_BY_ID = new Map(SCHEMES.map((s) => [s.id, s]));
