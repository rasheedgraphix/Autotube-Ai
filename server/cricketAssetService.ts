import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { AUTOTUBE_TMP_DIR, getRequiredFfmpegBinary } from "./ffmpegHelper";

const execAsync = promisify(exec);

// Local cache for downloaded player and match assets to make generation blazing fast
const CRICKET_ASSET_CACHE_DIR = path.join(AUTOTUBE_TMP_DIR, "cricket_assets");

// Curated verified Wikipedia & Official URLs for top players
export const KNOWN_PLAYER_PROFILES: Record<
  string,
  {
    displayName: string;
    wikiTitle: string;
    team: string;
    role: "Batter" | "Bowler" | "All-Rounder" | "Wicket-Keeper";
    jerseyNumber?: number;
    staticFallbackUrl: string;
  }
> = {
  "babar azam": {
    displayName: "Babar Azam",
    wikiTitle: "Babar_Azam",
    team: "Pakistan 🇵🇰",
    role: "Batter",
    jerseyNumber: 56,
    staticFallbackUrl: "https://upload.wikimedia.org/wikipedia/commons/4/43/Babar_azam_2023.jpg",
  },
  "babar": {
    displayName: "Babar Azam",
    wikiTitle: "Babar_Azam",
    team: "Pakistan 🇵🇰",
    role: "Batter",
    jerseyNumber: 56,
    staticFallbackUrl: "https://upload.wikimedia.org/wikipedia/commons/4/43/Babar_azam_2023.jpg",
  },
  "virat kohli": {
    displayName: "Virat Kohli",
    wikiTitle: "Virat_Kohli",
    team: "India 🇮🇳",
    role: "Batter",
    jerseyNumber: 18,
    staticFallbackUrl: "https://upload.wikimedia.org/wikipedia/commons/e/ef/Virat_Kohli_during_the_India_vs_Aus_4th_Test_match_at_Narendra_Modi_Stadium_on_09_March_2023.jpg",
  },
  "kohli": {
    displayName: "Virat Kohli",
    wikiTitle: "Virat_Kohli",
    team: "India 🇮🇳",
    role: "Batter",
    jerseyNumber: 18,
    staticFallbackUrl: "https://upload.wikimedia.org/wikipedia/commons/e/ef/Virat_Kohli_during_the_India_vs_Aus_4th_Test_match_at_Narendra_Modi_Stadium_on_09_March_2023.jpg",
  },
  "virat": {
    displayName: "Virat Kohli",
    wikiTitle: "Virat_Kohli",
    team: "India 🇮🇳",
    role: "Batter",
    jerseyNumber: 18,
    staticFallbackUrl: "https://upload.wikimedia.org/wikipedia/commons/e/ef/Virat_Kohli_during_the_India_vs_Aus_4th_Test_match_at_Narendra_Modi_Stadium_on_09_March_2023.jpg",
  },
  "rohit sharma": {
    displayName: "Rohit Sharma",
    wikiTitle: "Rohit_Sharma",
    team: "India 🇮🇳",
    role: "Batter",
    jerseyNumber: 45,
    staticFallbackUrl: "https://upload.wikimedia.org/wikipedia/commons/1/1e/Prime_Minister_Of_Bharat_Shri_Narendra_Damodardas_Modi_with_Shri_Rohit_Gurunath_Sharma_%28Cropped%29.jpg",
  },
  "rohit": {
    displayName: "Rohit Sharma",
    wikiTitle: "Rohit_Sharma",
    team: "India 🇮🇳",
    role: "Batter",
    jerseyNumber: 45,
    staticFallbackUrl: "https://upload.wikimedia.org/wikipedia/commons/1/1e/Prime_Minister_Of_Bharat_Shri_Narendra_Damodardas_Modi_with_Shri_Rohit_Gurunath_Sharma_%28Cropped%29.jpg",
  },
  "shaheen afridi": {
    displayName: "Shaheen Shah Afridi",
    wikiTitle: "Shaheen_Shah_Afridi",
    team: "Pakistan 🇵🇰",
    role: "Bowler",
    jerseyNumber: 10,
    staticFallbackUrl: "https://upload.wikimedia.org/wikipedia/commons/0/02/Shaheen_Afridi_jogging_Sri_Lanka_vs_Pakistan_-_2nd_TEST_Match_-_SSC%2C_Colombo_%28cropped%29.jpg",
  },
  "shaheen shah afridi": {
    displayName: "Shaheen Shah Afridi",
    wikiTitle: "Shaheen_Shah_Afridi",
    team: "Pakistan 🇵🇰",
    role: "Bowler",
    jerseyNumber: 10,
    staticFallbackUrl: "https://upload.wikimedia.org/wikipedia/commons/0/02/Shaheen_Afridi_jogging_Sri_Lanka_vs_Pakistan_-_2nd_TEST_Match_-_SSC%2C_Colombo_%28cropped%29.jpg",
  },
  "shaheen": {
    displayName: "Shaheen Shah Afridi",
    wikiTitle: "Shaheen_Shah_Afridi",
    team: "Pakistan 🇵🇰",
    role: "Bowler",
    jerseyNumber: 10,
    staticFallbackUrl: "https://upload.wikimedia.org/wikipedia/commons/0/02/Shaheen_Afridi_jogging_Sri_Lanka_vs_Pakistan_-_2nd_TEST_Match_-_SSC%2C_Colombo_%28cropped%29.jpg",
  },
  "jasprit bumrah": {
    displayName: "Jasprit Bumrah",
    wikiTitle: "Jasprit_Bumrah",
    team: "India 🇮🇳",
    role: "Bowler",
    jerseyNumber: 93,
    staticFallbackUrl: "https://upload.wikimedia.org/wikipedia/commons/0/02/Jasprit_Bumrah_in_PMO_New_Delhi.jpg",
  },
  "bumrah": {
    displayName: "Jasprit Bumrah",
    wikiTitle: "Jasprit_Bumrah",
    team: "India 🇮🇳",
    role: "Bowler",
    jerseyNumber: 93,
    staticFallbackUrl: "https://upload.wikimedia.org/wikipedia/commons/0/02/Jasprit_Bumrah_in_PMO_New_Delhi.jpg",
  },
  "mohammad rizwan": {
    displayName: "Mohammad Rizwan",
    wikiTitle: "Mohammad_Rizwan",
    team: "Pakistan 🇵🇰",
    role: "Wicket-Keeper",
    jerseyNumber: 16,
    staticFallbackUrl: "https://upload.wikimedia.org/wikipedia/commons/a/af/M_Rizwan.jpg",
  },
  "rizwan": {
    displayName: "Mohammad Rizwan",
    wikiTitle: "Mohammad_Rizwan",
    team: "Pakistan 🇵🇰",
    role: "Wicket-Keeper",
    jerseyNumber: 16,
    staticFallbackUrl: "https://upload.wikimedia.org/wikipedia/commons/a/af/M_Rizwan.jpg",
  },
  "pat cummins": {
    displayName: "Pat Cummins",
    wikiTitle: "Pat_Cummins",
    team: "Australia 🇦🇺",
    role: "Bowler",
    jerseyNumber: 30,
    staticFallbackUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/69/Pat_Cummins_fielding_Ashes_2021_%28cropped%29.jpg/1280px-Pat_Cummins_fielding_Ashes_2021_%28cropped%29.jpg",
  },
  "travis head": {
    displayName: "Travis Head",
    wikiTitle: "Travis_Head",
    team: "Australia 🇦🇺",
    role: "Batter",
    jerseyNumber: 62,
    staticFallbackUrl: "https://upload.wikimedia.org/wikipedia/commons/0/05/Travis_Head_bowling_at_Perth_Stadium%2C_First_Test_Australia_versus_West_Indies%2C_2_December_2022_03_%28cropped%29.jpg",
  },
  "hardik pandya": {
    displayName: "Hardik Pandya",
    wikiTitle: "Hardik_Pandya",
    team: "India 🇮🇳",
    role: "All-Rounder",
    jerseyNumber: 33,
    staticFallbackUrl: "https://upload.wikimedia.org/wikipedia/commons/f/fc/Hardik_Pandya_in_PMO_New_Delhi.jpg",
  },
  "hardik": {
    displayName: "Hardik Pandya",
    wikiTitle: "Hardik_Pandya",
    team: "India 🇮🇳",
    role: "All-Rounder",
    jerseyNumber: 33,
    staticFallbackUrl: "https://upload.wikimedia.org/wikipedia/commons/f/fc/Hardik_Pandya_in_PMO_New_Delhi.jpg",
  },
  "suryakumar yadav": {
    displayName: "Suryakumar Yadav",
    wikiTitle: "Suryakumar_Yadav",
    team: "India 🇮🇳",
    role: "Batter",
    jerseyNumber: 63,
    staticFallbackUrl: "https://upload.wikimedia.org/wikipedia/commons/b/b7/Suryakumar_Yadav_in_PMO_New_Delhi.jpg",
  },
  "suryakumar": {
    displayName: "Suryakumar Yadav",
    wikiTitle: "Suryakumar_Yadav",
    team: "India 🇮🇳",
    role: "Batter",
    jerseyNumber: 63,
    staticFallbackUrl: "https://upload.wikimedia.org/wikipedia/commons/b/b7/Suryakumar_Yadav_in_PMO_New_Delhi.jpg",
  },
  "sky": {
    displayName: "Suryakumar Yadav",
    wikiTitle: "Suryakumar_Yadav",
    team: "India 🇮🇳",
    role: "Batter",
    jerseyNumber: 63,
    staticFallbackUrl: "https://upload.wikimedia.org/wikipedia/commons/b/b7/Suryakumar_Yadav_in_PMO_New_Delhi.jpg",
  },
  "shubman gill": {
    displayName: "Shubman Gill",
    wikiTitle: "Shubman_Gill",
    team: "India 🇮🇳",
    role: "Batter",
    jerseyNumber: 77,
    staticFallbackUrl: "https://upload.wikimedia.org/wikipedia/commons/3/34/Shubman_Gill_2023_%28cropped%29.jpg",
  },
  "gill": {
    displayName: "Shubman Gill",
    wikiTitle: "Shubman_Gill",
    team: "India 🇮🇳",
    role: "Batter",
    jerseyNumber: 77,
    staticFallbackUrl: "https://upload.wikimedia.org/wikipedia/commons/3/34/Shubman_Gill_2023_%28cropped%29.jpg",
  },
  "naseem shah": {
    displayName: "Naseem Shah",
    wikiTitle: "Naseem_Shah",
    team: "Pakistan 🇵🇰",
    role: "Bowler",
    jerseyNumber: 71,
    staticFallbackUrl: "https://upload.wikimedia.org/wikipedia/commons/a/a6/Naseem_Shah%2C_Sri_Lanka_vs_Pakistan_-_2nd_TEST_Match_-_SSC%2C_Colombo_%28cropped%29.jpg",
  },
  "naseem": {
    displayName: "Naseem Shah",
    wikiTitle: "Naseem_Shah",
    team: "Pakistan 🇵🇰",
    role: "Bowler",
    jerseyNumber: 71,
    staticFallbackUrl: "https://upload.wikimedia.org/wikipedia/commons/a/a6/Naseem_Shah%2C_Sri_Lanka_vs_Pakistan_-_2nd_TEST_Match_-_SSC%2C_Colombo_%28cropped%29.jpg",
  },
  "haris rauf": {
    displayName: "Haris Rauf",
    wikiTitle: "Haris_Rauf",
    team: "Pakistan 🇵🇰",
    role: "Bowler",
    jerseyNumber: 97,
    staticFallbackUrl: "https://upload.wikimedia.org/wikipedia/commons/3/36/1_53_Haris_Rauf.jpg",
  },
  "haris": {
    displayName: "Haris Rauf",
    wikiTitle: "Haris_Rauf",
    team: "Pakistan 🇵🇰",
    role: "Bowler",
    jerseyNumber: 97,
    staticFallbackUrl: "https://upload.wikimedia.org/wikipedia/commons/3/36/1_53_Haris_Rauf.jpg",
  },
  "mohammad amir": {
    displayName: "Mohammad Amir",
    wikiTitle: "Mohammad_Amir",
    team: "Pakistan 🇵🇰",
    role: "Bowler",
    jerseyNumber: 5,
    staticFallbackUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9a/5_Amir.jpg/1280px-5_Amir.jpg",
  },
  "amir": {
    displayName: "Mohammad Amir",
    wikiTitle: "Mohammad_Amir",
    team: "Pakistan 🇵🇰",
    role: "Bowler",
    jerseyNumber: 5,
    staticFallbackUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9a/5_Amir.jpg/1280px-5_Amir.jpg",
  },
  "joe root": {
    displayName: "Joe Root",
    wikiTitle: "Joe_Root",
    team: "England 🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    role: "Batter",
    jerseyNumber: 66,
    staticFallbackUrl: "https://upload.wikimedia.org/wikipedia/commons/5/5f/2_05_Root_hundred.jpg",
  },
  "root": {
    displayName: "Joe Root",
    wikiTitle: "Joe_Root",
    team: "England 🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    role: "Batter",
    jerseyNumber: 66,
    staticFallbackUrl: "https://upload.wikimedia.org/wikipedia/commons/5/5f/2_05_Root_hundred.jpg",
  },
  "jos buttler": {
    displayName: "Jos Buttler",
    wikiTitle: "Jos_Buttler",
    team: "England 🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    role: "Wicket-Keeper",
    jerseyNumber: 63,
    staticFallbackUrl: "https://upload.wikimedia.org/wikipedia/commons/0/01/Jos_Buttler_in_2023.jpg",
  },
  "buttler": {
    displayName: "Jos Buttler",
    wikiTitle: "Jos_Buttler",
    team: "England 🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    role: "Wicket-Keeper",
    jerseyNumber: 63,
    staticFallbackUrl: "https://upload.wikimedia.org/wikipedia/commons/0/01/Jos_Buttler_in_2023.jpg",
  },
  "ben stokes": {
    displayName: "Ben Stokes",
    wikiTitle: "Ben_Stokes",
    team: "England 🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    role: "All-Rounder",
    jerseyNumber: 55,
    staticFallbackUrl: "https://upload.wikimedia.org/wikipedia/commons/d/db/3_14_Captain_Ben_%28cropped%29_%28cropped%29.jpg",
  },
  "stokes": {
    displayName: "Ben Stokes",
    wikiTitle: "Ben_Stokes",
    team: "England 🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    role: "All-Rounder",
    jerseyNumber: 55,
    staticFallbackUrl: "https://upload.wikimedia.org/wikipedia/commons/d/db/3_14_Captain_Ben_%28cropped%29_%28cropped%29.jpg",
  },
  "rashid khan": {
    displayName: "Rashid Khan",
    wikiTitle: "Rashid_Khan",
    team: "Afghanistan 🇦🇫",
    role: "Bowler",
    jerseyNumber: 19,
    staticFallbackUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/71/Rashid_Khan.jpg/1280px-Rashid_Khan.jpg",
  },
  "rashid": {
    displayName: "Rashid Khan",
    wikiTitle: "Rashid_Khan",
    team: "Afghanistan 🇦🇫",
    role: "Bowler",
    jerseyNumber: 19,
    staticFallbackUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/71/Rashid_Khan.jpg/1280px-Rashid_Khan.jpg",
  },
  "mohammed siraj": {
    displayName: "Mohammed Siraj",
    wikiTitle: "Mohammed_Siraj",
    team: "India 🇮🇳",
    role: "Bowler",
    jerseyNumber: 73,
    staticFallbackUrl: "https://upload.wikimedia.org/wikipedia/commons/d/da/Prime_Minister_Of_Bharat_Shri_Narendra_Damodardas_Modi_with_Mohammad_Siraj_%28cropped%29.jpg",
  },
  "siraj": {
    displayName: "Mohammed Siraj",
    wikiTitle: "Mohammed_Siraj",
    team: "India 🇮🇳",
    role: "Bowler",
    jerseyNumber: 73,
    staticFallbackUrl: "https://upload.wikimedia.org/wikipedia/commons/d/da/Prime_Minister_Of_Bharat_Shri_Narendra_Damodardas_Modi_with_Mohammad_Siraj_%28cropped%29.jpg",
  },
  "mohammed shami": {
    displayName: "Mohammed Shami",
    wikiTitle: "Mohammed_Shami",
    team: "India 🇮🇳",
    role: "Bowler",
    jerseyNumber: 11,
    staticFallbackUrl: "https://upload.wikimedia.org/wikipedia/commons/0/01/Mohammed_Shami_Arjuna_Award_%28cropped%29.jpg",
  },
  "shami": {
    displayName: "Mohammed Shami",
    wikiTitle: "Mohammed_Shami",
    team: "India 🇮🇳",
    role: "Bowler",
    jerseyNumber: 11,
    staticFallbackUrl: "https://upload.wikimedia.org/wikipedia/commons/0/01/Mohammed_Shami_Arjuna_Award_%28cropped%29.jpg",
  },
  "rishabh pant": {
    displayName: "Rishabh Pant",
    wikiTitle: "Rishabh_Pant",
    team: "India 🇮🇳",
    role: "Wicket-Keeper",
    jerseyNumber: 17,
    staticFallbackUrl: "https://upload.wikimedia.org/wikipedia/commons/7/77/Rishabh_Pant.jpg",
  },
  "pant": {
    displayName: "Rishabh Pant",
    wikiTitle: "Rishabh_Pant",
    team: "India 🇮🇳",
    role: "Wicket-Keeper",
    jerseyNumber: 17,
    staticFallbackUrl: "https://upload.wikimedia.org/wikipedia/commons/7/77/Rishabh_Pant.jpg",
  },
};

// Curated high-res match action and stadium backgrounds (authentic licensed Wikimedia Commons)
export const CURATED_MATCH_HIGHLIGHT_PHOTOS = [
  {
    title: "Gaddafi Stadium Lahore PSL & ODI Atmosphere",
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/68/Gaddafi_Stadium_during_PSL_2026.jpg/1280px-Gaddafi_Stadium_during_PSL_2026.jpg",
  },
  {
    title: "Melbourne Cricket Ground Packed Stadium",
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/42/2017_AFL_Grand_Final_panorama_during_national_anthem.jpg/1280px-2017_AFL_Grand_Final_panorama_during_national_anthem.jpg",
  },
  {
    title: "Narendra Modi Stadium Grand Stadium View",
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cb/Narendra_Modi_Stadium_view_from_the_gallery.jpg/1280px-Narendra_Modi_Stadium_view_from_the_gallery.jpg",
  },
  {
    title: "Eden Gardens Floodlights Cricket Clash",
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/73/%E0%A6%87%E0%A6%A1%E0%A7%87%E0%A6%A8_%E0%A6%97%E0%A6%BE%E0%A6%B0%E0%A7%8D%E0%A6%A1%E0%A7%87%E0%A6%A8%E0%A7%87_%E0%A6%AC%E0%A6%BE%E0%A6%82%E0%A6%B2%E0%A6%BE%E0%A6%A6%E0%A7%87%E0%A6%B6_%E0%A6%93_%E0%A6%AA%E0%A6%BE%E0%A6%95%E0%A6%BF%E0%A6%B8%E0%A7%8D%E0%A6%A4%E0%A6%BE%E0%A6%A8%E0%A7%87%E0%A6%B0_%E0%A6%96%E0%A7%87%E0%A6%B2%E0%A6%BE_%E0%A7%AB.jpg/1280px-%E0%A6%87%E0%A6%A1%E0%A7%87%E0%A6%A8_%E0%A6%97%E0%A6%BE%E0%A6%B0%E0%A7%8D%E0%A6%A1%E0%A7%87%E0%A6%A8%E0%A7%87_%E0%A6%AC%E0%A6%BE%E0%A6%82%E0%A6%B2%E0%A6%BE%E0%A6%A6%E0%A7%87%E0%A6%B6_%E0%A6%93_%E0%A6%AA%E0%A6%BE%E0%A6%95%E0%A6%BF%E0%A6%B8%E0%A7%8D%E0%A6%A4%E0%A6%BE%E0%A6%A8%E0%A7%87%E0%A6%B0_%E0%A6%96%E0%A7%87%E0%A6%B2%E0%A6%BE_%E0%A7%AB.jpg",
  },
  {
    title: "Lord's Cricket Ground Historic Pavilion",
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/77/Lords-Cricket-Ground-Pavilion-06-08-2017.jpg/1280px-Lords-Cricket-Ground-Pavilion-06-08-2017.jpg",
  },
  {
    title: "The Oval Cricket Ground",
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bc/The_Kia_Oval_-_geograph.org.uk_-_4645561.jpg/1280px-The_Kia_Oval_-_geograph.org.uk_-_4645561.jpg",
  },
  {
    title: "Wankhede Stadium Wicket & Pitch",
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6e/Wankhede_ICC_WCF.jpg/1280px-Wankhede_ICC_WCF.jpg",
  },
  {
    title: "Dubai International Stadium Under Lights",
    url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/50/Dubai_Stadium_2019.jpg/1280px-Dubai_Stadium_2019.jpg",
  },
];

/**
 * Ensures cricket asset directory exists
 */
function ensureCricketCacheDir(): string {
  if (!fs.existsSync(CRICKET_ASSET_CACHE_DIR)) {
    fs.mkdirSync(CRICKET_ASSET_CACHE_DIR, { recursive: true, mode: 0o777 });
  }
  return CRICKET_ASSET_CACHE_DIR;
}

/**
 * Detects if a scene or commentary mentions a specific star player (e.g. Babar Azam, Virat Kohli, Shaheen Afridi, etc.)
 */
export function detectCricketPlayerInText(text: string): {
  detected: boolean;
  playerKey?: string;
  profile?: typeof KNOWN_PLAYER_PROFILES[keyof typeof KNOWN_PLAYER_PROFILES];
} {
  if (!text) return { detected: false };
  const lower = text.toLowerCase();

  // Check multi-word player names first (e.g., "babar azam", "virat kohli")
  const sortedKeys = Object.keys(KNOWN_PLAYER_PROFILES).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    // Word boundary match to avoid substring false positives
    const regex = new RegExp(`\\b${key}\\b`, "i");
    if (regex.test(lower)) {
      return {
        detected: true,
        playerKey: key,
        profile: KNOWN_PLAYER_PROFILES[key],
      };
    }
  }

  return { detected: false };
}

/**
 * Downloads and caches a player's official portrait photo from Wikipedia
 */
export async function resolvePlayerPhoto(playerKey: string): Promise<string | null> {
  const profile = KNOWN_PLAYER_PROFILES[playerKey.toLowerCase()];
  if (!profile) return null;

  const cacheDir = ensureCricketCacheDir();
  const slug = profile.displayName.toLowerCase().replace(/[^a-z0-9]/g, "_");
  const localPhotoPath = path.join(cacheDir, `player_${slug}.jpg`);

  if (fs.existsSync(localPhotoPath) && fs.statSync(localPhotoPath).size > 5000) {
    return localPhotoPath;
  }

  // Attempt 1: Fetch latest high-res image directly from Wikipedia API
  try {
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(profile.wikiTitle)}&prop=pageimages&format=json&pithumbsize=1080`;
    const res = await fetch(wikiUrl, {
      headers: { "User-Agent": "AutoTubeCricketAI/1.0 (https://autotube.ai)" },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      const page = Object.values(data.query?.pages || {})[0] as any;
      const thumbUrl = page?.thumbnail?.source;
      if (thumbUrl && typeof thumbUrl === "string") {
        const imgRes = await fetch(thumbUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
          signal: AbortSignal.timeout(6000),
        });
        if (imgRes.ok) {
          const buf = Buffer.from(await imgRes.arrayBuffer());
          if (buf.length > 5000) {
            fs.writeFileSync(localPhotoPath, buf);
            console.log(`[CricketService] Successfully cached real photo for ${profile.displayName} from Wikipedia (${(buf.length / 1024).toFixed(1)} KB)`);
            return localPhotoPath;
          }
        }
      }
    }
  } catch (err: any) {
    console.warn(`[CricketService] Wikipedia fetch failed for ${profile.displayName}:`, err.message);
  }

  // Attempt 2: Download curated static fallback URL
  if (profile.staticFallbackUrl) {
    try {
      const imgRes = await fetch(profile.staticFallbackUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        signal: AbortSignal.timeout(6000),
      });
      if (imgRes.ok) {
        const buf = Buffer.from(await imgRes.arrayBuffer());
        if (buf.length > 5000) {
          fs.writeFileSync(localPhotoPath, buf);
          console.log(`[CricketService] Cached fallback portrait for ${profile.displayName} (${(buf.length / 1024).toFixed(1)} KB)`);
          return localPhotoPath;
        }
      }
    } catch {}
  }

  return null;
}

/**
 * Downloads a match action highlight / stadium backdrop photo
 */
export async function resolveMatchHighlightPhoto(index: number, matchContext: string = ""): Promise<string | null> {
  const cacheDir = ensureCricketCacheDir();
  const lower = matchContext.toLowerCase();

  // Pick best matching stadium or action photo
  let chosen = CURATED_MATCH_HIGHLIGHT_PHOTOS[index % CURATED_MATCH_HIGHLIGHT_PHOTOS.length];
  if (lower.includes("gaddafi") || lower.includes("lahore") || lower.includes("pakistan")) {
    chosen = CURATED_MATCH_HIGHLIGHT_PHOTOS[0];
  } else if (lower.includes("narendra modi") || lower.includes("ahmedabad") || lower.includes("india")) {
    chosen = CURATED_MATCH_HIGHLIGHT_PHOTOS[2];
  } else if (lower.includes("eden gardens") || lower.includes("kolkata")) {
    chosen = CURATED_MATCH_HIGHLIGHT_PHOTOS[3];
  } else if (lower.includes("lord") || lower.includes("england")) {
    chosen = CURATED_MATCH_HIGHLIGHT_PHOTOS[4];
  } else if (lower.includes("melbourne") || lower.includes("australia") || lower.includes("mcg")) {
    chosen = CURATED_MATCH_HIGHLIGHT_PHOTOS[1];
  }

  const localPath = path.join(cacheDir, `stadium_${index % 8}.jpg`);
  if (fs.existsSync(localPath) && fs.statSync(localPath).size > 5000) {
    return localPath;
  }

  try {
    const res = await fetch(chosen.url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 5000) {
        fs.writeFileSync(localPath, buf);
        console.log(`[CricketService] Cached match highlight backdrop: "${chosen.title}"`);
        return localPath;
      }
    }
  } catch (err: any) {
    console.warn(`[CricketService] Failed to cache match highlight image:`, err.message);
  }

  return null;
}

/**
 * Generates a smooth, cinematic 5-SECOND video clip from an authentic photo or match highlight
 * Uses FFmpeg dynamic zoom-in / pan motion with stadium lighting atmosphere to make it look professional!
 */
export async function generate5SecDynamicHighlightClip(
  sourceImagePath: string,
  outputVideoPath: string,
  options: {
    durationSeconds?: number;
    isLongVideo?: boolean;
    overlayText?: string;
    subText?: string;
  } = {}
): Promise<string | null> {
  if (!fs.existsSync(sourceImagePath)) return null;

  const duration = options.durationSeconds || 5;
  const isLongVideo = options.isLongVideo ?? true;
  const targetW = isLongVideo ? 1920 : 1080;
  const targetH = isLongVideo ? 1080 : 1920;
  const ffmpegBin = getRequiredFfmpegBinary();
  const fps = 24;
  const scaleW = Math.round(targetW * 1.08);
  const scaleH = Math.round(targetH * 1.08);

  // Cinematic broadcast motion with rich color grading (fast native crop pan & contrast)
  const motionFilter = isLongVideo
    ? `scale=${scaleW}:${scaleH}:force_original_aspect_ratio=increase,crop=${targetW}:${targetH}:x='(in_w-out_w)*(t/${duration})':y='(in_h-out_h)/2',eq=contrast=1.06:saturation=1.12,setsar=1,fps=${fps}`
    : `scale=${scaleW}:${scaleH}:force_original_aspect_ratio=increase,crop=${targetW}:${targetH}:x='(in_w-out_w)/2':y='(in_h-out_h)*(t/${duration})',eq=contrast=1.06:saturation=1.12,setsar=1,fps=${fps}`;

  const cmd = `"${ffmpegBin}" -y -nostats -loglevel error -loop 1 -framerate ${fps} -i "${sourceImagePath}" -vf "${motionFilter}" -c:v libx264 -preset ultrafast -crf 19 -b:v 4500k -maxrate 6000k -bufsize 8000k -threads 0 -pix_fmt yuv420p -t ${duration} "${outputVideoPath}"`;

  try {
    await execAsync(cmd, {
      env: {
        ...process.env,
        PATH: process.env.PATH ? `${process.env.PATH}:/usr/bin:/bin:/usr/local/bin` : "/usr/bin:/bin:/usr/local/bin",
      },
      timeout: 10000,
    });

    if (fs.existsSync(outputVideoPath) && fs.statSync(outputVideoPath).size > 5000) {
      return outputVideoPath;
    }
  } catch (err: any) {
    console.warn(`[CricketService] Dynamic 5s clip generation notice:`, err.message);
  }

  return null;
}
