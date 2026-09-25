// Realistic citizen reports for the demo dataset. English is authored here; the other languages are
// generated once by translateDemoContent.ts into demoContent.i18n.json (reviewed, committed) so seeding
// stays deterministic and offline. Every report is location-free on purpose: the place is carried by the
// submission's location_text and coordinates, and PII (names, phone numbers) never appears.

export type Category = "roads" | "water" | "electricity" | "sanitation" | "health_infra" | "education_infra" | "other";

export interface Template {
  id: string;
  category: Category;
  subcategory: string;
  /** The issue's canonical (merged) description, as the pipeline would write it. */
  canonical: string;
  /** How individual citizens phrase it. */
  reports: string[];
  /** Calendar months (1-12) when this problem peaks: drives the seasonal forecast demo. */
  peak?: number[];
  /** A genuine hazard: eligible for the emergency override. */
  hazard?: boolean;
}

export const TEMPLATES: Template[] = [
  // ---- roads ----
  { id: "roads.pothole", category: "roads", subcategory: "pothole", peak: [7, 8, 9, 10], canonical: "Large potholes on the main road cause accidents and slow traffic.",
    reports: ["There are big potholes on our main road and two wheelers keep slipping.", "The road is full of potholes since the rains; it is dangerous at night."] },
  { id: "roads.waterlogged", category: "roads", subcategory: "waterlogged road", peak: [6, 7, 8, 9], canonical: "The road floods after every rain and stays impassable for days.",
    reports: ["Every time it rains the road is under water and we cannot get to work.", "Water stands on the road for days because the drain is blocked."] },
  { id: "roads.bridge", category: "roads", subcategory: "damaged bridge or culvert", hazard: true, canonical: "A culvert on the village link road has cracked and is unsafe for vehicles.",
    reports: ["The culvert near our village has cracked and vehicles are afraid to cross it.", "The small bridge on the link road is damaged and may collapse in the next rain."] },
  { id: "roads.footpath", category: "roads", subcategory: "broken footpath", canonical: "The footpath is broken and unusable for the elderly and children.",
    reports: ["The footpath outside the school is broken, children have to walk on the road.", "There is no proper footpath and old people fall on the broken slabs."] },
  { id: "roads.connectivity", category: "roads", subcategory: "no all-weather road", peak: [6, 7, 8, 9], canonical: "The hamlet has no all-weather road and is cut off during the monsoon.",
    reports: ["Our hamlet has only a mud track and becomes cut off in the rainy season.", "There is no proper road to our settlement, ambulances cannot reach us."] },
  { id: "roads.markings", category: "roads", subcategory: "missing signs and speed breakers", canonical: "A busy junction has no signage or speed breakers, and accidents are frequent.",
    reports: ["There is no sign board or speed breaker at the crossing and vehicles come very fast.", "Accidents keep happening at this junction because there are no markings."] },

  // ---- water ----
  { id: "water.no_supply", category: "water", subcategory: "no drinking water supply", peak: [4, 5, 6], canonical: "Households receive no piped drinking water and depend on tankers.",
    reports: ["We have not received tap water for many days and have to buy from tankers.", "There is no drinking water supply in our area, women walk far to fetch water."] },
  { id: "water.leak", category: "water", subcategory: "pipeline leakage", canonical: "A main pipeline is leaking and wasting water while nearby homes go dry.",
    reports: ["A big water pipe is leaking on the street since last week and nobody has repaired it.", "Clean water is flowing onto the road from a broken pipe while our taps are dry."] },
  { id: "water.contaminated", category: "water", subcategory: "contaminated water", hazard: true, canonical: "Tap water is muddy and foul-smelling, and residents are falling sick.",
    reports: ["The water from our tap is dirty and smells bad, children have stomach infections.", "The supply water is contaminated and many families are sick."] },
  { id: "water.handpump", category: "water", subcategory: "dry handpump or borewell", peak: [3, 4, 5, 6], canonical: "The village handpump and borewell have run dry.",
    reports: ["Our village handpump has stopped giving water and the borewell is dry.", "The only borewell in our locality is not working and we have no other source."] },
  { id: "water.sewer_mix", category: "water", subcategory: "sewage mixing with supply", canonical: "Sewage is seeping into the drinking water line.",
    reports: ["Sewage water is mixing with our drinking water pipe after every rain.", "The drain runs next to the water pipe and dirty water enters the supply."] },

  // ---- electricity ----
  { id: "electricity.outages", category: "electricity", subcategory: "frequent power cuts", peak: [4, 5, 6], canonical: "Power cuts of many hours happen daily, affecting homes and small businesses.",
    reports: ["We face power cuts for many hours every day, especially in the evening.", "The electricity keeps going off and small shops cannot work."] },
  { id: "electricity.transformer", category: "electricity", subcategory: "transformer failure", canonical: "The local transformer has failed and the neighbourhood has been without power.",
    reports: ["Our area transformer burnt out and there has been no electricity for days.", "The transformer near the temple is damaged and has not been replaced."] },
  { id: "electricity.streetlight", category: "electricity", subcategory: "streetlights not working", canonical: "Streetlights on the road have been off for weeks, making it unsafe after dark.",
    reports: ["The streetlights on our road are not working and it is very dark and unsafe at night.", "All the lights in our lane are off, women are afraid to go out in the evening."] },
  { id: "electricity.wires", category: "electricity", subcategory: "exposed live wires", hazard: true, canonical: "Live electric wires hang low near a school and pose a danger to life.",
    reports: ["Electric wires are hanging very low near the school gate and children could touch them.", "A live wire has fallen near the market and nobody has come to fix it."] },
  { id: "electricity.voltage", category: "electricity", subcategory: "low voltage", canonical: "Persistent low voltage damages appliances and pumps.",
    reports: ["The voltage is so low that our fans and pumps do not run properly.", "Low voltage every evening has damaged many of our appliances."] },

  // ---- sanitation ----
  { id: "sanitation.garbage", category: "sanitation", subcategory: "garbage not collected", peak: [7, 8, 9], canonical: "Garbage has not been collected for days and is piling up in the street.",
    reports: ["Garbage has not been picked up for over a week and it smells terrible.", "The waste collection vehicle has stopped coming and rubbish is piling up."] },
  { id: "sanitation.drain", category: "sanitation", subcategory: "open drain overflow", peak: [6, 7, 8, 9], canonical: "An open drain overflows into the street, causing mosquitoes and disease.",
    reports: ["The open drain in front of our houses overflows and dirty water enters the road.", "Mosquitoes are breeding in the blocked drain and people are getting fever."] },
  { id: "sanitation.toilets", category: "sanitation", subcategory: "no public toilets", canonical: "The market area has no public toilet, especially affecting women.",
    reports: ["There is no public toilet near the market and women face great difficulty.", "Our locality has no community toilet, people are forced to defecate in the open."] },
  { id: "sanitation.sewage", category: "sanitation", subcategory: "sewage on the road", canonical: "Sewage flows onto the road because the sewer line is broken.",
    reports: ["Sewage is flowing on the road from a broken sewer line and the smell is unbearable.", "The sewer is choked and the dirty water has entered our houses."] },
  { id: "sanitation.dump", category: "sanitation", subcategory: "illegal dumping", canonical: "Waste is being dumped on an empty plot and burnt, causing smoke.",
    reports: ["People dump garbage on the empty plot and burn it, the smoke is harming children.", "There is a big illegal garbage dump next to our homes."] },

  // ---- health_infra ----
  { id: "health.no_doctor", category: "health_infra", subcategory: "health centre without doctor", canonical: "The primary health centre has no doctor and is often closed.",
    reports: ["The health centre in our area has no doctor and is mostly closed.", "We travel very far to see a doctor because the local clinic has none."] },
  { id: "health.ambulance", category: "health_infra", subcategory: "no ambulance", canonical: "There is no ambulance available for the area, delaying emergencies.",
    reports: ["There is no ambulance in our area and patients are taken on bikes and carts.", "During an emergency the ambulance never comes on time, or at all."] },
  { id: "health.building", category: "health_infra", subcategory: "clinic building in disrepair", peak: [6, 7, 8, 9], canonical: "The clinic building leaks and its roof is falling apart.",
    reports: ["The roof of our health centre leaks in the rain and medicines get spoilt.", "The clinic building is in very bad condition and unsafe for patients."] },
  { id: "health.maternity", category: "health_infra", subcategory: "no maternity facility", canonical: "There is no safe delivery facility within reasonable distance.",
    reports: ["Pregnant women have to travel a long way as there is no delivery room nearby.", "Our health centre has no maternity ward and women deliver at home."] },
  { id: "health.equipment", category: "health_infra", subcategory: "missing basic equipment", canonical: "The health centre lacks basic equipment such as beds, cold chain and lab facilities.",
    reports: ["The clinic has no beds or basic testing equipment.", "There is no place to keep vaccines and no laboratory in the health centre."] },

  // ---- education_infra ----
  { id: "education.toilets", category: "education_infra", subcategory: "school without toilets", canonical: "The school has no usable toilets, and girls are dropping out.",
    reports: ["Our school has no working toilets and girls are missing classes.", "There is no separate toilet for girls in the school."] },
  { id: "education.roof", category: "education_infra", subcategory: "leaking classroom roof", peak: [6, 7, 8, 9], canonical: "Classrooms leak during rain and lessons have to be stopped.",
    reports: ["The classroom roof leaks so much in the rain that children are sent home.", "The school building is old and water pours into the classrooms."] },
  { id: "education.water", category: "education_infra", subcategory: "no drinking water in school", canonical: "The school has no safe drinking water for students.",
    reports: ["There is no drinking water in the school and children bring bottles from home.", "The school handpump is broken and students drink unsafe water."] },
  { id: "education.wall", category: "education_infra", subcategory: "no boundary wall", canonical: "The school has no boundary wall and strangers and animals enter the campus.",
    reports: ["The school has no compound wall and stray animals come into the playground.", "Without a boundary wall the school is not safe for children."] },
  { id: "education.benches", category: "education_infra", subcategory: "no desks or benches", canonical: "Students sit on the floor because the school lacks desks and benches.",
    reports: ["Children sit on the floor in our school as there are no benches.", "The school does not have enough desks and classrooms for all students."] },

  // ---- other ----
  { id: "other.encroachment", category: "other", subcategory: "encroachment on public land", canonical: "Public land and the pavement have been encroached, blocking access.",
    reports: ["The pavement and public land near us have been taken over by illegal shops.", "An encroachment is blocking the lane and emergency vehicles cannot pass."] },
  { id: "other.park", category: "other", subcategory: "public park in disrepair", canonical: "The neighbourhood park is unusable and unsafe.",
    reports: ["The park in our colony is full of weeds and broken benches, children cannot play.", "Our public park has no lights or fencing and is not safe."] },
  { id: "other.bus_shelter", category: "other", subcategory: "no bus shelter", canonical: "The bus stop has no shelter, leaving commuters exposed to sun and rain.",
    reports: ["There is no shelter at our bus stop, people stand in the sun and rain.", "The bus stop is just a pole with no seating or roof."] },
  { id: "other.community_hall", category: "other", subcategory: "community facility missing", canonical: "The community hall is locked and unusable for residents.",
    reports: ["The community hall in our ward has been locked for years.", "We have no common place for meetings or functions in our locality."] },
];

export const CATEGORIES: Category[] = ["roads", "water", "electricity", "sanitation", "health_infra", "education_infra", "other"];
export const TEMPLATES_BY_CATEGORY = new Map(CATEGORIES.map((c) => [c, TEMPLATES.filter((t) => t.category === c)]));

/** Indian state ISO code -> languages residents are likely to write in (first is the most common). */
export const STATE_LANGUAGES: Record<string, string[]> = {
  DL: ["hi", "en"], MH: ["mr", "hi", "en"], KA: ["kn", "en"], TN: ["ta", "en"], WB: ["bn", "en"], TS: ["te", "en"],
  GJ: ["gu", "hi"], RJ: ["hi"], UP: ["hi"], BR: ["hi"], MP: ["hi"], KL: ["ml", "en"], OD: ["hi", "en"], JH: ["hi"],
  AS: ["en", "bn"], UK: ["hi"], CT: ["hi"], AP: ["te", "en"], PB: ["pa", "hi"], HR: ["hi", "en"], HP: ["hi"], GA: ["en", "mr"],
  JK: ["en", "hi"], MN: ["en"],
};
export const BRAZIL_LANGUAGES = ["pt"];

export const LANGUAGE_NAMES: Record<string, string> = {
  en: "English", hi: "Hindi", ta: "Tamil", bn: "Bengali", te: "Telugu", mr: "Marathi", kn: "Kannada",
  ml: "Malayalam", gu: "Gujarati", pa: "Punjabi", pt: "Brazilian Portuguese",
};

/** Comments officers leave on issues, and the reasons recorded in the audit trail. */
export const OFFICER_NOTES = [
  "Site visit scheduled for Thursday with the junior engineer.",
  "Spoke to the ward member, they confirm the problem has existed for months.",
  "Photographs match the reports. Recommending priority handling.",
  "Waiting for the department's cost estimate before we can fund this.",
  "Contractor identified; work order to be issued this week.",
  "Coordinating with the water board, this overlaps with their pipeline upgrade.",
  "Residents have been informed of the timeline through the platform.",
  "Similar issue reported two lanes away; checking whether it is the same cause.",
];
export const AUDIT_REASONS = {
  verified: ["Verified on site by the ward officer.", "Corroborated by photographs and multiple reporters.", "Confirmed during the weekly field inspection."],
  disputed: ["Location does not match the description; awaiting clarification.", "Could not be reproduced on inspection."],
  funded: ["Sanctioned under the district capital budget.", "Approved as part of the quarterly investment plan.", "Funding released from the central scheme allocation."],
  in_progress: ["Work order issued and contractor mobilised.", "Work started on site."],
};
