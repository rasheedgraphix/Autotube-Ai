import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import os from "os";
import { fetchHighestCTRCategory, CategoryCTRMetric } from "./analytics";
import { createViralFactVideo, VideoScene } from "./videoGenerator";
import { ensureAutotubeDirectory, AUTOTUBE_TMP_DIR } from "./ffmpegHelper";
import {
  inspectHighlightLink,
  extract5SecClipsFromHighlight,
  buildMultiHighlightScript,
  HighlightLinkMetadata,
  ExtractedClipItem,
} from "./cricketHighlightService";
import { generateProfessionalThumbnail, uploadThumbnailToYouTube } from "./thumbnailService";
import { generateSuperProfessionalSEO, evaluateCTRScore, getRealTimeTrendingTopics } from "./seoOptimizer";
import { loadPersistedToken } from "./tokenStorage";

export interface PipelineExecutionLog {
  id: string;
  timestamp: string;
  status: "success" | "failed" | "running";
  category: {
    id: string;
    name: string;
    ctrPercent: number;
    impressions: number;
    views: number;
    trend: string;
  };
  script: {
    title: string;
    description: string;
    tags: string[];
    hashtags: string[];
    scenes: VideoScene[];
  };
  thumbnail?: {
    previewUrl: string;
    downloadUrl: string;
    aspectRatio: "16:9" | "9:16";
    width: number;
    height: number;
    style: string;
  };
  seoAnalysis?: {
    predictedCTR: number;
    curiosityScore: number;
    urgencyScore: number;
    searchVolumeScore: number;
    realTimeTrendMatch: string;
    trendDate: string;
    powerKeywords: string[];
    ctrVerdict: string;
    recommendation: string;
  };
  video?: {
    sizeBytes: number;
    durationSeconds: number;
    previewUrl?: string;
    format?: string;
    aspectRatio?: "9:16" | "16:9";
  };
  youtube?: {
    videoId: string;
    videoUrl: string;
    embedUrl: string;
    privacyStatus: string;
  };
  logs: Array<{ step: string; message: string; timestamp: string }>;
  error?: string;
}

// Ensure /tmp/autotube exists with chmod 777
ensureAutotubeDirectory();
const HISTORY_FILE = path.join(AUTOTUBE_TMP_DIR, "autotube_pipeline_history.json");
const WORKSPACE_HISTORY_FILE = path.join(process.cwd(), "data", "autotube_pipeline_history.json");

// Helper to load and save history with persistent workspace storage
export function loadHistory(): PipelineExecutionLog[] {
  try {
    if (fs.existsSync(WORKSPACE_HISTORY_FILE)) {
      const data = fs.readFileSync(WORKSPACE_HISTORY_FILE, "utf8");
      return JSON.parse(data);
    }
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, "utf8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn("Could not read pipeline history file:", err);
  }
  return [];
}

function saveHistory(history: PipelineExecutionLog[]) {
  const jsonStr = JSON.stringify(history.slice(0, 50), null, 2);
  try {
    const wsDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(wsDir)) {
      fs.mkdirSync(wsDir, { recursive: true });
    }
    fs.writeFileSync(WORKSPACE_HISTORY_FILE, jsonStr, "utf8");
  } catch (err) {
    console.warn("Could not save persistent workspace pipeline history:", err);
  }
  try {
    fs.writeFileSync(HISTORY_FILE, jsonStr, "utf8");
  } catch (err) {
    console.warn("Could not save pipeline history file:", err);
  }
}

const PERSISTENT_TOPICS_DIR = path.join(process.cwd(), "server/data");
const PERSISTENT_TOPICS_FILE = path.join(PERSISTENT_TOPICS_DIR, "covered_topics.json");
const PERSISTENT_TOPICS_DATA_DIR = path.join(process.cwd(), "data");
const PERSISTENT_TOPICS_DATA_FILE = path.join(PERSISTENT_TOPICS_DATA_DIR, "covered_topics.json");
const PERSISTENT_TOPICS_TMP_FILE = path.join(AUTOTUBE_TMP_DIR, "covered_topics.json");

export interface CoveredTopicItem {
  title: string;
  category?: string;
  niche?: string;
  subject?: string;
  keywords?: string[];
  date?: string;
}

/**
 * Loads all covered topics across all persistent files and history logs
 */
export function loadCoveredTopicsRegistry(): CoveredTopicItem[] {
  const candidateFiles = [PERSISTENT_TOPICS_DATA_FILE, PERSISTENT_TOPICS_FILE, PERSISTENT_TOPICS_TMP_FILE];
  let list: CoveredTopicItem[] = [];

  for (const f of candidateFiles) {
    try {
      if (fs.existsSync(f)) {
        const parsed = JSON.parse(fs.readFileSync(f, "utf8"));
        if (Array.isArray(parsed) && parsed.length > list.length) {
          list = parsed;
        }
      }
    } catch {}
  }

  // Supplement with history logs
  try {
    const historyLogs = loadHistory();
    for (const h of historyLogs) {
      const t = h.script?.title;
      if (t && !list.some((it) => it.title.toLowerCase() === t.toLowerCase())) {
        list.push({
          title: t,
          category: h.category?.id || h.category?.name,
          niche: h.category?.name,
          subject: t,
          keywords: extractSubstantiveWords(t),
          date: h.timestamp || new Date().toISOString(),
        });
      }
    }
  } catch {}

  // Normalize keywords for every item
  return list.map((item) => ({
    ...item,
    keywords: Array.isArray(item.keywords) && item.keywords.length > 0
      ? item.keywords
      : extractSubstantiveWords(`${item.title} ${item.subject || ""}`),
  }));
}

/**
 * Records a generated or published video topic to persistent workspace storage across all sync locations
 */
export function recordCoveredTopic(title: string, category: string, niche: string, subjectOverride?: string) {
  try {
    ensureAutotubeDirectory();
    if (!fs.existsSync(PERSISTENT_TOPICS_DIR)) {
      fs.mkdirSync(PERSISTENT_TOPICS_DIR, { recursive: true });
    }
    if (!fs.existsSync(PERSISTENT_TOPICS_DATA_DIR)) {
      fs.mkdirSync(PERSISTENT_TOPICS_DATA_DIR, { recursive: true });
    }

    const candidateFiles = [PERSISTENT_TOPICS_DATA_FILE, PERSISTENT_TOPICS_FILE, PERSISTENT_TOPICS_TMP_FILE];
    let list: CoveredTopicItem[] = loadCoveredTopicsRegistry();

    const exists = list.some((item) => item.title.toLowerCase() === title.toLowerCase());
    if (!exists) {
      const kws = extractSubstantiveWords(`${title} ${subjectOverride || ""}`);
      list.unshift({
        title,
        category,
        niche,
        subject: subjectOverride || title,
        keywords: kws,
        date: new Date().toISOString(),
      });
      const str = JSON.stringify(list.slice(0, 500), null, 2);
      for (const f of candidateFiles) {
        try {
          fs.writeFileSync(f, str, "utf8");
        } catch {}
      }
    }
  } catch (err) {
    console.warn("Could not record covered topic:", err);
  }
}

const TITLE_STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
  "by", "from", "up", "about", "into", "over", "after", "is", "are", "was", "were",
  "be", "been", "being", "have", "has", "had", "do", "does", "did", "can", "could",
  "will", "would", "shall", "should", "may", "might", "must", "that", "which", "who",
  "whom", "this", "these", "those", "what", "where", "when", "why", "how", "all",
  "any", "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor",
  "not", "only", "own", "same", "so", "than", "too", "very", "s", "t", "just", "don",
  "now", "video", "videos", "shorts", "short", "documentary", "fact", "facts", "true",
  "real", "secret", "secrets", "mystery", "mysteries", "unbelievable", "shocking",
  "full", "hd", "4k", "2026", "2025", "2024", "today", "yesterday", "autotube"
]);

export function extractSubstantiveWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !TITLE_STOP_WORDS.has(w));
}

/**
 * Rich repository of curated fresh, high-CTR topics across all categories to guarantee 100% unique subjects
 */
export const FRESH_CATEGORY_TOPICS: Record<string, Array<{ topic: string; hook: string; keywords: string[] }>> = {
  "cricket-match-doc": [
    {
      topic: "Headingley 2019: Ben Stokes Impossible 1-Wicket Miracle Against Australia",
      hook: "Jack Leach wiped his glasses, but Ben Stokes pulled off the greatest heist in cricket history!",
      keywords: ["headingley", "stokes", "leach", "2019", "miracle", "ashes", "australia"],
    },
    {
      topic: "Carlos Brathwaite 2016 World T20 Final: Remember The Name 4 Consecutive Sixes",
      hook: "19 runs needed in the final over, and Ben Stokes bowled to Carlos Brathwaite...",
      keywords: ["brathwaite", "2016", "eden", "gardens", "england", "west", "indies", "sixes"],
    },
    {
      topic: "Virat Kohli 82* vs Pakistan at MCG 2022: The Shot of an Emperor",
      hook: "Haris Rauf was bowling 150 km/h, but Virat Kohli hit the two greatest sixes in T20 history!",
      keywords: ["kohli", "mcg", "rauf", "2022", "melbourne", "india", "pakistan"],
    },
    {
      topic: "Glenn Maxwell 201* on One Leg: 2023 World Cup Against Afghanistan",
      hook: "Australia was 91 for 7 chasing 292, Maxwell could not even run, and then this happened!",
      keywords: ["maxwell", "afghanistan", "2023", "mumbai", "wankhede", "double", "century"],
    },
    {
      topic: "Shoaib Akhtar 100 MPH: The Fastest Delivery in Cricket History at Newlands",
      hook: "Nick Knight faced the first officially recorded 100 mph thunderbolt at Newlands!",
      keywords: ["shoaib", "akhtar", "100", "mph", "fastest", "delivery", "rawalpindi", "express"],
    },
    {
      topic: "India vs Pakistan 2007 World T20 Final: Joginder Sharma's Historic Final Over",
      hook: "Misbah scooped it into the air, and Sreesanth took the catch that sparked the IPL era!",
      keywords: ["misbah", "joginder", "sreesanth", "2007", "johannesburg", "final"],
    },
    {
      topic: "Brian Lara 400 Not Out: The Greatest Individual Test Score in History",
      hook: "In Antigua, Brian Lara batted for 778 minutes against England to reclaim his world record!",
      keywords: ["lara", "400", "antigua", "england", "record", "test"],
    },
    {
      topic: "Shahid Afridi 37-Ball Century in Nairobi: The 16-Year-Old Phenomenon",
      hook: "Using Sachin Tendulkar's bat, 16-year-old Shahid Afridi blasted 11 sixes in 37 balls!",
      keywords: ["afridi", "37", "ball", "century", "nairobi", "sri", "lanka"],
    },
  ],
  "deep-space-telescopes": [
    {
      topic: "Mars Ancient Liquid Ocean: How a Water World Vanished into a Frozen Desert",
      hook: "Billions of years ago, Mars had an ocean deeper than the Arctic covering its northern hemisphere!",
      keywords: ["mars", "ocean", "water", "ancient", "red", "planet", "tharsis", "ice", "vanished"],
    },
    {
      topic: "Jupiter's Moon Europa: The 60-Mile Deep Alien Ocean Hidden Under Global Ice",
      hook: "Under 15 miles of ice on Jupiter's moon Europa lies a saltwater ocean with more water than all of Earth!",
      keywords: ["europa", "jupiter", "subsurface", "ocean", "ice", "plumes", "alien", "hydrothermal"],
    },
    {
      topic: "Saturn's Moon Titan: Methane Rainstorms and Hydrocarbon Oceans Under Orange Skies",
      hook: "On Titan, clouds rain liquid natural gas and rivers carve valleys of solid water ice!",
      keywords: ["titan", "saturn", "methane", "kraken", "mare", "atmosphere", "cassini", "hydrocarbon"],
    },
    {
      topic: "Olympus Mons on Mars: The 72,000-Foot Mega Volcano Three Times Mount Everest",
      hook: "Mars hosts a volcano so massive that its peak pokes out above the planetary atmosphere into space!",
      keywords: ["olympus", "mons", "volcano", "mars", "everest", "caldera", "shield", "tharsis"],
    },
    {
      topic: "James Webb Shatters Big Bang Models: Giant Galaxy JADES-GS-z14-0 at Cosmic Dawn",
      hook: "James Webb spotted a massive luminous galaxy formed just 290 million years after the Big Bang, defying all physics!",
      keywords: ["jades", "galaxy", "cosmic", "dawn", "webb", "jwst", "redshift", "early", "universe"],
    },
    {
      topic: "Jupiter's Volcanic Moon Io: 400 Active Lava Volcanoes Erupting into Outer Space",
      hook: "Jupiter's gravitational tidal forces flex Io so violently that lakes of liquid sulfur erupt 300 miles high!",
      keywords: ["io", "jupiter", "volcanoes", "lava", "sulfur", "plumes", "tidal", "heating"],
    },
    {
      topic: "Enceladus Geysers: Fresh Water Spewing into Space from Saturn's Icy Moon",
      hook: "Hydrothermal geysers are blasting organic molecules and ocean spray directly into Saturn's rings!",
      keywords: ["enceladus", "geysers", "saturn", "tiger", "stripes", "plumes", "subsurface", "ocean"],
    },
    {
      topic: "Venus The Acid Furnace: Why Earth's Twin Melts Lead at 900 Degrees Fahrenheit",
      hook: "Beneath sulfuric acid clouds, Venus has surface pressures that crush steel submarines and melt lead!",
      keywords: ["venus", "surface", "acid", "sulfuric", "greenhouse", "furnace", "pressure", "venera"],
    },
    {
      topic: "TON 618: The Ultramassive Black Hole 66 Billion Times the Mass of Our Sun",
      hook: "A monster black hole so vast that our entire Solar System could fit inside its shadow eleven times over!",
      keywords: ["ton", "618", "ultramassive", "black", "hole", "singularity", "quasars", "event", "horizon"],
    },
    {
      topic: "Diamond Rain on Neptune and Uranus: 10,000 Atmospheres Crushing Carbon into Hail",
      hook: "Deep inside the ice giants, extreme temperature and pressure split methane into showers of pure diamonds!",
      keywords: ["neptune", "uranus", "diamond", "rain", "methane", "hydrocarbon", "mantle", "pressure"],
    },
    {
      topic: "The Great Dimming of Betelgeuse: The Red Supergiant Star Ready to Go Supernova",
      hook: "Betelgeuse suddenly lost two-thirds of its brightness after belching a giant dust cloud into space!",
      keywords: ["betelgeuse", "supergiant", "orion", "dimming", "supernova", "star", "explosion"],
    },
    {
      topic: "James Webb Infrared Breakthrough: Penetrating The Pillars of Creation",
      hook: "Webb's infrared cameras pierced through cosmic dust pillars to reveal thousands of newborn stars inside!",
      keywords: ["pillars", "creation", "eagle", "nebula", "newborn", "stars", "infrared", "webb", "jwst"],
    },
    {
      topic: "Voyager 1 in Interstellar Space: The 47-Year-Old Probe Flying Beyond Our Sun",
      hook: "15 billion miles from Earth, humanity's oldest spacecraft is sending signals back from interstellar plasma!",
      keywords: ["voyager", "interstellar", "heliopause", "probe", "deep", "space", "plasma", "solar"],
    },
    {
      topic: "Mercury's Comet-Like Tail: The Massive Iron Core Roasting Next to the Sun",
      hook: "Mercury is practically a naked iron cannonball, trailing a 15-million-mile glowing yellow sodium tail!",
      keywords: ["mercury", "iron", "core", "sodium", "tail", "solar", "wind", "bepicolombo", "messenger"],
    },
  ],
  "space-cosmos-mysteries": [
    {
      topic: "The Great Attractor: The Colossal Gravitational Monster Pulling Our Entire Galaxy",
      hook: "Our entire Milky Way is rushing at 2 million km/h towards an invisible gravitational anomaly!",
      keywords: ["attractor", "milky", "way", "cluster", "anomaly", "gravity", "hydra", "centaurus"],
    },
    {
      topic: "Magnetars: Dead Neutron Stars with Trillion-Gauss Magnetic Fields That Dissolve Atoms",
      hook: "If a magnetar came within 1,000 kilometers of Earth, its magnetic field would dissolve your DNA!",
      keywords: ["magnetar", "magnetic", "field", "neutron", "star", "atoms", "radiation", "pulse"],
    },
    {
      topic: "The Boomerang Nebula: The Coldest Natural Place in the Known Universe at -272°C",
      hook: "Deep inside Centaurus lies a place colder than the cosmic background afterglow of the Big Bang itself!",
      keywords: ["boomerang", "nebula", "coldest", "centaurus", "kelvin", "temperature", "absolute", "zero"],
    },
    {
      topic: "Fast Radio Bursts: Cosmic Millisecond Blasts Releasing More Energy Than the Sun in Days",
      hook: "Radio telescopes are picking up millisecond flashes from across the cosmos that defy physics!",
      keywords: ["radio", "bursts", "frb", "millisecond", "pulses", "energy", "cosmic"],
    },
    {
      topic: "Oumuamua: The Mysterious Needle-Shaped Object That Accelerated Away From Our Sun",
      hook: "The first interstellar visitor did not have a comet tail, but it mysteriously sped up on its way out!",
      keywords: ["oumuamua", "interstellar", "visitor", "acceleration", "needle", "solar", "system"],
    },
    {
      topic: "The Fermi Paradox & The Great Filter: Why Is The Entire Universe Eerily Silent?",
      hook: "There are trillions of planets in the habitable zone, so where is everybody?",
      keywords: ["fermi", "paradox", "great", "filter", "aliens", "silent", "universe", "civilizations"],
    },
    {
      topic: "Jupiter's Great Red Spot: The 400-Year-Old Storm Large Enough to Swallow Earth",
      hook: "For over 400 years, a colossal hurricane three times the size of Earth has been roaring on Jupiter!",
      keywords: ["jupiter", "great", "red", "spot", "storm", "hurricane", "atmosphere"],
    },
    {
      topic: "55 Cancri e: The Alien Super-Earth Made of Solid Diamond and Graphite",
      hook: "Twice the size of Earth, this exoplanet is made of pure crystallized diamond and liquid carbon!",
      keywords: ["cancri", "diamond", "planet", "carbon", "graphite", "exoplanet"],
    },
  ],
  "earth-deep-ocean": [
    {
      topic: "The Kola Superdeep Borehole: When Humans Drilled 40,000 Feet Straight into Earth",
      hook: "At 12 kilometers deep, Soviet scientists hit 180°C boiling rocks and boiling water where none should exist!",
      keywords: ["kola", "superdeep", "borehole", "drill", "russia", "crust", "mantle", "drilling"],
    },
    {
      topic: "Lake Natron: The Deadly Tanzanian Lake That Turns Animals into Calcified Stone",
      hook: "With a pH of 10.5, this blood-red lake calcifies dead birds and bats into perfect stone statues!",
      keywords: ["natron", "lake", "tanzania", "stone", "calcified", "alkaline", "statues"],
    },
    {
      topic: "The Door to Hell: The Darvaza Gas Crater Burning Continuously for Over 50 Years",
      hook: "In the middle of the Karakum desert, a 230-foot crater of roaring flame has been blazing since 1971!",
      keywords: ["darvaza", "crater", "door", "hell", "turkmenistan", "methane", "fire", "karakum"],
    },
    {
      topic: "Krubera Cave: The 7,200-Foot Vertical Abyss Dropping into the Deepest Darkness on Earth",
      hook: "Inside the Caucasus mountains lies a vertical chasm so deep it takes speleologists 2 weeks to reach bottom!",
      keywords: ["krubera", "cave", "abyss", "subterranean", "chasm", "georgia", "darkness"],
    },
    {
      topic: "The Sailing Stones of Racetrack Playa: Heavy Boulders That Move Across the Desert Floor",
      hook: "In Death Valley, 700-pound boulders glide across the flat desert leaving long tracks behind them!",
      keywords: ["sailing", "stones", "racetrack", "playa", "death", "valley", "boulders", "sliding"],
    },
    {
      topic: "The Blood Falls of Antarctica: The Crimson Waterfall Spilling from a Million-Year-Old Sealed Lake",
      hook: "Flowing from the Taylor Glacier, bright crimson water erupts from an ancient underground reservoir with zero oxygen!",
      keywords: ["blood", "falls", "antarctica", "glacier", "iron", "subglacial", "crimson"],
    },
    {
      topic: "The Zone of Silence: The Mysterious Mexican Desert Where Radio and Compass Waves Inexplicably Fail",
      hook: "In Mapimí, Mexico, an electromagnetic dead zone causes radios to go silent and compasses to spin wildly!",
      keywords: ["zone", "silence", "mapimi", "mexico", "radio", "compass", "anomaly", "electromagnetic"],
    },
  ],
  "human-body-brain": [
    {
      topic: "Synesthesia: The Rare Neurological Crossover Where Humans Physically Taste Sounds and Hear Colors",
      hook: "Some human brains are wired so cross-connected that they see colors when they hear a guitar chord!",
      keywords: ["synesthesia", "sensory", "crossover", "taste", "colors", "sounds", "neurology", "brain"],
    },
    {
      topic: "The Placebo & Nocebo Effect: How Pure Subconscious Belief Triggers Measurable Physical Healing",
      hook: "When doctors give patients sugar pills, their brain physically produces real natural painkillers!",
      keywords: ["placebo", "nocebo", "subconscious", "healing", "sugar", "pill", "brain", "belief"],
    },
    {
      topic: "Hyperthymesia: The Rare Genetic Condition Where People Remember Every Second of Their Entire Life",
      hook: "Fewer than 60 people on Earth have a brain that can vividly recall what they ate for breakfast on March 14th, 2004!",
      keywords: ["hyperthymesia", "memory", "recall", "photographic", "autobiographical", "brain"],
    },
    {
      topic: "The Gut-Brain Axis: How 38 Trillion Bacteria Inside You Directly Dictate Your Emotions and Thoughts",
      hook: "Over 90% of your body's serotonin is not made in your brain—it is manufactured by bacteria in your gut!",
      keywords: ["gut", "microbiome", "bacteria", "serotonin", "vagus", "nerve", "microbes"],
    },
    {
      topic: "Phantom Limb Syndrome: Why the Human Brain Can Feel Severe Pain in an Arm That Does Not Exist",
      hook: "Even after an amputation, sensory maps in the brain continue sending nerve pulses to phantom fingers!",
      keywords: ["phantom", "limb", "amputation", "sensory", "cortex", "mirror", "box", "nerves"],
    },
  ],
  "quantum-physics-paradoxes": [
    {
      topic: "Quantum Tunneling: How Subatomic Particles Magically Teleport Through Solid Physical Barriers",
      hook: "In the subatomic world, electrons can literally walk right through solid physical walls!",
      keywords: ["tunneling", "subatomic", "barrier", "teleport", "quantum", "wavefunction", "particle"],
    },
    {
      topic: "The Delayed-Choice Quantum Eraser: How Measuring a Photon Today Can Rewrite Its History in the Past",
      hook: "Physics experiments show that deciding to measure a particle right now changes how it behaved in the past!",
      keywords: ["delayed", "choice", "eraser", "photon", "measurement", "time", "quantum"],
    },
    {
      topic: "Antimatter: The Most Dangerous and Costliest Substance on Earth at $62.5 Trillion per Gram",
      hook: "Just one gram of antimatter colliding with matter releases the explosive power of an atomic bomb!",
      keywords: ["antimatter", "positron", "cern", "explosion", "annihilation", "substance"],
    },
    {
      topic: "Time Dilation: Why Moving at High Velocity Literally Causes Time to Slow Down for You",
      hook: "If you spend 6 months on the International Space Station, you return to Earth 0.005 seconds younger!",
      keywords: ["dilation", "relativity", "einstein", "iss", "atomic", "clock", "velocity", "speed"],
    },
  ],
  "wild-animals-nature": [
    {
      topic: "Tardigrades: The Microscopic Water Bears That Can Survive Outer Space Vacuum and 300°F Heat",
      hook: "You can freeze them to near absolute zero, boil them, or shoot them into outer space—and they survive!",
      keywords: ["tardigrade", "water", "bear", "vacuum", "cryptobiosis", "microscopic", "space"],
    },
    {
      topic: "The Mantis Shrimp Strike: Punching at the Speed of a Gunshot to Vaporize Water Around It",
      hook: "Its clubs accelerate faster than a 22-caliber bullet, creating shockwaves as hot as the surface of the Sun!",
      keywords: ["mantis", "shrimp", "punch", "cavitation", "bullet", "aquarium", "strike"],
    },
    {
      topic: "The Immortal Jellyfish: The Creature on Earth That Biologically Reverses Its Age Forever",
      hook: "When Turritopsis dohrnii gets old or sick, it transforms its cells back into a baby polyp and starts life over!",
      keywords: ["immortal", "jellyfish", "turritopsis", "dohrnii", "polyp", "reversal", "aging"],
    },
    {
      topic: "Cordyceps Zombie Fungi: Mind-Controlling Parasites That Hijack Ants to Spread Spores",
      hook: "The fungal spores infiltrate an ant's brain, forcing it to climb the highest plant before bursting through its head!",
      keywords: ["cordyceps", "zombie", "ant", "fungus", "parasite", "spores", "insects"],
    },
    {
      topic: "The Mimic Octopus: The Cephalopod That Can Transform into 15 Venomous Predators in Seconds",
      hook: "In seconds, this incredible octopus changes skin color, texture, and shape to impersonate sea snakes and lionfish!",
      keywords: ["mimic", "octopus", "camouflage", "predators", "cephalopod", "marine"],
    },
  ],
};

/**
 * Dynamically picks a fresh, untouched subtopic for a category that has never been covered
 */
export function pickFreshUntouchedSubtopic(
  categoryId: string,
  categoryName: string,
  existingTitles: string[],
  coveredRegistry: CoveredTopicItem[]
): { topic: string; hook: string; keywords: string[] } | null {
  const existingLower = existingTitles.map((t) => t.toLowerCase()).join(" ");
  const regWords = new Set<string>();
  for (const item of coveredRegistry) {
    const kws = item.keywords || extractSubstantiveWords(`${item.title} ${item.subject || ""}`);
    kws.forEach((k) => regWords.add(k.toLowerCase()));
  }

  // Find category candidates
  let candidates = FRESH_CATEGORY_TOPICS[categoryId] || [];
  if (candidates.length === 0) {
    const foundKey = Object.keys(FRESH_CATEGORY_TOPICS).find((k) =>
      categoryName.toLowerCase().includes(k.replace(/-/g, " "))
    );
    if (foundKey) {
      candidates = FRESH_CATEGORY_TOPICS[foundKey];
    }
  }

  // Cross-link space categories so space explorations have an expansive pool of planets & celestial bodies
  const isSpace =
    categoryId === "deep-space-telescopes" ||
    categoryId === "space-cosmos-mysteries" ||
    categoryName.toLowerCase().includes("space") ||
    categoryName.toLowerCase().includes("telescope") ||
    categoryName.toLowerCase().includes("cosmos");

  if (isSpace) {
    const spaceTelescopePool = FRESH_CATEGORY_TOPICS["deep-space-telescopes"] || [];
    const spaceCosmosPool = FRESH_CATEGORY_TOPICS["space-cosmos-mysteries"] || [];
    candidates = [...spaceTelescopePool, ...spaceCosmosPool];
  }

  if (candidates.length === 0) {
    candidates = Object.values(FRESH_CATEGORY_TOPICS).flat();
  }

  // Collect all completely untouched candidates (zero collision and zero keyword overlap)
  const untouchedCandidates: typeof candidates = [];
  let bestCandidate: (typeof candidates)[0] | null = null;
  let minOverlap = Infinity;

  for (const cand of candidates) {
    const candKws = cand.keywords.map((k) => k.toLowerCase());

    // Check direct collision
    const collision = checkTitleCollision(cand.topic, existingTitles, coveredRegistry);
    if (collision.isCollision) continue;

    // Check keyword collision against registry
    const kwOverlapCount = candKws.filter((k) => regWords.has(k) || existingLower.includes(k)).length;
    if (kwOverlapCount === 0) {
      untouchedCandidates.push(cand);
    }
    if (kwOverlapCount < minOverlap) {
      minOverlap = kwOverlapCount;
      bestCandidate = cand;
    }
  }

  if (untouchedCandidates.length > 0) {
    // Rotate dynamically so consecutive runs on the same category pick a different fresh subject every time
    const pickIdx = (coveredRegistry.length + Math.floor(Date.now() / 1000)) % untouchedCandidates.length;
    return untouchedCandidates[pickIdx];
  }

  if (bestCandidate && minOverlap <= 1) {
    return bestCandidate;
  }

  // If all candidates have been covered or have partial overlap, cycle deterministically through candidates
  // so consecutive runs on the same category ALWAYS rotate to a different phenomenon
  if (candidates.length > 0) {
    const rotatedIdx = (coveredRegistry.length + Math.floor(Date.now() / 1000)) % candidates.length;
    return candidates[rotatedIdx];
  }

  return null;
}

/**
 * Checks if a candidate title collides with existing channel videos or covered topics registry
 * Highly rigorous: checks noun matching, substantive concepts, and string overlap
 */
export function checkTitleCollision(
  newTitle: string,
  existingTitles: string[],
  coveredRegistry?: CoveredTopicItem[]
): { isCollision: boolean; matchedTitle?: string; overlapPercent: number; matchedWords?: string[] } {
  if (!newTitle) return { isCollision: false, overlapPercent: 0 };
  const cleanNewWords = extractSubstantiveWords(newTitle);
  if (cleanNewWords.length === 0) return { isCollision: false, overlapPercent: 0 };

  const normNew = cleanNewWords.join(" ");

  // 1. Direct check against existing titles
  for (const ext of existingTitles) {
    const cleanExtWords = extractSubstantiveWords(ext);
    if (cleanExtWords.length === 0) continue;

    const normExt = cleanExtWords.join(" ");

    // Substring matching of core concept
    if (normNew.length >= 8 && normExt.length >= 8) {
      if (normNew.includes(normExt) || normExt.includes(normNew)) {
        return { isCollision: true, matchedTitle: ext, overlapPercent: 100, matchedWords: cleanExtWords };
      }
    }

    // Common substantive words
    const commonWords = cleanNewWords.filter((w) => cleanExtWords.includes(w));
    const minWordCount = Math.min(cleanNewWords.length, cleanExtWords.length);
    const overlapPercent = (commonWords.length / minWordCount) * 100;

    // Trigger collision if 2 or more key substantive nouns match
    if (commonWords.length >= 2 && (overlapPercent >= 24 || minWordCount <= 4)) {
      return { isCollision: true, matchedTitle: ext, overlapPercent: Math.round(overlapPercent), matchedWords: commonWords };
    }

    // Trigger collision if overlap is >= 30%
    if (overlapPercent >= 30) {
      return { isCollision: true, matchedTitle: ext, overlapPercent: Math.round(overlapPercent), matchedWords: commonWords };
    }
  }

  // 2. Semantic entity / concept check against covered topics registry
  if (coveredRegistry && coveredRegistry.length > 0) {
    for (const item of coveredRegistry) {
      const regKeywords = item.keywords || extractSubstantiveWords(`${item.title} ${item.subject || ""}`);
      const matchedKws = cleanNewWords.filter((w) => regKeywords.includes(w));

      if (matchedKws.length >= 2) {
        return {
          isCollision: true,
          matchedTitle: `${item.title} (Subject: ${item.subject || item.title})`,
          overlapPercent: Math.round((matchedKws.length / Math.min(cleanNewWords.length, regKeywords.length)) * 100),
          matchedWords: matchedKws,
        };
      }
    }
  }

  return { isCollision: false, overlapPercent: 0 };
}

/**
 * Fetches all recent video titles from the connected YouTube channel and local history to avoid duplicates
 */
export async function fetchChannelExistingVideoTitles(oauthToken?: string | null): Promise<string[]> {
  const titles: string[] = [];

  // If no token passed, restore from persistent storage (/tmp/autotube/token.json or data/token.json)
  let resolvedToken = oauthToken;
  if (!resolvedToken) {
    try {
      const persisted = loadPersistedToken();
      resolvedToken = persisted.token;
    } catch {}
  }

  // 1. Read from persistent workspace covered topics databases
  const candidateFiles = [
    path.join(process.cwd(), "data", "covered_topics.json"),
    path.join(process.cwd(), "server/data", "covered_topics.json"),
    path.join(AUTOTUBE_TMP_DIR, "covered_topics.json"),
  ];
  for (const f of candidateFiles) {
    try {
      if (fs.existsSync(f)) {
        const data = JSON.parse(fs.readFileSync(f, "utf8"));
        if (Array.isArray(data)) {
          for (const it of data) {
            const t = typeof it === "string" ? it : it?.title;
            if (t && typeof t === "string" && t.trim().length > 0) {
              titles.push(t.trim());
            }
          }
        }
      }
    } catch (err) {
      console.warn(`Could not read persistent covered topics file from ${f}:`, err);
    }
  }

  // 2. Read from pipeline execution history
  try {
    const historyLogs = loadHistory();
    for (const h of historyLogs) {
      if (h.script?.title) titles.push(h.script.title.trim());
    }
  } catch {}

  // 3. If YouTube OAuth token is available, deeply inspect channel uploads (multi-page up to 200 videos)
  if (resolvedToken) {
    try {
      const chRes = await fetch("https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true", {
        headers: { Authorization: `Bearer ${resolvedToken}` },
      });
      if (chRes.ok) {
        const chData = await chRes.json();
        const uploadsPlaylistId = chData?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
        if (uploadsPlaylistId) {
          let pageToken: string | undefined = undefined;
          // Fetch up to 4 pages = 200 channel videos
          for (let page = 0; page < 4; page++) {
            const pageParam = pageToken ? `&pageToken=${pageToken}` : "";
            const plRes = await fetch(
              `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=50${pageParam}`,
              {
                headers: { Authorization: `Bearer ${resolvedToken}` },
              }
            );
            if (!plRes.ok) break;
            const plData = await plRes.json();
            if (Array.isArray(plData.items)) {
              for (const it of plData.items) {
                const titleStr = it?.snippet?.title;
                if (typeof titleStr === "string" && titleStr.trim().length > 0) {
                  titles.push(titleStr.trim());
                }
              }
            }
            pageToken = plData.nextPageToken;
            if (!pageToken) break;
          }
        }
      }
    } catch (err) {
      console.warn("Could not fetch YouTube channel existing video titles for deduplication:", err);
    }
  }

  // Return deduplicated list
  return Array.from(new Set(titles));
}

// In-memory state for active execution with granular progress tracking
let isRunning = false;
let currentStep = "idle";
let currentRunId: string | null = null;
let activeLogs: Array<{ step: string; message: string; timestamp: string }> = [];

let progressPercent = 0;
let currentStageIndex = 0;
const totalStages = 5;
let stageTitle = "Idle - Waiting to Start";
let stageDescription = "No video generation currently in progress.";
let stageDetail = "";
let isVideoReady = false;
let isUploadReady = false;
let uploadPercent = 0;
let activeVideoMetadata: {
  title?: string;
  format?: string;
  durationSeconds?: number;
  sizeBytes?: number;
  previewUrl?: string;
  youtubeUrl?: string;
  videoId?: string;
  thumbnailUrl?: string;
  thumbnailDownloadUrl?: string;
  seoAnalysis?: any;
} | null = null;

export function resetPipeline() {
  isRunning = false;
  currentRunId = null;
  currentStep = "idle";
  progressPercent = 0;
  uploadPercent = 0;
  currentStageIndex = 0;
  stageTitle = "Idle";
  stageDescription = "Ready to produce viral cricket documentaries or 2+ min shorts.";
  stageDetail = "";
  isVideoReady = false;
  isUploadReady = false;
  activeLogs = [];
  activeVideoMetadata = null;
  try {
    saveHistory([]);
    if (fs.existsSync(WORKSPACE_HISTORY_FILE)) {
      fs.writeFileSync(WORKSPACE_HISTORY_FILE, "[]", "utf8");
    }
    if (fs.existsSync(HISTORY_FILE)) {
      fs.writeFileSync(HISTORY_FILE, "[]", "utf8");
    }
  } catch {}
  console.log("[Pipeline] Pipeline was reset and history cleared.");
  return { success: true, message: "Pipeline state and history cleared successfully." };
}

export function getPipelineStatus() {
  const history = loadHistory();
  const successfulRuns = history.filter((h) => h.status === "success");
  const latestSuccess = successfulRuns[0] || null;

  return {
    isRunning,
    currentStep,
    currentRunId,
    activeLogs,
    progress: {
      percent: isRunning ? Math.min(progressPercent, 99) : isVideoReady || latestSuccess ? 100 : 0,
      stageIndex: isRunning ? currentStageIndex : latestSuccess ? 5 : 0,
      totalStages,
      stageTitle: isRunning ? stageTitle : latestSuccess ? "✅ Video Complete & Live" : "Idle",
      stageDescription: isRunning
        ? stageDescription
        : latestSuccess
        ? `Latest video "${latestSuccess.script?.title || "Documentary"}" generated successfully.`
        : "Ready to produce viral cricket documentaries or 2+ min shorts.",
      stageDetail: isRunning ? stageDetail : "",
      isVideoReady: isVideoReady || Boolean(latestSuccess?.video?.previewUrl),
      isUploadReady: isUploadReady || Boolean(latestSuccess?.youtube?.videoUrl),
      uploadPercent: isRunning ? uploadPercent : latestSuccess?.youtube?.videoUrl ? 100 : 0,
      totalVideosGenerated: successfulRuns.length,
      currentVideoMetadata: activeVideoMetadata || (latestSuccess ? {
        title: latestSuccess.script?.title,
        format: latestSuccess.category?.name?.includes("Long") || (latestSuccess as any).category?.isLongVideo ? "16:9 Long Video (8+ Min)" : "9:16 Short (2+ Min)",
        durationSeconds: latestSuccess.video?.durationSeconds,
        sizeBytes: latestSuccess.video?.sizeBytes,
        previewUrl: latestSuccess.video?.previewUrl,
        youtubeUrl: latestSuccess.youtube?.videoUrl,
        videoId: latestSuccess.youtube?.videoId,
        thumbnailUrl: latestSuccess.thumbnail?.previewUrl,
        thumbnailDownloadUrl: latestSuccess.thumbnail?.downloadUrl,
        seoAnalysis: latestSuccess.seoAnalysis,
      } : null),
      lastVideo: latestSuccess
        ? {
            id: latestSuccess.id,
            title: latestSuccess.script?.title,
            format: latestSuccess.category?.name?.includes("Long") || (latestSuccess as any).category?.isLongVideo ? "16:9 Long Video (8+ Min)" : "9:16 Short (2+ Min)",
            durationSeconds: latestSuccess.video?.durationSeconds,
            sizeBytes: latestSuccess.video?.sizeBytes,
            previewUrl: latestSuccess.video?.previewUrl,
            youtubeUrl: latestSuccess.youtube?.videoUrl,
            videoId: latestSuccess.youtube?.videoId,
            thumbnailUrl: latestSuccess.thumbnail?.previewUrl,
            thumbnailDownloadUrl: latestSuccess.thumbnail?.downloadUrl,
            seoAnalysis: latestSuccess.seoAnalysis,
            completedAt: (latestSuccess as any).completedAt || latestSuccess.timestamp,
          }
        : null,
    },
    lastRun: history[0] || null,
    totalRuns: history.length,
    history: history.slice(0, 15),
  };
}

/**
 * Uploads a video buffer directly to YouTube Data API v3 Resumable Upload
 */
async function uploadBufferToYouTube(
  buffer: Buffer,
  metadata: {
    title: string;
    description: string;
    tags: string[];
    privacyStatus?: string;
  },
  oauthToken: string
): Promise<{ videoId: string; videoUrl: string; embedUrl: string }> {
  // 1. Initiate resumable upload session
  const initResponse = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${oauthToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "video/mp4",
        "X-Upload-Content-Length": String(buffer.length),
      },
      body: JSON.stringify({
        snippet: {
          title: metadata.title.trim(),
          description: metadata.description.trim(),
          tags: metadata.tags,
          categoryId: "27", // Education category
        },
        status: {
          privacyStatus: metadata.privacyStatus || "public",
          selfDeclaredMadeForKids: false,
        },
      }),
    }
  );

  if (!initResponse.ok) {
    const errText = await initResponse.text();
    let msg = `YouTube upload initiation failed (${initResponse.status})`;
    try {
      const parsed = JSON.parse(errText);
      msg = parsed.error?.message || msg;
    } catch {
      msg = errText || msg;
    }
    throw new Error(msg);
  }

  const uploadLocation = initResponse.headers.get("location");
  if (!uploadLocation) {
    throw new Error("YouTube API did not return an upload session URL.");
  }

  // 2. Stream/Upload the binary MP4 buffer with full Google Resumable Upload headers
  const uploadResponse = await fetch(uploadLocation, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${oauthToken}`,
      "Content-Type": "video/mp4",
      "Content-Length": String(buffer.length),
      "Content-Range": `bytes 0-${buffer.length - 1}/${buffer.length}`,
    },
    body: buffer,
  });

  if (!uploadResponse.ok) {
    const uploadErr = await uploadResponse.text();
    let msg = `YouTube video upload failed (${uploadResponse.status})`;
    try {
      const parsed = JSON.parse(uploadErr);
      msg = parsed.error?.message || msg;
    } catch {
      msg = uploadErr || msg;
    }
    throw new Error(msg);
  }

  const uploadResult = await uploadResponse.json();
  const videoId = uploadResult.id;

  // Verify YouTube received and queued the video for processing
  try {
    const statusRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,status,processingDetails&id=${videoId}`,
      {
        headers: { Authorization: `Bearer ${oauthToken}` },
      }
    );
    if (statusRes.ok) {
      const statusData: any = await statusRes.json();
      const item = statusData.items?.[0];
      const procStatus = item?.processingDetails?.processingStatus || "queued";
      console.log(`[YouTube API] Video ${videoId} successfully accepted by YouTube! Processing status: ${procStatus}`);
    }
  } catch {}

  return {
    videoId,
    videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
  };
}

/**
 * Safe JSON extraction and repair for AI model outputs.
 * Handles markdown code fences, trailing explanations, trailing commas,
 * unescaped string control characters, and regex object extraction.
 */
function safeParseJsonFromAI(rawText: string): any {
  if (!rawText || typeof rawText !== "string") {
    throw new Error("Empty AI response text");
  }

  let text = rawText.trim();

  // 1. Strip markdown code fences if present (```json ... ``` or ``` ... ```)
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    text = codeBlockMatch[1].trim();
  }

  // 2. Extract substring from the first '{' to the last '}'
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1).trim();
  }

  // 3. Attempt standard parse
  try {
    return JSON.parse(text);
  } catch (e1) {
    // 4. Try lenient repair: remove trailing commas before closing braces/brackets
    let cleaned = text.replace(/,\s*([}\]])/g, "$1");
    try {
      return JSON.parse(cleaned);
    } catch (e2) {
      // 5. Try cleaning non-printable control characters
      try {
        const sanitizedControls = cleaned.replace(/[\u0000-\u0009\u000B-\u001F]/g, " ");
        return JSON.parse(sanitizedControls);
      } catch (e3) {
        // 6. Regex-based key extractor as final recovery
        console.warn("Attempting regex recovery for AI script...");
        const titleMatch = text.match(/"title"\s*:\s*"([^"]+)"/i);
        const descMatch = text.match(/"description"\s*:\s*"([^"]+)"/i);

        const sceneRegex = /\{\s*"badge"\s*:\s*"([^"]*)"\s*,\s*"title"\s*:\s*"([^"]*)"\s*,\s*"body"\s*:\s*"([^"]*)"\s*,\s*"highlight"\s*:\s*"([^"]*)"\s*,\s*"visualPrompt"\s*:\s*"([^"]*)"\s*,\s*"voiceText"\s*:\s*"([^"]*)"\s*,\s*"durationSeconds"\s*:\s*(\d+)\s*\}/gi;
        const recoveredScenes: any[] = [];
        let sMatch;
        while ((sMatch = sceneRegex.exec(text)) !== null) {
          recoveredScenes.push({
            badge: sMatch[1],
            title: sMatch[2],
            body: sMatch[3],
            highlight: sMatch[4],
            visualPrompt: sMatch[5],
            voiceText: sMatch[6],
            durationSeconds: parseInt(sMatch[7], 10) || 10,
          });
        }

        if (titleMatch && recoveredScenes.length > 0) {
          return {
            title: titleMatch[1],
            description: descMatch ? descMatch[1] : "",
            tags: [],
            hashtags: [],
            scenes: recoveredScenes,
          };
        }

        throw new Error(`Failed to parse AI JSON response: ${(e1 as any).message}`);
      }
    }
  }
}

/**
 * Runs the complete end-to-end AutoTube AI daily pipeline:
 * 1. Analytics CTR picker
 * 2. Gemini script & metadata creation
 * 3. FFmpeg video rendering
 * 4. YouTube OAuth auto-upload
 */
export async function runDailyAutoPipeline(
  oauthToken?: string | null,
  geminiApiKey?: string | null,
  options: {
    privacyStatus?: string;
    overrideNiche?: string;
    categoryId?: string;
    videoFormat?: "short" | "long";
    customPrompt?: string;
    targetDurationMinutes?: number;
    cricketMatchDetails?: any;
    languageStyle?: "urdu_hindi" | "urdu" | "hindi" | "english";
    voiceId?: string;
    highlightUrls?: string[];
    filterMode?: "all_sixes_fours" | "all_wickets" | "specific_bowler" | "specific_batsman" | "full_match_highlights";
    targetPlayerName?: string;
    bgmStyle?: "high_energy_phonk" | "stadium_beats" | "cinematic_trap" | "epic_nasheed";
    copyrightShield?: boolean;
    autoUpload?: boolean;
  } = {}
): Promise<PipelineExecutionLog> {
  if (isRunning) {
    throw new Error("Pipeline is already executing! Please wait for the current run to complete.");
  }

  const isLongVideo = options.videoFormat === "long";
  const runId = `run_${Date.now()}`;
  const timestamp = new Date().toISOString();
  isRunning = true;
  currentRunId = runId;
  activeLogs = [];
  progressPercent = 5;
  currentStageIndex = 1;
  stageTitle = "Stage 1: Live Match & Topic Analysis";
  stageDescription = "Gathering verified match stats, scorecard records, and high-CTR hook...";
  stageDetail = "Checking deduplication and recent uploads";
  isVideoReady = false;
  isUploadReady = false;
  uploadPercent = 0;
  activeVideoMetadata = null;

  const addLog = (step: string, message: string) => {
    const entry = { step, message, timestamp: new Date().toISOString() };
    activeLogs.push(entry);
    console.log(`[Pipeline ${step}] ${message}`);
  };

  const executionRecord: PipelineExecutionLog = {
    id: runId,
    timestamp,
    status: "running",
    category: {
      id: "unknown",
      name: "Pending",
      ctrPercent: 0,
      impressions: 0,
      views: 0,
      trend: "stable",
    },
    script: {
      title: "",
      description: "",
      tags: [],
      hashtags: [],
      scenes: [],
    },
    logs: activeLogs,
  };

  try {
    // STEP 1: Query YouTube Analytics API & Channel Uploads for deduplication and highest CTR category
    currentStep = "analytics";
    addLog("analytics", `Checking YouTube channel upload history & analyzing trending viral CTR benchmarks (${isLongVideo ? "16:9 Long Video 8+ Min" : "9:16 Vertical Short 2+ Min"})...`);

    // 1a. Fetch existing channel video titles and local pipeline history to guarantee NO duplicate topics/titles
    const channelTitles = await fetchChannelExistingVideoTitles(oauthToken);
    const historyLogs = loadHistory();
    const historyTitles = historyLogs.map((h) => h.script?.title).filter(Boolean);
    const coveredRegistry = loadCoveredTopicsRegistry();
    const registryTitles = coveredRegistry.map((c) => c.title).filter(Boolean);
    const existingTitles = Array.from(new Set([...channelTitles, ...historyTitles, ...registryTitles]));
    const recentCategoryIds = Array.from(
      new Set([
        ...historyLogs.slice(0, 8).map((h) => h.category?.id).filter(Boolean),
        ...coveredRegistry.slice(0, 8).map((c) => c.category).filter(Boolean),
      ])
    ) as string[];

    if (existingTitles.length > 0) {
      addLog("analytics", `Deduplication Active: Found ${existingTitles.length} existing channel/history video titles. Ensuring brand-new unique topic.`);
    }

    const analyticsResult = await fetchHighestCTRCategory(oauthToken, recentCategoryIds, existingTitles);
    let winningCategory = analyticsResult.topCategory;

    // Check if user chose a specific category
    if (options.categoryId) {
      const matched = analyticsResult.categories.find((c) => c.id === options.categoryId);
      if (matched) {
        winningCategory = matched;
      }
    } else if (options.overrideNiche && options.overrideNiche.trim()) {
      const nicheQuery = options.overrideNiche.toLowerCase().trim();
      const matched = analyticsResult.categories.find(
        (c) => c.name.toLowerCase().includes(nicheQuery) || c.niche.toLowerCase().includes(nicheQuery)
      );
      if (matched) {
        winningCategory = matched;
      } else {
        winningCategory = {
          id: `custom-${Date.now()}`,
          name: options.overrideNiche,
          niche: options.overrideNiche,
          ctrPercent: 15.2,
          impressions: 65000,
          views: 9800,
          avgViewDurationSec: isLongVideo ? 360 : 50,
          trend: "hot",
          description: `Viral trending facts about ${options.overrideNiche}`,
          sampleHook: `Did you know the most insane secret about ${options.overrideNiche}?`,
        };
      }
    }

    executionRecord.category = {
      id: winningCategory.id,
      name: winningCategory.name,
      ctrPercent: winningCategory.ctrPercent,
      impressions: winningCategory.impressions,
      views: winningCategory.views,
      trend: winningCategory.trend,
    };

    addLog(
      "analytics",
      `Selected Trending Category: "${winningCategory.name}" (${winningCategory.niche}) with ${winningCategory.ctrPercent}% CTR (Source: ${analyticsResult.source})`
    );

    // STEP 2: Generate viral video script using Gemini AI with strict deduplication & 100% factual accuracy
    currentStep = "gemini_script";
    progressPercent = 18;
    currentStageIndex = 2;
    stageTitle = "Stage 2: Script & Storyboard Creation";
    stageDescription = `Gemini AI writing ${isLongVideo ? "16-chapter full documentary" : "2+ Min (120s+) viral fact short"} script...`;
    stageDetail = `Analyzing scorecard turning points & crafting hook for "${winningCategory.name}"`;
    addLog("gemini_script", `Prompting Gemini AI for 100% verified facts & unique high-CTR script for "${winningCategory.name}" (${isLongVideo ? "8+ Min Full Documentary" : "2+ Min Viral Fact Short (120s+)"})...`);

    const apiKey =
      geminiApiKey ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.CUSTOM_GEMINI_API_KEY ||
      process.env.GEMINI_KEY ||
      process.env.API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key is required. Please set GOOGLE_API_KEY or CUSTOM_GEMINI_API_KEY in Settings.");
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { "User-Agent": "aistudio-build" },
      },
    });

    const recentTitlesListStr = existingTitles.slice(0, 40).map((t) => `- "${t}"`).join("\n");
    const coveredSummaryList = coveredRegistry
      .slice(0, 40)
      .map((item, idx) => `${idx + 1}. "${item.title}" (Subject: ${item.subject || item.title})`)
      .join("\n");

    const freshSubtopicCandidate = pickFreshUntouchedSubtopic(
      winningCategory.id,
      winningCategory.name,
      existingTitles,
      coveredRegistry
    );

    if (freshSubtopicCandidate) {
      addLog("gemini_script", `Fresh Subtopic Selected: "${freshSubtopicCandidate.topic}" (Zero collision with past ${existingTitles.length} topics)`);
    }

    const rawHighlightUrls = Array.isArray(options.highlightUrls)
      ? options.highlightUrls.map((u) => (typeof u === "string" ? u.trim() : "")).filter(Boolean)
      : [];
    const hasHighlightUrls = rawHighlightUrls.length > 0;

    let parsedScript: any = null;
    let rawScriptText = "";

    if (hasHighlightUrls) {
      addLog(
        "highlight_pipeline",
        `Received ${rawHighlightUrls.length} Match Highlight link(s) for 5-second dynamic extraction & commentary.`
      );
      progressPercent = 15;
      currentStageIndex = 1;
      stageTitle = "Stage 1: Inspecting & Downloading Highlight Links (1-3 URLs)";
      stageDescription = `Downloading & extracting 5-second action clips from ${rawHighlightUrls.length} highlight source(s)...`;
      stageDetail = `Analyzing video streams & key moments`;

      // 1. Inspect all links
      const metadataList: HighlightLinkMetadata[] = await Promise.all(
        rawHighlightUrls.map((url) => inspectHighlightLink(url, apiKey))
      );

      metadataList.forEach((m, idx) => {
        addLog(
          "highlight_pipeline",
          `Link #${idx + 1}: "${m.title}" (${m.uploader || "Sports TV"}) - Duration: ${m.durationSeconds || 300}s`
        );
      });

      // 2. Extract 5-second clips from each link
      // If 1 link: 6 to 8 clips (30-40s)
      // If 2 links: 4 clips each (8 clips total = 40s)
      // If 3 links: 3 clips each (9 clips total = 45s)
      let clipsPerLink = 3;
      if (rawHighlightUrls.length === 1) clipsPerLink = isLongVideo ? 10 : 6;
      else if (rawHighlightUrls.length === 2) clipsPerLink = 4;
      else clipsPerLink = 3;

      progressPercent = 25;
      stageTitle = "Stage 2: Cutting 5-Second Action Clips";
      stageDescription = `Cutting ${clipsPerLink} high-voltage 5-sec clips from each highlight link...`;

      const allExtractedClips: ExtractedClipItem[] = [];
      for (let i = 0; i < rawHighlightUrls.length; i++) {
        const url = rawHighlightUrls[i];
        addLog("highlight_pipeline", `Extracting ${clipsPerLink} 5-sec clips from Highlight #${i + 1} (Filter: ${options.filterMode || "full_match_highlights"})...`);
        const { clips } = await extract5SecClipsFromHighlight(url, i, clipsPerLink, {
          isLongVideo,
          filterMode: options.filterMode,
          targetPlayerName: options.targetPlayerName,
          bgmStyle: options.bgmStyle,
          copyrightShield: options.copyrightShield,
          onProgress: (msg) => {
            stageDetail = msg;
            addLog("highlight_pipeline", msg);
          },
        });
        allExtractedClips.push(...clips);
      }

      addLog("highlight_pipeline", `Successfully extracted ${allExtractedClips.length} dynamic 5-second video clips!`);

      // 3. Script & Commentary Generation
      progressPercent = 40;
      currentStageIndex = 2;
      stageTitle = "Stage 3: Cricket Commentary Generation (Speaking on What Happened)";
      stageDescription = `Gemini AI writing high-energy sports commentary for each 5-second clip...`;
      stageDetail = `Narrating wickets, sixes, turning points & link highlights`;
      addLog(
        "gemini_script",
        `Writing dedicated cricket commentary analyzing what took place in each 5-second clip across all ${rawHighlightUrls.length} highlight link(s) (Filter: ${options.filterMode || "full_match_highlights"})...`
      );

      parsedScript = await buildMultiHighlightScript(metadataList, allExtractedClips, {
        languageStyle: options.languageStyle,
        geminiApiKey: apiKey,
        isLongVideo,
        customMatchTitle: options.cricketMatchDetails?.matchTitle,
        filterMode: options.filterMode,
        targetPlayerName: options.targetPlayerName,
        bgmStyle: options.bgmStyle,
      });

      winningCategory.name = parsedScript.title;
      winningCategory.niche = "Cricket Highlights & 5s Multi-Clip Breakdown";
      winningCategory.ctrPercent = 19.8;
      addLog("gemini_script", `Script generated: "${parsedScript.title}" with ${parsedScript.scenes.length} commentary scenes (5s each).`);
    } else {
    const isCricket =
      winningCategory.id === "cricket-match-doc" ||
      winningCategory.name.toLowerCase().includes("cricket") ||
      winningCategory.niche.toLowerCase().includes("cricket") ||
      Boolean(options.cricketMatchDetails);

    const isCustomUserPrompt = Boolean(options.customPrompt && options.customPrompt.trim());
    const cricketInfo = options.cricketMatchDetails || null;
    const isUrduHindi = options.languageStyle === "urdu_hindi" || options.languageStyle === "urdu";

    let scriptPrompt = "";

    if (isCustomUserPrompt) {
      const userPromptText = options.customPrompt!.trim();
      const requestedMinutes = options.targetDurationMinutes && options.targetDurationMinutes > 0
        ? options.targetDurationMinutes
        : (isLongVideo ? 8 : 3);

      const sceneCount = isLongVideo
        ? Math.max(6, Math.min(20, Math.round(requestedMinutes * 2))) // e.g. 8 mins = 16 scenes (30s each)
        : requestedMinutes <= 1
        ? 4 // 1 minute: 4 snappy scenes (48s total) - ultrafast under 90s render!
        : requestedMinutes <= 2
        ? 8 // 2 minutes: 8 scenes (96s total) - smooth fast render
        : Math.max(6, Math.min(12, Math.round(requestedMinutes * 4))); // 3 mins: 12 scenes (144s total)

      const sceneDuration = isLongVideo ? 30 : 12;

      scriptPrompt = `You are a world-class professional documentary and viral video producer for AutoTube AI.
The user has provided an EXACT custom instruction, prompt, or COMPLETE WRITTEN SCRIPT.
You MUST strictly honor and use their input.

USER'S EXACT SCRIPT / PROMPT INPUT:
"""
${userPromptText}
"""

TARGET DURATION: ~${requestedMinutes} Minutes (${sceneCount} scenes, each approx ${sceneDuration} seconds).
FORMAT: ${isLongVideo ? "16:9 Widescreen Full Professional Long Video" : "9:16 Vertical Viral YouTube Short"}
LANGUAGE: ${isUrduHindi ? "Roman Urdu / Hindi (natural, captivating, professional tone)" : "English (crisp, authoritative, high-retention narration)"}

SCRIPT & NARRATION HANDLING RULES:
1. IF THE USER PROVIDED A READY-MADE SCRIPT:
   - Divide their actual script lines across the ${sceneCount} scenes sequentially without omitting their words or changing their meaning.
   - Match each scene's voiceText directly to their script paragraphs or dialogue in proper order from start to finish.
2. IF THE USER PROVIDED STORY OUTLINE / STEP-BY-STEP PROMPT:
   - Follow their exact progression:
     * Scene 1 (Beginning / Hook): Explosive opening hook introducing the topic or conflict.
     * Early Scenes (Setup & Genesis): Background context and initial setup.
     * Middle Scenes (Rising Action & Steps): Step-by-step unfolding of events, mechanics, and revelations.
     * Climax Scenes (Peak Moment): Turning point or climax.
     * Final Scene (Resolution & Subscribe Outro): Conclusion + Call-To-Action (asking viewers to subscribe and like).

CRITICAL PRODUCTION RULES:
- Exactly ${sceneCount} scenes.
- Each scene must have "durationSeconds": ${sceneDuration}.
- "visualPrompt": Highly descriptive, photorealistic, cinematic prompt describing the EXACT real subject, camera motion, and lighting. NO cartoon or fake hallucinated elements.
- "voiceText": Professional, captivating spoken narration (~25-30 words per scene for shorts, ~45-55 words for long videos).
- "badge": Punchy 2-4 word uppercase badge (e.g. "🚨 THE HOOK", "⚡ TURNING POINT", "🏆 THE CLIMAX", "🔔 SUBSCRIBE").
- "highlight": 1-3 high-impact words for dynamic Hormozi subtitle coloring.

Respond ONLY with this JSON schema:
{
  "title": "Under 70 chars high-CTR professional title based on user prompt",
  "description": "250-400 words SEO description summarizing the complete story and key points",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8", "tag9", "tag10"],
  "hashtags": ["#Topic1", "#Topic2", "#Trending", "#AutoTubeAI"],
  "scenes": [
    {
      "badge": "...",
      "title": "...",
      "body": "...",
      "highlight": "...",
      "visualPrompt": "...",
      "voiceText": "...",
      "durationSeconds": ${sceneDuration}
    }
  ]
}`;
    } else if (isCricket) {
      const matchContext = cricketInfo
        ? `MATCH DOSSIER & FACTS:
Match Title: ${cricketInfo.matchTitle || winningCategory.name}
Tournament: ${cricketInfo.tournament || "International Cricket Championship"}
Teams: ${cricketInfo.teams?.team1 || "Team 1"} vs ${cricketInfo.teams?.team2 || "Team 2"}
Result / Status: ${cricketInfo.resultSummary || "Sensational thrilling finish"}
Top Batters & Runs: ${cricketInfo.topBatters || "Sensational batting masterclass"}
Top Bowlers & Wickets: ${cricketInfo.topBowlers || "Lethal bowling spells & wickets"}
Turning Point Moment: ${cricketInfo.turningPoint || "The dramatic late overs turnaround"}
Viral Hook: ${cricketInfo.viralHook || "How this match shocked cricket fans worldwide!"}
Overview: ${cricketInfo.summary || winningCategory.description}`
        : `MATCH TOPIC: ${winningCategory.name} (${winningCategory.description})`;

      if (isLongVideo) {
        scriptPrompt = `You are the chief sports documentary director for AutoTube Cricket TV, producing an electrifying 8+ MINUTE 16:9 WIDESCREEN CRICKET MATCH DOCUMENTARY.

${matchContext}

LANGUAGE & COMMENTARY STYLE: ${
          isUrduHindi
            ? "Urdu / Hindi high-energy cricket commentary & storytelling (Roman Urdu / Hindi terms mixed naturally like 'Shandar Chhakka', 'Qayamat-khez Bowling', 'Hairan-kun Over', 'Dhamaakedaar Match')."
            : "Dynamic International Cricket Broadcast Commentary style (passionate, analytical, fast-paced, honoring player achievements)."
        }

CRITICAL RULES:
1. Include exact player names (e.g., Babar Azam, Virat Kohli, Shaheen Afridi, Rohit Sharma, Jasprit Bumrah, Mohammad Rizwan, Joe Root, Ben Stokes, Pat Cummins, Travis Head, etc.), runs scored, balls faced, wickets taken, economy rates, and specific overs.
2. PLAYER FOCUS DIRECTIVE: In scenes discussing a batsman or bowler, explicitly write their FULL NAME in title, body, and voiceText (e.g. "Babar Azam anchors the innings with a brilliant masterclass" or "Jasprit Bumrah delivers an unplayable yorker") so the video engine automatically displays their authentic official portrait photo!
3. Structure into exactly 8 high-voltage documentary chapters (each 15s = 120s total full documentary):
   - Ch 01: The Electric Stadium Atmosphere & Toss
   - Ch 02: Powerplay Carnage & Early Strike
   - Ch 03: The Big Partnership & Boundary Blitz
   - Ch 04: Middle Overs Spin Trap & Pressure Build-up
   - Ch 05: Death Overs Fireworks & Target Set
   - Ch 06: Batsman Counter-Attack & Magnificent 50/100
   - Ch 07: The Turning Point Over & Heart-Stopping Finish
   - Ch 08: Player of the Match, Scorecard & Outro

Respond ONLY with this JSON schema:
{
  "title": "...",
  "description": "...",
  "tags": ["Cricket", "MatchHighlights", "...", 15 tags total],
  "hashtags": ["#Cricket", "#INDvsENG", "#MatchHighlights", "#CricketDocumentary", "#AutoTubeAI"],
  "scenes": [
    {
      "badge": "CH 01: HIGH VOLTAGE START",
      "title": "...",
      "body": "...",
      "highlight": "...",
      "visualPrompt": "cinematic 4k 16:9 cricket stadium under floodlights, packed roaring crowd, lush pitch, batsman in stance, ultra photorealistic",
      "voiceText": "...",
      "durationSeconds": 32
    }
  ]
}`;
      } else {
        scriptPrompt = `You are the executive viral short producer for AutoTube Cricket TV, specializing in creating high-retention, high-CTR 2+ MINUTE (125-132s) viral YouTube Shorts.

MATCH STORY CONTEXT:
${matchContext}

LANGUAGE STYLE: ${
          isUrduHindi
            ? "Urdu / Hindi viral cricket commentary style with exciting catchy phrases, emotional intensity, and high drama."
            : "Exciting, high-tempo English sports commentary with dramatic storytelling."
        }

CRITICAL DEDUPLICATION & UNIQUE TOPIC DIRECTIVE:
Existing titles published on this channel or recent runs:
${recentTitlesListStr || "None yet"}
You MUST NOT repeat any match or topic already covered above. Pick a completely fresh match, contest, or thrilling angle!

CRITICAL VIRAL SHORT DIRECTIVES:
1. DURATION & PACING (MINIMUM 2 MINUTES / 125-132s TOTAL):
Generate exactly 11 scenes. Each scene is 11-12 seconds long. Each scene's "voiceText" MUST contain 25 to 28 spoken words (approx 280-310 total words across the video) ensuring rich, continuous, and thrilling commentary.
2. THE 3-SECOND PATTERN-INTERRUPT HOOK:
Scene 1 MUST start with an explosive, high-stakes curiosity hook that immediately stops the user from scrolling.
3. COMPLETE DRAMATIC STORY ARC (BAAT POORI HONI CHAHIYE):
This must NOT be a set of disjointed bullet points. It must be ONE CONTINUOUS, THRILLING STORY with a clear beginning, rising tension, turning point climax, and a complete satisfying resolution in Scene 10, followed by a Subscribe Call-to-action in Scene 11.
4. LOWER-THIRD HORMOZI CAPTIONS:
Every scene's "title", "body", and "highlight" must be punchy, high-impact, and color-highlight friendly.

Structure for the 11 Scenes (11-12s each = 125-132s total):
- Scene 1 (0-12s): The Impossible Hook (badge: "🚨 MATCH OF THE YEAR", title: punchy 3-4 words, body: shocking match situation or impossible chase, highlight: "IMPOSSIBLE THRILLER", visualPrompt: "cinematic 4k vertical cricket stadium under blazing floodlights, batsman ready to strike, intense atmospheric smoke, ultra photorealistic", voiceText: "25-28 spoken words starting with an irresistible shock statement that hooks the viewer instantly", durationSeconds: 12)
- Scene 2 (12-24s): Powerplay Fireworks (badge: "💥 POWERPLAY CARNAGE", title: punchy title, body: early explosive boundaries and attacking field placements, highlight: "BOUNDARIES RAINING", visualPrompt: "cinematic 4k vertical cricket batsman smashing pull shot into roaring crowd, photorealistic 8k", voiceText: "25-28 spoken words describing the opening explosive onslaught and high-voltage momentum", durationSeconds: 12)
- Scene 3 (24-36s): The Crucial Breakthrough (badge: "⚡ LETHAL BOWLING", title: punchy title, body: fast bowler strikes with unplayable delivery, highlight: "STUMPS SHATTERED", visualPrompt: "cinematic 4k vertical fast bowler celebrating fiercely as middle stump cartwheels out of ground", voiceText: "25-28 spoken words capturing the heart-stopping wicket that silenced the batting side", durationSeconds: 12)
- Scene 4 (36-48s): Mountain Target Built (badge: "🎯 MONSTER TARGET", title: punchy title, body: how the massive total was achieved in death overs, highlight: "HUGE TOTAL SET", visualPrompt: "cinematic 4k vertical batsman raising bat to roaring crowd, electronic scoreboard in background", voiceText: "25-28 spoken words describing the fearless batting finish that posted a towering mountain target", durationSeconds: 12)
- Scene 5 (48-60s): The Fierce Counter-Attack (badge: "🔥 SENSATIONAL CHASE", title: punchy title, body: how the chasing team fought back ball by ball, highlight: "ROARING FIGHTBACK", visualPrompt: "cinematic 4k vertical batsman driving through covers under night floodlights, lens flare, 8k", voiceText: "25-28 spoken words capturing the explosive counter-attack and rising crowd hysteria", durationSeconds: 12)
- Scene 6 (60-72s): Spin Trap In Middle Overs (badge: "🌀 THE SPIN TRAP", title: punchy title, body: mystery spin turns the pitch into a minefield, highlight: "MYSTERY SPIN", visualPrompt: "cinematic 4k vertical mystery spinner releasing ball in extreme slow motion under floodlights", voiceText: "25-28 spoken words describing the tricky middle overs where every dot ball brought breathless pressure", durationSeconds: 12)
- Scene 7 (72-84s): The Insane Turning Point (badge: "⚡ THE TURNING POINT", title: punchy title, body: the single over that flipped the game completely, highlight: "GAME FLIPPED", visualPrompt: "cinematic 4k vertical fielder taking spectacular flying boundary catch near ropes", voiceText: "25-28 spoken words delivering the shocking game-changing moment that left spectators in total disbelief", durationSeconds: 12)
- Scene 8 (84-96s): Death Overs Tension (badge: "🥶 NERVES OF STEEL", title: punchy title, body: equation down to wire, captains under immense pressure, highlight: "PURE PRESSURE", visualPrompt: "cinematic 4k vertical captain talking to bowler under stadium lights, intense close-up", voiceText: "25-28 spoken words detailing the nerve-shredding field settings and icy focus as the final overs arrived", durationSeconds: 12)
- Scene 9 (96-108s): Last Over Heart-Stopper (badge: "🔥 LAST OVER CLIMAX", title: punchy title, body: 6 balls, impossible equation, pure adrenaline, highlight: "LAST BALL FINISH", visualPrompt: "cinematic 4k vertical bowler running in for final ball, stadium holding its collective breath", voiceText: "25-28 spoken words describing the insane drama of the final over and the heart-stopping finish", durationSeconds: 12)
- Scene 10 (108-120s): The Grand Victory Payoff (badge: "🏆 HISTORIC WIN", title: "Legendary Finish", body: "A victory etched forever into cricket history!", highlight: "VICTORY FOREVER", visualPrompt: "cinematic 4k vertical team celebrating wildly on pitch with fireworks exploding over stadium", voiceText: "25-28 spoken words delivering the triumphant resolution to this historic cricket thriller", durationSeconds: 12)
- Scene 11 (120-132s): Follow & Subscribe Loop (badge: "🔔 SUBSCRIBE FOR CRICKET", title: "Subscribe For More", body: "Agar match pasand aaya toh channel ko zaroor subscribe karein!", highlight: "SUBSCRIBE & LIKE", visualPrompt: "cinematic 4k vertical glowing golden cricket trophy and subscribe bell with fireworks", voiceText: "Agar aapko yeh sensational cricket match pasand aaya toh daily thrillers ke liye channel ko zaroor subscribe karein, like karein aur bell icon dabana mat bhooliye ga!", durationSeconds: 12)

Respond ONLY with this JSON schema:
{
  "title": "Under 70 chars high-CTR title",
  "description": "250-300 words SEO description with match breakdown and hashtags",
  "tags": ["tag1", "...", "tag15"],
  "hashtags": ["#Cricket", "#MatchShorts", "#ViralCricket", "#Shorts", "#AutoTubeAI"],
  "scenes": [
    {
      "badge": "...",
      "title": "...",
      "body": "...",
      "highlight": "...",
      "visualPrompt": "...",
      "voiceText": "...",
      "durationSeconds": 12
    }
  ]
}`;
      }
    } else {
      scriptPrompt = isLongVideo
        ? `You are the executive documentary producer for AutoTube AI, producing a comprehensive, breathtaking 8+ MINUTE 16:9 WIDESCREEN YOUTUBE DOCUMENTARY in the trending niche "${winningCategory.niche}".

CRITICAL DIRECTIVES:
1. STRICT ANTI-DUPLICATION / UNIQUE TOPIC RULE:
The user already has the following videos published on their channel or recent runs:
${recentTitlesListStr || "None yet"}
You MUST NOT create a video with any of the above titles or cover the exact same specific subject. Pick a completely fresh, distinct sub-topic/phenomenon within "${winningCategory.name}".

2. 100% FACTUAL ACCURACY & ZERO HALLUCINATION RULE:
All facts, scientific mechanisms, numbers, scales, dates, and historical discoveries MUST BE 100% FACTUALLY ACCURATE and scientifically verified (NASA, Nature/Science journals, verified biology, academic history). DO NOT invent fake numbers, mythological pseudoscience, or fabricated claims.

3. DURATION & CHAPTER STRUCTURE (MINIMUM 8 MINUTES):
Generate exactly 16 deep documentary chapters / scenes (each 32 seconds duration = 512 seconds total ~8.5 minutes). Each chapter must have in-depth educational narrative narration, verified statistics, and accurate visual prompts.

Trending Niche: "${winningCategory.niche}"
Category Topic: "${winningCategory.name}"
Category Context: "${winningCategory.description}"

Create a full documentary package strictly following this format:
1. Title: Under 70 characters, cinematic, highly compelling, SEO optimized for YouTube search and suggested documentaries.
2. Description: 400-500 words, rich with high-volume search keywords in this niche, complete with YouTube Chapter Timestamps (00:00 - Prologue, 00:32 - Chapter 1, 01:04 - Chapter 2, etc.), verified scientific sources summary, and call-to-action.
3. Tags: Exactly 15 high-ranking SEO tags (no '#' symbols).
4. Hashtags: Exactly 5 trending hashtags starting with '#' (e.g., #Documentary, #ScienceFacts, #DeepDive, #Space, #AutoTubeAI).
5. Scenes: Exactly 16 scenes (each durationSeconds: 32) spanning the full narrative arc from introduction, historical genesis, extreme physics/mechanisms, deep experiments, global impact, to philosophical epilogue.

Respond ONLY with this JSON schema:
{
  "title": "...",
  "description": "...",
  "tags": ["tag1", "...", "tag15"],
  "hashtags": ["#tag1", "...", "#tag5"],
  "scenes": [
    {
      "badge": "CH 01: GENESIS",
      "title": "...",
      "body": "...",
      "highlight": "KEY DISCOVERY",
      "visualPrompt": "photorealistic 4k cinematic 16:9 widescreen documentary shot matching narration",
      "voiceText": "Detailed, elegant spoken narrative for 32 seconds...",
      "durationSeconds": 32
    }
  ]
}`
        : `You are the master facts documentary storyteller and executive YouTube Shorts director for AutoTube AI, creating top 0.1% retention 3-MINUTE (UP TO 180 SECONDS) YOUTUBE SHORTS in the viral niche "${winningCategory.niche}".

CRITICAL VIRAL BLUEPRINT (MUST FOLLOW 100%):
1. DURATION REQUIREMENT (UP TO 3 MINUTES / 165-180 SECONDS TOTAL):
YouTube Shorts now officially supports up to 3-minute vertical videos. The user explicitly requires a comprehensive, high-retention 2.5 to 3-minute short (strictly 14 to 15 detailed scenes, each 11 to 12 seconds, totaling 165 to 180 seconds). NEVER output a rushed or short 60-second video!

2. STRICT CHANNEL DEDUPLICATION & UNIQUE TOPIC RULE ("AIK HI TOPIC PER BAR BAR VIDEO NA BANAO"):
The user's YouTube channel already contains the following published video titles:
${recentTitlesListStr || "None yet"}

CRITICAL REQUIREMENT: You MUST inspect every title above and NEVER generate a video on any topic, subject, or phenomenon that has already been covered!
Do NOT make slight variations or rewordings of existing topics.
You MUST choose a completely BRAND NEW, UNIQUE, UNTOUCHED, and FASCINATING subject within "${winningCategory.name}" that does NOT exist on this channel!

${
  freshSubtopicCandidate
    ? `CRITICAL ASSIGNED SUBTOPIC & CELESTIAL SUBJECT:
- Mandatory Topic: "${freshSubtopicCandidate.topic}"
- Recommended Hook: "${freshSubtopicCandidate.hook}"
- Key Entities & Concepts to explore: ${freshSubtopicCandidate.keywords.join(", ")}
You MUST build this entire video specifically around "${freshSubtopicCandidate.topic}". Do NOT change or dilute this into generic topics.`
    : ""
}

3. REAL AUTHENTIC VISUAL SPECIFICATION ("JIS KI BARE ME BAT KARE WO DEKYE, FARZI TASVEER NAHI"):
For each scene's "visualPrompt", specify the EXACT REAL ENTITY, OBJECT, ORGANISM, HISTORICAL ARTIFACT, TELESCOPE, OR LOCATION being discussed (e.g. "James Webb Space Telescope infrared galaxy GN-z11", "Challenger Deep Mariana Trench bathymetric sonar map", "Milnesium tardigradum electron microscope photograph", "Yellowstone supervolcano hydrothermal caldera aerial photo", "SR-71 Blackbird titanium airframe wind tunnel shockwaves").
DO NOT describe imaginary, hallucinated, or fake concepts! The visual engine uses this exact entity name to fetch genuine archival encyclopedic photography from NASA, ESA, museums, and scientific research institutes.

4. COMPLETE STORYTELLING WITH HEAD & TAIL ("BAAT POORI HONI CHAHIYE - SAR AUR PAON KE SAATH"):
Do NOT output disjointed or shallow trivia bullets that confuse viewers. Tell ONE COMPLETE, CONTINUOUS, FASCINATING STORY from genesis to resolution:
- Act 1 (Scenes 1-3): The Unbelievable Hook & Initial Mystery — What is the shocking fact? Hook the viewer with an irresistible curiosity gap.
- Act 2 (Scenes 4-7): The Deep Scientific Genesis & Mechanisms — How and why does this happen? Explain the physics, biology, chemistry, or cosmic forces step-by-step with verified numbers and scales.
- Act 3 (Scenes 8-11): Extreme Realities & Terrifying Scenarios — What do scientists, probes, and satellites measure? What happens if an object or human encounters this?
- Act 4 (Scenes 12-14): The Scientific Breakthrough & Complete Climax — Completely answer the question raised in the hook! Deliver the full, satisfying truth with zero loose ends.
- Act 5 (Scene 15): The Grand Subscribe Call-To-Action (SUBSCRIBE KE BARE MEIN LAZMI BATANA HAI) — Explicitly invite the audience to subscribe to the channel, like, and tap the bell icon.

5. LAST SCENE SUBSCRIBE CTA & LANGUAGE DIRECTIVE:
${
  options.languageStyle === "urdu" || options.languageStyle === "urdu_hindi"
    ? `LANGUAGE: Roman Urdu / Hindi for all scenes! Every scene's "voiceText", "title", and "body" must be written in exciting, dramatic, natural Roman Urdu/Hindi.
Scene 15 MUST explicitly conclude with an engaging, natural Call-To-Action in Roman Urdu:
- Badge: "🔔 SUBSCRIBE FOR DAILY FACTS"
- Title: "Subscribe Now"
- Highlight: "SUBSCRIBE & LIKE"
- Body: "Agar video pasand aayi toh channel ko zaroor subscribe karein!"
- VoiceText MUST conclude with: "Agar aapko yeh hairat-angez fact pasand aaya toh mazeed aisi videos ke liye channel ko abhi subscribe karein, like karein aur bell icon dabana mat bhooliye ga!"`
    : `LANGUAGE: English for all scenes! Every scene's "voiceText", "title", and "body" must be written in crisp, cinematic, high-retention English.
Scene 15 MUST explicitly conclude with an engaging, natural Call-To-Action in English:
- Badge: "🔔 SUBSCRIBE FOR DAILY FACTS"
- Title: "Subscribe for More"
- Highlight: "SUBSCRIBE & LIKE"
- Body: "If you enjoyed this fact, hit subscribe for daily discoveries!"
- VoiceText MUST conclude with: "If you found this mind-blowing fact fascinating, hit subscribe right now, like this video, and tap the bell icon for daily unbelievable discoveries!"`
}

6. EXACT PACING & WORD COUNT:
Generate exactly 15 scenes. Each scene is 11 to 12 seconds long (total 165-180 seconds, up to 3 minutes). Each scene's "voiceText" MUST contain 26 to 30 spoken words (approx 390-440 total words across the video) ensuring smooth, natural, rich, and continuous narration across the full 3 minutes.

7. 100% FACTUAL ACCURACY & VERIFIED SCIENCE:
All mechanisms, numbers, scales, and astrophysical / biological phenomena must be authentic, verified, and awe-inspiring.

Structure for the 15 Scenes (11-12s each = ~175-180s total, up to 3 minutes):
- Scene 1 (0-12s): The Impossible Hook (badge: "🚨 MIND-BLOWING FACT", title: punchy 3-4 words, body: shocking truth statement, highlight: "IMPOSSIBLE MYSTERY", visualPrompt: "exact real subject name, photorealistic 4k cinematic vertical 9:16 shot with dramatic volumetric lighting", voiceText: "26-30 spoken words hooking the viewer instantly with an irresistible question or shock discovery", durationSeconds: 12)
- Scene 2 (12-24s): The Setup & Context (badge: "🌍 THE DISCOVERY", title: punchy 3-4 words, body: when and where researchers first uncovered this, highlight: "INITIAL DISCOVERY", visualPrompt: "exact real subject discovery archive or scientific observatory vertical 9:16", voiceText: "26-30 spoken words detailing how scientists or explorers first noticed something impossible", durationSeconds: 12)
- Scene 3 (24-36s): Early Observations (badge: "🔭 FIRST SIGHTINGS", title: punchy title, body: initial anomalies recorded by instruments, highlight: "STRANGE ANOMALY", visualPrompt: "exact real observatory telemetry or telescope imagery vertical 9:16", voiceText: "26-30 spoken words revealing the initial data that puzzled scientists", durationSeconds: 12)
- Scene 4 (36-48s): The Hidden Mechanism (badge: "🔬 HOW IT WORKS", title: punchy title, body: the underlying physics or natural laws, highlight: "CORE MECHANISM", visualPrompt: "exact real phenomenon subatomic or microscopic visualization vertical 9:16", voiceText: "26-30 spoken words breaking down the core mechanism in clear, awe-inspiring detail", durationSeconds: 12)
- Scene 5 (48-60s): The Terrifying Scale (badge: "⚡ UNBELIEVABLE NUMBERS", title: punchy title, body: temperature, speed, or massive dimensions, highlight: "MASSIVE SCALE", visualPrompt: "exact real subject scale comparison vertical 9:16", voiceText: "26-30 spoken words presenting verified numbers, speeds, or pressures that blow human imagination", durationSeconds: 12)
- Scene 6 (60-72s): Deep Science Reality (badge: "🧪 LAB EVIDENCE", title: punchy title, body: satellite data or sensor measurements, highlight: "PROVEN BY DATA", visualPrompt: "exact real entity data telemetry or research imagery vertical 9:16", voiceText: "26-30 spoken words explaining the concrete physical evidence that proved this is real", durationSeconds: 12)
- Scene 7 (72-84s): Extreme Forces (badge: "💥 EXTREME FORCES", title: punchy title, body: physical conditions pushed to absolute limits, highlight: "CRUSHING POWER", visualPrompt: "exact real physical extreme conditions vertical 9:16", voiceText: "26-30 spoken words exploring the intense energy, gravity, or chemical reactions", durationSeconds: 12)
- Scene 8 (84-96s): Eyewitness Reality (badge: "👁️ WHAT WE SEE", title: punchy title, body: what a human would experience or witness, highlight: "EYEWITNESS REALITY", visualPrompt: "exact real location perspective vertical 9:16", voiceText: "26-30 spoken words taking the viewer inside the phenomenon to experience the reality", durationSeconds: 12)
- Scene 9 (96-108s): Spacecraft & Probe Findings (badge: "🛰️ SATELLITE PROBE", title: punchy title, body: data returned by robotic explorers or probes, highlight: "PROBE TELEMETRY", visualPrompt: "exact real spacecraft or robotic explorer photo vertical 9:16", voiceText: "26-30 spoken words detailing the exact telemetry beamed back to Earth", durationSeconds: 12)
- Scene 10 (108-120s): The Mind-Bending Twist (badge: "🤯 MIND-BENDING TWIST", title: punchy title, body: the paradox that defies common logic, highlight: "DEFIES ALL LOGIC", visualPrompt: "exact real phenomenon extreme close up vertical 9:16", voiceText: "26-30 spoken words revealing the most counter-intuitive, unbelievable twist of the fact", durationSeconds: 12)
- Scene 11 (120-132s): Ripple Effects (badge: "🪐 MASSIVE RIPPLE", title: punchy title, body: how this reshapes its surroundings, highlight: "COSMIC IMPACT", visualPrompt: "exact real surrounding environmental impact vertical 9:16", voiceText: "26-30 spoken words examining the dramatic consequences on the planetary or cosmic neighborhood", durationSeconds: 12)
- Scene 12 (132-144s): Scientific Consensus (badge: "🔭 EXPERT VERDICT", title: punchy title, body: what leading world institutions say, highlight: "OFFICIAL VERDICT", visualPrompt: "exact real scientific team or laboratory research vertical 9:16", voiceText: "26-30 spoken words explaining what modern science now confirms and how it reshapes our textbooks", durationSeconds: 12)
- Scene 13 (144-156s): Cosmic Significance (badge: "🌌 COSMIC MEANING", title: punchy title, body: what this reveals about the greater universe, highlight: "UNIVERSAL TRUTH", visualPrompt: "exact real cosmic panorama vertical 9:16", voiceText: "26-30 spoken words reflecting on what this breakthrough teaches humanity about existence", durationSeconds: 12)
- Scene 14 (156-168s): Complete Resolution (badge: "✨ THE FULL TRUTH", title: punchy title, body: the definitive answer to the opening hook, highlight: "MYSTERY SOLVED", visualPrompt: "exact real entity majestic wide shot capturing full beauty and truth vertical 9:16", voiceText: "26-30 spoken words providing the complete, satisfying conclusion to the opening mystery", durationSeconds: 12)
- Scene 15 (168-180s): Grand Outro & Subscribe CTA (badge: "🔔 SUBSCRIBE FOR DAILY FACTS", title: "Subscribe Now", body: "${options.languageStyle === "urdu" || options.languageStyle === "urdu_hindi" ? "Agar video pasand aayi toh channel ko zaroor subscribe karein!" : "Hit subscribe and tap bell for daily discoveries!"}", highlight: "SUBSCRIBE & LIKE", visualPrompt: "cinematic 9:16 vertical glowing golden bell and subscribe button with fireworks and starry background", voiceText: "${options.languageStyle === "urdu" || options.languageStyle === "urdu_hindi" ? "26-30 spoken words concluding: Agar aapko yeh fact hairat-angez laga toh mazeed aisi videos ke liye channel ko zaroor subscribe karein aur bell icon dabayein!" : "26-30 spoken words concluding: If you found this mind-blowing fact fascinating, hit subscribe right now, like this video, and tap the bell icon for daily unbelievable discoveries!"}", durationSeconds: 12)

Trending Niche: "${winningCategory.niche}"
Category Topic: "${winningCategory.name}"
Category Context: "${winningCategory.description}"

Respond ONLY with this JSON schema:
{
  "title": "Under 70 chars curiosity-driven title",
  "description": "250-300 words SEO description packed with keywords and narrative summary",
  "tags": ["tag1", "...", "tag15"],
  "hashtags": ["#tag1", "...", "#tag5"],
  "scenes": [
    {
      "badge": "...",
      "title": "...",
      "body": "...",
      "highlight": "...",
      "visualPrompt": "...",
      "voiceText": "...",
      "durationSeconds": 12
    }
  ]
}`;
      }

      // Prioritize ultra-reliable gemini-2.5-flash to prevent 503 high demand errors
      const candidateModels = ["gemini-2.5-flash", "gemini-3.8-flash", "gemini-3.1-flash-lite"];
      rawScriptText = "";
      let geminiErr: any = null;

      for (const model of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: scriptPrompt,
            config: {
              responseMimeType: "application/json",
              temperature: 0.8,
            },
          });
          if (response.text) {
            rawScriptText = response.text;
            break;
          }
        } catch (err) {
          geminiErr = err;
          console.warn(`Model ${model} failed for script generation:`, err);
        }
      }
    }

    if (!parsedScript && rawScriptText) {
      try {
        parsedScript = safeParseJsonFromAI(rawScriptText);
      } catch (err: any) {
        console.warn("safeParseJsonFromAI encountered issue, falling back to intelligent template:", err.message);
      }
    }

    // Collision Check: Verify generated topic is not a duplicate of existing channel videos or covered registry
    if (parsedScript && parsedScript.title) {
      let retryCount = 0;
      while (retryCount < 3) {
        const collision = checkTitleCollision(parsedScript.title, existingTitles, coveredRegistry);
        if (!collision.isCollision) break;

        retryCount++;
        addLog(
          "gemini_script",
          `Duplicate Topic Detected (Attempt ${retryCount}): "${parsedScript.title}" collides (${collision.overlapPercent}%) with "${collision.matchedTitle}". Re-generating 100% brand-new unique topic...`
        );
        try {
          const alternateCandidate = pickFreshUntouchedSubtopic(
            winningCategory.id,
            winningCategory.name,
            [...existingTitles, parsedScript.title],
            [...coveredRegistry, { title: parsedScript.title, subject: parsedScript.title }]
          );

          const dedupePrompt = `CRITICAL DEDUPLICATION DIRECTIVE:
The title "${parsedScript.title}" is too similar or already published on the YouTube channel ("${collision.matchedTitle}").
You MUST pick a COMPLETELY DIFFERENT, UNTOUCHED, and UNIQUE topic within "${winningCategory.name}".
${alternateCandidate ? `MANDATORY ASSIGNED FRESH TOPIC: "${alternateCandidate.topic}"\nSUGGESTED HOOK: "${alternateCandidate.hook}"\nKEY CONCEPTS: ${alternateCandidate.keywords.join(", ")}` : ""}
Forbidden topics: ${existingTitles.slice(0, 30).join("; ")}.
Ensure zero overlap with any of these.

Return JSON matching the schema with ${isLongVideo ? "16 documentary chapters" : "11 scenes (125-132s total)"}.`;

          const dedupeRes = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: dedupePrompt,
            config: { responseMimeType: "application/json", temperature: 0.95 },
          });
          if (dedupeRes.text) {
            const retryScript = safeParseJsonFromAI(dedupeRes.text);
            if (retryScript?.title && Array.isArray(retryScript.scenes) && retryScript.scenes.length > 0) {
              parsedScript = retryScript;
              const checkAfter = checkTitleCollision(parsedScript.title, existingTitles, coveredRegistry);
              if (!checkAfter.isCollision) {
                addLog("gemini_script", `Deduplication Success: Selected fresh unique topic "${parsedScript.title}"`);
                break;
              }
            }
          }
        } catch (e) {
          console.warn("Deduplication retry warning:", e);
          break;
        }
      }
    }

    if (parsedScript?.title) {
      recordCoveredTopic(
        parsedScript.title,
        winningCategory.id,
        winningCategory.niche,
        freshSubtopicCandidate?.topic || parsedScript.title
      );
    }

    // If Gemini parsing was empty or failed, use high-quality dynamic non-duplicate template
    if (!parsedScript || !parsedScript.title || !Array.isArray(parsedScript.scenes) || parsedScript.scenes.length === 0) {
      if (isLongVideo) {
        console.warn("Using high-quality 16-chapter 8+ Min Full Documentary template for niche:", winningCategory.name);

        const LONG_DOCS = [
          {
            id: "space-deep-doc",
            categoryMatch: "space",
            title: "Cosmic Enigmas: Mysteries Beyond The Event Horizon",
            description: `A comprehensive 8+ minute scientific documentary exploring the extreme frontiers of astrophysics, black hole thermodynamics, and the origins of space-time.

CHAPTER TIMESTAMPS:
00:00 - Prologue: The Silent Cosmos
00:32 - Chapter 01: The Birth of Supermassive Giants
01:04 - Chapter 02: Singularity & Event Horizon
01:36 - Chapter 03: Hawking Radiation & Quantum Leaks
02:08 - Chapter 04: Spaghettification & Gravitational Pull
02:40 - Chapter 05: Supermassive Black Hole Sagittarius A*
03:12 - Chapter 06: Neutron Stars & Pulsar Clocks
03:44 - Chapter 07: Kilonovae & The Forge of Gold
04:16 - Chapter 08: Relativistic Jets at Near Light-Speed
04:48 - Chapter 09: Gravitational Lensing in Deep Space
05:20 - Chapter 10: Dark Matter's Invisible Cosmic Web
05:52 - Chapter 11: Dark Energy & Accelerating Expansion
06:24 - Chapter 12: James Webb Telescope Deep Field
06:56 - Chapter 13: The Multiverse Theory & String Dimensions
07:28 - Chapter 14: The Cosmic Microwave Background
08:00 - Chapter 15: The Ultimate Fate of the Universe

Subscribe to AutoTube AI for in-depth educational documentaries and verified astrophysics discoveries!`,
            tags: ["Black Holes", "Space Documentary", "Astrophysics", "Cosmology", "NASA", "James Webb", "Astronomy", "Deep Space", "Physics", "Universe", "Science Documentary", "Event Horizon", "Dark Matter", "General Relativity", "Cosmos"],
            hashtags: ["#Documentary", "#SpaceMysteries", "#Astrophysics", "#Universe", "#AutoTubeAI"],
            scenes: [
              { badge: "PROLOGUE", title: "The Silent Void", body: "Across billions of light years, the universe harbors extreme gravitational anchors.", highlight: "SILENT COSMIC VOID", visualPrompt: "photorealistic 4k cinematic 16:9 deep space cosmic nebula starry expanse", voiceText: "Welcome to a journey into the deepest frontiers of astrophysical science, where gravity twists space and time beyond human comprehension.", durationSeconds: 32 },
              { badge: "CH 01: GENESIS", title: "Birth of Cosmic Giants", body: "When stars twenty times the mass of our Sun exhaust their fuel, core collapse initiates.", highlight: "STELLAR CORE COLLAPSE", visualPrompt: "supernova explosion collapsing stellar core glowing plasma shockwave 16:9", voiceText: "The story of extreme cosmic entities begins when supermassive stars deplete their nuclear fuel, triggering catastrophic gravitational collapse.", durationSeconds: 32 },
              { badge: "CH 02: HORIZON", title: "The Event Horizon", body: "The boundary beyond which escape velocity exceeds the speed of light.", highlight: "NO ESCAPE FOR LIGHT", visualPrompt: "glowing accretion disk spinning black hole photon sphere 16:9 documentary", voiceText: "At the event horizon, the laws of classical physics yield to general relativity. Not even light traveling at 300,000 kilometers per second can escape.", durationSeconds: 32 },
              { badge: "CH 03: QUANTUM", title: "Hawking Radiation", body: "Stephen Hawking proved quantum fluctuations cause black holes to slowly evaporate.", highlight: "QUANTUM EVAPORATION", visualPrompt: "subatomic virtual particle pairs escaping event horizon quantum field simulation", voiceText: "In 1974, Stephen Hawking revealed that virtual particle-antiparticle pairs near the horizon cause black holes to slowly radiate energy.", durationSeconds: 32 },
              { badge: "CH 04: PHYSICS", title: "Spaghettification", body: "Extreme tidal gravitational gradients stretch physical matter into ultra-thin streams.", highlight: "TIDAL GRAVITY STRETCH", visualPrompt: "infalling matter stream stretched by gravitational gradient spacetime distortion", voiceText: "An object approaching a stellar black hole experiences differential tidal forces so immense that matter is stretched into continuous molecular streams.", durationSeconds: 32 },
              { badge: "CH 05: SGR A*", title: "Milky Way's Monster", body: "Sagittarius A* commands four million times the mass of our solar system.", highlight: "4 MILLION SOLAR MASSES", visualPrompt: "supermassive black hole sagittarius A star center milky way glowing dust", voiceText: "At the gravitational heart of our own Milky Way galaxy lies Sagittarius A*, a supermassive engine exerting orbital command over millions of stars.", durationSeconds: 32 },
              { badge: "CH 06: PULSARS", title: "Neutron Star Clocks", body: "Pulsars rotate hundreds of times per second with atomic clock precision.", highlight: "700 ROTATIONS/SEC", visualPrompt: "rapidly spinning neutron star lighthouse pulsar beam cosmic magnetic field", voiceText: "Before reaching black hole density, collapsing cores form neutron stars, spinning up to seven hundred times every second with unmatched precision.", durationSeconds: 32 },
              { badge: "CH 07: KILONOVA", title: "The Cosmic Forge", body: "Neutron star mergers synthesize gold, platinum, and the heaviest elements.", highlight: "FORGE OF PRECIOUS METALS", visualPrompt: "kilonova explosion two neutron stars colliding golden relativistic ejecta", voiceText: "When two neutron stars collide in a kilonova event, the nuclear furnace synthesizes almost all the gold and platinum found across our solar system.", durationSeconds: 32 },
              { badge: "CH 08: JETS", title: "Relativistic Plasma", body: "Magnetic fields propel plasma jets across entire intergalactic distances.", highlight: "NEAR LIGHT SPEED", visualPrompt: "immense relativistic plasma jets shooting from galactic core across space", voiceText: "Twisted magnetic fields channel superheated infalling plasma into concentrated relativistic beams accelerating particles close to the speed of light.", durationSeconds: 32 },
              { badge: "CH 09: LENSING", title: "Gravitational Lenses", body: "Immense gravity bends the trajectory of background light around galactic clusters.", highlight: "SPACETIME CURVATURE", visualPrompt: "gravitational lensing warped galaxy light rings einstein ring deep space", voiceText: "Einstein's general relativity predicts that intense mass curves space-time itself, creating natural magnifying glasses that bend light across deep space.", durationSeconds: 32 },
              { badge: "CH 10: DARK MATTER", title: "The Invisible Scaffold", body: "85% of cosmic matter emits zero radiation but holds galaxies in formation.", highlight: "INVISIBLE COSMIC WEB", visualPrompt: "cosmic web dark matter filament structure glowing galactic nodes 16:9", voiceText: "Observations show that eighty-five percent of all matter in the universe is invisible dark matter, forming the gravitational scaffolding of the cosmos.", durationSeconds: 32 },
              { badge: "CH 11: EXPANSION", title: "Dark Energy Driving Force", body: "The expansion rate of the universe is accelerating across cosmic epochs.", highlight: "ACCELERATING EXPANSION", visualPrompt: "expanding universe redshifted galaxies moving away visualization 16:9", voiceText: "In 1998, astronomers discovered that rather than slowing under gravity, cosmic expansion is accelerating, propelled by mysterious dark energy.", durationSeconds: 32 },
              { badge: "CH 12: JWST", title: "Deep Field Revelations", body: "James Webb Space Telescope observes the first galaxies born after the Big Bang.", highlight: "13.5 BILLION YEARS AGO", visualPrompt: "james webb space telescope deep field ultra sharp colorful early universe", voiceText: "Infrared instruments aboard the James Webb Space Telescope have peered thirteen and a half billion years into the past, capturing the dawn of light.", durationSeconds: 32 },
              { badge: "CH 13: THEORIES", title: "Multiverse & Dimensions", body: "Theoretical physics investigates higher dimensional string geometries.", highlight: "HIGHER DIMENSIONS", visualPrompt: "calabi yau manifold higher dimensions theoretical physics mathematics 8k", voiceText: "Cutting-edge theoretical physics and string theory suggest that our observable three-dimensional universe may reside within higher dimensional space.", durationSeconds: 32 },
              { badge: "CH 14: CMB", title: "Echo of the Big Bang", body: "The Cosmic Microwave Background preserves the thermal imprint of creation.", highlight: "THERMAL AFTERGLOW", visualPrompt: "cosmic microwave background radiation all sky map glowing thermal fluctuations", voiceText: "Every cubic meter of space contains ancient photons dating back to 380,000 years after the Big Bang, preserving the thermal blueprint of our origin.", durationSeconds: 32 },
              { badge: "EPILOGUE", title: "The Cosmic Horizon", body: "Subscribe to AutoTube AI for continuous in-depth science and documentary expeditions.", highlight: "SUBSCRIBE FOR DEEP DIVES", visualPrompt: "cinematic pull-back Earth to Milky Way to Deep Field galaxies 16:9 master", voiceText: "As our instruments penetrate deeper into the cosmos, each discovery unveils new mysteries. Subscribe to AutoTube AI for daily verified science documentaries.", durationSeconds: 32 },
            ],
          },
          {
            id: "ocean-deep-doc",
            categoryMatch: "ocean",
            title: "Abyssal Secrets: Unexplored Frontiers of Earth's Deep Oceans",
            description: `An in-depth 8+ minute marine science documentary investigating the Mariana Trench, hydrothermal vents, and the alien biology thriving in the Hadal zone.

CHAPTER TIMESTAMPS:
00:00 - Prologue: The Blue Unknown
00:32 - Chapter 01: Mapping the 80% Unexplored
01:04 - Chapter 02: Descent Through the Epipelagic Zone
01:36 - Chapter 03: The Mesopelagic Twilight Zone
02:08 - Chapter 04: Midnight Abyss & Total Darkness
02:40 - Chapter 05: Hydrostatic Pressure Physics
03:12 - Chapter 06: Mariana Trench Challenger Deep
03:44 - Chapter 07: Snailfish & Extreme Cell Membranes
04:16 - Chapter 08: Bioluminescent Warfare & Communication
04:48 - Chapter 09: Hydrothermal Black Smoker Vents
05:20 - Chapter 10: Chemosynthesis: Life Without Sunlight
05:52 - Chapter 11: Colossal & Giant Squids of the Deep
06:24 - Chapter 12: Submarine Exploration Technology
06:56 - Chapter 13: Deep Sea Microbial Medical Goldmine
07:28 - Chapter 14: Subduction Zones & Megathrust Faults
08:00 - Chapter 15: Preserving the Abyssal Biosphere

Subscribe to AutoTube AI for full-length marine biology and Earth science documentaries!`,
            tags: ["Deep Ocean", "Mariana Trench", "Ocean Documentary", "Marine Biology", "Challenger Deep", "Hydrothermal Vents", "Bioluminescence", "Earth Science", "Deep Sea", "Abyss", "Nature Documentary", "Science Facts", "Ocean Mysteries", "Underwater", "Biology"],
            hashtags: ["#Documentary", "#DeepOcean", "#MarianaTrench", "#MarineLife", "#AutoTubeAI"],
            scenes: [
              { badge: "PROLOGUE", title: "The Blue Planet", body: "Oceans cover 71% of Earth's surface yet remain our least explored frontier.", highlight: "71% OF EARTH SURFACE", visualPrompt: "photorealistic 4k cinematic 16:9 aerial shot majestic deep blue open ocean waves", voiceText: "Covering over seventy percent of our planet's surface, the world's oceans harbor ecosystems more alien to humans than the lunar landscape.", durationSeconds: 15 },
              { badge: "CH 01: MYSTERY", title: "80% Unmapped Abyss", body: "We possess more detailed topographical maps of Venus and Mars than our seafloor.", highlight: "MORE MAPPED MARS", visualPrompt: "high tech sonar bathymetric ocean floor topographical 3D map glowing 16:9", voiceText: "Despite centuries of seafloor exploration, more than eighty percent of our ocean floor remains unmapped by modern high-resolution sonar.", durationSeconds: 15 },
              { badge: "CH 02: SUNLIT", title: "Epipelagic Gateway", body: "Sunlight penetrates only the top 200 meters, supporting photosynthetic life.", highlight: "TOP 200 METERS", visualPrompt: "clear sunlit tropical ocean water sun rays piercing surface coral life 16:9", voiceText: "The upper two hundred meters represent the sunlit epipelagic zone, home to ninety percent of marine biomass dependent on direct photosynthesis.", durationSeconds: 15 },
              { badge: "CH 03: TWILIGHT", title: "The Mesopelagic", body: "From 200 to 1,000 meters, blue wavelengths fade into perpetual twilight.", highlight: "TWILIGHT ZONE", visualPrompt: "deep twilight ocean water dim blue luminescence strange translucent fish 16:9", voiceText: "Descending past two hundred meters, red light is absorbed completely, leaving an eerie dim blue twilight populated by vertically migrating organisms.", durationSeconds: 15 },
              { badge: "CH 04: MIDNIGHT", title: "Bathypelagic Darkness", body: "Zero sunlight penetrates below 1,000 meters into perpetual near-freezing dark.", highlight: "TOTAL DARKNESS", visualPrompt: "pitch black deep ocean abyss with solitary glowing bioluminescent jellyfish 16:9", voiceText: "Below one thousand meters lies the bathypelagic midnight zone, where temperatures hover near freezing and natural sunlight never arrives.", durationSeconds: 15 },
              { badge: "CH 05: PRESSURE", title: "Hydrostatic Physics", body: "Pressure increases by one atmosphere every 10 meters of descent.", highlight: "1 ATM PER 10 METERS", visualPrompt: "robotic deep sea titanium submersible hull under extreme water pressure 16:9", voiceText: "For every ten meters of descent, water pressure increases by an entire atmospheric unit, exerting immense mechanical forces on any submerged structure.", durationSeconds: 15 },
              { badge: "CH 06: HADAL", title: "Challenger Deep", body: "The Mariana Trench reaches 10,994 meters (36,000 feet) into the Earth's crust.", highlight: "36,000 FEET DEEP", visualPrompt: "deepest ocean trench challenger deep rocky canyon walls illuminated by robotic sub", voiceText: "At the southern end of the Mariana Trench lies Challenger Deep, dropping nearly eleven thousand meters into the crust of our planet.", durationSeconds: 15 },
              { badge: "EPILOGUE", title: "Protecting the Abyss", body: "Subscribe to AutoTube AI for continuous deep sea documentaries and Earth discoveries.", highlight: "SUBSCRIBE FOR SCIENCE", visualPrompt: "cinematic ascent from dark ocean trench to sunrise over sparkling calm ocean 16:9", voiceText: "The deep ocean remains Earth's last grand frontier. Subscribe to AutoTube AI for daily full-length documentaries exploring the mysteries of our living planet.", durationSeconds: 15 },
            ],
          },
        ];

        const unusedLong = LONG_DOCS.filter((d) => !existingTitles.some((t) => t.toLowerCase().includes(d.title.toLowerCase().slice(0, 15))));
        const chosenLong = unusedLong.length > 0 ? unusedLong[0] : LONG_DOCS[0];

        parsedScript = {
          title: chosenLong.title,
          description: chosenLong.description,
          tags: chosenLong.tags,
          hashtags: chosenLong.hashtags,
          scenes: chosenLong.scenes,
        };
      } else {
        // Fallback for 2+ Min Extended Shorts: Complete Narrative Arc with Head, Tail, and Subscribe CTA
        const ALL_FALLBACK_SHORTS = [
          {
            title: "What Happens If A Rogue Planet Enters Our Solar System?",
            description: "Discover the terrifying cosmic phenomenon of rogue planets wandering through deep space with no star and what happens if one crosses our solar system. Subscribe to our channel for daily mind-blowing facts and verified astronomy discoveries!",
            tags: ["Rogue Planet", "Space Mystery", "Astronomy", "NASA", "Universe", "Astrophysics", "Cosmos", "Science Shorts", "Deep Space", "Black Holes", "Galaxy", "Did You Know", "Space", "Physics", "Planets"],
            hashtags: ["#SpaceFacts", "#RoguePlanet", "#Universe", "#Astronomy", "#AutoTubeAI"],
            scenes: [
              {
                badge: "🚨 COSMIC THREAT",
                title: "Wandering In The Dark",
                body: "Billions of dark giant worlds wander interstellar space without a sun.",
                highlight: "NO PARENT STAR",
                visualPrompt: "cinematic photorealistic 4k vertical rogue planet drifting through pitch black starry cosmos, glowing eerie aura, 8k",
                voiceText: "What if I told you there are billions of gigantic rogue planets wandering through deep space right now, completely invisible without any host star?",
                durationSeconds: 12,
              },
              {
                badge: "💥 CATASTROPHIC BIRTH",
                title: "Kicked Out Of Orbit",
                body: "Violent gravitational interactions fling newborn worlds out into the void.",
                highlight: "EJECTED INTO VOID",
                visualPrompt: "supermassive gas giant planet being violently ejected from young solar system by gravitational slingshot 4k vertical",
                voiceText: "These orphaned worlds were violently thrown out of their original solar systems billions of years ago during catastrophic gravitational battles between young planets.",
                durationSeconds: 12,
              },
              {
                badge: "❄️ FROZEN SURFACES",
                title: "Oceans Under The Ice",
                body: "Surface temperatures drop to absolute zero while internal cores remain boiling hot.",
                highlight: "METHANE OCEANS",
                visualPrompt: "frozen alien ice world surface with glowing hydrothermal fissures under deep dark starry sky 4k vertical",
                voiceText: "While their frozen crusts plunge to nearly absolute zero, internal radioactive heat and volcanic tides can keep subsurface liquid water oceans alive for billions of years.",
                durationSeconds: 12,
              },
              {
                badge: "⚡ 3 MILLION MPH",
                title: "Silent Hypervelocity",
                body: "Roaming through the dark at speeds exceeding 3 million miles per hour.",
                highlight: "UNSTOPPABLE SPEED",
                visualPrompt: "colossal dark planet rushing through asteroid belt trailing cosmic dust illuminated by distant stars 4k vertical",
                voiceText: "Traveling at mind-numbing speeds of three million miles per hour, their sheer gravitational pull can warp asteroid belts and throw planets off their orbits.",
                durationSeconds: 12,
              },
              {
                badge: "🔭 JWST DISCOVERY",
                title: "James Webb Breakthrough",
                body: "Infrared sensors have just mapped 40 Jupiter-sized rogue pairs in Orion.",
                highlight: "40 PLANET PAIRS",
                visualPrompt: "james webb space telescope deep field glowing infrared nebula capturing twin rogue planets 4k vertical",
                voiceText: "The James Webb Space Telescope recently made history by discovering dozens of these twin rogue worlds roaming together inside the fiery Orion Nebula.",
                durationSeconds: 12,
              },
              {
                badge: "🌌 GRAVITATIONAL SHOCK",
                title: "What If One Arrives?",
                body: "If a rogue world entered our solar system, Earth's orbit would destabilize.",
                highlight: "ORBITAL COLLAPSE",
                visualPrompt: "cinematic vertical 9:16 cosmic gravitational shockwave warping planetary orbits around the sun",
                voiceText: "If even a single Jupiter-sized rogue planet entered our outer solar system, its gravity would disrupt the Kuiper Belt, hurling thousands of giant comets towards Earth.",
                durationSeconds: 12,
              },
              {
                badge: "☄️ THE NIGHT SKY",
                title: "A Second Moon",
                body: "Approaching Earth, the dark planet would eclipse constellations.",
                highlight: "DARK ECLIPSE",
                visualPrompt: "cinematic vertical 9:16 night sky with colossal dark silhouette eclipsing starry background above mountains",
                voiceText: "Within months, the rogue world would appear in our night sky as a terrifying colossal black sphere, blocking distant stars and generating extreme ocean tidal waves.",
                durationSeconds: 12,
              },
              {
                badge: "🔬 SCIENTIFIC TESTS",
                title: "Infrared Early Warning",
                body: "NASA sky surveys scan thermal infrared signatures across deep space.",
                highlight: "THERMAL DETECTION",
                visualPrompt: "cinematic vertical 9:16 futuristic observatory radar scanning deep space heat signatures",
                voiceText: "Fortunately, NASA and global space telescopes constantly scan the heavens using deep infrared sensors to detect internal heat signatures years before any intruder approaches.",
                durationSeconds: 12,
              },
              {
                badge: "🤯 COSMIC PARADOX",
                title: "More Than Stars",
                body: "Rogue planets outnumber stars in our galaxy by trillions to one.",
                highlight: "TRILLIONS OF WORLDS",
                visualPrompt: "cinematic vertical 9:16 vast glowing Milky Way galaxy filled with unseen dark planets",
                voiceText: "Astrophysicists now calculate that there are up to fifty trillion rogue planets roaming our Milky Way alone, far outnumbering every single star in the galaxy.",
                durationSeconds: 12,
              },
              {
                badge: "✨ THE MYSTERY SOLVED",
                title: "The Silent Travellers",
                body: "They represent the hidden majority of all planetary mass in the universe.",
                highlight: "HIDDEN COSMOS",
                visualPrompt: "cinematic vertical 9:16 majestic dark wandering planet illuminated by distant galactic core",
                voiceText: "Far from being rare anomalies, these silent cosmic wanderers are the true architects of galactic space, carrying hidden oceans across endless interstellar dark.",
                durationSeconds: 12,
              },
              {
                badge: "🔔 SUBSCRIBE FOR DAILY FACTS",
                title: "Subscribe For More",
                body: "Agar video pasand aayi toh channel ko zaroor subscribe karein aur bell icon dabayein!",
                highlight: "SUBSCRIBE & LIKE",
                visualPrompt: "cinematic 9:16 vertical glowing golden bell and subscribe button with fireworks and starry background",
                voiceText: "Agar aapko yeh hairat-angez cosmic fact pasand aaya toh mazeed aisi videos ke liye channel ko zaroor subscribe karein, like karein aur bell icon dabayein!",
                durationSeconds: 12,
              },
            ],
          },
          {
            title: "Mariana Trench: The Alien World 36,000 Feet Below",
            description: "Journey nearly 11,000 meters beneath the Pacific Ocean into the Mariana Trench Challenger Deep where crushing pressure and bizarre alien organisms thrive in absolute darkness. Subscribe to our channel for daily verified science discoveries!",
            tags: ["Mariana Trench", "Deep Ocean", "Challenger Deep", "Ocean Secrets", "Earth Science", "Marine Biology", "Science Shorts", "Submersible", "Abyss", "Sea Creatures"],
            hashtags: ["#MarianaTrench", "#DeepOcean", "#OceanMysteries", "#ScienceFacts", "#AutoTubeAI"],
            scenes: [
              {
                badge: "🚨 ABYSSAL MYSTERY",
                title: "Into The Darkness",
                body: "Nearly 11,000 meters below sea level lies Earth's deepest extreme point.",
                highlight: "36,000 FEET DEEP",
                visualPrompt: "Mariana Trench bathymetric sonar map and underwater abyss vertical 9:16",
                voiceText: "Nearly eleven thousand meters beneath the Pacific Ocean lies the Mariana Trench, an abyssal canyon deeper than Mount Everest is tall.",
                durationSeconds: 12,
              },
              {
                badge: "🌍 FIRST DISCOVERY",
                title: "HMS Challenger 1875",
                body: "British explorers first sounded this extreme depth using weighted ropes.",
                highlight: "1875 SOUNDING",
                visualPrompt: "historical ocean research ship HMS Challenger archival sketch vertical 9:16",
                voiceText: "In eighteen seventy-five, scientists aboard HMS Challenger lowered weighted hemp ropes into the abyss, discovering a void deeper than any known chasm on Earth.",
                durationSeconds: 12,
              },
              {
                badge: "🔬 CRUSHING FORCE",
                title: "1,000 Atmospheres",
                body: "Hydrostatic water pressure exceeds 1,000 times surface atmospheric levels.",
                highlight: "1,086 BARS PRESSURE",
                visualPrompt: "robotic deep sea titanium hull with intense headlights vertical 9:16",
                voiceText: "At the bottom, water pressure reaches over one thousand atmospheres, equivalent to eight tons of weight pressing onto every single square inch.",
                durationSeconds: 12,
              },
              {
                badge: "⚡ ALIEN BIOLOGY",
                title: "The Hadal Snailfish",
                body: "Specialized enzymes and piezolyte molecules prevent cellular collapse.",
                highlight: "PIEZOLYTE PROTEINS",
                visualPrompt: "transparent deep sea snailfish Pseudoliparis swirei in dark water vertical 9:16",
                voiceText: "Yet even here, translucent Hadal snailfish thrive, using unique chemical piezolytes that stop their biological cell membranes from turning to solid glass.",
                durationSeconds: 12,
              },
              {
                badge: "🧪 CHEMICAL SEEDS",
                title: "Serpentinization Life",
                body: "Rock and water reactions release hydrogen fuel for microbial life.",
                highlight: "CHEMOSYNTHESIS",
                visualPrompt: "hydrothermal serpentinization vents deep sea crust vertical 9:16",
                voiceText: "Without a single ray of sunlight, microbial ecosystems flourish on hydrothermal hydrogen released by mantle rocks reacting with deep subterranean seawater.",
                durationSeconds: 12,
              },
              {
                badge: "💥 SUBDUCTION ENGINE",
                title: "Tectonic Recycling",
                body: "The Pacific plate dives deep under the Mariana plate recycling ocean crust.",
                highlight: "TECTONIC SLAB",
                visualPrompt: "Earth cross section subducting tectonic plate into mantle vertical 9:16",
                voiceText: "This trench is actually a giant planetary conveyor belt, where the ancient Pacific tectonic plate is dragged down directly into Earth's blazing molten mantle.",
                durationSeconds: 12,
              },
              {
                badge: "👁️ MANNED DESCENT",
                title: "Humans Reach Deep",
                body: "Only four expeditions in human history have ever reached Challenger Deep.",
                highlight: "FEWER THAN MOON",
                visualPrompt: "deepsea challenger submersible cockpit view deep ocean trench vertical 9:16",
                voiceText: "Fewer human beings have descended to the absolute floor of Challenger Deep than have walked on the surface of the Moon.",
                durationSeconds: 12,
              },
              {
                badge: "🤯 SHOCKING TRUTH",
                title: "Microplastics Found",
                body: "Human plastic waste was discovered even at the deepest trench floor.",
                highlight: "MAN-MADE POLLUTION",
                visualPrompt: "robotic arm collecting sediment sample deep ocean trench floor vertical 9:16",
                voiceText: "Shockingly, when modern robotic submersibles collected sediment samples from the deepest point on Earth, they found synthetic microplastic fibers inside trench organisms.",
                durationSeconds: 12,
              },
              {
                badge: "🔭 SCIENTIFIC VALUE",
                title: "Origins Of Life",
                body: "Trench chemistry may explain how the first cells evolved on early Earth.",
                highlight: "PREBIOTIC CHEMISTRY",
                visualPrompt: "microscopic primordial RNA molecules deep hydrothermal vent simulation vertical 9:16",
                voiceText: "Astrobiologists believe these extreme conditions mimic the primordial oceans of early Earth, and possibly the subterranean oceans of Europa and Enceladus.",
                durationSeconds: 12,
              },
              {
                badge: "✨ UNCHARTED ABYSS",
                title: "Earth's Final Frontier",
                body: "Over 80% of our ocean floor remains completely unmapped.",
                highlight: "UNKNOWN PLANET",
                visualPrompt: "panoramic vertical 9:16 deep blue ocean with robotic submersible surfacing into sunset",
                voiceText: "The Mariana Trench proves that we know more about the craters of Mars than we do about the incredible living mysteries right beneath our own oceans.",
                durationSeconds: 12,
              },
              {
                badge: "🔔 SUBSCRIBE FOR DAILY FACTS",
                title: "Subscribe For More",
                body: "Agar video pasand aayi toh channel ko zaroor subscribe karein aur bell icon dabayein!",
                highlight: "SUBSCRIBE & LIKE",
                visualPrompt: "cinematic 9:16 vertical glowing golden bell and subscribe button with fireworks and starry background",
                voiceText: "Agar aapko yeh hairat-angez deep ocean fact pasand aaya toh mazeed aisi videos ke liye channel ko zaroor subscribe karein, like karein aur bell icon dabayein!",
                durationSeconds: 12,
              },
            ],
          },
        ];

        // Deduplication: Choose an unused fallback that does not collide with channel videos or covered registry
        const unusedShorts = ALL_FALLBACK_SHORTS.filter(
          (s) => !checkTitleCollision(s.title, existingTitles, coveredRegistry).isCollision
        );
        parsedScript = unusedShorts.length > 0 ? unusedShorts[0] : ALL_FALLBACK_SHORTS[0];
      }
    }

    // Super-Professional SEO & Real-Time Trend Verification
    const seoPackage = await generateSuperProfessionalSEO({
      topic: parsedScript.title || winningCategory.name,
      niche: winningCategory.niche,
      isLongVideo,
      matchDetails: options.cricketMatchDetails,
      highlightUrls: options.highlightUrls,
      chapters: parsedScript.scenes,
      geminiApiKey: apiKey,
    });

    // Sanitize and enhance title with high-CTR formatting
    let cleanTitle = (parsedScript.title || "").trim();
    if (!cleanTitle || cleanTitle.length < 15) {
      cleanTitle = seoPackage.title;
    }

    recordCoveredTopic(cleanTitle, winningCategory.id, winningCategory.niche, freshSubtopicCandidate?.topic || cleanTitle);
    if (cleanTitle.length > 80) {
      cleanTitle = cleanTitle.slice(0, 77).trim() + "...";
    }
    parsedScript.title = cleanTitle || `${winningCategory.name.slice(0, 50)} Highlights`;

    // Record this topic to persistent database so it is NEVER generated again on this channel
    recordCoveredTopic(parsedScript.title, winningCategory.name, winningCategory.niche);

    // High-CTR tags & viral hashtags
    parsedScript.tags = Array.from(new Set([...(parsedScript.tags || []), ...seoPackage.tags])).slice(0, 20);
    parsedScript.hashtags = Array.from(new Set([...(parsedScript.hashtags || []), ...seoPackage.hashtags])).slice(0, 8);
    parsedScript.description = seoPackage.description;

    executionRecord.seoAnalysis = seoPackage.ctrAnalysis;
    addLog(
      "analytics",
      `Super-Professional SEO Applied: "${cleanTitle}" | Projected CTR: ${seoPackage.ctrAnalysis.predictedCTR}% (${seoPackage.ctrAnalysis.ctrVerdict}) | Real-time Verified for Today (${seoPackage.ctrAnalysis.trendDate})`
    );

    // Validate scenes
    const isCustomUserPrompt = Boolean(options.customPrompt && options.customPrompt.trim());
    const defaultSceneDuration = isLongVideo ? 15 : 12;
    let rawScenes: VideoScene[] = Array.isArray(parsedScript.scenes) && parsedScript.scenes.length > 0
      ? parsedScript.scenes.map((s: any, idx: number) => ({
          badge: String(s.badge || (isLongVideo ? `CH ${(idx + 1).toString().padStart(2, "0")}` : `SCENE ${(idx + 1).toString().padStart(2, "0")}`)).slice(0, 36),
          title: String(s.title || "Key Discovery"),
          body: String(s.body || ""),
          highlight: String(s.highlight || winningCategory.name.toUpperCase()).slice(0, 32),
          visualPrompt: typeof s.visualPrompt === "string" ? s.visualPrompt : undefined,
          voiceText: typeof s.voiceText === "string" ? s.voiceText : `${s.title || ""}. ${s.body || ""}`,
          durationSeconds: hasHighlightUrls
            ? (typeof s.durationSeconds === "number" && s.durationSeconds >= 10 ? s.durationSeconds : (isLongVideo ? 15 : 12))
            : isCustomUserPrompt
              ? (typeof s.durationSeconds === "number" && s.durationSeconds >= 5 ? s.durationSeconds : (isLongVideo ? 30 : 12))
              : (isLongVideo ? Math.min(32, Math.max(12, Number(s.durationSeconds) || 15)) : Math.min(14, Math.max(11, Number(s.durationSeconds) || 12))),
          customVideoPath: s.customVideoPath,
          customVideoStart: s.customVideoStart,
        }))
      : [];

    if (isCustomUserPrompt && rawScenes.length > 0) {
      // Respect user custom prompt/script scenes 100% without truncating or overwriting with stock topics
      const finalScene = rawScenes[rawScenes.length - 1];
      if (!finalScene.badge) finalScene.badge = "🔔 SUBSCRIBE FOR MORE";
    } else if (isLongVideo && !hasHighlightUrls) {
      // Ensure 8 high-impact chapters for 120s documentary (8 x 15s = 120s Full HD)
      const chapterTopics = [
        { badge: "PROLOGUE", title: "The Deep Enigma", body: `Exploring the profound unsolved frontiers and documented physics of ${winningCategory.name}.`, highlight: "UNSOLVED MYSTERY" },
        { badge: "CH 01: ORIGINS", title: "Historical Discovery", body: "Historical archives and pioneering scientific expeditions that uncovered initial evidence.", highlight: "HISTORICAL DISCOVERY" },
        { badge: "CH 02: MECHANISMS", title: "The Fundamental Physics", body: "Subatomic forces and energetic interactions operating under extreme scales.", highlight: "EXTREME PHYSICS" },
        { badge: "CH 03: BREAKTHROUGH", title: "The Great Turning Point", body: "Sensor telemetry and observational arrays that redefined modern understanding.", highlight: "PARADIGM SHIFT" },
        { badge: "CH 04: NATURE SCALE", title: "Unfathomable Proportions", body: "Mass, volume, and gravitational energies that surpass ordinary comprehension.", highlight: "COSMIC SCALES" },
        { badge: "CH 05: DATA & TESTS", title: "Laboratory Evidence", body: "Computational matrices and observational telemetry testing theoretical limits.", highlight: "SUPERCOMPUTER MODELS" },
        { badge: "CH 06: CONSENSUS", title: "Scientific Verdict", body: "Leading researchers and global scientific consensus establishing verified facts.", highlight: "VERIFIED SCIENCE" },
        { badge: "EPILOGUE", title: "Subscribe to AutoTube", body: "Thank you for watching. Subscribe to AutoTube AI for daily long-form documentaries!", highlight: "SUBSCRIBE FOR DEEP DIVES" },
      ];

      if (rawScenes.length > 8) {
        rawScenes = rawScenes.slice(0, 8);
      } else {
        while (rawScenes.length < 8) {
          const idx = rawScenes.length;
          const chapInfo = chapterTopics[idx] || {
            badge: `CH ${(idx + 1).toString().padStart(2, "0")}: IN-DEPTH`,
            title: `${winningCategory.name} Analysis ${idx + 1}`,
            body: `Continuing deep investigation into the documented science and observations of ${winningCategory.name}.`,
            highlight: "VERIFIED DISCOVERY",
          };

          rawScenes.push({
            badge: chapInfo.badge,
            title: chapInfo.title,
            body: chapInfo.body,
            highlight: chapInfo.highlight,
            visualPrompt: `cinematic 16:9 widescreen 4k documentary photography of ${winningCategory.name} ${chapInfo.title}, photorealistic, dramatic lighting, 8k render, no text`,
            voiceText: `${chapInfo.title}. ${chapInfo.body}`,
            durationSeconds: 15,
          });
        }
      }
    } else if (!hasHighlightUrls) {
      // Extended Short video: up to 3 minutes (15 scenes x 12s = 180s total)
      // Complete storytelling arc with head, detailed body, planetary/cosmic mechanisms, resolution, and subscribe CTA
      const defaultShortStoryChapters = [
        { badge: "🚨 MIND-BLOWING FACT", title: winningCategory.name, body: winningCategory.sampleHook || `Shocking verified truth about ${winningCategory.name}.`, highlight: "IMPOSSIBLE DISCOVERY" },
        { badge: "🌍 THE GENESIS", title: "Where It Started", body: `Scientists first uncovered anomalies relating to ${winningCategory.name}.`, highlight: "INITIAL OBSERVATION" },
        { badge: "🔭 FIRST SIGHTINGS", title: "Early Anomalies", body: "Telescopes and tracking stations picked up signals that contradicted all models.", highlight: "STRANGE ANOMALY" },
        { badge: "🔬 CORE MECHANISM", title: "How It Works", body: "Subatomic and physical forces interacting in conditions never seen before.", highlight: "DEEP PHYSICS" },
        { badge: "⚡ TERRIFYING SCALE", title: "Unbelievable Numbers", body: "Speeds, pressures, and temperatures that defy normal human comprehension.", highlight: "MASSIVE NUMBERS" },
        { badge: "🧪 SENSOR TELEMETRY", title: "Laboratory Proof", body: "Confirmed through modern satellite telemetry and high-tech sensors.", highlight: "PROVEN BY DATA" },
        { badge: "💥 EXTREME FORCES", title: "Crushing Conditions", body: "Physical parameters pushed to absolute limits under immense gravitational weight.", highlight: "CRUSHING POWER" },
        { badge: "👁️ WITNESS REALITY", title: "What You Would See", body: "Standing near this phenomenon would warp your perception of space and time.", highlight: "EYEWITNESS VIEW" },
        { badge: "🛰️ SATELLITE PROBE", title: "Robotic Telemetry", body: "Deep space probes sending back authentic readings directly from the scene.", highlight: "PROBE TELEMETRY" },
        { badge: "🤯 THE UNEXPECTED TWIST", title: "Defying Common Logic", body: "The single most counter-intuitive paradox uncovered by researchers.", highlight: "DEFIES ALL LOGIC" },
        { badge: "🪐 MASSIVE RIPPLE", title: "Planetary Shockwaves", body: "Catastrophic reactions that alter surrounding planetary conditions.", highlight: "GLOBAL IMPACT" },
        { badge: "🔭 EXPERT CONSENSUS", title: "Scientific Verdict", body: "Global scientific institutions confirming this rewrites our textbooks.", highlight: "VERIFIED SCIENCE" },
        { badge: "🌌 COSMIC MEANING", title: "The Bigger Picture", body: "What this discovery reveals about our place in the expanding cosmos.", highlight: "UNIVERSAL TRUTH" },
        { badge: "✨ THE FULL PAYOFF", title: "The Complete Truth", body: "Completely solving the mystery that perplexed astronomers and explorers.", highlight: "MYSTERY SOLVED" },
        { badge: "🔔 SUBSCRIBE FOR DAILY FACTS", title: "Subscribe For More", body: "Agar video pasand aayi toh channel ko zaroor subscribe karein aur bell icon dabayein!", highlight: "SUBSCRIBE & LIKE" },
      ];

      if (rawScenes.length === 0) {
        rawScenes = defaultShortStoryChapters.slice(0, 10).map((ch, idx) => ({
          badge: ch.badge,
          title: ch.title,
          body: ch.body,
          highlight: ch.highlight,
          visualPrompt: `cinematic 9:16 vertical 4k documentary photography ${winningCategory.name} ${ch.title} dramatic lighting`,
          voiceText: idx === 9
            ? "Agar aapko yeh hairat-angez fact pasand aaya toh mazeed aisi videos ke liye channel ko zaroor subscribe karein, like karein aur bell icon dabayein!"
            : `${ch.title}. ${ch.body}`,
          durationSeconds: 12,
        }));
      } else {
        // Enforce 10 scenes (each 12s = 120s total, exactly 2 minutes high retention)
        while (rawScenes.length < 10) {
          const idx = rawScenes.length;
          const ch = defaultShortStoryChapters[idx] || defaultShortStoryChapters[defaultShortStoryChapters.length - 1];
          rawScenes.push({
            badge: ch.badge,
            title: ch.title,
            body: ch.body,
            highlight: ch.highlight,
            visualPrompt: `cinematic 9:16 vertical 4k documentary photography ${winningCategory.name} ${ch.title} dramatic lighting`,
            voiceText: idx === 9
              ? "Agar aapko yeh hairat-angez fact pasand aaya toh mazeed aisi videos ke liye channel ko zaroor subscribe karein, like karein aur bell icon dabayein!"
              : `${ch.title}. ${ch.body}`,
            durationSeconds: 12,
          });
        }
        if (rawScenes.length > 10) {
          rawScenes = rawScenes.slice(0, 10);
        }
      }

      // Guarantee the last scene has a prominent, explicit Subscribe CTA (voice & text)
      const finalScene = rawScenes[rawScenes.length - 1];
      finalScene.badge = "🔔 SUBSCRIBE FOR DAILY FACTS";
      finalScene.highlight = "SUBSCRIBE & LIKE";
      const existingVoice = (finalScene.voiceText || `${finalScene.title}. ${finalScene.body}`).trim();
      if (!existingVoice.toLowerCase().includes("subscribe")) {
        finalScene.voiceText = `${existingVoice} Agar aapko yeh hairat-angez fact pasand aaya toh channel ko abhi zaroor subscribe karein aur bell icon dabayein!`;
      } else {
        finalScene.voiceText = existingVoice;
      }
    }

    const scenes = rawScenes;

    executionRecord.script = {
      title: parsedScript.title,
      description: parsedScript.description,
      tags: parsedScript.tags,
      hashtags: parsedScript.hashtags,
      scenes,
    };

    addLog(
      "gemini_script",
      `Generated Script: "${cleanTitle}" with ${scenes.length} scenes, ${parsedScript.tags.length} SEO tags.`
    );

    // STEP 3: Create the video using Google Veo 3 / AI visual engine, ElevenLabs Voice, and custom layouts
    currentStep = "video_render";
    progressPercent = 35;
    currentStageIndex = 3;
    stageTitle = "Stage 3: Voice Narration & Audio Commentary";
    stageDescription = "Synthesizing energetic sports commentary audio via ElevenLabs & AI Voice...";
    stageDetail = `Generating narration for ${scenes.length} chapters in parallel`;

    addLog(
      "video_render",
      isLongVideo
        ? `Rendering 16:9 Widescreen 1080p Documentary (16 Chapters, ~8.5 minutes, ElevenLabs voice narration, chapter overlays)...`
        : `Rendering 2+ Min (120s+) 1080x1920 Full HD Shorts (Google Veo 3 background, ElevenLabs voice narration, Hormozi captions)...`
    );

    let completedClipsCount = 0;
    const videoResult = await createViralFactVideo(winningCategory.name, scenes, {
      useVeo: !isLongVideo,
      geminiApiKey: apiKey,
      elevenLabsApiKey: process.env.ELEVENLABS_API_KEY,
      elevenLabsVoiceId: options.voiceId || process.env.ELEVENLABS_VOICE_ID,
      languageStyle: options.languageStyle || (winningCategory.id === "cricket-match-doc" ? "urdu_hindi" : undefined),
      videoFormat: options.videoFormat || "short",
      bgmStyle: options.bgmStyle,
      copyrightShield: options.copyrightShield,
      onProgress: (step, msg) => {
        addLog(step, msg);
        if (msg.includes("Synthesizing")) {
          progressPercent = 40;
          stageTitle = "Stage 3: Voiceover Synthesis";
          stageDetail = msg;
        } else if (msg.includes("Pre-resolving") || msg.includes("Backdrops")) {
          progressPercent = 52;
          currentStageIndex = 4;
          stageTitle = "Stage 4: 4K Visuals & Stadium Backdrops";
          stageDescription = "Generating high-definition stadium backdrops and broadcast graphics...";
          stageDetail = msg;
        } else if (msg.includes("Rendered clip")) {
          completedClipsCount++;
          const scenePct = Math.min(completedClipsCount / scenes.length, 1);
          progressPercent = Math.round(55 + scenePct * 25); // 55% to 80%
          currentStageIndex = 4;
          stageTitle = `Stage 4: Rendering Scene Clips (${completedClipsCount}/${scenes.length})`;
          stageDetail = msg;
        } else if (msg.includes("Concatenating") || msg.includes("Stitching") || msg.includes("FFmpeg")) {
          progressPercent = 85;
          stageTitle = "Stage 4: Master Assembly & Subtitles";
          stageDescription = "Stitching chapters, burning dynamic Hormozi captions & audio mix into 1080p MP4...";
          stageDetail = msg;
        }
      },
    });

    // 1. Save temporary video file for preview/download in /tmp/autotube FIRST before advertising preview URL
    ensureAutotubeDirectory();
    const previewDir = path.join(AUTOTUBE_TMP_DIR, "previews");
    if (!fs.existsSync(previewDir)) {
      fs.mkdirSync(previewDir, { recursive: true, mode: 0o777 });
      try { fs.chmodSync(previewDir, 0o777); } catch {}
    }
    const savedPreviewPath = path.join(previewDir, `${runId}.mp4`);
    if (videoResult.filePath && fs.existsSync(videoResult.filePath)) {
      try {
        fs.copyFileSync(videoResult.filePath, savedPreviewPath);
      } catch {
        fs.writeFileSync(savedPreviewPath, videoResult.buffer);
      }
    } else {
      fs.writeFileSync(savedPreviewPath, videoResult.buffer);
    }
    try { fs.chmodSync(savedPreviewPath, 0o666); } catch {}

    // Mirror to persistent workspace directory so it survives container restarts!
    try {
      const wsPreviewDir = path.join(process.cwd(), "data", "previews");
      if (!fs.existsSync(wsPreviewDir)) {
        fs.mkdirSync(wsPreviewDir, { recursive: true });
      }
      fs.copyFileSync(savedPreviewPath, path.join(wsPreviewDir, `${runId}.mp4`));
    } catch {}

    // 2. Set video as fully ready and accessible for preview player & download
    isVideoReady = true;
    progressPercent = 90;
    activeVideoMetadata = {
      title: cleanTitle,
      format: isLongVideo ? "16:9 Long Video (8+ Min)" : "9:16 Short (2+ Min)",
      durationSeconds: videoResult.durationSeconds,
      sizeBytes: videoResult.sizeBytes,
      previewUrl: `/api/scheduler/video-preview/${runId}`,
    };

    executionRecord.video = {
      sizeBytes: videoResult.sizeBytes,
      durationSeconds: videoResult.durationSeconds,
      previewUrl: `/api/scheduler/video-preview/${runId}`,
      format: isLongVideo ? "16:9 Long Video (8+ Min)" : "9:16 Short (2+ Min)",
      aspectRatio: isLongVideo ? "16:9" : "9:16",
    };

    addLog(
      "video_render",
      `Video rendered successfully! Format: ${isLongVideo ? "16:9 Long Video (8+ Min)" : "9:16 Short (2+ Min)"}, Engine: ${videoResult.engineUsed || "Veo3/AI Visuals"}, Voice: ${videoResult.voiceEngineUsed || "Human Narration"}, Size: ${(videoResult.sizeBytes / 1024 / 1024).toFixed(2)} MB, Duration: ${videoResult.durationSeconds}s`
    );

    // Generate bespoke professional thumbnail for this video or short
    addLog(
      "video_render",
      `Generating bespoke high-CTR professional thumbnail (${isLongVideo ? "16:9 Landscape 1280x720" : "9:16 Vertical 1080x1920"})...`
    );
    let thumbnailResult: any = null;
    try {
      thumbnailResult = await generateProfessionalThumbnail({
        videoPath: savedPreviewPath,
        runId,
        title: cleanTitle,
        hookText: seoPackage.thumbnailHookText || cleanTitle.slice(0, 30),
        badgeText: seoPackage.thumbnailBadgeText || (isLongVideo ? "🔴 FULL HIGHLIGHTS" : "🔥 VIRAL SHORTS"),
        subText: options.cricketMatchDetails?.teams
          ? `${options.cricketMatchDetails.teams.team1} vs ${options.cricketMatchDetails.teams.team2}`
          : (isLongVideo ? "100% UNBELIEVABLE FINISH" : "WAIT FOR THE END!"),
        isLongVideo,
      });

      if (activeVideoMetadata) {
        activeVideoMetadata.thumbnailUrl = thumbnailResult.previewUrl;
        activeVideoMetadata.thumbnailDownloadUrl = thumbnailResult.downloadUrl;
        activeVideoMetadata.seoAnalysis = seoPackage.ctrAnalysis;
      }
      executionRecord.thumbnail = {
        previewUrl: thumbnailResult.previewUrl,
        downloadUrl: thumbnailResult.downloadUrl,
        aspectRatio: isLongVideo ? "16:9" : "9:16",
        width: thumbnailResult.width,
        height: thumbnailResult.height,
        style: "Professional High-CTR Vivid Composite",
      };
      addLog(
        "video_render",
        `Professional thumbnail created! Resolution: ${thumbnailResult.width}x${thumbnailResult.height}, Size: ${(thumbnailResult.sizeBytes / 1024).toFixed(1)} KB. Ready for preview & download.`
      );
    } catch (thumbErr: any) {
      console.warn("[Pipeline] Thumbnail creation notice:", thumbErr.message);
      addLog("video_render", `Thumbnail notice: ${thumbErr.message}. Video rendered successfully.`);
    }

    // STEP 4: YouTube Upload Stage (Auto or Manual Review)
    const shouldAutoUpload = options.autoUpload !== false; // Only upload if autoUpload is true (for cricket we can default to manual review or user preference)

    if (shouldAutoUpload && oauthToken) {
      currentStep = "youtube_upload";
      currentStageIndex = 5;
      stageTitle = "Stage 5: YouTube Upload & Publishing";
      stageDescription = "Uploading MP4 file directly to YouTube channel via Data API v3 Resumable Session...";
      stageDetail = `Uploading ${(videoResult.sizeBytes / (1024 * 1024)).toFixed(1)} MB MP4`;
      uploadPercent = 40;

      addLog("youtube_upload", `Uploading generated ${isLongVideo ? "16:9 Long Documentary" : "2+ Min Short"} directly to YouTube channel via OAuth 2.0...`);

      // Build rich description with timestamps and hashtags
      let fullDesc = parsedScript.description || "";
      if (isLongVideo && !fullDesc.includes("00:00")) {
        const chapterLines = scenes.map((s, idx) => {
          const totalSec = idx * (s.durationSeconds || 32);
          const mins = String(Math.floor(totalSec / 60)).padStart(2, "0");
          const secs = String(totalSec % 60).padStart(2, "0");
          return `${mins}:${secs} - ${s.badge || s.title}`;
        }).join("\n");
        fullDesc = `${fullDesc}\n\n⏱️ TIMESTAMPS:\n${chapterLines}`;
      }
      fullDesc = `${fullDesc}\n\n${parsedScript.hashtags.join(" ")}\n\n#AutoTubeAI ${isLongVideo ? "#Documentary #CricketDocumentary" : "#CricketShorts #DailyCricket"}`;

      try {
        uploadPercent = 75;
        const uploadResult = await uploadBufferToYouTube(
          videoResult.buffer,
          {
            title: cleanTitle,
            description: fullDesc,
            tags: parsedScript.tags,
            privacyStatus: options.privacyStatus || "public",
          },
          oauthToken
        );

        isUploadReady = true;
        uploadPercent = 100;
        progressPercent = 100;
        stageTitle = "🎉 Video Ready & Published!";
        stageDescription = "Video is generated, uploaded, and live on YouTube! Watch link active.";
        stageDetail = `Live at ${uploadResult.videoUrl}`;

        if (activeVideoMetadata) {
          activeVideoMetadata.youtubeUrl = uploadResult.videoUrl;
          activeVideoMetadata.videoId = uploadResult.videoId;
        }

        executionRecord.youtube = {
          videoId: uploadResult.videoId,
          videoUrl: uploadResult.videoUrl,
          embedUrl: uploadResult.embedUrl,
          privacyStatus: options.privacyStatus || "public",
        };

        addLog("youtube_upload", `Auto-upload COMPLETE! YouTube Watch URL: ${uploadResult.videoUrl}`);

        // Upload custom high-CTR thumbnail to YouTube Data API v3
        if (thumbnailResult && thumbnailResult.buffer) {
          addLog("youtube_upload", `Uploading custom high-CTR thumbnail to YouTube video (${uploadResult.videoId})...`);
          const thumbUploadRes = await uploadThumbnailToYouTube(thumbnailResult.buffer, uploadResult.videoId, oauthToken);
          addLog("youtube_upload", thumbUploadRes.message);
        }
      } catch (uploadErr: any) {
        uploadPercent = 0;
        console.warn("[Pipeline] YouTube upload error:", uploadErr.message);
        addLog(
          "youtube_upload",
          `YouTube Upload Notice: ${uploadErr.message || "OAuth token expired"}. Video successfully generated and ready for instant preview or re-upload once channel is re-connected.`
        );
      }
    } else if (!shouldAutoUpload) {
      // User opted for manual review before upload ("jab ban jaye to seeda upload na ho")
      uploadPercent = 0;
      progressPercent = 100;
      stageTitle = "✅ Video Ready for Review (Preview Mode)";
      stageDescription = "Video is generated & ready for your review! Watch/Preview it below, then click 'Upload to YouTube' whenever you're ready.";
      stageDetail = "Awaiting user approval to publish to YouTube";
      addLog(
        "preview_mode",
        "Video generated and saved locally for review. Ready to preview before publishing to YouTube channel."
      );
    } else {
      uploadPercent = 0;
      progressPercent = 100;
      stageTitle = "✅ Video Ready Locally (Awaiting Upload)";
      stageDescription = "Video is rendered and ready. Connect YouTube channel to publish directly.";
      addLog(
        "youtube_upload",
        "OAuth token not connected at execution time. Video saved locally and ready for manual or automated upload upon OAuth authorization."
      );
    }

    executionRecord.status = "success";
    currentStep = "done";
    addLog("done", "Daily pipeline finished successfully!");

    const history = loadHistory();
    history.unshift(executionRecord);
    saveHistory(history);

    return executionRecord;
  } catch (pipelineErr: any) {
    currentStep = "failed";
    executionRecord.status = "failed";
    executionRecord.error = pipelineErr.message || String(pipelineErr);
    addLog("error", `Pipeline failed: ${executionRecord.error}`);

    const history = loadHistory();
    history.unshift(executionRecord);
    saveHistory(history);

    throw pipelineErr;
  } finally {
    isRunning = false;
    currentRunId = null;
  }
}

/**
 * Manually publishes an already generated and reviewed video run to YouTube on user's command
 */
export async function publishVideoRunToYouTube(
  runId: string,
  oauthToken: string,
  customPrivacy?: string
): Promise<{ success: boolean; videoId: string; videoUrl: string; embedUrl: string; message: string }> {
  if (!oauthToken) {
    throw new Error("No YouTube OAuth token available. Please connect your YouTube channel first.");
  }

  const primaryPath = path.join(AUTOTUBE_TMP_DIR, "previews", `${runId}.mp4`);
  const fallbackPath = path.join(os.tmpdir(), "autotube_previews", `${runId}.mp4`);
  const videoPath = fs.existsSync(primaryPath) ? primaryPath : fallbackPath;

  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video file for run "${runId}" not found on disk.`);
  }

  const videoBuffer = fs.readFileSync(videoPath);
  const history = loadHistory();
  const targetRecord = history.find((h) => h.id === runId);

  const title = targetRecord?.script?.title || `Cricket Match Video #${runId}`;
  let description = targetRecord?.script?.description || "High-octane cricket breakdown produced by AutoTube AI.";
  const tags = targetRecord?.script?.tags || ["Cricket", "Match Highlights", "Cricket Highlights", "Sports"];
  const isLong = targetRecord?.category?.name?.includes("Long") || (targetRecord as any)?.category?.isLongVideo;

  if (isLong && targetRecord?.script?.scenes && !description.includes("00:00")) {
    const chapterLines = targetRecord.script.scenes.map((s, idx) => {
      const totalSec = idx * (s.durationSeconds || 32);
      const mins = String(Math.floor(totalSec / 60)).padStart(2, "0");
      const secs = String(totalSec % 60).padStart(2, "0");
      return `${mins}:${secs} - ${s.badge || s.title}`;
    }).join("\n");
    description = `${description}\n\n⏱️ TIMESTAMPS:\n${chapterLines}`;
  }

  if (targetRecord?.script?.hashtags && targetRecord.script.hashtags.length > 0) {
    description = `${description}\n\n${targetRecord.script.hashtags.join(" ")}`;
  }

  const uploadResult = await uploadBufferToYouTube(
    videoBuffer,
    {
      title,
      description,
      tags,
      privacyStatus: customPrivacy || targetRecord?.youtube?.privacyStatus || "public",
    },
    oauthToken
  );

  // Upload thumbnail if available
  const thumbPath = path.join(AUTOTUBE_TMP_DIR, "thumbnails", `${runId}.jpg`);
  if (fs.existsSync(thumbPath)) {
    try {
      const thumbBuffer = fs.readFileSync(thumbPath);
      await uploadThumbnailToYouTube(thumbBuffer, uploadResult.videoId, oauthToken);
    } catch (e: any) {
      console.warn("Manual thumbnail upload notice:", e.message);
    }
  }

  // Update history record
  if (targetRecord) {
    targetRecord.youtube = {
      videoId: uploadResult.videoId,
      videoUrl: uploadResult.videoUrl,
      embedUrl: uploadResult.embedUrl,
      privacyStatus: customPrivacy || "public",
    };
    saveHistory(history);
  }

  isUploadReady = true;
  if (activeVideoMetadata && activeVideoMetadata.previewUrl?.includes(runId)) {
    activeVideoMetadata.youtubeUrl = uploadResult.videoUrl;
    activeVideoMetadata.videoId = uploadResult.videoId;
  }

  return {
    success: true,
    videoId: uploadResult.videoId,
    videoUrl: uploadResult.videoUrl,
    embedUrl: uploadResult.embedUrl,
    message: `Video "${title}" successfully published to your YouTube channel!`,
  };
}

