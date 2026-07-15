import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const DEFAULT_SOCKET_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:4000"
    : "https://gauntlet-online.onrender.com";
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || DEFAULT_SOCKET_URL;
const DONATE_URL = process.env.REACT_APP_DONATE_URL || "";
const PUBLIC_GAME_URL =
  process.env.REACT_APP_PUBLIC_GAME_URL ||
  (typeof window !== "undefined" && window.location.origin
    ? window.location.origin
    : "https://gauntlet-online.vercel.app");
const INITIAL_JOIN_ROOM_CODE =
  typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("join")?.trim().toUpperCase() || ""
    : "";

const socket = io(SOCKET_URL, {
  transports: ["websocket", "polling"]
});

const STORAGE_KEYS = {
  roomCode: "gauntlet_room_code",
  reconnectToken: "gauntlet_reconnect_token",
  role: "gauntlet_role",
  authToken: "gauntlet_auth_token",
  guestName: "gauntlet_guest_name",
  friendReadAt: "gauntlet_friend_read_at",
  accountSoundMuted: "gauntlet_account_sound_muted",
  onboardingDismissed: "gauntlet_onboarding_dismissed",
  accountModeGuideSeen: "gauntlet_account_mode_guide_seen"
};

const FACTION_COLORS = {
  rumin: { primary: "#8b5e3c", light: "#f3e8dc", border: "#6f4628" },
  sheen: { primary: "#2f855a", light: "#e6f6ec", border: "#276749" },
  frumo: { primary: "#2563eb", light: "#e8f0ff", border: "#1d4ed8" },
  bizi: { primary: "#7c3aed", light: "#f3e8ff", border: "#6d28d9" },
  default: { primary: "#374151", light: "#f3f4f6", border: "#1f2937" }
};

const TABLETOP_THEME = {
  text: "#f5ead5",
  muted: "#cbb38b",
  panel: "linear-gradient(180deg, rgba(47, 30, 18, 0.94), rgba(16, 10, 7, 0.95))",
  panelSoft: "linear-gradient(180deg, rgba(64, 42, 25, 0.88), rgba(24, 15, 10, 0.92))",
  gold: "rgba(205, 154, 86, 0.82)",
  goldSoft: "rgba(205, 154, 86, 0.36)",
  ember: "#f59e0b",
  shadow: "0 14px 36px rgba(0,0,0,0.42), inset 0 0 0 1px rgba(255,232,188,0.08), inset 0 18px 42px rgba(255,255,255,0.04)"
};

const MUSIC_TRACKS = {
  menu: { label: "Command Menu", pad: [55, 82.41, 110], notes: [220, 246.94, 261.63, 329.63, 293.66, 246.94], tempo: 650, wave: "sawtooth" },
  basic: { label: "Basic Gauntlet Theme", pad: [65.41, 87.31, 130.81], notes: [261.63, 293.66, 329.63, 392, 349.23, 293.66, 246.94, 261.63], tempo: 600, wave: "triangle" },
  rumin: {
    label: "March of the Rumin",
    sources: [
      "/assets/gauntlet/music/rumin-1.mp3",
      "/assets/gauntlet/music/rumin-2.mp3",
      "/assets/gauntlet/music/rumin-3.mp3",
      "/assets/gauntlet/music/rumin-4.mp3"
    ]
  },
  sheen: {
    label: "Song of the Sheen",
    sources: [
      "/assets/gauntlet/music/sheen-1.mp3",
      "/assets/gauntlet/music/sheen-2.mp3",
      "/assets/gauntlet/music/sheen-3.mp3",
      "/assets/gauntlet/music/sheen-4.mp3"
    ]
  },
  frumo: {
    label: "The Frumos Anthem",
    sources: [
      "/assets/gauntlet/music/frumo-1.mp3",
      "/assets/gauntlet/music/frumo-2.mp3",
      "/assets/gauntlet/music/frumo-3.mp3",
      "/assets/gauntlet/music/frumo-4.mp3"
    ]
  },
  bizi: {
    label: "Hymn of the Gilded Dust",
    sources: [
      "/assets/gauntlet/music/bizi-1.mp3",
      "/assets/gauntlet/music/bizi-2.mp3",
      "/assets/gauntlet/music/bizi-3.mp3",
      "/assets/gauntlet/music/bizi-4.mp3"
    ]
  }
};

const MENU_THEME = {
  page: {
    minHeight: "100vh",
    padding: 30,
    boxSizing: "border-box",
    fontFamily: "Arial, sans-serif",
    color: "#e5eef8",
    background:
      "radial-gradient(circle at 18% 12%, rgba(56, 189, 248, 0.22), transparent 28%), radial-gradient(circle at 82% 18%, rgba(180, 83, 9, 0.18), transparent 24%), linear-gradient(135deg, #07111f 0%, #111827 42%, #1f2933 100%)"
  },
  frame: {
    maxWidth: 1180,
    border: "1px solid rgba(125, 211, 252, 0.28)",
    borderRadius: 8,
    padding: 22,
    background: "linear-gradient(180deg, rgba(15, 23, 42, 0.86), rgba(17, 24, 39, 0.72))",
    boxShadow: "0 24px 80px rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.08)"
  },
  cardStyle: {
    color: "#dbeafe",
    borderRadius: 8,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 12px 28px rgba(0,0,0,0.26)"
  },
  input: {
    padding: 10,
    background: "#0b1220",
    color: "#f8fafc",
    border: "1px solid rgba(148, 163, 184, 0.7)",
    borderRadius: 4
  },
  button: {
    padding: "9px 12px",
    background: "linear-gradient(180deg, #f59e0b, #92400e)",
    color: "#fff7ed",
    border: "1px solid rgba(251, 191, 36, 0.75)",
    borderRadius: 4,
    fontWeight: "bold",
    cursor: "pointer"
  },
  secondaryButton: {
    padding: "9px 12px",
    background: "linear-gradient(180deg, #1f2937, #0f172a)",
    color: "#dbeafe",
    border: "1px solid rgba(125, 211, 252, 0.5)",
    borderRadius: 4,
    fontWeight: "bold",
    cursor: "pointer"
  }
};

const BOARD_BACKGROUNDS = {
  rumin: `
    linear-gradient(180deg, rgba(3, 7, 18, 0.06), rgba(3, 7, 18, 0.34)),
    radial-gradient(circle at 14% 18%, rgba(239, 68, 68, 0.44), transparent 18%),
    radial-gradient(circle at 72% 14%, rgba(56, 189, 248, 0.36), transparent 20%),
    radial-gradient(circle at 48% 30%, rgba(250, 204, 21, 0.34), transparent 24%),
    linear-gradient(90deg, transparent 0 6%, rgba(248, 250, 252, 0.22) 6% 7%, transparent 7% 12%, rgba(248, 250, 252, 0.18) 12% 13%, transparent 13% 20%, rgba(251, 146, 60, 0.22) 20% 21%, transparent 21%),
    linear-gradient(0deg, rgba(15, 23, 42, 0.58) 0 18%, transparent 18%),
    repeating-linear-gradient(90deg, rgba(15, 23, 42, 0.68) 0 18px, rgba(30, 41, 59, 0.68) 18px 20px, transparent 20px 64px),
    repeating-linear-gradient(0deg, transparent 0 22px, rgba(248, 250, 252, 0.12) 22px 23px),
    linear-gradient(135deg, #e879f9 0%, #fb7185 18%, #f59e0b 34%, #22c55e 54%, #0ea5e9 72%, #1e293b 100%)
  `,
  sheen: `
    radial-gradient(ellipse at 50% 0%, rgba(255, 255, 255, 0.7), transparent 34%),
    radial-gradient(ellipse at 16% 24%, rgba(22, 101, 52, 0.28), transparent 30%),
    radial-gradient(ellipse at 78% 20%, rgba(5, 46, 22, 0.22), transparent 28%),
    repeating-linear-gradient(102deg, rgba(17, 24, 39, 0.28) 0 1px, transparent 1px 22px),
    linear-gradient(112deg, transparent 0 10%, rgba(17, 24, 39, 0.18) 10% 11%, transparent 11% 20%, rgba(22, 101, 52, 0.22) 20% 21%, transparent 21%),
    radial-gradient(ellipse at 50% 100%, rgba(21, 128, 61, 0.28), transparent 42%),
    linear-gradient(180deg, #f8f3e7 0%, #e7ead9 42%, #bad0ad 72%, #6b8f68 100%)
  `,
  bizi: `
    radial-gradient(circle at 76% 14%, rgba(253, 224, 71, 0.34), transparent 16%),
    radial-gradient(ellipse at 28% 62%, rgba(120, 53, 15, 0.18), transparent 34%),
    repeating-linear-gradient(166deg, rgba(92, 45, 16, 0.24) 0 2px, transparent 2px 38px),
    repeating-linear-gradient(12deg, rgba(255, 247, 237, 0.12) 0 1px, transparent 1px 34px),
    linear-gradient(90deg, transparent 0 18%, rgba(76, 29, 149, 0.18) 18% 19%, transparent 19% 38%, rgba(76, 29, 149, 0.14) 38% 39%, transparent 39%),
    radial-gradient(ellipse at 50% 84%, rgba(69, 26, 3, 0.46), transparent 38%),
    linear-gradient(180deg, #e9d1a8 0%, #c49a6a 38%, #9b6a3d 64%, #4a321f 100%)
  `,
  frumo: `
    radial-gradient(circle at 18% 22%, rgba(125, 211, 252, 0.54), transparent 18%),
    radial-gradient(circle at 82% 28%, rgba(45, 212, 191, 0.46), transparent 22%),
    radial-gradient(circle at 50% 66%, rgba(236, 72, 153, 0.34), transparent 22%),
    radial-gradient(circle at 24% 76%, rgba(168, 85, 247, 0.28), transparent 18%),
    repeating-linear-gradient(100deg, rgba(255,255,255,0.15) 0 3px, transparent 3px 42px),
    repeating-radial-gradient(circle at 74% 70%, rgba(255,255,255,0.16) 0 2px, transparent 2px 18px),
    linear-gradient(160deg, rgba(20, 184, 166, 0.38), transparent 36%),
    linear-gradient(180deg, #67e8f9 0%, #0891b2 32%, #0369a1 62%, #172554 100%)
  `,
  default:
    "linear-gradient(135deg, #f8fafc 0%, #e5e7eb 100%)"
};

const FACTION_VOICE_LINES = {
  rumin: [
    "The treasury will not underwrite this assault.",
    "The empire requires proper payment.",
    "Discipline first. Then conquest."
  ],
  sheen: [
    "The roots have not gathered enough strength.",
    "Patience. Growth must be nourished.",
    "Harmony rejects an unfed strike."
  ],
  bizi: [
    "Insufficient power allocation.",
    "Payment circuit below threshold.",
    "System error: attack budget invalid."
  ],
  frumo: [
    "A poor wager, captain.",
    "The tide demands more coin.",
    "No sail catches wind without proper pay."
  ]
};

const CAMPAIGN_CHAPTERS = {
  rumin: {
    factionName: "Rumin",
    commanderName: "The Jewel of Rumie",
    pitch: "Follow Rumie from founding myth to republic, Kaiser, civil war, assassination, and imperial legacy.",
    chapters: [
      { id: "brothers-of-destiny", playableName: "Rolmus", opponentName: "Remex", title: "Brothers of Destiny", story: "Two brothers found Rumie together, then clash over whether trade or conquest will define the city.", dialogue: ["Rolmus: Trade builds empires.", "Remex: Trade only survives behind walls.", "Rolmus: Then today we decide what Rumie is."], dialogueAudio: ["/assets/gauntlet/voices/rolmus-brothers-2.mp3", "/assets/gauntlet/voices/remex-brothers-1.mp3", "/assets/gauntlet/voices/rolmus-brothers-1.mp3"] },
      { id: "the-republic", playableName: "The Senate Guard", opponentName: "Tribune Marcell", title: "The Republic", story: "Generations pass. Rumie grows wealthy, but corrupt senators, banks, runes, and legions begin shaping a fragile republic.", dialogue: ["Senator: The Republic endures because it is slow.", "Marcell: Slow things are easy to buy.", "Young Kaiser: Then someone must become too expensive to own."] },
      { id: "the-jewel", playableName: "Kaiser", opponentName: "Corrupt Governor Severan", title: "The Jewel", story: "Kaiser rises as a beloved officer who walks among workers, pays debts, and exposes a governor protected by the aristocracy.", dialogue: ["Severan: You mistake popularity for authority.", "Kaiser: No. I mistake theft for treason.", "Crowd: Kaiser! Kaiser! Kaiser!"] },
      { id: "gaulic-wars", playableName: "Kaiser", opponentName: "Gaulic Warchief Vercan", title: "The Gaulic Wars", story: "Northern tribes unite against Rumie. Kaiser turns frontier war into fame, wealth, and open trade routes.", dialogue: ["Vercan: Your roads end here, jewel prince.", "Kaiser: Roads do not end. They arrive.", "Vercan: Then arrive with steel."] },
      { id: "three-runes", playableName: "Kaiser", opponentName: "Ancient Rune Guardian", title: "The Three Runes", story: "Kaiser discovers vaults of Strength, Protection, and Experience, then begins binding sacred runes to the legions.", dialogue: ["Guardian: Strength without wisdom breaks itself.", "Kaiser: Then I will take wisdom too.", "Guardian: All conquerors say that before the vault closes."] },
      { id: "first-empire-bank", playableName: "Kaiser", opponentName: "Market Collapse", title: "The First Empire Bank", story: "Kaiser returns to build roads, grain systems, public works, and banking reforms while saboteurs try to break Rumie's markets.", dialogue: ["Merchant: The city eats because credit moves.", "Brutus: And if one man commands the credit?", "Kaiser: Then one man answers if the people starve."] },
      { id: "the-crossing", playableName: "Kaiser", opponentName: "Senate General Cassius", title: "The Crossing", story: "The Senate orders Kaiser to surrender command. Brutus pleads for restraint, but Kaiser marches and civil war begins.", dialogue: ["Brutus: Kaiser, do not do this.", "Kaiser: If I surrender, Rumie returns to corruption.", "Brutus: Then save the Republic.", "Kaiser: I intend to."] },
      { id: "last-republic", playableName: "Kaiser", opponentName: "Brutus", title: "The Last Republic", story: "Rumie burns as legions and senators collide. Kaiser wins the city, but Brutus survives the fall of the old order.", dialogue: ["Brutus: You have saved Rumie by conquering it.", "Kaiser: I have saved Rumie from men who sold it.", "Brutus: Then we are both traitors."] },
      { id: "emperor-of-gold", playableName: "Kaiser", opponentName: "Rebel Senate Coalition", title: "Emperor of Gold", story: "At Kaiser's peak, roads, banks, and legions flourish, but prisoners, taxes, and central rule make citizens question the jewel.", dialogue: ["Senator: Prosperity is not freedom.", "Kaiser: Freedom without bread is a slogan.", "Brutus: And bread without law is obedience."] },
      { id: "ides-of-rumie", playableName: "Kaiser", opponentName: "Brutus and the Conspirators", title: "The Ides of Rumie", story: "Kaiser stabilizes the empire, yet the conspiracy reaches the Senate floor. This chapter frames the tragedy more than the victory.", dialogue: ["Kaiser: You too, Brutus?", "Brutus: I do this for Rumie.", "Kaiser: No. You do it because Rumie no longer needs you."] },
      { id: "war-of-successors", playableName: "Bobei", opponentName: "Brutus", title: "War of the Successors", story: "After Kaiser dies, Bobei seeks vengeance while Brutus tries to restore the Republic from the ruins.", dialogue: ["Bobei: You killed a man and woke an empire.", "Brutus: I killed a tyrant.", "Bobei: Then why does Rumie weep?"] },
      { id: "first-emperor", playableName: "Augustus", opponentName: "Bobei the Great", title: "The First Emperor", story: "Augustus defeats Bobei, keeps the bank, legions, and rune program, restores Senate traditions, and leaves Rumie with an empire wearing republican robes.", dialogue: ["Bobei: I was Kaiser's sword.", "Augustus: And I will be his law.", "Old Senator: Perhaps the better question is whether Rumie could have survived without him."] }
    ]
  },
  sheen: {
    factionName: "Sheen",
    commanderName: "The Rise and Trials of the Sheen",
    pitch: "Guide the Sheen from rebellion and living-city prosperity through reform, civil war, and renewal.",
    chapters: [
      { id: "iron-roots", playableName: "Leafen Gao", opponentName: "Emperor Blackthorn", title: "The Iron Roots", story: "The Obsidian Lords drain the forests through Iron Root outposts while Leafen Gao begins a rebellion among starving villages.", dialogue: ["Leafen Gao: A root that drinks everything is not a root. It is a chain.", "Blackthorn: Chains hold kingdoms together.", "Leafen Gao: Then the forest will break yours."] },
      { id: "verdant-uprising", playableName: "Leafen Gao and Hushan", opponentName: "The Thorn Guard Commanders", title: "The Verdant Uprising", story: "Hushan joins Leafen as the rebellion spreads against Ironbark, Thornclaw, and Rootlash.", dialogue: ["Hushan: They say this rebellion is doomed.", "Leafen Gao: Seeds are buried before they rise.", "Ironbark: Then we will salt the soil."] },
      { id: "obsidian-throne", playableName: "Leafen Gao, Hushan, and Leshan", opponentName: "Blackthorn, Lord of Iron", title: "Fall of the Obsidian Throne", story: "Leshan and Dowan collapse the Iron Roots themselves, forcing Blackthorn into one last monstrous stand.", dialogue: ["Leshan: Strike the root, not the branch.", "Blackthorn: I am the root.", "Leafen Gao: Then fall with it."] },
      { id: "beli-living-city", playableName: "Leafen Gao", opponentName: "The Great Blight", title: "Beli, Living City", story: "The Sheen rebuild, found Beli, and begin the Root Network while a natural blight threatens the new kingdom.", dialogue: ["Leafen Gao: We won a forest. Now we must make it a home.", "Reane: Homes are grown, not declared.", "The Great Blight: All growth returns to hunger."] },
      { id: "root-network", playableName: "Bark Xin and Dowan", opponentName: "The Ash Serpent", title: "The Root Network", story: "Dowan expands Sheen botanical science with barriers, shields, greenhouses, and trade routes, but the Ash Serpent burns the nodes.", dialogue: ["Dowan: The network must bend before it spreads.", "Bark Xin: And if fire follows the roots?", "Dowan: Then we teach roots to carry rain."] },
      { id: "blooming-age", playableName: "Reane and Hushan", opponentName: "The Drought King", title: "The Blooming Age", story: "The Sheen enter a golden age of shelters, retreats, springs, and living greenhouses as a desert warlord tests the border.", dialogue: ["Reane: Prosperity is not how much we store. It is how much survives winter.", "Drought King: I bring a longer winter.", "Hushan: Then we bring deeper roots."] },
      { id: "court-of-blossoms", playableName: "Den", opponentName: "Minister Hollowvine", title: "The Court of Blossoms", story: "Political factions emerge in Beli as Den tries to preserve stability while Aime and Tang rise through the court.", dialogue: ["Den: A court can rot while every garden blooms.", "Hollowvine: Rot feeds the next garden.", "Den: Not while I still prune."] },
      { id: "the-reformer", playableName: "Tang", opponentName: "Lord Goldroot", title: "The Reformer", story: "Tang sees inequality and stagnation, introduces reforms that truly help, and wins sympathy against corrupt nobles.", dialogue: ["Tang: Tradition has become a fence around empty soil.", "Goldroot: Empty soil is still mine.", "Tang: Not after the roots remember the poor."] },
      { id: "thorned-crown", playableName: "Tang", opponentName: "Ringan", title: "Thorned Crown", story: "Tang centralizes power and creates the Thornblades, while Ringan, a former ally, tries to stop his imbalance.", dialogue: ["Ringan: You wanted reform. This is control.", "Tang: Control is reform that cannot be bribed.", "Ringan: And cannot be questioned."] },
      { id: "war-of-roots", playableName: "Dowan, Hushan, and Ringan", opponentName: "The Thornblade Generals", title: "The War of Roots", story: "Civil war burns the forests as shelters are weaponized and the Root Network collapses under Ashroot, Briarfang, and Ironvine.", dialogue: ["Dowan: I built these roads to feed cities.", "Ashroot: Roads also carry armies.", "Hushan: Then we cut the roads and save the roots."] },
      { id: "fall-of-thorn-mang", playableName: "Dowan and Reane", opponentName: "Tang, Crown of Thorns", title: "Fall of Thorn Mang", story: "Tang realizes too late what his reforms became, then falls as healer, commander, and living thorn avatar.", dialogue: ["Tang: I only wanted the kingdom to live.", "Reane: Then why does it bleed when you speak?", "Tang: Because I mistook pain for pruning."] },
      { id: "green-era", playableName: "Dowan", opponentName: "The Great Renewal", title: "The Green Era", story: "Dowan restores the Root Network, shelters, healing, greenhouses, and balance after the civil war.", dialogue: ["Dowan: Growth without harmony becomes overgrowth.", "Reane: Tradition without growth becomes ash.", "Dowan: Then wisdom is knowing when to nurture and when to prune."] }
    ]
  },
  frumo: {
    factionName: "Frumo",
    commanderName: "The Last Tide",
    pitch: "Fight through taxation, revolution, terror, Polea's rise, empire, disaster, and the uneasy restoration of the Council.",
    chapters: [
      { id: "tax-of-tides", playableName: "Lafayette", opponentName: "Royal Tax Collector", title: "The Tax of the Tides", story: "King Ludvik's tribute fleets bleed Ristus while royal collectors seize treasure from every captain and family.", dialogue: ["Lafayette: The sea gives enough for all Frumo.", "Tax Collector: Then all Frumo can pay the king.", "Lafayette: The tide is turning against your vaults."] },
      { id: "voices-of-revolution", playableName: "Privateer Mirabeau", opponentName: "Royal Governor of Coral Bay", title: "Voices of Revolution", story: "Hidden taverns and pirate dens fill with reformers as Mirabeau, Danton, Marat, Robespier, and Lafayette demand a freer kingdom.", dialogue: ["Mirabeau: A king who ignores his people will hear their cannons.", "Governor: Coral Bay answers only to Ludvik.", "Danton: Then Coral Bay will learn a new language."] },
      { id: "fall-of-silver-shoals", playableName: "Corsair Danton", opponentName: "General Carnot", title: "The Fall of Silver Shoals", story: "Revolutionary captains storm Ludvik's treasure fortress, proving common pirates can defeat royal formations.", dialogue: ["Danton: Silver Shoals was built to scare us.", "Carnot: It was built to contain you.", "Danton: Then watch what escapes."] },
      { id: "sunken-fortress", playableName: "Lafayette", opponentName: "King Ludvik", title: "The Sunken Fortress", story: "The capital floods with revolution as Ludvik discovers his treasure can buy armies, but not loyalty.", dialogue: ["Ludvik: You call it greed. I call it responsibility.", "Lafayette: Responsibility does not wear a jewel-covered crown.", "Ludvik: Do you know how difficult it is being king?"] },
      { id: "trial-of-king", playableName: "Robespier", opponentName: "Royal Loyalists", title: "The Trial of the King", story: "The monarchy falls, but Frumo divides over whether Ludvik should be imprisoned, spared, or executed.", dialogue: ["Robespier: No kingdom can be free while the crown still lives.", "Lafayette: Justice is not hunger with a blade.", "Robespier: Mercy is how tyrants learn to swim back."] },
      { id: "reign-of-revolution", playableName: "Marat", opponentName: "Robespier the Red Tide", title: "The Reign of the Revolution", story: "Victory curdles into suspicion as Robespier hunts enemies of freedom until the revolution itself becomes dangerous.", dialogue: ["Robespier: The enemies of freedom wear many faces.", "Marat: Then you will soon accuse the mirror.", "Robespier: Mercy is the weapon of tyrants."] },
      { id: "hero-of-republic", playableName: "Polea", opponentName: "Admiral of the Northern Coalition", title: "The Hero of the Republic", story: "As chaos spreads, Polea wins impossible naval battles, defeats Frumo-world invaders, and gives the republic hope.", dialogue: ["Polea: I did not come to rule the republic.", "Admiral: No. You came to make it need you.", "Polea: Today it needs victory."] },
      { id: "lord-commander", playableName: "Polea", opponentName: "Council Rivals", title: "Lord Commander", story: "Polea saves the republic, then takes control of it as the Council of Captains yields more power each year.", dialogue: ["Councilor: You were given command for one crisis.", "Polea: The crisis learned to change names.", "Councilor: So did ambition."] },
      { id: "frumo-empire", playableName: "Polea", opponentName: "Polea's Shadow", title: "The Frumo Empire", story: "Polea crowns himself Lord Commander of All Frumo: no king, no council, no election, only command.", dialogue: ["Polea: I freed the Frumo from kings.", "Shadow: And gave them a commander instead.", "Polea: Better one helm than a thousand drowning hands."] },
      { id: "hundred-fleets", playableName: "Polea", opponentName: "The Coral Crown, Kelpbound Princes, and Brasswater League", title: "The Hundred Fleets", story: "Polea's armadas dominate Reath's oceans as rival Frumo sea powers unite against his endless victories.", dialogue: ["Coral Envoy: The seas do not belong to one captain.", "Polea: Then why do they answer mine?", "Brasswater Admiral: Because fear sounds like obedience."] },
      { id: "frozen-sea", playableName: "Polea", opponentName: "The Ice Leviathan", title: "The Frozen Sea", story: "Polea attempts to conquer the northern oceans, but storms, ice, hunger, and a leviathan shatter the once-invincible navy.", dialogue: ["Polea: No tide has ever refused me.", "Ice Leviathan: This is not tide. This is silence.", "Polea: Then I will break silence too."] },
      { id: "last-tide", playableName: "The Restored Council", opponentName: "Lord Commander Polea", title: "The Last Tide", story: "Former allies and rival fleets face Polea one final time, then restore the Council with the uneasy knowledge that freedom can decay again.", dialogue: ["Polea: I freed the Frumo. I united them. I made them strong.", "Lafayette: And then you made them yours.", "Polea: If that makes me a tyrant, history may judge me."] }
    ]
  },
  bizi: {
    factionName: "Bizi",
    commanderName: "The Gears of Eternity",
    pitch: "Endure impossible odds through invention, faith, schism, restoration, and the final defense of Constanti.",
    chapters: [
      { id: "kharons-vision", playableName: "Kharon", opponentName: "Maxor the Usurper", title: "Kharon's Vision", story: "A young inventor receives visions from Titan Machina, defeats Maxor at Iron River, and founds Constanti.", dialogue: ["Kharon: The future shall not belong to kings.", "Maxor: Then it will belong to tyrants with better machines.", "Kharon: No. It shall belong to builders."] },
      { id: "first-titan", playableName: "Kharon", opponentName: "The Assembly of Doubt", title: "The First Titan", story: "Machina sleeps beneath Constanti, dividing Bizi thinkers over whether the Titan created them or merely guides them.", dialogue: ["Assembly: You ask us to kneel before a machine.", "Kharon: I ask you to listen before you fear.", "Assembly: Faith is poor engineering."] },
      { id: "golden-empire", playableName: "Justine, Theo, and Beli", opponentName: "The Vandal Engine", title: "The Golden Empire", story: "Centuries later, Justine, Theo, and Beli attempt to restore the old Bizi world at the empire's dazzling peak.", dialogue: ["Theo: An empire cannot survive on steel alone.", "Justine: Then give it purpose.", "Beli: And give me the armies to defend it."] },
      { id: "riot-of-sparks", playableName: "Theo and Beli", opponentName: "The Riot Leader", title: "The Riot of Sparks", story: "Constanti burns in rebellion, Justine nearly flees, and Theo forces him to choose rule over escape.", dialogue: ["Justine: The factories are ash. The city hates me.", "Theo: Do you wish to be remembered as a ruler or a fugitive?", "Beli: Open the gates. I will restore order."] },
      { id: "last-victories", playableName: "Beli", opponentName: "The Desert Coalition, Iron Tribes, and Sea Raiders", title: "The Last Victories", story: "Beli wins impossible campaigns and reclaims ancient territories, but each victory stretches the empire thinner.", dialogue: ["Beli: We have won another province.", "Theo: And inherited another wound.", "Beli: Then the empire is made of wounds that refused to close."] },
      { id: "age-of-focus", playableName: "Focus", opponentName: "Emperor Maurice", title: "The Age of Focus", story: "After decline and exhaustion, Focus seizes power and promises order through absolute efficiency.", dialogue: ["Maurice: You call murder progress?", "Focus: Compassion is inefficient. Progress is not.", "Maurice: Then your empire will run perfectly without a soul."] },
      { id: "great-invasion", playableName: "Focus", opponentName: "Khosar the Conqueror", title: "The Great Invasion", story: "The eastern empire collapses, factories fall, shrines are destroyed, and the Bizi face extinction.", dialogue: ["Khosar: Your gears stop where my banners begin.", "Focus: Systems fail. Systems restart.", "Khosar: Not after I melt them."] },
      { id: "heras-counterattack", playableName: "Hera", opponentName: "Khosar", title: "Hera's Counterattack", story: "Hera rises when victory seems impossible, marches into enemy territory, and turns one victory into ten.", dialogue: ["Hera: Machines break. Empires fall.", "Khosar: Then kneel before the empire that remains.", "Hera: Determination endures."] },
      { id: "three-titans", playableName: "Iro, Leon, and Nike", opponentName: "Machina, Melech, and Meca Cult Leaders", title: "The Three Titans", story: "Followers of Machina, Melech, and Meca fight over creation, guidance, and control until faith becomes civil danger.", dialogue: ["Iro: A Titan should guide, not divide.", "Cult Leader: Division proves truth has enemies.", "Leon: Or that certainty has teeth."] },
      { id: "the-schism", playableName: "Theo's Disciples", opponentName: "Archon Severus", title: "The Schism", story: "The Titan faith fractures permanently as old allies become enemies and the empire weakens from certainty within.", dialogue: ["Severus: Unity built on compromise is rust.", "Disciple: The greatest enemy of an empire is certainty.", "Severus: Then certainty will rule what doubt could not hold."] },
      { id: "the-restoration", playableName: "Xios", opponentName: "Corrupt Governors and Invaders", title: "The Restoration", story: "The empire nearly collapses until Xios reforms the economy, repairs the military, and revives Bizi industry.", dialogue: ["Xios: The machine is damaged.", "Governor: Damaged things are replaced.", "Xios: Not destroyed. Repaired. Remember that."] },
      { id: "last-gear", playableName: "The Defenders of Constanti", opponentName: "The Iron Sultan", title: "The Last Gear", story: "Constanti falls under siege. Machina's engines fail, the Titans fall silent, and divided Bizi fight side by side so their knowledge survives.", dialogue: ["Defender: The Titans are silent.", "Iron Sultan: Then your city has no gods left.", "Kharon's Recording: Steel rusts. Cities fall. But ideas are eternal."] }
    ]
  }
};

const CAMPAIGN_NARRATION = {
  "brothers-of-destiny": {
    beforeBattle: "Rumie begins as a fragile dream between two brothers: Rolmus, who sees trade as the road to greatness, and Remex, who believes only conquest can keep the city alive. Their argument will decide the soul of the empire before it is even born.",
    afterBattle: "Rolmus wins the first argument, but not the last. Rumie is founded on trade, ambition, and the unresolved truth that wealth will always need soldiers to guard it."
  },
  "the-republic": {
    beforeBattle: "Generations later, Rumie is rich, proud, and rotten beneath its marble. Senators speak of tradition while banks, legions, and private debts quietly decide the fate of citizens.",
    afterBattle: "The Republic survives, but its weakness has been exposed. Rumie's laws still stand, yet more people now wonder whether law without justice is only another kind of market."
  },
  "the-jewel": {
    beforeBattle: "Kaiser rises from officer to public champion, paying debts and walking among workers while the aristocracy protects its own. Governor Severan believes popularity cannot defeat power.",
    afterBattle: "Severan falls, and Kaiser becomes more than a soldier. To the people, he is the Jewel of Rumie; to the Senate, he is a warning."
  },
  "gaulic-wars": {
    beforeBattle: "Northern tribes unite against Rumie's frontier, threatening roads, trade, and imperial pride. Kaiser marches north, knowing victory will make him beloved and feared in equal measure.",
    afterBattle: "The frontier opens. Kaiser returns with wealth, veterans, and a legend too large for the Senate to comfortably contain."
  },
  "three-runes": {
    beforeBattle: "Beneath conquered lands, Kaiser finds ancient vaults of Strength, Protection, and Experience. The runes promise power, but every sacred weapon demands a price from the hand that holds it.",
    afterBattle: "The legions are changed forever. Rumie now commands not only soldiers and gold, but myth itself."
  },
  "first-empire-bank": {
    beforeBattle: "Kaiser turns from conquest to reform, building roads, grain systems, and public credit. His enemies strike at the markets, hoping the people will blame him when Rumie hungers.",
    afterBattle: "The markets hold. Kaiser proves that money can be a weapon of stability, and the people begin trusting him more than the institutions meant to govern him."
  },
  "the-crossing": {
    beforeBattle: "The Senate orders Kaiser to surrender command. Brutus begs him to preserve the Republic, but Kaiser believes the Republic has already been sold by the men claiming to save it.",
    afterBattle: "The line is crossed. Civil war begins, and Rumie must now choose between a corrupt freedom and an honest empire."
  },
  "last-republic": {
    beforeBattle: "Legions and senators collide while Brutus fights for a dying order. Kaiser fights for the city itself, even if saving Rumie means conquering it.",
    afterBattle: "Kaiser wins the city. The Republic still has voices, but no longer has control."
  },
  "emperor-of-gold": {
    beforeBattle: "Roads flourish, banks expand, and the legions obey one hand. Yet prosperity casts a long shadow: taxes, prisoners, and obedience gather beneath the gold.",
    afterBattle: "Kaiser reaches the height of power. Rumie is safer and richer than ever, but citizens begin asking whether rescue has become rule."
  },
  "ides-of-rumie": {
    beforeBattle: "The conspiracy reaches the Senate floor. Kaiser enters believing his work has saved Rumie; Brutus waits believing only betrayal can save what remains.",
    afterBattle: "Kaiser falls, but the empire does not. The assassins kill the man and accidentally preserve his myth."
  },
  "war-of-successors": {
    beforeBattle: "Bobei takes up vengeance while Brutus tries to restore the Republic from blood and ashes. Both claim Kaiser's death proves their cause.",
    afterBattle: "Brutus loses the future. The Republic he tried to save becomes a memory carried by the empire that replaces it."
  },
  "first-emperor": {
    beforeBattle: "Augustus and Bobei clash over Kaiser's legacy: sword or law, vengeance or settlement. Rumie waits to see what shape empire will finally take.",
    afterBattle: "Augustus wins. The Senate returns in ceremony, the empire remains in fact, and Rumie learns to call obedience tradition."
  },
  "iron-roots": {
    beforeBattle: "The Obsidian Lords drain the forest through Iron Root outposts, turning living land into tribute. Leafen Gao's rebellion begins among starving villages with little more than anger and patience.",
    afterBattle: "The first chains break. The Sheen learn that roots can strangle as well as nourish."
  },
  "verdant-uprising": {
    beforeBattle: "Hushan joins Leafen as the rebellion spreads through villages, groves, and hidden paths. The Thorn Guard believes a scattered forest cannot become an army.",
    afterBattle: "The rebellion becomes a people. What began as hunger has grown into a shared memory of injustice."
  },
  "obsidian-throne": {
    beforeBattle: "Leshan and Dowan strike at the Iron Roots themselves, forcing Blackthorn into a final stand. If the root survives, the forest will never be free.",
    afterBattle: "Blackthorn falls. The Sheen win their forest, but victory leaves them with the harder task of building a kingdom that does not become another chain."
  },
  "beli-living-city": {
    beforeBattle: "The Sheen found Beli and begin the Root Network, but nature itself tests the newborn kingdom through blight and scarcity. Rebellion must become stewardship.",
    afterBattle: "Beli survives. The Sheen discover that a city can grow like a forest if its people accept patience as power."
  },
  "root-network": {
    beforeBattle: "Dowan expands botanical science into roads, shields, greenhouses, and trade routes. The Ash Serpent burns the nodes, proving that connection also creates vulnerability.",
    afterBattle: "The network bends instead of breaking. The Sheen learn that defense is not a wall, but a living system."
  },
  "blooming-age": {
    beforeBattle: "Shelters, retreats, springs, and greenhouses bring abundance, but prosperity attracts enemies from dry borders. The Drought King comes to prove growth can be starved.",
    afterBattle: "The Blooming Age endures. The Sheen understand prosperity as preparation, not comfort."
  },
  "court-of-blossoms": {
    beforeBattle: "As Beli blooms, politics rot quietly inside the court. Den watches nobles and ministers turn harmony into influence.",
    afterBattle: "Den preserves stability for now. But the court has revealed a dangerous truth: a peaceful kingdom can still decay."
  },
  "the-reformer": {
    beforeBattle: "Tang rises against inequality and noble stagnation, promising reforms that return life to the poor. His cause is just, but justice can grow thorns.",
    afterBattle: "Tang wins the people's faith. Reform becomes power, and power begins asking for obedience."
  },
  "thorned-crown": {
    beforeBattle: "Tang creates the Thornblades and centralizes authority to protect reform from corruption. Ringan sees the danger: a cure becoming a crown.",
    afterBattle: "Tang defeats his critics, but the kingdom is no longer merely healing. It is being commanded."
  },
  "war-of-roots": {
    beforeBattle: "Civil war spreads through the forest. Shelters become forts, roads carry armies, and the Root Network becomes a battlefield.",
    afterBattle: "The old harmony burns. The Sheen learn that even living systems can be weaponized when fear takes root."
  },
  "fall-of-thorn-mang": {
    beforeBattle: "Tang stands as healer, reformer, ruler, and living thorn avatar. He finally sees the pain caused in the name of survival, but too late to step aside peacefully.",
    afterBattle: "Tang falls. The Sheen mourn both the tyrant he became and the reformer he once was."
  },
  "green-era": {
    beforeBattle: "Dowan inherits a wounded kingdom. The Root Network must be restored, not as a tool of control, but as a promise of balance.",
    afterBattle: "The Green Era begins. The Sheen choose renewal over revenge, and remember that growth without harmony becomes overgrowth."
  },
  "tax-of-tides": {
    beforeBattle: "King Ludvik's tribute fleets bleed Ristus dry while royal collectors seize treasure from captains and families. Lafayette sees a kingdom drowning in its own greed.",
    afterBattle: "The tax fleet is broken. The Frumo learn that the sea does not belong only to crowns."
  },
  "voices-of-revolution": {
    beforeBattle: "Taverns, pirate dens, and hidden harbors fill with reformers. Mirabeau, Danton, Marat, Robespier, and Lafayette speak different visions of freedom.",
    afterBattle: "The voices become a movement. The monarchy still stands, but the Frumo have learned to imagine life without it."
  },
  "fall-of-silver-shoals": {
    beforeBattle: "Silver Shoals guards Ludvik's treasure and the myth of royal invincibility. Danton leads common captains against trained formations and fortress guns.",
    afterBattle: "Silver Shoals falls. The revolution proves that courage, tide, and timing can defeat inherited power."
  },
  "sunken-fortress": {
    beforeBattle: "The capital floods with unrest. Ludvik believes treasure can buy loyalty, but Lafayette knows fear and gold cannot hold a kingdom forever.",
    afterBattle: "The monarchy breaks. Ludvik discovers too late that a crown is heavy only while people agree to carry it."
  },
  "trial-of-king": {
    beforeBattle: "The Frumo must decide whether Ludvik should be spared, imprisoned, or executed. Justice and vengeance begin wearing the same face.",
    afterBattle: "The king's fate divides the revolution. Freedom has won its first victory and immediately faces its first moral wound."
  },
  "reign-of-revolution": {
    beforeBattle: "Robespier hunts enemies of freedom until suspicion becomes government. Marat sees the revolution turning its blade inward.",
    afterBattle: "The terror consumes itself. The Frumo learn that a revolution can drown in the name of purity."
  },
  "hero-of-republic": {
    beforeBattle: "Coalition fleets gather while the republic trembles. Polea wins impossible battles and gives the Frumo a hero when they most need one.",
    afterBattle: "Polea saves the republic. In doing so, he becomes the one person the republic fears it cannot survive without."
  },
  "lord-commander": {
    beforeBattle: "The Council grants Polea more command with every crisis. Each emergency passes, but his authority remains.",
    afterBattle: "The Council yields piece by piece. Polea has not seized the republic all at once; he has taught it to depend on him."
  },
  "frumo-empire": {
    beforeBattle: "Polea crowns himself Lord Commander of All Frumo. He claims unity, order, and survival; his shadow whispers another word: ambition.",
    afterBattle: "The republic becomes an empire. The Frumo are strong, victorious, and no longer free in the way they once demanded."
  },
  "hundred-fleets": {
    beforeBattle: "Rival sea powers unite against Polea's endless victories. The oceans themselves seem to ask whether one commander can own every tide.",
    afterBattle: "Polea dominates the seas. But each victory makes his empire wider, colder, and harder to hold."
  },
  "frozen-sea": {
    beforeBattle: "Polea sails north to conquer what no fleet has held. Ice, hunger, storms, and silence await the navy that believed itself invincible.",
    afterBattle: "The fleet shatters. Polea survives, but his myth is cracked by a sea that refuses command."
  },
  "last-tide": {
    beforeBattle: "Former allies and rival fleets gather for one final reckoning. Polea insists history will understand him; Lafayette insists the living cannot wait for history.",
    afterBattle: "Polea falls. The Council is restored, but the Frumo remember how easily freedom can become command when fear asks for a hero."
  },
  "kharons-vision": {
    beforeBattle: "Kharon receives visions from Titan Machina and dreams of a city built by invention rather than kings. Maxor stands in the way with older claims to power.",
    afterBattle: "Maxor falls at Iron River. Constanti is founded, and the Bizi begin believing the future can be engineered."
  },
  "first-titan": {
    beforeBattle: "Machina sleeps beneath Constanti, dividing thinkers over whether the Titan is creator, guide, or dangerous machine. Faith and reason meet over the same engine.",
    afterBattle: "The debate does not end. Instead, it becomes the foundation of Bizi identity: progress powered by doubt."
  },
  "golden-empire": {
    beforeBattle: "Centuries later, Justine, Theo, and Beli try to restore the old empire at its dazzling height. The Vandal Engine threatens to prove that splendor cannot stop collapse.",
    afterBattle: "The empire shines again. Yet beneath the gold, every repair reveals how much machinery is already wearing thin."
  },
  "riot-of-sparks": {
    beforeBattle: "Constanti burns in rebellion, and Justine nearly flees from the city he was meant to rule. Theo forces him to choose between command and disappearance.",
    afterBattle: "Order returns, but trust does not. The Bizi learn that machines can restart faster than societies can forgive."
  },
  "last-victories": {
    beforeBattle: "Beli reclaims territory from desert coalitions, iron tribes, and sea raiders. Each triumph looks impossible, and each one stretches the empire thinner.",
    afterBattle: "Beli wins again, but victory becomes exhaustion. The empire is not dying from defeat, but from the cost of refusing to shrink."
  },
  "age-of-focus": {
    beforeBattle: "After decline and paralysis, Focus seizes power with a promise of absolute efficiency. Compassion is treated as waste; progress becomes command.",
    afterBattle: "Focus takes control. The empire runs cleaner, faster, and colder, proving that efficiency without mercy can become its own kind of ruin."
  },
  "great-invasion": {
    beforeBattle: "Khosar the Conqueror breaks the eastern empire, destroying factories, shrines, and old defenses. The Bizi face extinction as systems fail one after another.",
    afterBattle: "The Bizi survive the first collapse. Not because their machines never fail, but because they know how to restart."
  },
  "heras-counterattack": {
    beforeBattle: "Hera rises when defeat seems certain, marching into enemy territory with determination stronger than the machines around her. One victory must become many.",
    afterBattle: "Hera turns the war. The Bizi remember that progress is not only invention; sometimes it is refusal."
  },
  "three-titans": {
    beforeBattle: "Followers of Machina, Melech, and Meca argue over creation, guidance, and control. Faith becomes circuitry for civil danger.",
    afterBattle: "The Titan faith fractures. The Bizi gain a deeper mythology, but lose the unity that once made it powerful."
  },
  "the-schism": {
    beforeBattle: "The empire weakens as certainty hardens into doctrine. Old allies become enemies, each claiming the true meaning of the Titans.",
    afterBattle: "The schism becomes permanent. The Bizi discover that ideas can preserve an empire or split it from the inside."
  },
  "the-restoration": {
    beforeBattle: "Xios inherits a damaged machine of state: corrupt governors, broken armies, failing industry, and borders under pressure. Repair must become revolution.",
    afterBattle: "Xios restores the empire's engine. The Bizi prove that decline is not destiny while knowledge, discipline, and courage remain."
  },
  "last-gear": {
    beforeBattle: "Constanti stands under final siege. The Titans are silent, engines fail, and divided Bizi fight together so their knowledge will outlive the city.",
    afterBattle: "Constanti falls, but the Bizi do not vanish. Their final victory is not survival of stone, but survival of memory, design, and idea."
  }
};

function getCampaignNarration(chapterId) {
  return CAMPAIGN_NARRATION[chapterId] || {};
}

function getCampaignChapterList(factionId) {
  return CAMPAIGN_CHAPTERS[factionId]?.chapters || [];
}

function getNextCampaignChapter(factionId, chapterId) {
  const chapters = getCampaignChapterList(factionId);
  const currentIndex = chapters.findIndex((chapter) => chapter.id === chapterId);
  return currentIndex >= 0 ? chapters[currentIndex + 1] || null : null;
}

function buildCampaignEndDialogue(campaign = {}) {
  if (Array.isArray(campaign.endDialogue) && campaign.endDialogue.length > 0) {
    return campaign.endDialogue;
  }
  const lines = [];
  const playableName = campaign.playableName || "Commander";
  const opponentName = campaign.opponentName || "Opponent";
  if (campaign.afterBattle) lines.push(`Narrator: ${campaign.afterBattle}`);
  lines.push(`${playableName}: This victory will shape what comes next.`);
  lines.push(`${opponentName}: Then carry it carefully. The next battle will remember this one.`);
  return lines;
}

const FACTION_VOICE_AUDIO = {
  rumin: [
    "/assets/gauntlet/voices/kaiser-1.mp3",
    "/assets/gauntlet/voices/kaiser-2.mp3",
    "/assets/gauntlet/voices/kaiser-3.mp3"
  ],
  sheen: [
    "/assets/gauntlet/voices/leafen-gao-1.mp3",
    "/assets/gauntlet/voices/leafen-gao-2.mp3",
    "/assets/gauntlet/voices/leafen-gao-3.mp3"
  ],
  bizi: [
    "/assets/gauntlet/voices/focus-1.mp3",
    "/assets/gauntlet/voices/focus-2.mp3",
    "/assets/gauntlet/voices/focus-3.mp3"
  ],
  frumo: [
    "/assets/gauntlet/voices/polea-1.mp3",
    "/assets/gauntlet/voices/polea-2.mp3",
    "/assets/gauntlet/voices/polea-3.mp3"
  ],
  zalara: [
    "/assets/gauntlet/voices/zalara-1.mp3",
    "/assets/gauntlet/voices/zalara-2.mp3",
    "/assets/gauntlet/voices/zalara-3.mp3"
  ]
};

const FACTION_VOICE_PROFILES = {
  rumin: { rate: 0.82, pitch: 0.55, volume: 1 },
  sheen: { rate: 0.72, pitch: 0.72, volume: 0.9 },
  frumo: { rate: 1.08, pitch: 0.95, volume: 1 },
  bizi: { rate: 0.9, pitch: 1.18, volume: 0.95 },
  basic: { rate: 0.95, pitch: 0.9, volume: 0.9 },
  default: { rate: 0.96, pitch: 0.95, volume: 1 }
};

function getFactionTheme(factionId) {
  return FACTION_COLORS[factionId] || FACTION_COLORS.default;
}

function getBoardBackground(factionId) {
  return BOARD_BACKGROUNDS[factionId] || BOARD_BACKGROUNDS.default;
}

function getFactionVoiceLine(factionId, seedText = "") {
  const lines = FACTION_VOICE_LINES[factionId] || ["That action is not ready."];
  const seed = String(seedText).split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return lines[seed % lines.length];
}

function getFactionVoiceAudio(factionId, quote) {
  const lines = FACTION_VOICE_LINES[factionId] || [];
  const clips = FACTION_VOICE_AUDIO[factionId] || [];
  const quoteIndex = lines.indexOf(quote);
  return quoteIndex >= 0 ? clips[quoteIndex] : null;
}

function getCampaignDifficulty(factionId, chapterIndex) {
  if (factionId === "rumin" || factionId === "sheen" || factionId === "frumo" || factionId === "bizi") {
    return {
      bossLife: Math.min(58, 18 + chapterIndex * 3),
      attacksPerTurn: Math.min(4, 2 + Math.floor(chapterIndex / 4)),
      minAttackValue: 2 + Math.floor(chapterIndex / 5),
      maxAttackValue: 5 + Math.floor(chapterIndex / 4)
    };
  }
  return {
    bossLife: [18, 24, 32][chapterIndex] || 32,
    attacksPerTurn: Math.min(4, 2 + chapterIndex),
    minAttackValue: 2 + chapterIndex,
    maxAttackValue: 5 + chapterIndex
  };
}

function getCampaignAddedCardCount(chapterIndex, side = "player") {
  if (side === "player") {
    if (chapterIndex < 2) return 0;
    if (chapterIndex < 5) return 2;
    if (chapterIndex < 8) return 4;
    return 6;
  }
  if (chapterIndex < 4) return 0;
  if (chapterIndex < 8) return 2;
  return 4;
}

function getCampaignBossAbilityPreview(factionId, chapterIndex, opponentName = "Boss") {
  const tier = chapterIndex >= 9 ? 3 : chapterIndex >= 6 ? 2 : 1;
  const earlyBonus = tier >= 3 ? 2 : 1;
  const previews = {
    rumin: [
      `${opponentName}: Fortified Claim - first scripted attack each turn gets +1.`,
      `${opponentName}: Senate Pressure - final scripted attack each turn gets +${earlyBonus}.`,
      `${opponentName}: Imperial Doctrine - ${tier >= 3 ? "last two scripted attacks each turn get +1" : "final scripted attack each turn gets +1"}.`
    ],
    sheen: [
      `${opponentName}: Ironroot Pressure - odd-numbered attacks get +1.`,
      `${opponentName}: Thorned Advance - first scripted attack each turn gets +1.`,
      `${opponentName}: Living Siege - odd-numbered attacks get +1${tier >= 3 ? " and the boss restores 1 life each turn" : ""}.`
    ],
    frumo: [
      `${opponentName}: Tide Feint - even-numbered attacks get +1.`,
      `${opponentName}: Boarding Rush - final scripted attack each turn gets +${earlyBonus}.`,
      `${opponentName}: Admiral's Ruse - even-numbered attacks get +${tier >= 3 ? 2 : 1}.`
    ],
    bizi: [
      `${opponentName}: Prototype Surge - final scripted attack each turn gets +1.`,
      `${opponentName}: Overclock Directive - last two scripted attacks each turn get +1.`,
      `${opponentName}: Machine Logic - ${tier >= 3 ? "first and final scripted attacks each turn get +1" : "final scripted attack each turn gets +1"}.`
    ]
  };
  const options = previews[factionId];
  return options ? options[Math.min(options.length - 1, Math.floor(chapterIndex / 4))] : null;
}

function getCampaignComplexityPreview(factionId, chapterIndex, opponentName) {
  const playerCards = getCampaignAddedCardCount(chapterIndex, "player");
  const bossCards = getCampaignAddedCardCount(chapterIndex, "boss");
  const bossAbility = getCampaignBossAbilityPreview(factionId, chapterIndex, opponentName);
  const details = [];
  if (playerCards > 0) details.push(`Your deck adds ${playerCards} faction card${playerCards === 1 ? "" : "s"}.`);
  if (bossCards > 0) details.push(`Boss deck adds ${bossCards} faction card${bossCards === 1 ? "" : "s"}.`);
  if (bossAbility) details.push(bossAbility);
  return details;
}

function saveReconnectInfo({ roomCode, reconnectToken, role }) {
  if (roomCode) localStorage.setItem(STORAGE_KEYS.roomCode, roomCode);
  if (reconnectToken) localStorage.setItem(STORAGE_KEYS.reconnectToken, reconnectToken);
  if (role) localStorage.setItem(STORAGE_KEYS.role, role);
}

function clearReconnectInfo() {
  localStorage.removeItem(STORAGE_KEYS.roomCode);
  localStorage.removeItem(STORAGE_KEYS.reconnectToken);
  localStorage.removeItem(STORAGE_KEYS.role);
}

function getSuitSymbol(suit) {
  if (!suit) return "";
  if (["♠", "♣", "♥", "♦"].includes(suit)) return suit;

  const map = {
    S: "♠",
    C: "♣",
    H: "♥",
    D: "♦",
    spades: "♠",
    clubs: "♣",
    hearts: "♥",
    diamonds: "♦"
  };

  const key = String(suit);
  return map[key] || map[key.toLowerCase()] || suit;
}

function isRedSuit(suit) {
  const symbol = getSuitSymbol(suit);
  return symbol === "♥" || symbol === "♦";
}

function getCardNumericValue(card) {
  if (!card) return 0;
  const raw = card.value;

  if (card.rank === "A" || raw === "A" || raw === 1 || raw === "1" || raw === 14 || raw === "14") return 14;
  if (card.rank === "K" || raw === "K" || raw === 13 || raw === "13") return 13;
  if (card.rank === "Q" || raw === "Q" || raw === 12 || raw === "12") return 12;
  if (card.rank === "J" || raw === "J" || raw === 11 || raw === "11") return 11;

  const num = Number(raw);
  return Number.isNaN(num) ? 0 : num;
}

function getCardRank(card) {
  const value = getCardNumericValue(card);
  if (value === 14) return "A";
  if (value === 13) return "K";
  if (value === 12) return "Q";
  if (value === 11) return "J";
  return String(value);
}

function getCardShortLabel(card) {
  if (!card) return "None";
  return `${getCardRank(card)}${getSuitSymbol(card.suit)}`;
}

function resolveAssetPath(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${process.env.PUBLIC_URL || ""}${path}`;
}

function CardBox({ card, children, bg = "white", selected = false, accent = "#2563eb", onInspect, onPreview }) {
  const suit = getSuitSymbol(card?.suit);
  const rank = getCardRank(card);
  const suitColor = isRedSuit(card?.suit) ? "#b91c1c" : "#111827";
  const cardSurface = bg === "white"
    ? "linear-gradient(180deg, #f8ecd5 0%, #e5c9a6 58%, #caa47a 100%)"
    : `linear-gradient(180deg, ${bg}, #ead6b8)`;

  return (
    <div
      className="card-box"
      onMouseEnter={onPreview && card ? () => onPreview(card) : undefined}
      onFocus={onPreview && card ? () => onPreview(card) : undefined}
      style={{
        border: selected ? `2px solid ${accent}` : "1px solid rgba(82, 50, 26, 0.86)",
        borderRadius: 6,
        padding: 6,
        width: 108,
        minWidth: 108,
        minHeight: 164,
        background: cardSurface,
        boxShadow: selected
          ? `0 0 0 3px ${accent}55, 0 12px 24px rgba(0,0,0,0.42), inset 0 0 0 1px rgba(255,255,255,0.42)`
          : "0 9px 18px rgba(0,0,0,0.32), inset 0 0 0 1px rgba(255,255,255,0.38)",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ color: suitColor, fontWeight: "bold", lineHeight: 1 }}>
          <div style={{ fontSize: 18 }}>{rank}</div>
          <div style={{ fontSize: 16 }}>{suit}</div>
        </div>
        <div style={{ fontSize: 9, color: "#666", textAlign: "right" }}>
          {card?.tempBuff ? <div>Buff: +{card.tempBuff}</div> : null}
          <div>Value: {getCardNumericValue(card)}</div>
        </div>
      </div>

      <button
        type="button"
        onClick={onInspect ? (event) => {
          event.stopPropagation();
          if (onPreview) onPreview(card);
          onInspect(card);
        } : undefined}
        disabled={!onInspect || !card}
        title={card ? `Inspect ${card.name || getCardShortLabel(card)}` : "No card"}
        style={{ position: "relative", margin: "4px 0", height: 50, borderRadius: 4, overflow: "hidden", border: "1px solid rgba(82,50,26,0.42)", background: "linear-gradient(180deg, #fff7e8, #d8b98c)", padding: 0, cursor: onInspect && card ? "zoom-in" : "default" }}
      >
        {card?.image ? (
          <img src={resolveAssetPath(card.image)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{ textAlign: "center", fontSize: 34, lineHeight: "50px", color: suitColor }}>{suit}</div>
        )}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, lineHeight: 1, color: suitColor, textShadow: "0 1px 3px white, 0 -1px 3px white" }}>
          {suit}
        </div>
      </button>

      <div style={{ marginBottom: 5 }}>
        {card?.name && <div style={{ fontSize: 10, fontWeight: "bold", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{card.name}</div>}
        {card?.faction && <div style={{ fontSize: 9, color: "#555", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{card.faction}</div>}
      </div>

      <div
        style={{
          position: "absolute",
          right: 6,
          bottom: 50,
          transform: "rotate(180deg)",
          color: suitColor,
          fontWeight: "bold",
          lineHeight: 1,
          textAlign: "center"
        }}
      >
        <div style={{ fontSize: 14 }}>{rank}</div>
        <div style={{ fontSize: 13 }}>{suit}</div>
      </div>

      {children}
    </div>
  );
}

function CardInspectModal({ card, onClose }) {
  if (!card) return null;
  const suit = getSuitSymbol(card.suit);
  const suitColor = isRedSuit(card.suit) ? "#b91c1c" : "#111827";

  return (
    <div role="dialog" aria-modal="true" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(2,6,23,0.72)", display: "grid", placeItems: "center", padding: 18 }}>
      <div onClick={(event) => event.stopPropagation()} style={{ width: "min(420px, 94vw)", border: "2px solid rgba(250, 204, 21, 0.75)", borderRadius: 10, background: "linear-gradient(180deg, #f8fafc, #e5e7eb)", boxShadow: "0 24px 80px rgba(0,0,0,0.55)", overflow: "hidden" }}>
        <div style={{ position: "relative", height: 210, background: "#0f172a" }}>
          {card.image ? <img src={resolveAssetPath(card.image)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : <div style={{ color: suitColor, fontSize: 118, textAlign: "center", lineHeight: "210px", background: "#fff" }}>{suit}</div>}
          <button onClick={onClose} style={{ position: "absolute", right: 10, top: 10, border: 0, borderRadius: 6, background: "rgba(15,23,42,0.86)", color: "#fff", padding: "6px 10px", cursor: "pointer" }}>Close</button>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
            <div>
              <h2 style={{ margin: 0, color: "#111827" }}>{card.name || getCardShortLabel(card)}</h2>
              <div style={{ color: "#475569", marginTop: 4 }}>{card.faction || "Standard card"}</div>
            </div>
            <div style={{ color: suitColor, fontWeight: "bold", textAlign: "center", fontSize: 28, lineHeight: 1 }}>
              <div>{getCardRank(card)}</div>
              <div>{suit}</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 14 }}>
            <StatusPill label="Value" value={getCardNumericValue(card)} bg="#fff" />
            <StatusPill label="Suit" value={suit} bg="#fff" />
            <StatusPill label="Buff" value={card.tempBuff ? `+${card.tempBuff}` : "None"} bg="#fff" />
          </div>
          {(card.rulesText || card.text) && (
            <div style={{ marginTop: 14, border: "1px solid rgba(15,23,42,0.14)", borderRadius: 8, padding: 10, color: "#1f2937", background: "#fff7ed", lineHeight: 1.35 }}>
              {card.rulesText || card.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DiscardPileModal({ game, playerNumbers, onClose, onInspect, onPreview }) {
  if (!game) return null;

  return (
    <div role="dialog" aria-modal="true" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 78, background: "rgba(2,6,23,0.72)", display: "grid", placeItems: "center", padding: 18 }}>
      <div onClick={(event) => event.stopPropagation()} style={{ width: "min(820px, 94vw)", maxHeight: "86dvh", overflow: "auto", border: "2px solid rgba(250,204,21,0.72)", borderRadius: 10, background: "linear-gradient(180deg, #21150c, #090604)", color: "#fff7e6", boxShadow: "0 24px 80px rgba(0,0,0,0.58)", padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontFamily: "Georgia, serif", color: "#f7d99e" }}>Discard Piles</h2>
          <button onClick={onClose} style={{ border: "1px solid rgba(247,217,158,0.52)", borderRadius: 6, background: "rgba(8,5,3,0.62)", color: "#fff7e6", padding: "6px 10px", cursor: "pointer" }}>Close</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          {playerNumbers.map((playerNum) => {
            const discard = game.players?.[playerNum]?.discard || [];
            return (
              <section key={playerNum} style={{ border: "1px solid rgba(247,217,158,0.36)", borderRadius: 8, background: "rgba(255,239,207,0.06)", padding: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", marginBottom: 8 }}>
                  <strong style={{ color: "#f7d99e" }}>{getGamePlayerName(game, playerNum)} (P{playerNum})</strong>
                  <span style={{ color: TABLETOP_THEME.muted, fontSize: 12 }}>{discard.length} cards</span>
                </div>
                {discard.length === 0 ? (
                  <div style={{ color: TABLETOP_THEME.muted, fontSize: 13 }}>No cards in discard.</div>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {discard.map((card, index) => (
                      <button
                        key={card.id || `${playerNum}-${index}`}
                        type="button"
                        onMouseEnter={() => onPreview(card)}
                        onFocus={() => onPreview(card)}
                        onClick={() => {
                          onPreview(card);
                          onInspect(card);
                        }}
                        style={{ border: 0, background: "transparent", padding: 0, cursor: "zoom-in" }}
                      >
                        <SmallCardToken card={card} />
                      </button>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SectionCard({ title, children, borderColor = "#333", background = "white", style = {}, headingStyle = {}, className }) {
  const combinedClassName = ["section-card-shell", className].filter(Boolean).join(" ");
  return (
    <div className={combinedClassName} style={{ border: `2px solid ${borderColor}`, borderRadius: 8, padding: 16, marginBottom: 18, background, ...style }}>
      {title && <h3 style={{ marginTop: 0, marginBottom: 12, ...headingStyle }}>{title}</h3>}
      {children}
    </div>
  );
}

function MenuCard({ title, children }) {
  return (
    <SectionCard
      title={title}
      borderColor="rgba(125, 211, 252, 0.42)"
      background="linear-gradient(180deg, rgba(15, 23, 42, 0.94), rgba(30, 41, 59, 0.9))"
      style={MENU_THEME.cardStyle}
      headingStyle={{ color: "#facc15", letterSpacing: 0.4, textTransform: "uppercase", fontSize: 18 }}
    >
      {children}
    </SectionCard>
  );
}

function MenuButton({ children, variant = "primary", disabled = false, onClick, style = {} }) {
  const base = variant === "secondary" ? MENU_THEME.secondaryButton : MENU_THEME.button;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...base,
        opacity: disabled ? 0.48 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        ...style
      }}
    >
      {children}
    </button>
  );
}

function ActionIconButton({ icon, label, onClick, disabled = false, danger = false, title, iconOnly = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title || label}
      className={`icon-action-button${danger ? " icon-action-danger" : ""}${iconOnly ? " icon-action-only" : ""}`}
      aria-label={label}
    >
      <span aria-hidden="true" className="icon-action-mark">{icon}</span>
      {!iconOnly && <span className="icon-action-label">{label}</span>}
    </button>
  );
}

function startProceduralTrack(trackKey, volume) {
  if (typeof window === "undefined") return { stop: () => {}, setVolume: () => {} };
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return { stop: () => {}, setVolume: () => {} };

  const track = MUSIC_TRACKS[trackKey] || MUSIC_TRACKS.menu;
  const context = new AudioContext();
  const master = context.createGain();
  master.gain.value = volume;
  master.connect(context.destination);

  const resumeContext = () => {
    if (context.state === "suspended") {
      context.resume().catch(() => {});
    }
  };
  resumeContext();
  window.addEventListener("pointerdown", resumeContext);
  window.addEventListener("keydown", resumeContext);

  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = trackKey === "bizi" ? 1200 : trackKey === "basic" ? 1000 : 900;
  filter.connect(master);

  const padNodes = track.pad.map((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = track.wave;
    oscillator.frequency.value = frequency;
    gain.gain.value = 0.035 / (index + 1);
    oscillator.connect(gain);
    gain.connect(filter);
    oscillator.start();
    return oscillator;
  });

  let step = 0;
  const playNote = () => {
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = track.wave;
    oscillator.frequency.value = track.notes[step % track.notes.length];
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.06, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.46);
    oscillator.connect(gain);
    gain.connect(filter);
    oscillator.start(now);
    oscillator.stop(now + 0.5);
    step++;
  };

  playNote();
  const intervalId = window.setInterval(playNote, track.tempo);

  return {
    setVolume: (nextVolume) => {
      master.gain.value = nextVolume;
    },
    stop: () => {
      window.removeEventListener("pointerdown", resumeContext);
      window.removeEventListener("keydown", resumeContext);
      window.clearInterval(intervalId);
      padNodes.forEach((node) => {
        try { node.stop(); } catch (_error) {}
      });
      context.close();
    }
  };
}

function startAudioPlaylist(track, volume) {
  if (typeof window === "undefined" || !track?.sources?.length) return { stop: () => {}, setVolume: () => {} };

  let stopped = false;
  let failedSources = 0;
  let trackIndex = Math.floor(Math.random() * track.sources.length);
  const audio = new Audio(resolveAssetPath(track.sources[trackIndex]));
  audio.preload = "auto";
  audio.volume = volume;
  audio.loop = track.sources.length === 1;

  const play = () => {
    if (stopped) return;
    audio.play().catch(() => {});
  };

  const playNext = () => {
    if (stopped || track.sources.length <= 1) return;
    failedSources++;
    if (failedSources > track.sources.length * 2) return;
    trackIndex = (trackIndex + 1) % track.sources.length;
    audio.src = resolveAssetPath(track.sources[trackIndex]);
    audio.load();
    play();
  };

  const clearFailureCount = () => {
    failedSources = 0;
  };

  const resumeAudio = () => play();
  audio.addEventListener("playing", clearFailureCount);
  audio.addEventListener("ended", playNext);
  audio.addEventListener("error", playNext);
  window.addEventListener("pointerdown", resumeAudio);
  window.addEventListener("keydown", resumeAudio);
  play();

  return {
    setVolume: (nextVolume) => {
      audio.volume = nextVolume;
    },
    stop: () => {
      stopped = true;
      window.removeEventListener("pointerdown", resumeAudio);
      window.removeEventListener("keydown", resumeAudio);
      audio.removeEventListener("playing", clearFailureCount);
      audio.removeEventListener("ended", playNext);
      audio.removeEventListener("error", playNext);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
  };
}

function startMusicTrack(trackKey, volume) {
  const track = MUSIC_TRACKS[trackKey] || MUSIC_TRACKS.menu;
  if (track.sources?.length) return startAudioPlaylist(track, volume);
  return startProceduralTrack(trackKey, volume);
}

function MusicControl({ trackKey, enabled, volume, onToggle, onVolumeChange, account, soundMuted, onSoundMutedChange }) {
  const track = MUSIC_TRACKS[trackKey] || MUSIC_TRACKS.menu;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", color: "#bfdbfe", fontSize: 13 }}>
      {account && <MenuButton variant="secondary" onClick={() => onSoundMutedChange(!soundMuted)}>{soundMuted ? "Unmute All" : "Mute All"}</MenuButton>}
      <MenuButton variant="secondary" onClick={onToggle} disabled={soundMuted}>{enabled ? "Pause Music" : "Play Music"}</MenuButton>
      <span>{track.label}</span>
      <input
        type="range"
        min="0"
        max="0.3"
        step="0.01"
        value={volume}
        onChange={(e) => onVolumeChange(Number(e.target.value))}
        aria-label="Music volume"
        disabled={soundMuted}
        style={{ width: 110, opacity: soundMuted ? 0.48 : 1 }}
      />
      {account && soundMuted && <span style={{ color: "#fca5a5", fontWeight: "bold" }}>All sounds muted</span>}
    </div>
  );
}

function DonateButton({ onUnavailable }) {
  function handleDonate() {
    if (DONATE_URL) {
      window.open(DONATE_URL, "_blank", "noopener,noreferrer");
      return;
    }
    onUnavailable();
  }

  return <MenuButton variant="secondary" onClick={handleDonate}>Support Gauntlet</MenuButton>;
}

function HotkeyWindow({ visible, onClose }) {
  if (!visible) return null;
  const shortcuts = [
    ["A", "Attack from hand"],
    ["L", "Attack from first available lane"],
    ["B", "Block incoming attack"],
    ["T", "Take damage / pass on block"],
    ["P", "Pass priority"],
    ["D", "Resolve damage"],
    ["E", "Place card in current end-phase lane"],
    ["S", "Skip current end-phase lane"],
    ["C", "Confirm selected action"],
    ["X / Esc", "Cancel current selection"],
    ["H / ?", "Toggle this shortcuts window"]
  ];

  return (
    <div style={{ position: "fixed", right: 14, top: 58, zIndex: 40, width: "min(340px, calc(100vw - 28px))", border: "2px solid rgba(125, 211, 252, 0.65)", borderRadius: 8, background: "rgba(15, 23, 42, 0.96)", color: "#e5eef8", boxShadow: "0 18px 50px rgba(0,0,0,0.4)", padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <h3 style={{ margin: 0, color: "#facc15", fontSize: 16 }}>Gameplay Shortcuts</h3>
        <button onClick={onClose} style={{ padding: "3px 8px" }}>Close</button>
      </div>
      <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
        {shortcuts.map(([key, label]) => (
          <div key={key} style={{ display: "grid", gridTemplateColumns: "70px minmax(0, 1fr)", gap: 8, alignItems: "center" }}>
            <kbd style={{ border: "1px solid rgba(191, 219, 254, 0.45)", borderRadius: 5, padding: "3px 6px", textAlign: "center", background: "rgba(30, 41, 59, 0.92)", color: "#f8fafc" }}>{key}</kbd>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CollapseHeader({ title, collapsed, onToggle, color = "#111827" }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: collapsed ? 0 : 8 }}>
      <h3 style={{ margin: 0, color, fontSize: 15 }}>{title}</h3>
      <button onClick={onToggle} style={{ padding: "3px 7px", fontSize: 12 }}>{collapsed ? "Show" : "Hide"}</button>
    </div>
  );
}

function AccountPanel({ account, mode, form, error, onModeChange, onFormChange, onSubmit, onSignOut }) {
  if (account) {
    return (
      <MenuCard title="Account">
        <p style={{ marginTop: 0 }}>Signed in as <strong>{account.name}</strong></p>
        <MenuButton variant="secondary" onClick={onSignOut}>Sign Out</MenuButton>
      </MenuCard>
    );
  }

  return (
    <MenuCard title={mode === "register" ? "Create Account" : "Sign In"}>
      <div style={{ display: "grid", gap: 10 }}>
        <input
          value={form.name}
          onChange={(e) => onFormChange({ ...form, name: e.target.value })}
          placeholder="Account name"
          autoComplete="username"
          style={MENU_THEME.input}
        />
        <input
          value={form.password}
          onChange={(e) => onFormChange({ ...form, password: e.target.value })}
          placeholder="Password"
          type="password"
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          style={MENU_THEME.input}
        />
        {error && <div style={{ color: "#fca5a5", fontSize: 13 }}>{error}</div>}
        <div>
          <MenuButton onClick={onSubmit} style={{ marginRight: 8 }}>{mode === "register" ? "Create Account" : "Sign In"}</MenuButton>
          <MenuButton variant="secondary" onClick={() => onModeChange(mode === "register" ? "login" : "register")}>
            {mode === "register" ? "Use Existing Account" : "Make Account"}
          </MenuButton>
        </div>
      </div>
    </MenuCard>
  );
}

function ProgressionPanel({ account, onSelectCosmetic }) {
  if (!account) {
    return (
      <MenuCard title="Progression">
        <p style={{ margin: 0, color: "#bfdbfe" }}>Sign in to unlock titles, card backs, faction badges, achievements, campaign progress, and match history.</p>
      </MenuCard>
    );
  }

  const progression = account.progression || {};
  const definitions = progression.definitions || {};
  const cosmetics = progression.cosmetics || {};
  const achievements = Object.values(progression.achievements || {}).sort((a, b) => String(b.unlockedAt || "").localeCompare(String(a.unlockedAt || "")));
  const matchHistory = progression.matchHistory || [];
  const campaign = progression.campaign || {};

  const renderOptions = (ids, bucket, selected, field) => (
    <select
      value={selected || ids?.[0] || ""}
      onChange={(event) => onSelectCosmetic({ [field]: event.target.value })}
      style={{ ...MENU_THEME.input, width: "100%", boxSizing: "border-box" }}
    >
      {(ids || []).map((id) => {
        const entry = definitions[bucket]?.[id] || { name: id };
        return <option key={id} value={id}>{entry.name}</option>;
      })}
    </select>
  );

  return (
    <MenuCard title="Progression">
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          <label style={{ display: "grid", gap: 5, color: "#bfdbfe", fontSize: 12 }}>
            Title
            {renderOptions(cosmetics.unlockedTitles, "titles", cosmetics.selectedTitle, "title")}
          </label>
          <label style={{ display: "grid", gap: 5, color: "#bfdbfe", fontSize: 12 }}>
            Card Back
            {renderOptions(cosmetics.unlockedCardBacks, "cardBacks", cosmetics.selectedCardBack, "cardBack")}
          </label>
          <label style={{ display: "grid", gap: 5, color: "#bfdbfe", fontSize: 12 }}>
            Faction Badge
            {renderOptions(cosmetics.unlockedFactionBadges, "factionBadges", cosmetics.selectedFactionBadge, "factionBadge")}
          </label>
        </div>

        <div>
          <h4 style={{ color: "#facc15", margin: "0 0 6px" }}>Achievements</h4>
          {achievements.length === 0 ? (
            <p style={{ margin: 0, color: "#bfdbfe", fontSize: 13 }}>No achievements yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {achievements.slice(0, 8).map((achievement) => (
                <div key={achievement.id} style={{ border: "1px solid rgba(250,204,21,0.28)", borderRadius: 6, padding: 8, background: "rgba(245,158,11,0.12)" }}>
                  <strong style={{ color: "#fde68a" }}>{achievement.name}</strong>
                  <div style={{ color: "#bfdbfe", fontSize: 12 }}>{achievement.description}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h4 style={{ color: "#facc15", margin: "0 0 6px" }}>Campaign Progress</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
            {Object.entries(CAMPAIGN_CHAPTERS).map(([factionId, entry]) => {
              const completed = campaign[factionId]?.length || 0;
              return (
                <div key={factionId} style={{ border: "1px solid rgba(125,211,252,0.25)", borderRadius: 6, padding: 8, color: "#dbeafe" }}>
                  <strong>{entry.factionName}</strong>
                  <div style={{ fontSize: 12 }}>{completed}/{entry.chapters.length} chapters</div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h4 style={{ color: "#facc15", margin: "0 0 6px" }}>Recent Matches</h4>
          {matchHistory.length === 0 ? (
            <p style={{ margin: 0, color: "#bfdbfe", fontSize: 13 }}>No match history yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 5, maxHeight: 180, overflowY: "auto" }}>
              {matchHistory.slice(0, 10).map((match) => (
                <div key={match.id} style={{ display: "grid", gridTemplateColumns: "80px 1fr auto", gap: 8, alignItems: "center", color: "#e5e7eb", fontSize: 12, borderBottom: "1px solid rgba(148,163,184,0.16)", paddingBottom: 5 }}>
                  <strong style={{ color: match.result === "win" ? "#86efac" : match.result === "loss" ? "#fca5a5" : "#fde68a" }}>{match.result.toUpperCase()}</strong>
                  <span>{match.campaign?.title || `${match.factionName || "Basic"} vs ${match.opponentName || "Opponent"}`}</span>
                  <span>{match.life != null ? `${match.life} life` : ""}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </MenuCard>
  );
}

const RARITY_STYLES = {
  common: { label: "Common", color: "#dbeafe", border: "rgba(191,219,254,0.5)" },
  uncommon: { label: "Uncommon", color: "#bbf7d0", border: "rgba(187,247,208,0.5)" },
  rare: { label: "Rare", color: "#fde68a", border: "rgba(253,230,138,0.62)" },
  mythic: { label: "Mythic", color: "#fca5a5", border: "rgba(252,165,165,0.65)" }
};

const PACK_THEMES = {
  rumin: { name: "Rumin", subtitle: "Imperial Arsenal", accent: "#f59e0b", glow: "rgba(245,158,11,0.34)", background: "linear-gradient(145deg, #3b1305, #9a3412 35%, #14532d 76%, #111827)", art: "linear-gradient(135deg, rgba(251,191,36,0.9), rgba(21,128,61,0.72)), radial-gradient(circle at 70% 30%, rgba(254,243,199,0.7), transparent 34%)" },
  sheen: { name: "Sheen", subtitle: "Living Forest", accent: "#86efac", glow: "rgba(134,239,172,0.3)", background: "linear-gradient(145deg, #052e16, #166534 42%, #0f172a 82%)", art: "repeating-linear-gradient(115deg, rgba(220,252,231,0.72) 0 3px, transparent 3px 12px), linear-gradient(135deg, rgba(5,46,22,0.95), rgba(74,222,128,0.62))" },
  frumo: { name: "Frumo", subtitle: "Sunken Fleet", accent: "#67e8f9", glow: "rgba(103,232,249,0.34)", background: "linear-gradient(145deg, #083344, #0e7490 44%, #312e81 88%)", art: "radial-gradient(circle at 22% 22%, rgba(186,230,253,0.8), transparent 18%), radial-gradient(circle at 74% 50%, rgba(34,211,238,0.65), transparent 24%), linear-gradient(135deg, rgba(14,116,144,0.95), rgba(49,46,129,0.78))" },
  bizi: { name: "Bizi", subtitle: "Progress Engine", accent: "#facc15", glow: "rgba(250,204,21,0.28)", background: "linear-gradient(145deg, #422006, #a16207 43%, #334155 86%)", art: "linear-gradient(90deg, rgba(250,204,21,0.28) 1px, transparent 1px), linear-gradient(0deg, rgba(250,204,21,0.22) 1px, transparent 1px), linear-gradient(135deg, rgba(120,53,15,0.95), rgba(71,85,105,0.84))" }
};

function getBattlefieldTexture(factionId) {
  const textures = {
    rumin: `
      radial-gradient(circle at 18% 16%, rgba(252, 211, 77, 0.16), transparent 18%),
      repeating-linear-gradient(0deg, rgba(255, 247, 220, 0.05) 0 3px, transparent 3px 32px),
      repeating-linear-gradient(90deg, rgba(251, 191, 36, 0.08) 0 2px, transparent 2px 92px),
      linear-gradient(135deg, rgba(120, 53, 15, 0.24), rgba(15, 23, 42, 0.12))
    `,
    sheen: `
      radial-gradient(ellipse at 34% 22%, rgba(187, 247, 208, 0.14), transparent 24%),
      repeating-linear-gradient(104deg, rgba(22, 101, 52, 0.42) 0 4px, transparent 4px 54px),
      repeating-linear-gradient(82deg, rgba(15, 23, 42, 0.34) 0 2px, transparent 2px 38px),
      linear-gradient(180deg, rgba(5, 46, 22, 0.22), rgba(2, 6, 23, 0.14))
    `,
    frumo: `
      radial-gradient(circle at 18% 38%, rgba(186, 230, 253, 0.16), transparent 6%),
      radial-gradient(circle at 72% 18%, rgba(103, 232, 249, 0.16), transparent 8%),
      repeating-radial-gradient(ellipse at 52% 120%, rgba(103, 232, 249, 0.18) 0 2px, transparent 2px 24px),
      linear-gradient(160deg, rgba(14, 116, 144, 0.25), rgba(49, 46, 129, 0.16))
    `,
    bizi: `
      linear-gradient(90deg, rgba(250, 204, 21, 0.13) 1px, transparent 1px),
      linear-gradient(0deg, rgba(250, 204, 21, 0.1) 1px, transparent 1px),
      repeating-linear-gradient(45deg, transparent 0 36px, rgba(15, 23, 42, 0.34) 36px 39px),
      radial-gradient(circle at 76% 24%, rgba(250, 204, 21, 0.12), transparent 18%)
    `
  };
  return textures[factionId] || textures.rumin;
}

const BASE_PLAYING_DECK_SIZE = 52;
const PLAYING_DECK_VALUES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
const MAX_REPLACEMENTS_PER_VALUE = 4;
const MAX_CONSTRUCTED_DECK_SIZE = BASE_PLAYING_DECK_SIZE;
const REPLACEMENT_SUITS = [
  { id: "spades", label: "♠" },
  { id: "hearts", label: "♥" },
  { id: "diamonds", label: "♦" },
  { id: "clubs", label: "♣" }
];

function getReplacementValue(card) {
  const value = Number(card?.value);
  return PLAYING_DECK_VALUES.includes(value) ? value : null;
}

function normalizeReplacementSuitId(suit) {
  const key = String(suit || "").toLowerCase();
  const map = {
    "♠": "spades",
    spade: "spades",
    spades: "spades",
    "♥": "hearts",
    heart: "hearts",
    hearts: "hearts",
    "♦": "diamonds",
    diamond: "diamonds",
    diamonds: "diamonds",
    "♣": "clubs",
    club: "clubs",
    clubs: "clubs"
  };
  return map[key] || (REPLACEMENT_SUITS.some((entry) => entry.id === key) ? key : "spades");
}

function BoosterPackTile({ booster, opening, canOpen, onOpen, onBuyPack }) {
  const theme = PACK_THEMES[booster.factionId] || PACK_THEMES.rumin;
  const rarityCounts = (booster.slots || []).reduce((counts, slot) => {
    counts[slot] = (counts[slot] || 0) + 1;
    return counts;
  }, {});

  return (
    <button
      type="button"
      className={`booster-pack-tile ${opening ? "opening" : ""}`}
      onClick={() => {
        if (canOpen) onOpen(booster.id);
      }}
      disabled={opening}
      style={{ "--pack-accent": theme.accent, "--pack-glow": theme.glow, background: theme.background, opacity: canOpen ? 1 : 0.86 }}
    >
      <span className="booster-pack-shine" />
      <span className="booster-pack-crimp booster-pack-crimp-top" />
      <span className="booster-pack-crimp booster-pack-crimp-bottom" />
      <span className="booster-pack-hanger" />
      <span className="booster-pack-topline">Gauntlet Online</span>
      <span className="booster-pack-set">Foundation Booster</span>
      <strong>{theme.name}</strong>
      <span className="booster-pack-subtitle">{theme.subtitle}</span>
      <span className="booster-pack-art" style={{ background: theme.art }}>
        <span className="booster-pack-sigil">{theme.name.slice(0, 1)}</span>
      </span>
      <span className="booster-pack-count">{booster.cardCount || booster.slots?.length || 8} digital cards</span>
      <span className="booster-pack-slots">
        {Object.entries(rarityCounts).map(([rarity, count]) => (
          <span key={rarity}>{count} {RARITY_STYLES[rarity]?.label || rarity}</span>
        ))}
      </span>
      <span className="booster-pack-open">{opening ? "Opening..." : canOpen ? "Open Pack" : "Earn a Pack Credit"}</span>
      <span className="booster-pack-retail">
        <span>GAUNTLET</span>
        <span>$1.00</span>
      </span>
      <span
        role="button"
        tabIndex={0}
        onClick={(event) => {
          event.stopPropagation();
          onBuyPack(booster.id);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            onBuyPack(booster.id);
          }
        }}
        style={{ zIndex: 2, justifySelf: "start", border: "1px solid rgba(255,255,255,0.26)", borderRadius: 6, padding: "6px 9px", background: "rgba(2,6,23,0.48)", color: "#fff7dc", fontWeight: 900, fontSize: 12 }}
      >
        Buy $1 Pack
      </span>
    </button>
  );
}

function CollectionPanel({ account, lastOpenedPack, openingPackId, onOpenPack, onBuyPack, onSaveConstructedDeck }) {
  const savedConstructedDeck = account?.stats?.savedConstructedDeck || null;
  const [constructedFactionId, setConstructedFactionId] = useState(savedConstructedDeck?.factionId || "rumin");
  const [constructedQuantities, setConstructedQuantities] = useState(savedConstructedDeck?.cardQuantities || {});
  const [constructedSuitChoices, setConstructedSuitChoices] = useState(savedConstructedDeck?.cardSuitChoices || {});
  const [constructedSaveMessage, setConstructedSaveMessage] = useState("");
  const [catalogFactionFilter, setCatalogFactionFilter] = useState("all");
  const [catalogRarityFilter, setCatalogRarityFilter] = useState("all");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogOwnedOnly, setCatalogOwnedOnly] = useState(false);

  useEffect(() => {
    setConstructedFactionId(savedConstructedDeck?.factionId || "rumin");
    setConstructedQuantities(savedConstructedDeck?.cardQuantities || {});
    setConstructedSuitChoices(savedConstructedDeck?.cardSuitChoices || {});
    setConstructedSaveMessage("");
  }, [account?.id, savedConstructedDeck?.savedAt, savedConstructedDeck?.factionId, savedConstructedDeck?.cardQuantities, savedConstructedDeck?.cardSuitChoices]);

  if (!account) {
    return (
      <MenuCard title="Collection">
        <p style={{ margin: 0, color: "#bfdbfe" }}>Sign in to open faction boosters and build a card collection.</p>
      </MenuCard>
    );
  }

  const collection = account.collection || {};
  const cardsOwned = collection.cards || {};
  const catalog = collection.catalog || {};
  const boosters = Object.values(collection.boosters || {});
  const ownedTotal = Object.values(cardsOwned).reduce((sum, count) => sum + Number(count || 0), 0);
  const packCredits = Number(collection.packCredits || 0);
  const allCatalogCards = Object.entries(catalog).flatMap(([factionId, cards]) => (
    ["mythic", "rare", "uncommon", "common"].flatMap((rarity) => (cards || []).filter((card) => card.rarity === rarity).map((card) => ({ ...card, factionId })))
  ));
  const ownedUniqueCount = allCatalogCards.filter((card) => Number(cardsOwned[card.id] || 0) > 0).length;
  const ownedPercent = allCatalogCards.length > 0 ? Math.round((ownedUniqueCount / allCatalogCards.length) * 100) : 0;
  const normalizedCatalogSearch = catalogSearch.trim().toLowerCase();
  const filteredCatalogCards = allCatalogCards.filter((card) => {
    const ownedCount = Number(cardsOwned[card.id] || 0);
    if (catalogFactionFilter !== "all" && card.factionId !== catalogFactionFilter) return false;
    if (catalogRarityFilter !== "all" && card.rarity !== catalogRarityFilter) return false;
    if (catalogOwnedOnly && ownedCount <= 0) return false;
    if (normalizedCatalogSearch) {
      const searchText = `${card.name} ${card.type} ${card.text} ${PACK_THEMES[card.factionId]?.name || card.factionId}`.toLowerCase();
      if (!searchText.includes(normalizedCatalogSearch)) return false;
    }
    return true;
  });
  const ownedConstructedCards = (catalog[constructedFactionId] || [])
    .filter((card) => Number(cardsOwned[card.id] || 0) > 0)
    .sort((a, b) => {
      const rarityOrder = { mythic: 0, rare: 1, uncommon: 2, common: 3 };
      return (rarityOrder[a.rarity] ?? 9) - (rarityOrder[b.rarity] ?? 9) || a.name.localeCompare(b.name);
    });
  const constructedCardsById = Object.fromEntries((catalog[constructedFactionId] || []).map((card) => [card.id, card]));
  const constructedReplacementCount = Object.values(constructedQuantities).reduce((sum, count) => sum + Math.max(0, Number(count || 0)), 0);
  const constructedValueCounts = Object.entries(constructedQuantities).reduce((counts, [cardId, count]) => {
    const value = getReplacementValue(constructedCardsById[cardId]);
    if (value == null) return counts;
    counts[value] = (counts[value] || 0) + Math.max(0, Number(count || 0));
    return counts;
  }, {});
  const constructedSlotCounts = Object.entries(constructedQuantities).reduce((counts, [cardId, count]) => {
    const value = getReplacementValue(constructedCardsById[cardId]);
    if (value == null) return counts;
    const suits = Array.isArray(constructedSuitChoices[cardId]) ? constructedSuitChoices[cardId] : [];
    Array.from({ length: Math.max(0, Number(count || 0)) }, (_, index) => normalizeReplacementSuitId(suits[index] || REPLACEMENT_SUITS[index % REPLACEMENT_SUITS.length].id)).forEach((suit) => {
      const key = `${value}:${suit}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, {});
  const constructedDeckCount = BASE_PLAYING_DECK_SIZE;
  const constructedCurveWarning = Object.entries(constructedValueCounts).find(([, count]) => count > MAX_REPLACEMENTS_PER_VALUE);
  const constructedSlotWarning = Object.entries(constructedSlotCounts).find(([, count]) => count > 1);

  function setConstructedCardQuantity(cardId, nextQuantity) {
    const owned = Number(cardsOwned[cardId] || 0);
    const card = constructedCardsById[cardId];
    const value = getReplacementValue(card);
    const sameValueCurrent = value == null ? 0 : Object.entries(constructedQuantities).reduce((sum, [otherCardId, count]) => {
      if (otherCardId === cardId) return sum;
      return getReplacementValue(constructedCardsById[otherCardId]) === value ? sum + Math.max(0, Number(count || 0)) : sum;
    }, 0);
    const maxForValue = value == null ? 0 : Math.max(0, MAX_REPLACEMENTS_PER_VALUE - sameValueCurrent);
    const quantity = Math.max(0, Math.min(owned, maxForValue, Math.floor(Number(nextQuantity || 0))));
    setConstructedSaveMessage("");
    setConstructedQuantities((current) => {
      const next = { ...current };
      if (quantity <= 0) delete next[cardId];
      else next[cardId] = quantity;
      return next;
    });
    setConstructedSuitChoices((current) => {
      const existing = Array.isArray(current[cardId]) ? current[cardId] : [];
      const usedSuits = new Set();
      if (value != null) {
        for (const [otherCardId, otherCount] of Object.entries(constructedQuantities)) {
          if (otherCardId === cardId || getReplacementValue(constructedCardsById[otherCardId]) !== value) continue;
          const otherSuits = Array.isArray(current[otherCardId]) ? current[otherCardId] : [];
          Array.from({ length: Math.max(0, Number(otherCount || 0)) }, (_, index) => normalizeReplacementSuitId(otherSuits[index] || REPLACEMENT_SUITS[index % REPLACEMENT_SUITS.length].id)).forEach((suit) => usedSuits.add(suit));
        }
      }
      const next = { ...current };
      if (quantity <= 0) {
        delete next[cardId];
      } else {
        next[cardId] = Array.from({ length: quantity }, (_, index) => {
          const preferred = normalizeReplacementSuitId(existing[index] || "");
          const suit = preferred && !usedSuits.has(preferred)
            ? preferred
            : REPLACEMENT_SUITS.find((entry) => !usedSuits.has(entry.id))?.id || REPLACEMENT_SUITS[index % REPLACEMENT_SUITS.length].id;
          usedSuits.add(suit);
          return suit;
        });
      }
      return next;
    });
  }

  function setConstructedCardSuit(cardId, copyIndex, suit) {
    setConstructedSaveMessage("");
    setConstructedSuitChoices((current) => {
      const quantity = Math.max(0, Number(constructedQuantities[cardId] || 0));
      const existing = Array.isArray(current[cardId]) ? current[cardId] : [];
      return {
        ...current,
        [cardId]: Array.from({ length: quantity }, (_, index) => (
          index === copyIndex ? normalizeReplacementSuitId(suit) : normalizeReplacementSuitId(existing[index] || REPLACEMENT_SUITS[index % REPLACEMENT_SUITS.length].id)
        ))
      };
    });
  }

  async function saveConstructedDeck() {
    setConstructedSaveMessage("");
    try {
      await onSaveConstructedDeck({
        factionId: constructedFactionId,
        cardQuantities: constructedQuantities,
        cardSuitChoices: constructedSuitChoices
      });
      setConstructedSaveMessage("Constructed deck saved.");
    } catch (saveError) {
      setConstructedSaveMessage(saveError.message || "Could not save constructed deck.");
    }
  }

  return (
    <MenuCard title="Faction Collection">
      <style>{`
        @keyframes packPulse {
          0% { transform: translateY(0) scale(1); box-shadow: 0 0 0 rgba(255,255,255,0); }
          35% { transform: translateY(-3px) scale(1.025) rotate(-1deg); box-shadow: 0 0 28px var(--pack-glow); }
          70% { transform: translateY(1px) scale(0.99) rotate(1deg); box-shadow: 0 0 42px var(--pack-glow); }
          100% { transform: translateY(0) scale(1); box-shadow: 0 0 0 rgba(255,255,255,0); }
        }
        @keyframes cardReveal {
          from { opacity: 0; transform: translateY(20px) rotateX(68deg) scale(0.92); filter: brightness(1.8); }
          60% { opacity: 1; transform: translateY(-4px) rotateX(0deg) scale(1.02); filter: brightness(1.18); }
          to { opacity: 1; transform: translateY(0) rotateX(0deg) scale(1); filter: brightness(1); }
        }
        .booster-pack-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(206px, 1fr));
          gap: 14px;
        }
        .booster-pack-tile {
          position: relative;
          min-height: 348px;
          border: 1px solid color-mix(in srgb, var(--pack-accent) 70%, #fef3c7 18%);
          border-radius: 5px;
          padding: 34px 16px 18px;
          color: #fff7dc;
          text-align: center;
          overflow: hidden;
          cursor: pointer;
          display: grid;
          align-content: start;
          gap: 8px;
          isolation: isolate;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.26), inset 0 -20px 44px rgba(0,0,0,0.32), 0 16px 36px rgba(0,0,0,0.34);
          clip-path: polygon(0 4%, 3% 2%, 0 0, 100% 0, 97% 2%, 100% 4%, 100% 96%, 97% 98%, 100% 100%, 0 100%, 3% 98%, 0 96%);
        }
        .booster-pack-tile::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            repeating-linear-gradient(90deg, rgba(255,255,255,0.09) 0 1px, transparent 1px 11px),
            linear-gradient(105deg, transparent 0 22%, rgba(255,255,255,0.2) 28%, transparent 34% 58%, rgba(255,255,255,0.14) 64%, transparent 70%),
            radial-gradient(circle at 50% 8%, rgba(255,255,255,0.2), transparent 18%);
          mix-blend-mode: screen;
          opacity: 0.72;
          z-index: 0;
        }
        .booster-pack-tile::after {
          content: "";
          position: absolute;
          inset: 9px;
          border: 1px solid rgba(255,247,220,0.24);
          box-shadow: inset 0 0 0 1px rgba(0,0,0,0.28);
          pointer-events: none;
          z-index: 1;
        }
        .booster-pack-tile:hover {
          transform: translateY(-2px);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.24), 0 18px 42px var(--pack-glow);
        }
        .booster-pack-tile.opening {
          animation: packPulse 720ms ease-in-out infinite;
        }
        .booster-pack-tile strong {
          font-family: Georgia, serif;
          font-size: 34px;
          line-height: 1;
          text-shadow: 0 2px 0 rgba(0,0,0,0.8), 0 0 18px var(--pack-glow);
          z-index: 2;
        }
        .booster-pack-topline,
        .booster-pack-open {
          z-index: 2;
          color: var(--pack-accent);
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          font-size: 11px;
        }
        .booster-pack-set {
          z-index: 2;
          color: #fef3c7;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 1px;
          text-transform: uppercase;
          border-top: 1px solid rgba(255,247,220,0.32);
          border-bottom: 1px solid rgba(255,247,220,0.32);
          padding: 5px 0;
          background: rgba(2,6,23,0.3);
        }
        .booster-pack-subtitle,
        .booster-pack-count {
          z-index: 2;
          color: #fde68a;
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }
        .booster-pack-art {
          z-index: 2;
          min-height: 112px;
          border: 2px solid rgba(255,247,220,0.68);
          box-shadow: inset 0 0 0 2px rgba(0,0,0,0.42), 0 8px 22px rgba(0,0,0,0.32);
          display: grid;
          place-items: center;
          margin: 2px 8px;
          position: relative;
          overflow: hidden;
        }
        .booster-pack-art::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(115deg, transparent, rgba(255,255,255,0.28), transparent);
          transform: translateX(-45%);
        }
        .booster-pack-sigil {
          position: relative;
          width: 58px;
          height: 58px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          border: 2px solid rgba(255,247,220,0.76);
          background: rgba(2,6,23,0.38);
          color: #fff7dc;
          font-family: Georgia, serif;
          font-size: 34px;
          font-weight: 900;
          text-shadow: 0 2px 8px rgba(0,0,0,0.72);
        }
        .booster-pack-slots {
          z-index: 2;
          display: flex;
          gap: 5px;
          flex-wrap: wrap;
          justify-content: center;
          font-size: 10px;
        }
        .booster-pack-slots span {
          border: 1px solid rgba(255,255,255,0.22);
          border-radius: 999px;
          padding: 3px 6px;
          background: rgba(2,6,23,0.34);
        }
        .booster-pack-retail {
          z-index: 2;
          display: flex;
          justify-content: space-between;
          gap: 8px;
          align-items: center;
          border: 1px solid rgba(255,255,255,0.28);
          background: rgba(255,247,220,0.88);
          color: #111827;
          padding: 5px 7px;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.8px;
        }
        .booster-pack-hanger {
          position: absolute;
          top: 10px;
          left: 50%;
          width: 40px;
          height: 14px;
          transform: translateX(-50%);
          border-radius: 0 0 999px 999px;
          border: 1px solid rgba(255,247,220,0.38);
          border-top: 0;
          background: rgba(2,6,23,0.38);
          z-index: 2;
        }
        .booster-pack-crimp {
          position: absolute;
          left: 0;
          right: 0;
          height: 18px;
          background:
            repeating-linear-gradient(90deg, rgba(255,247,220,0.38) 0 7px, rgba(0,0,0,0.18) 7px 13px),
            rgba(2,6,23,0.24);
          z-index: 2;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.45);
        }
        .booster-pack-crimp-top {
          top: 0;
        }
        .booster-pack-crimp-bottom {
          bottom: 0;
        }
        .booster-pack-shine {
          position: absolute;
          inset: -30% auto auto -30%;
          width: 80%;
          height: 160%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent);
          transform: rotate(18deg);
        }
        .opened-card-reveal {
          animation: cardReveal 520ms ease-out both;
          transform-origin: center bottom;
        }
      `}</style>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ color: "#bfdbfe", fontSize: 13 }}>
            {ownedTotal} cards owned - {collection.openedPacks || 0} packs opened - {packCredits} pack credit{packCredits === 1 ? "" : "s"}
          </div>
          <div style={{ color: "#fde68a", fontSize: 12 }}>Earn 1 pack credit the first time you clear each campaign chapter. Paid packs use your configured $1 checkout link.</div>
        </div>
        {boosters.length > 0 && (
          <div className="booster-pack-grid">
            {boosters.map((booster) => (
              <BoosterPackTile
                key={booster.id}
                booster={booster}
                opening={openingPackId === booster.id}
                canOpen={packCredits > 0}
                onOpen={onOpenPack}
                onBuyPack={onBuyPack}
              />
            ))}
          </div>
        )}
        {lastOpenedPack?.length > 0 && (
          <div>
            <h4 style={{ color: "#facc15", margin: "0 0 6px" }}>Last Pack</h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
              {lastOpenedPack.map((card, index) => {
                const rarity = RARITY_STYLES[card.rarity] || RARITY_STYLES.common;
                return (
                  <div className="opened-card-reveal" key={`${card.id}-${index}`} style={{ animationDelay: `${index * 90}ms`, border: `1px solid ${rarity.border}`, borderRadius: 7, padding: 8, background: "rgba(2,6,23,0.5)" }}>
                    <strong style={{ color: rarity.color }}>{card.name}</strong>
                    <div style={{ color: "#bfdbfe", fontSize: 12 }}>{rarity.label} {card.type} - value {card.value}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div style={{ border: "1px solid rgba(125,211,252,0.24)", borderRadius: 8, padding: 12, background: "rgba(2,6,23,0.36)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
            <div>
              <h4 style={{ color: "#facc15", margin: "0 0 4px" }}>Constructed Deck</h4>
              <div style={{ color: "#bfdbfe", fontSize: 12 }}>The standard 52-card playing deck is included automatically. Swap owned faction cards into matching values while keeping exactly 4 cards of each value.</div>
            </div>
            <div style={{ color: constructedCurveWarning ? "#fca5a5" : "#86efac", fontWeight: 900 }}>
              {constructedDeckCount}/{MAX_CONSTRUCTED_DECK_SIZE} - {constructedReplacementCount} swap{constructedReplacementCount === 1 ? "" : "s"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            {Object.values(PACK_THEMES).map((theme) => {
              const factionId = theme.name.toLowerCase();
              const active = constructedFactionId === factionId;
              return (
                <button
                  key={factionId}
                  type="button"
                  onClick={() => {
                    setConstructedFactionId(factionId);
                    setConstructedQuantities({});
                    setConstructedSuitChoices({});
                    setConstructedSaveMessage("");
                  }}
                  style={{ border: `1px solid ${active ? theme.accent : "rgba(148,163,184,0.34)"}`, borderRadius: 6, padding: "7px 10px", background: active ? "rgba(250,204,21,0.16)" : "rgba(15,23,42,0.55)", color: active ? "#fde68a" : "#bfdbfe", fontWeight: 900, cursor: "pointer" }}
                >
                  {theme.name}
                </button>
              );
            })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 8, maxHeight: 300, overflowY: "auto", paddingRight: 4 }}>
            {ownedConstructedCards.length === 0 ? (
              <div style={{ color: "#bfdbfe", fontSize: 13 }}>Open {PACK_THEMES[constructedFactionId]?.name || constructedFactionId} packs to collect cards for this faction.</div>
            ) : ownedConstructedCards.map((card) => {
              const rarity = RARITY_STYLES[card.rarity] || RARITY_STYLES.common;
              const count = Number(constructedQuantities[card.id] || 0);
              const owned = Number(cardsOwned[card.id] || 0);
              const value = getReplacementValue(card);
              const valueCount = value == null ? MAX_REPLACEMENTS_PER_VALUE : constructedValueCounts[value] || 0;
              const canAdd = count < owned && value != null && valueCount < MAX_REPLACEMENTS_PER_VALUE;
              return (
                <div key={card.id} style={{ border: `1px solid ${rarity.border}`, borderRadius: 8, padding: 9, background: count > 0 ? "rgba(15,23,42,0.78)" : "rgba(15,23,42,0.44)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <strong style={{ color: rarity.color }}>{card.name}</strong>
                    <span style={{ color: "#f8fafc", fontWeight: "bold" }}>{count}/{owned}</span>
                  </div>
                  <div style={{ color: "#bfdbfe", fontSize: 12, margin: "3px 0" }}>{rarity.label} {card.type} - value {card.value} ({valueCount}/{MAX_REPLACEMENTS_PER_VALUE} at this value)</div>
                  <div style={{ color: "#e5e7eb", fontSize: 12, lineHeight: 1.35, minHeight: 32 }}>{card.text}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <button type="button" onClick={() => setConstructedCardQuantity(card.id, count - 1)} disabled={count <= 0} style={{ flex: 1, border: "1px solid rgba(255,255,255,0.22)", borderRadius: 5, padding: "5px 7px", background: "rgba(2,6,23,0.5)", color: "#e5e7eb", cursor: count <= 0 ? "not-allowed" : "pointer" }}>-</button>
                    <button type="button" onClick={() => setConstructedCardQuantity(card.id, count + 1)} disabled={!canAdd} style={{ flex: 1, border: "1px solid rgba(255,255,255,0.22)", borderRadius: 5, padding: "5px 7px", background: "rgba(2,6,23,0.5)", color: "#e5e7eb", cursor: canAdd ? "pointer" : "not-allowed" }}>+</button>
                  </div>
                  {count > 0 && (
                    <div style={{ display: "grid", gap: 5, marginTop: 8 }}>
                      <div style={{ color: "#fde68a", fontSize: 11, fontWeight: 900 }}>Replace suits</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {Array.from({ length: count }, (_, copyIndex) => (
                          <select
                            key={`${card.id}-suit-${copyIndex}`}
                            value={normalizeReplacementSuitId(constructedSuitChoices[card.id]?.[copyIndex])}
                            onChange={(event) => setConstructedCardSuit(card.id, copyIndex, event.target.value)}
                            aria-label={`${card.name} replacement suit ${copyIndex + 1}`}
                            style={{ border: "1px solid rgba(255,255,255,0.22)", borderRadius: 5, padding: "4px 6px", background: "rgba(2,6,23,0.62)", color: "#e5e7eb", fontWeight: 900 }}
                          >
                            {REPLACEMENT_SUITS.map((suit) => <option key={suit.id} value={suit.id}>{suit.label}</option>)}
                          </select>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
            <MenuButton onClick={saveConstructedDeck} disabled={constructedReplacementCount <= 0 || !!constructedCurveWarning || !!constructedSlotWarning}>Save Constructed Deck</MenuButton>
            {savedConstructedDeck && <span style={{ color: "#bfdbfe", fontSize: 13 }}>Saved: {savedConstructedDeck.factionName || savedConstructedDeck.factionId} ({savedConstructedDeck.cardCount || BASE_PLAYING_DECK_SIZE} cards, {savedConstructedDeck.replacementCount || savedConstructedDeck.additionCount || 0} swaps)</span>}
            {constructedSaveMessage && <span style={{ color: constructedSaveMessage.includes("Could not") ? "#fca5a5" : "#86efac", fontSize: 13, fontWeight: 900 }}>{constructedSaveMessage}</span>}
            {constructedCurveWarning && <span style={{ color: "#fca5a5", fontSize: 13, fontWeight: 900 }}>Too many value {constructedCurveWarning[0]} cards.</span>}
            {constructedSlotWarning && <span style={{ color: "#fca5a5", fontSize: 13, fontWeight: 900 }}>Two cards are replacing the same {constructedSlotWarning[0].replace(":", " of ")}.</span>}
          </div>
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "end", flexWrap: "wrap", marginBottom: 8 }}>
            <div>
              <h4 style={{ color: "#facc15", margin: "0 0 4px" }}>Card Catalog</h4>
              <div style={{ color: "#bfdbfe", fontSize: 12 }}>Owned: {ownedUniqueCount}/{allCatalogCards.length} unique cards ({ownedPercent}%)</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input
                value={catalogSearch}
                onChange={(event) => setCatalogSearch(event.target.value)}
                placeholder="Search cards"
                style={{ minWidth: 160, border: "1px solid rgba(125,211,252,0.28)", borderRadius: 6, padding: "7px 9px", background: "rgba(15,23,42,0.74)", color: "#e5e7eb" }}
              />
              <select value={catalogFactionFilter} onChange={(event) => setCatalogFactionFilter(event.target.value)} style={{ border: "1px solid rgba(125,211,252,0.28)", borderRadius: 6, padding: "7px 9px", background: "rgba(15,23,42,0.74)", color: "#e5e7eb" }}>
                <option value="all">All factions</option>
                {Object.entries(PACK_THEMES).map(([factionId, theme]) => <option key={factionId} value={factionId}>{theme.name}</option>)}
              </select>
              <select value={catalogRarityFilter} onChange={(event) => setCatalogRarityFilter(event.target.value)} style={{ border: "1px solid rgba(125,211,252,0.28)", borderRadius: 6, padding: "7px 9px", background: "rgba(15,23,42,0.74)", color: "#e5e7eb" }}>
                <option value="all">All rarities</option>
                {Object.entries(RARITY_STYLES).map(([rarity, style]) => <option key={rarity} value={rarity}>{style.label}</option>)}
              </select>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#bfdbfe", fontSize: 12, fontWeight: 800 }}>
                <input type="checkbox" checked={catalogOwnedOnly} onChange={(event) => setCatalogOwnedOnly(event.target.checked)} />
                Owned only
              </label>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 8, maxHeight: 340, overflowY: "auto", paddingRight: 4 }}>
            {filteredCatalogCards.length === 0 && (
              <div style={{ color: "#bfdbfe", fontSize: 13 }}>No cards match those filters.</div>
            )}
            {filteredCatalogCards.map((card) => {
              const rarity = RARITY_STYLES[card.rarity] || RARITY_STYLES.common;
              const count = cardsOwned[card.id] || 0;
              return (
                <div key={card.id} style={{ border: `1px solid ${rarity.border}`, borderRadius: 8, padding: 9, background: count > 0 ? "rgba(15,23,42,0.7)" : "rgba(15,23,42,0.36)", opacity: count > 0 ? 1 : 0.72 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <strong style={{ color: rarity.color }}>{card.name}</strong>
                    <span style={{ color: "#f8fafc", fontWeight: "bold" }}>x{count}</span>
                  </div>
                  <div style={{ color: "#bfdbfe", fontSize: 12, margin: "3px 0" }}>{PACK_THEMES[card.factionId]?.name || card.factionId} - {rarity.label} {card.type} - value {card.value}</div>
                  <div style={{ color: "#e5e7eb", fontSize: 12, lineHeight: 1.35 }}>{card.text}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </MenuCard>
  );
}

function CollectionScreen({ account, lastOpenedPack, openingPackId, onOpenPack, onBuyPack, onSaveConstructedDeck, onBack }) {
  return (
    <div style={MENU_THEME.page}>
      <div style={MENU_THEME.frame}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, borderBottom: "1px solid rgba(125, 211, 252, 0.28)", paddingBottom: 16, marginBottom: 20 }}>
          <div>
            <div style={{ color: "#f59e0b", fontSize: 12, fontWeight: "bold", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Vault Terminal</div>
            <h1 style={{ margin: 0, fontSize: 42, color: "#f8fafc", textShadow: "0 0 18px rgba(56,189,248,0.4)" }}>Collection</h1>
          </div>
          <MenuButton variant="secondary" onClick={onBack}>Main Menu</MenuButton>
        </div>
        <CollectionPanel account={account} lastOpenedPack={lastOpenedPack} openingPackId={openingPackId} onOpenPack={onOpenPack} onBuyPack={onBuyPack} onSaveConstructedDeck={onSaveConstructedDeck} />
      </div>
    </div>
  );
}

function DraftCardTile({ card, selected = false, disabled = false, onClick, actionLabel = "Pick" }) {
  const rarity = RARITY_STYLES[card.rarity] || RARITY_STYLES.common;
  const theme = PACK_THEMES[card.factionId] || PACK_THEMES.rumin;
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        border: `1px solid ${selected ? theme.accent : rarity.border}`,
        borderRadius: 8,
        padding: 9,
        background: selected ? "rgba(250,204,21,0.18)" : "rgba(2,6,23,0.58)",
        color: "#e5e7eb",
        textAlign: "left",
        display: "grid",
        gap: 5,
        minHeight: 132,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.48 : 1
      }}
    >
      <strong style={{ color: rarity.color }}>{card.name}</strong>
      <span style={{ color: "#bfdbfe", fontSize: 12 }}>{theme.name} - {rarity.label} {card.type} - value {card.value}</span>
      <span style={{ fontSize: 12, lineHeight: 1.35 }}>{card.text}</span>
      <span style={{ justifySelf: "end", color: theme.accent, fontWeight: "bold", fontSize: 12 }}>{selected ? "Swapped" : actionLabel}</span>
    </button>
  );
}

function DraftScreen({ draft, lobby, player, isSpectator, account, draftPickPending, draftSaveMessage, onBack, onCopyRoom, onStartDraft, onPickCard, onToggleDeckCard, onSetDeckCardSuit, onSaveDraftDeck }) {
  const myPack = draft?.myCurrentPack?.cards || [];
  const myPool = draft?.myPool || [];
  const myDeckAdditions = draft?.myDeckAdditions || [];
  const selectedIds = new Set(myDeckAdditions.map((card) => card.draftCopyId));
  const selectedFactionIds = [...new Set(myDeckAdditions.map((card) => card.factionId).filter(Boolean))];
  const selectedFactionId = selectedFactionIds[0] || "";
  const selectedFactionName = selectedFactionId ? (PACK_THEMES[selectedFactionId]?.name || selectedFactionId) : "";
  const selectedValueCounts = myDeckAdditions.reduce((counts, card) => {
    const value = getReplacementValue(card);
    if (value == null) return counts;
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
  const selectedSlotCounts = myDeckAdditions.reduce((counts, card) => {
    const value = getReplacementValue(card);
    if (value == null) return counts;
    const suit = normalizeReplacementSuitId(card.replacementSuit || card.suit);
    const key = `${value}:${suit}`;
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
  const selectedSlotWarning = Object.entries(selectedSlotCounts).find(([, count]) => count > 1);
  const savedDraftDeck = account?.stats?.savedDraftDeck || null;
  const players = draft?.players || lobby?.players || {};
  const connectedPlayers = Object.entries(players).filter(([, seat]) => seat.connected || seat.accountName);
  const canStart = player === 1 && draft?.status === "lobby";
  const hasPickedThisPass = !!draft?.myCurrentPack?.pickedThisPass;
  const isBotDraft = !!draft?.botDraft;

  return (
    <div style={MENU_THEME.page}>
      <div style={MENU_THEME.frame}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", borderBottom: "1px solid rgba(125, 211, 252, 0.28)", paddingBottom: 16, marginBottom: 18 }}>
          <div>
            <div style={{ color: "#f59e0b", fontSize: 12, fontWeight: "bold", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>{draft?.league ? "Draft League Match" : isBotDraft ? "Bot Draft" : "Eight Seat Draft"}</div>
            <h1 style={{ margin: 0, color: "#f8fafc" }}>{draft?.league ? "Gauntlet Draft League" : isBotDraft ? "Gauntlet Bot Draft" : "Gauntlet Draft"}</h1>
            <p style={{ color: "#bfdbfe", marginBottom: 0 }}>{isBotDraft ? "Draft with seven bot drafters, then save a one-faction 52-card deck for Draft League." : "Draft faction cards, then swap selected cards into your standard 52-card playing deck."}</p>
          </div>
          <div style={{ display: "grid", justifyItems: "end", gap: 8 }}>
            <RoomCodeDisplay code={draft?.roomCode || lobby?.roomCode} roleLabel={isSpectator ? "Spectator" : `Player ${player}`} onCopy={onCopyRoom} color="#bfdbfe" />
            <MenuButton variant="secondary" onClick={onBack}>Main Menu</MenuButton>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <MenuCard title="Draft Table">
            <p style={{ color: "#bfdbfe", marginTop: 0 }}>Seats: {connectedPlayers.length}/8</p>
            <div style={{ display: "grid", gap: 6 }}>
              {Array.from({ length: 8 }, (_, index) => index + 1).map((seatNum) => {
                const seat = players[seatNum] || {};
                return (
                  <div key={seatNum} style={{ display: "flex", justifyContent: "space-between", gap: 8, border: "1px solid rgba(125,211,252,0.22)", borderRadius: 6, padding: 7, color: "#dbeafe" }}>
                    <strong>P{seatNum}</strong>
                    <span>{seat.accountName || (seat.connected ? "Connected" : "Open Seat")}</span>
                    <span style={{ color: seat.connected ? "#86efac" : "#94a3b8" }}>{seat.connected ? "Online" : "Open"}</span>
                  </div>
                );
              })}
            </div>
            {canStart && !isBotDraft && <MenuButton onClick={onStartDraft} disabled={connectedPlayers.length < 2} style={{ marginTop: 12 }}>Start Draft</MenuButton>}
            {draft?.status === "lobby" && !canStart && <p style={{ color: "#bfdbfe", fontSize: 13 }}>Waiting for Player 1 to start the draft.</p>}
            {draft?.status === "lobby" && isBotDraft && <p style={{ color: "#bfdbfe", fontSize: 13 }}>Preparing bot draft seats...</p>}
          </MenuCard>

          <MenuCard title="Draft Status">
            <div style={{ color: "#dbeafe", display: "grid", gap: 6 }}>
              <div><strong>Status:</strong> {draft?.status || "lobby"}</div>
              <div><strong>Round:</strong> {draft?.round || 0}/{draft?.packsPerPlayer || 3}</div>
              <div><strong>Pick:</strong> {draft?.pickNumber || 0}</div>
              <div><strong>Pass:</strong> {draft?.direction || "left"}</div>
              <div><strong>Base deck:</strong> {draft?.baseDeck?.cardCount || 52} cards</div>
              {isBotDraft && <div><strong>Bot table:</strong> 7 automated drafters</div>}
              {savedDraftDeck && <div><strong>Saved league deck:</strong> {savedDraftDeck.factionName || savedDraftDeck.factionId} ({savedDraftDeck.cardCount || BASE_PLAYING_DECK_SIZE} cards, {savedDraftDeck.replacementCount || savedDraftDeck.additionCount || savedDraftDeck.cards?.length || 0} swaps) - {(savedDraftDeck.draftType || "player") === "bot" ? "Bot Draft" : "Player Draft"}</div>}
            </div>
            {isBotDraft && draft?.botPickLog?.length > 0 && (
              <div style={{ marginTop: 10, padding: 10, borderRadius: 8, border: "1px solid rgba(125,211,252,0.22)", background: "rgba(15,23,42,0.42)", color: "#bfdbfe", fontSize: 12, display: "grid", gap: 3 }}>
                <strong style={{ color: "#fde68a" }}>Recent bot picks</strong>
                {draft.botPickLog.slice(-5).map((line, index) => <div key={`${line}-${index}`}>{line}</div>)}
              </div>
            )}
          </MenuCard>
        </div>

        {draft?.status === "drafting" && !isSpectator && (
          <MenuCard title={`Current Pack (${myPack.length} cards)`}>
            <p style={{ color: "#bfdbfe", marginTop: 0 }}>{hasPickedThisPass ? "Pick locked in. Waiting for the other players before the next pack." : "Pick exactly one card from this pack."}</p>
            {myPack.length === 0 ? (
              <p style={{ color: "#bfdbfe", margin: 0 }}>Waiting for the next pack.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                {myPack.map((card) => (
                  <DraftCardTile key={card.draftCopyId} card={card} disabled={draftPickPending || hasPickedThisPass} actionLabel={draftPickPending || hasPickedThisPass ? "Waiting" : "Pick"} onClick={() => onPickCard(card.draftCopyId)} />
                ))}
              </div>
            )}
          </MenuCard>
        )}

        {draft?.status === "building" && !isSpectator && (
          <MenuCard title={`Build Draft Deck (${myDeckAdditions.length} swaps)`}>
            <p style={{ color: "#bfdbfe", marginTop: 0 }}>Choose cards from one faction only. Each chosen card replaces a same-value card in your 52-card base deck, with no more than 4 cards at any value.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8, marginBottom: 12 }}>
              <div style={{ border: "1px solid rgba(125,211,252,0.28)", borderRadius: 8, padding: 10, color: "#dbeafe", background: "rgba(15,23,42,0.5)" }}>
                <strong>Deck size</strong>
                <div>{draft?.baseDeck?.cardCount || BASE_PLAYING_DECK_SIZE} cards - {myDeckAdditions.length} swap{myDeckAdditions.length === 1 ? "" : "s"}</div>
              </div>
              <div style={{ border: "1px solid rgba(125,211,252,0.28)", borderRadius: 8, padding: 10, color: "#dbeafe", background: "rgba(15,23,42,0.5)" }}>
                <strong>Faction</strong>
                <div>{selectedFactionName || "Choose your first card"}</div>
              </div>
              <div style={{ border: "1px solid rgba(125,211,252,0.28)", borderRadius: 8, padding: 10, color: "#dbeafe", background: "rgba(15,23,42,0.5)" }}>
                <strong>Draft League</strong>
                <div>{savedDraftDeck ? `Saved: ${savedDraftDeck.factionName || savedDraftDeck.factionId}` : "No saved deck yet"}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
              <MenuButton onClick={onSaveDraftDeck} disabled={!account || myDeckAdditions.length === 0 || selectedFactionIds.length !== 1 || !!selectedSlotWarning}>Save Deck for Draft League</MenuButton>
              {!account && <span style={{ color: "#bfdbfe", fontSize: 13 }}>Sign in to save decks.</span>}
              {draftSaveMessage && <span style={{ color: "#86efac", fontSize: 13, fontWeight: "bold" }}>{draftSaveMessage}</span>}
              {selectedSlotWarning && <span style={{ color: "#fca5a5", fontSize: 13, fontWeight: "bold" }}>Two cards are replacing the same {selectedSlotWarning[0].replace(":", " of ")}.</span>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
              {myPool.map((card) => {
                const selected = selectedIds.has(card.draftCopyId);
                return (
                  <div key={card.draftCopyId} style={{ display: "grid", gap: 6 }}>
                    <DraftCardTile
                      card={card}
                      selected={selected}
                      disabled={!selected && ((selectedFactionId && card.factionId !== selectedFactionId) || ((selectedValueCounts[getReplacementValue(card)] || 0) >= MAX_REPLACEMENTS_PER_VALUE))}
                      actionLabel={selected ? "Remove" : selectedFactionId && card.factionId !== selectedFactionId ? "Wrong faction" : (selectedValueCounts[getReplacementValue(card)] || 0) >= MAX_REPLACEMENTS_PER_VALUE ? "Value full" : "Swap In"}
                      onClick={() => onToggleDeckCard(card.draftCopyId)}
                    />
                    {selected && (
                      <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, color: "#fde68a", fontSize: 12, fontWeight: 900, border: "1px solid rgba(125,211,252,0.22)", borderRadius: 6, padding: "5px 7px", background: "rgba(2,6,23,0.44)" }}>
                        Replace suit
                        <select
                          value={normalizeReplacementSuitId(card.replacementSuit || card.suit)}
                          onChange={(event) => onSetDeckCardSuit(card.draftCopyId, event.target.value)}
                          style={{ border: "1px solid rgba(255,255,255,0.22)", borderRadius: 5, padding: "4px 6px", background: "rgba(2,6,23,0.62)", color: "#e5e7eb", fontWeight: 900 }}
                        >
                          {REPLACEMENT_SUITS.map((suit) => <option key={suit.id} value={suit.id}>{suit.label}</option>)}
                        </select>
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </MenuCard>
        )}

        <MenuCard title={`Your Draft Pool (${myPool.length})`}>
          {isSpectator ? (
            <p style={{ color: "#bfdbfe", margin: 0 }}>Spectators can watch seat and pick counts, but not hidden packs.</p>
          ) : myPool.length === 0 ? (
            <p style={{ color: "#bfdbfe", margin: 0 }}>No drafted cards yet.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8, maxHeight: 320, overflowY: "auto" }}>
              {myPool.map((card) => <DraftCardTile key={card.draftCopyId} card={card} actionLabel={selectedIds.has(card.draftCopyId) ? "Deck" : "Pool"} />)}
            </div>
          )}
        </MenuCard>
      </div>
    </div>
  );
}

function LeaderboardPanel({ leaderboard, error }) {
  return (
    <MenuCard title="Leaderboard">
      {error && <div style={{ color: "#fca5a5", fontSize: 13 }}>{error}</div>}
      {!error && leaderboard.length === 0 && <p style={{ margin: 0, color: "#bfdbfe" }}>No completed account games yet.</p>}
      {leaderboard.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "#facc15", textAlign: "left", borderBottom: "1px solid rgba(125, 211, 252, 0.28)" }}>
                <th style={{ padding: "6px 4px" }}>Player</th>
                <th style={{ padding: "6px 4px", textAlign: "right" }}>W</th>
                <th style={{ padding: "6px 4px", textAlign: "right" }}>L</th>
                <th style={{ padding: "6px 4px", textAlign: "right" }}>Rate</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.slice(0, 8).map((entry, index) => (
                <tr key={entry.name} style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.16)" }}>
                  <td style={{ padding: "6px 4px" }}>{index + 1}. {entry.name}</td>
                  <td style={{ padding: "6px 4px", textAlign: "right" }}>{entry.wins}</td>
                  <td style={{ padding: "6px 4px", textAlign: "right" }}>{entry.losses}</td>
                  <td style={{ padding: "6px 4px", textAlign: "right" }}>{entry.winRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </MenuCard>
  );
}

function MatchmakingPanel({
  account,
  status,
  onJoin,
  onLeave,
  title = "Matchmaking",
  description = "Find an account opponent with a similar win/loss ratio.",
  joinLabel = "Find Match",
  cancelLabel = "Cancel Search",
  signedOutText = "Sign in to use ranked matchmaking.",
  extraActions = null
}) {
  return (
    <MenuCard title={title}>
      <p style={{ marginTop: 0, color: "#bfdbfe" }}>{description}</p>
      {status.message && <div style={{ color: status.inQueue ? "#fde68a" : "#bfdbfe", fontSize: 13, marginBottom: 10 }}>{status.message}</div>}
      {status.inQueue ? (
        <MenuButton variant="secondary" onClick={onLeave}>{cancelLabel}</MenuButton>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <MenuButton onClick={onJoin} disabled={!account}>{joinLabel}</MenuButton>
          {extraActions}
        </div>
      )}
      {!account && <p style={{ color: "#bfdbfe", fontSize: 13 }}>{signedOutText}</p>}
    </MenuCard>
  );
}

function FriendsPanel({
  account,
  friendsData,
  selectedFriendId,
  friendName,
  messageText,
  error,
  onSelectFriend,
  onFriendNameChange,
  onMessageTextChange,
  onAddFriend,
  onRemoveFriend,
  onSendMessage,
  onRefresh,
  unreadCounts = {},
  unreadTotal = 0
}) {
  if (!account) {
    return (
      <MenuCard title="Friends">
        <p style={{ margin: 0, color: "#bfdbfe" }}>Sign in to add friends and send messages.</p>
      </MenuCard>
    );
  }

  const friends = friendsData.friends || [];
  const messages = friendsData.messages || [];
  const selectedFriend = friends.find((friend) => friend.id === selectedFriendId) || null;
  const selectedMessages = selectedFriend
    ? messages.filter((message) => message.fromId === selectedFriend.id || message.toId === selectedFriend.id)
    : [];

  return (
    <MenuCard title={unreadTotal > 0 ? `Friends (${unreadTotal} new)` : "Friends"}>
      {error && <div style={{ color: "#fca5a5", fontSize: 13, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input value={friendName} onChange={(e) => onFriendNameChange(e.target.value)} placeholder="Friend account name" style={{ ...MENU_THEME.input, flex: "1 1 190px" }} />
        <MenuButton onClick={onAddFriend}>Add</MenuButton>
        <MenuButton variant="secondary" onClick={onRefresh}>Refresh</MenuButton>
      </div>
      {friends.length === 0 ? (
        <p style={{ color: "#bfdbfe", margin: 0 }}>No friends yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {friends.map((friend) => {
            const expanded = selectedFriend?.id === friend.id;
            const unreadCount = unreadCounts[friend.id] || 0;
            return (
              <div key={friend.id} style={{ border: expanded ? "1px solid #f59e0b" : "1px solid rgba(125,211,252,0.35)", borderRadius: 6, background: expanded ? "rgba(245,158,11,0.14)" : "rgba(15,23,42,0.64)", overflow: "hidden" }}>
                <button onClick={() => onSelectFriend(expanded ? "" : friend.id)} style={{ width: "100%", textAlign: "left", padding: 8, border: 0, background: "transparent", color: "#dbeafe", cursor: "pointer", display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong>{friend.name}</strong>
                  <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                    {unreadCount > 0 && <span style={{ color: "#0f172a", background: "#facc15", borderRadius: 999, padding: "2px 7px", fontWeight: "bold", fontSize: 12 }}>{unreadCount}</span>}
                    <span>{expanded ? "Close" : "Open"}</span>
                  </span>
                </button>
                {expanded && (
                  <div style={{ padding: 8, borderTop: "1px solid rgba(125,211,252,0.25)", background: "rgba(2,6,23,0.34)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 8 }}>
                      <strong>{friend.name}</strong>
                      <button onClick={() => onRemoveFriend(friend.id)} style={{ padding: "5px 8px", color: "#fecaca", background: "#7f1d1d", border: "1px solid #ef4444", borderRadius: 4, cursor: "pointer" }}>Remove</button>
                    </div>
                    <div style={{ height: 130, overflowY: "auto", border: "1px solid rgba(125,211,252,0.28)", borderRadius: 6, padding: 8, marginBottom: 8, background: "rgba(2,6,23,0.42)" }}>
                      {selectedMessages.length === 0 && <p style={{ margin: 0, color: "#93c5fd" }}>No messages yet.</p>}
                      {selectedMessages.map((message) => (
                        <div key={message.id} style={{ marginBottom: 8, textAlign: message.fromId === account.id ? "right" : "left" }}>
                          <div style={{ display: "inline-block", maxWidth: "88%", padding: "6px 8px", borderRadius: 6, background: message.fromId === account.id ? "rgba(245,158,11,0.22)" : "rgba(59,130,246,0.18)", color: "#f8fafc" }}>
                            <div style={{ fontSize: 11, color: "#bfdbfe", marginBottom: 2 }}>{message.fromName}</div>
                            <div>{message.text}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input value={messageText} onChange={(e) => onMessageTextChange(e.target.value)} placeholder="Message" maxLength={500} style={{ ...MENU_THEME.input, flex: 1 }} />
                      <MenuButton onClick={() => onSendMessage(friend.id)}>Send</MenuButton>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </MenuCard>
  );
}

function StatusPill({ label, value, bg = "#f3f4f6" }) {
  const lightSurface = bg === "white" || bg === "#fff" || bg === "#f3f4f6";
  return (
    <div style={{ padding: "7px 9px", borderRadius: 6, background: lightSurface ? "linear-gradient(180deg, rgba(255, 246, 224, 0.96), rgba(218, 183, 134, 0.92))" : bg, border: "1px solid rgba(205,154,86,0.34)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)" }}>
      <div style={{ fontSize: 11, color: lightSurface ? "#6b3f17" : TABLETOP_THEME.muted }}>{label}</div>
      <div style={{ fontWeight: "bold", marginTop: 2, fontSize: 13, color: lightSurface ? "#1f130a" : TABLETOP_THEME.text }}>{value}</div>
    </div>
  );
}

function HelperText({ enabled, children }) {
  if (!enabled || !children) return null;
  return <div className="helper-text" style={{ marginTop: 5, color: "#475569", fontSize: 12, lineHeight: 1.3 }}>{children}</div>;
}

function HelperToggle({ enabled, onToggle, light = false }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title="Toggle helper labels"
      style={{
        border: `1px solid ${enabled ? "#facc15" : light ? "rgba(255,255,255,0.3)" : "#94a3b8"}`,
        borderRadius: 7,
        background: enabled ? "#facc15" : light ? "rgba(15,23,42,0.72)" : "#fff",
        color: enabled ? "#111827" : light ? "#e5e7eb" : "#334155",
        padding: "6px 9px",
        fontSize: 12,
        fontWeight: 800,
        cursor: "pointer"
      }}
    >
      Hints {enabled ? "On" : "Off"}
    </button>
  );
}

function QuickActionButton({ children, className = "", disabled = false, reason = "", title = "", ...props }) {
  const helpTitle = disabled && reason ? reason : title;
  return (
    <button
      {...props}
      className={`quick-action-button ${className}`.trim()}
      disabled={disabled}
      title={helpTitle}
      aria-label={helpTitle ? `${children}: ${helpTitle}` : undefined}
    >
      {children}
    </button>
  );
}

function LobbySeatGrid({ lobby }) {
  const playerNumbers = Object.keys(lobby?.players || {}).map(Number).sort((a, b) => a - b);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
      {playerNumbers.map((playerNum) => {
        const seat = lobby.players[playerNum];
        const faction = (lobby.factions || []).find((entry) => entry.id === seat.factionId);
        const theme = getFactionTheme(seat.factionId);
        const occupied = !!seat.connected || !!seat.accountName;
        return (
          <div key={playerNum} style={{ border: `2px solid ${occupied ? theme.border : "rgba(148,163,184,0.45)"}`, borderRadius: 8, padding: 10, background: occupied ? "rgba(255,255,255,0.94)" : "rgba(15,23,42,0.28)", color: occupied ? "#111827" : "#bfdbfe", minHeight: 96 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <strong style={{ color: occupied ? theme.primary : "#e5e7eb" }}>Seat {playerNum}</strong>
              <span style={{ fontSize: 11, fontWeight: "bold", color: seat.connected ? "#166534" : "#991b1b" }}>{seat.connected ? "Connected" : "Open"}</span>
            </div>
            <div style={{ marginTop: 8, fontWeight: "bold" }}>{seat.accountName || "Waiting for player"}</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>{faction?.name || (lobby.gameMode === "basic" ? "Basic Gauntlet" : "No faction selected")}</div>
            <div style={{ fontSize: 12, marginTop: 4, color: seat.readyToStart ? "#166534" : occupied ? "#92400e" : "#94a3b8" }}>{seat.readyToStart ? "Ready" : occupied ? "Not ready" : "Empty"}</div>
          </div>
        );
      })}
    </div>
  );
}

function getCombatSummaries(game) {
  const hand = (game.handAttacks || []).map((attack) => ({
    id: attack.id,
    laneLabel: "Hand",
    attacker: attack.player,
    defender: attack.targetPlayer || (attack.player === 1 ? 2 : 1),
    card: attack.card,
    attackValue: attack.effectiveValue || 0,
    blockValue: (attack.block || []).reduce((sum, block) => sum + (block.effectiveValue || 0), 0),
    payment: attack.payment || null,
    blocks: attack.block || []
  }));
  const lanes = (game.lanes || [])
    .map((lane, laneIndex) => lane.attack ? ({
      id: lane.attack.id || `lane-${laneIndex}`,
      laneLabel: `Lane ${laneIndex + 1}`,
      attacker: lane.attack.player,
      defender: lane.attack.targetPlayer || (lane.attack.player === 1 ? 2 : 1),
      card: lane.attack.card,
      attackValue: lane.attack.effectiveValue || 0,
      blockValue: (lane.block || []).reduce((sum, block) => sum + (block.effectiveValue || 0), 0),
      payment: lane.attack.payment || null,
      blocks: lane.block || []
    }) : null)
    .filter(Boolean);
  return [...hand, ...lanes].map((summary) => ({ ...summary, projectedDamage: Math.max(0, summary.attackValue - summary.blockValue) }));
}

function formatCombatCards(cards) {
  if (!Array.isArray(cards) || cards.length === 0) return "none";
  return cards.map(getCardShortLabel).join(", ");
}

function CombatStrip({ game }) {
  const summaries = getCombatSummaries(game);
  if (summaries.length === 0) return null;

  return (
    <div style={{ border: "2px solid #f59e0b", borderRadius: 8, background: "rgba(15,23,42,0.92)", color: "#f8fafc", padding: 8, display: "grid", gap: 8 }}>
      {summaries.map((summary) => (
        <div key={summary.id} style={{ display: "grid", gap: 5, fontSize: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(68px, auto) 1fr repeat(3, auto)", gap: 8, alignItems: "center" }}>
            <strong style={{ color: "#facc15" }}>{summary.laneLabel}</strong>
            <span>P{summary.attacker}{" -> "}P{summary.defender}: <strong>{getCardShortLabel(summary.card)}</strong></span>
            <span>ATK {summary.attackValue}</span>
            <span>BLK {summary.blockValue}</span>
            <strong style={{ color: summary.projectedDamage > 0 ? "#fecaca" : "#bbf7d0" }}>DMG {summary.projectedDamage}</strong>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 6, color: "#cbd5e1" }}>
            <span>Attack paid: {summary.payment ? `${summary.payment.total}/${summary.payment.required} with ${formatCombatCards(summary.payment.cards)}` : "none"}</span>
            <span>Blocks: {summary.blocks.length > 0 ? summary.blocks.map((block) => `P${block.player} ${getCardShortLabel(block.card)}${block.payment ? ` paid ${block.payment.total}/${block.payment.required}` : ""}`).join("; ") : "none"}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function CampaignDialogueBlock({ title = "Dialogue", lines = [], audio = [], compact = false, light = false, autoPlayKey = "" }) {
  const dialogueAudioRefs = useRef([]);
  const autoPlayedRef = useRef("");
  const visibleLines = (Array.isArray(lines) ? lines : []).filter(Boolean);
  const audioLines = Array.isArray(audio) ? audio : [];
  const audioKey = audioLines.filter(Boolean).join("\n");
  const stopDialogueAudio = () => {
    dialogueAudioRefs.current.forEach((clip) => {
      if (!clip) return;
      clip.pause();
      clip.currentTime = 0;
    });
  };
  const playDialogueAudio = (index) => {
    const source = audioLines[index];
    if (!source || typeof window === "undefined" || typeof window.Audio !== "function") return;
    stopDialogueAudio();
    const clip = new window.Audio(resolveAssetPath(source));
    clip.volume = 1;
    dialogueAudioRefs.current[index] = clip;
    clip.play().catch(() => {});
  };

  useEffect(() => () => {
    dialogueAudioRefs.current.forEach((clip) => {
      if (!clip) return;
      clip.pause();
      clip.currentTime = 0;
    });
  }, []);

  useEffect(() => {
    const sources = audioKey.split("\n").filter(Boolean);
    if (!autoPlayKey || sources.length === 0 || autoPlayedRef.current === autoPlayKey) return undefined;
    autoPlayedRef.current = autoPlayKey;
    let cancelled = false;
    let currentIndex = 0;
    let activeClip = null;
    let gestureArmed = false;
    const removeGestureListeners = () => {
      if (!gestureArmed || typeof window === "undefined") return;
      gestureArmed = false;
      window.removeEventListener("pointerdown", playNext, true);
      window.removeEventListener("keydown", playNext, true);
    };
    const armGestureRetry = () => {
      if (gestureArmed || typeof window === "undefined") return;
      gestureArmed = true;
      window.addEventListener("pointerdown", playNext, true);
      window.addEventListener("keydown", playNext, true);
    };
    const playNext = () => {
      removeGestureListeners();
      if (cancelled || currentIndex >= sources.length || typeof window === "undefined" || typeof window.Audio !== "function") return;
      const source = sources[currentIndex];
      if (!source) {
        currentIndex += 1;
        playNext();
        return;
      }
      stopDialogueAudio();
      activeClip = new window.Audio(resolveAssetPath(source));
      activeClip.volume = 1;
      dialogueAudioRefs.current[currentIndex] = activeClip;
      activeClip.onended = () => {
        currentIndex += 1;
        playNext();
      };
      activeClip.play().catch(armGestureRetry);
    };
    const timer = window.setTimeout(playNext, 50);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      removeGestureListeners();
      if (activeClip) activeClip.onended = null;
    };
  }, [autoPlayKey, audioKey]);

  if (visibleLines.length === 0) return null;

  return (
    <div
      style={{
        marginTop: compact ? 6 : 12,
        padding: compact ? "6px 8px" : 12,
        borderRadius: compact ? 6 : 10,
        background: light ? "rgba(255,255,255,0.58)" : "rgba(15,23,42,0.3)",
        border: light ? "1px solid rgba(42,22,11,0.22)" : "1px solid rgba(250,204,21,0.22)",
        textAlign: "left",
        color: light ? "#2f1c10" : "#f8fafc",
        lineHeight: 1.35
      }}
    >
      <div style={{ fontSize: compact ? 10 : 12, textTransform: "uppercase", letterSpacing: 1, color: light ? "#8a4b16" : "#facc15", fontWeight: "bold", marginBottom: compact ? 4 : 8 }}>
        {title}
      </div>
      <div style={{ display: "grid", gap: compact ? 3 : 6, fontSize: compact ? 11 : 14 }}>
        {visibleLines.map((line, index) => {
          const text = String(line);
          const separatorIndex = text.indexOf(":");
          const speaker = separatorIndex > 0 ? text.slice(0, separatorIndex).trim() : "Narrator";
          const spoken = separatorIndex > 0 ? text.slice(separatorIndex + 1).trim() : text;
          const hasAudio = Boolean(audioLines[index]);
          return (
            <div key={`${speaker}-${index}`} style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {hasAudio && (
                <button
                  type="button"
                  onClick={() => playDialogueAudio(index)}
                  title={`Play ${speaker} voice`}
                  style={{
                    border: "1px solid rgba(250,204,21,0.42)",
                    borderRadius: 4,
                    padding: compact ? "1px 5px" : "2px 7px",
                    background: light ? "rgba(255,247,237,0.86)" : "rgba(42,22,11,0.72)",
                    color: light ? "#7c2d12" : "#fde68a",
                    fontWeight: "bold",
                    cursor: "pointer",
                    fontSize: compact ? 10 : 12
                  }}
                >
                  Play Voice
                </button>
              )}
              <span>
                <strong style={{ color: light ? "#7c2d12" : "#fde68a" }}>{speaker}:</strong>{" "}
                <span>{spoken}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function roomJoinUrl(code) {
  const baseUrl = PUBLIC_GAME_URL.replace(/\/$/, "");
  return code ? `${baseUrl}?join=${encodeURIComponent(code)}` : baseUrl;
}

function RoomCodeDisplay({ code, roleLabel, onCopy, color = "#555" }) {
  if (!code) return null;

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", color }}>
      <span>Room</span>
      <input
        readOnly
        value={code}
        aria-label="Room code"
        onFocus={(event) => event.target.select()}
        style={{
          width: 78,
          padding: "3px 6px",
          border: "1px solid currentColor",
          borderRadius: 6,
          background: "rgba(255,255,255,0.7)",
          color: "inherit",
          fontWeight: "bold",
          fontSize: 13,
          textAlign: "center"
        }}
      />
      <button
        type="button"
        onClick={() => onCopy(code, "code")}
        style={{
          border: "1px solid currentColor",
          borderRadius: 6,
          background: "transparent",
          color: "inherit",
          padding: "3px 8px",
          fontSize: 12,
          fontWeight: "bold",
          cursor: "pointer"
        }}
      >
        Copy
      </button>
      <button
        type="button"
        onClick={() => onCopy(code, "link")}
        style={{
          border: "1px solid currentColor",
          borderRadius: 6,
          background: "transparent",
          color: "inherit",
          padding: "3px 8px",
          fontSize: 12,
          fontWeight: "bold",
          cursor: "pointer"
        }}
      >
        Copy Link
      </button>
      <span>| {roleLabel}</span>
    </div>
  );
}

function ShareGameQrCard() {
  const [copied, setCopied] = useState(false);
  const gameUrl = PUBLIC_GAME_URL.replace(/\/$/, "");
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(gameUrl)}`;

  async function copyGameUrl() {
    try {
      await navigator.clipboard.writeText(gameUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <MenuCard title="Share Game">
      <div style={{ display: "grid", gridTemplateColumns: "96px minmax(0, 1fr)", gap: 12, alignItems: "center" }}>
        <a href={gameUrl} target="_blank" rel="noreferrer" aria-label="Open Gauntlet Online">
          <img
            src={qrUrl}
            alt="QR code for Gauntlet Online"
            width="96"
            height="96"
            style={{ display: "block", width: 96, height: 96, borderRadius: 8, border: "2px solid rgba(125,211,252,0.5)", background: "#fff", padding: 4 }}
          />
        </a>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: "0 0 8px", color: "#bfdbfe", fontSize: 13 }}>Scan to open Gauntlet Online on another device.</p>
          <input
            readOnly
            value={gameUrl}
            aria-label="Gauntlet Online site link"
            onFocus={(event) => event.target.select()}
            style={{ ...MENU_THEME.input, width: "100%", boxSizing: "border-box", marginBottom: 8, fontSize: 12 }}
          />
          <MenuButton variant="secondary" onClick={copyGameUrl}>{copied ? "Copied" : "Copy Link"}</MenuButton>
        </div>
      </div>
    </MenuCard>
  );
}

function FactionFeature({ title, feature, theme }) {
  if (!feature) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "78px minmax(0, 1fr)", gap: 10, alignItems: "start", marginBottom: 12 }}>
      {feature?.image ? (
        <img src={resolveAssetPath(feature.image)} alt="" style={{ width: 78, height: 78, objectFit: "cover", borderRadius: 10, border: `2px solid ${theme.border}` }} />
      ) : (
        <div style={{ width: 78, height: 78, borderRadius: 10, border: `2px solid ${theme.border}`, background: theme.light }} />
      )}
      <div>
        <p style={{ margin: "0 0 4px 0" }}><strong>{title}:</strong> {feature.name}</p>
        <p style={{ color: "#555", margin: 0 }}>{feature.text}</p>
      </div>
    </div>
  );
}

function CompactPowerCard({ title, feature, theme, expanded, onToggle }) {
  return (
    <button
      className={`compact-power-card${expanded ? " compact-power-card-active" : ""}`}
      onClick={onToggle}
      style={{
        display: "grid",
        gridTemplateColumns: "62px minmax(0, 1fr)",
        gap: 10,
        alignItems: "stretch",
        textAlign: "left",
        padding: 7,
        border: `2px solid ${expanded ? theme.primary : theme.border}`,
        borderRadius: 10,
        background: expanded
          ? `linear-gradient(135deg, ${theme.primary}33, rgba(255,247,220,0.96))`
          : "linear-gradient(135deg, rgba(255,247,220,0.96), rgba(93,58,29,0.2))",
        cursor: "pointer",
        minWidth: 0,
        boxShadow: expanded ? `0 0 18px ${theme.primary}55, inset 0 0 0 1px rgba(255,255,255,0.28)` : undefined
      }}
    >
      <span className="compact-power-portrait" style={{ borderColor: theme.border }}>
        {feature?.image && <img src={resolveAssetPath(feature.image)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
      </span>
      <span style={{ minWidth: 0, alignSelf: "center" }}>
        <span style={{ display: "block", fontSize: 10, color: theme.primary, fontWeight: "bold", textTransform: "uppercase" }}>{title}</span>
        <span style={{ display: "block", fontSize: 14, fontWeight: "bold", color: "#29170d", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{feature?.name || "None"}</span>
      </span>
    </button>
  );
}

function LaneCardLabel({ label, card, hidden = false }) {
  return (
    <div className="lane-card-line" style={{ color: hidden ? "#f9fafb" : TABLETOP_THEME.text }}>
      <span>{label}</span>
      <strong>{hidden ? "Face-down" : card ? `${getCardShortLabel(card)}${card.tempBuff ? ` (+${card.tempBuff})` : ""}` : "None"}</strong>
    </div>
  );
}

function SmallCardToken({ card }) {
  const suitColor = isRedSuit(card?.suit) ? "#b91c1c" : "#111827";
  return (
    <div title={card?.name || getCardShortLabel(card)} style={{ width: 42, minHeight: 56, border: "1px solid rgba(82,50,26,0.62)", borderRadius: 5, background: "linear-gradient(180deg, #f8ecd5, #d6b386)", padding: 4, display: "grid", alignContent: "space-between", boxShadow: "0 4px 10px rgba(0,0,0,0.28), inset 0 0 0 1px rgba(255,255,255,0.35)" }}>
      <strong style={{ color: suitColor, fontSize: 14 }}>{getCardRank(card)}</strong>
      <span style={{ color: suitColor, fontSize: 18, lineHeight: 1, textAlign: "center" }}>{getSuitSymbol(card?.suit)}</span>
      <span style={{ fontSize: 8, color: "#475569", textAlign: "right" }}>{getCardNumericValue(card)}</span>
    </div>
  );
}

function PlayerInfoBox({ game, playerNum, perspectivePlayer, position = "top" }) {
  const infoPlayer = game.players?.[playerNum];
  if (!infoPlayer) return null;
  const theme = getFactionTheme(infoPlayer.faction?.id);
  const isSelf = playerNum === perspectivePlayer;
  const handCount = isSelf ? infoPlayer.hand?.length ?? 0 : infoPlayer.handCount ?? infoPlayer.hand?.length ?? 0;
  const connectionColor = infoPlayer.connected ? "#86efac" : "#fca5a5";
  const ccgText = infoPlayer.faction?.commander
    ? `${infoPlayer.faction.commander.name} / ${infoPlayer.faction.city?.name || "City"} / ${infoPlayer.faction.general?.name || "General"}`
    : infoPlayer.faction?.name || "Basic";

  return (
    <div
      className={`player-frame player-frame-${position}${isSelf ? " player-frame-self" : ""}`}
      style={{
        borderColor: theme.border,
        background: `linear-gradient(180deg, rgba(16,10,7,0.9), rgba(8,5,3,0.86)), linear-gradient(90deg, ${theme.primary}44, transparent)`,
        color: TABLETOP_THEME.text
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
          <strong style={{ color: "#f7d99e", fontSize: 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getGamePlayerName(game, playerNum)}</strong>
          <span style={{ color: TABLETOP_THEME.muted, fontSize: 12 }}>P{playerNum}</span>
        </div>
        <div style={{ color: connectionColor, fontSize: 12, marginTop: 2 }}>{infoPlayer.connected ? "Connected" : "Disconnected"}</div>
      </div>
      <div className="player-frame-stats">
        <span title="Life total"><span className="player-stat-icon">♥</span>{infoPlayer.life}</span>
        <span title="Cards in hand"><span className="player-stat-icon">▰</span>{handCount}</span>
        <span title={`CCG: ${ccgText}`}><span className="player-stat-icon">◆</span>{ccgText}</span>
      </div>
    </div>
  );
}

function PlayerFrameRow({ game, player, placement = "opponents" }) {
  const playerNumbers = Object.keys(game.players || {}).map(Number).sort((a, b) => a - b);
  const shownPlayers = placement === "self"
    ? playerNumbers.filter((p) => p === player)
    : playerNumbers.filter((p) => p !== player);
  const position = placement === "self" ? "bottom" : "top";

  return (
    <div className={`player-frame-row player-frame-row-${position}`}>
      {shownPlayers.map((p) => <PlayerInfoBox key={p} game={game} playerNum={p} perspectivePlayer={player} position={position} />)}
    </div>
  );
}

function OpponentIntelPanel({ game, player, showAbilities, onToggleAbilities }) {
  const opponentNumbers = Object.keys(game.players || {}).map(Number).filter((p) => p !== player).sort((a, b) => a - b);
  if (opponentNumbers.length === 0) return null;
  return (
    <SectionCard className="opponent-intel" borderColor="#334155" background="rgba(255,255,255,0.94)" style={{ padding: 8, marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>Opponent Abilities</h3>
        <button onClick={onToggleAbilities} style={{ padding: "4px 8px", fontSize: 12 }}>{showAbilities ? "Hide Abilities" : "Show Abilities"}</button>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {opponentNumbers.map((p) => {
          const opponent = game.players[p];
          const theme = getFactionTheme(opponent.faction.id);
          return (
            <div key={p} style={{ border: `1px solid ${theme.border}`, borderRadius: 8, background: theme.light, padding: 8, textAlign: "center" }}>
              <strong style={{ color: theme.primary, display: "block", marginBottom: showAbilities ? 8 : 0 }}>{opponent.accountName || opponent.faction?.name || `Player ${p}`}</strong>
              {showAbilities && (
                <div className="opponent-ability-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(132px, 1fr))", gap: 6, fontSize: 12, alignItems: "stretch" }}>
                  {["commander", "city", "general"].map((key) => opponent.faction?.[key] && (
                    <div key={key} style={{ border: `1px solid ${theme.border}`, borderRadius: 7, padding: 8, background: "rgba(255,255,255,0.72)", display: "grid", alignContent: "start", justifyItems: "center", textAlign: "center", minHeight: 92 }}>
                      {opponent.faction[key].image && (
                        <img src={opponent.faction[key].image} alt="" style={{ width: 34, height: 34, borderRadius: 5, objectFit: "cover", marginBottom: 5, border: `1px solid ${theme.border}` }} />
                      )}
                      <span style={{ color: "#6b7280", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.6 }}>{key}</span>
                      <strong style={{ color: theme.primary, display: "block", lineHeight: 1.15 }}>{opponent.faction[key].name}</strong>
                      <div style={{ color: "#475569", marginTop: 4, lineHeight: 1.25 }}>{opponent.faction[key].text}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

function PaymentLogPanel({ game }) {
  const entries = (game.paymentLog || []).slice().reverse();
  if (entries.length === 0) return null;
  return (
    <div className="payment-log-panel" style={{ marginTop: 10, border: `1px solid ${TABLETOP_THEME.goldSoft}`, borderRadius: 6, background: "rgba(12,8,5,0.72)", padding: 8, minHeight: 0, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)" }}>
      <h3 style={{ margin: "0 0 6px 0", fontSize: 14, color: TABLETOP_THEME.text }}>Payments & Reveals</h3>
      <div className="payment-log-list" style={{ display: "grid", gap: 6, maxHeight: "min(20dvh, 190px)", overflowY: "auto", paddingRight: 4 }}>
        {entries.map((entry) => (
          <div key={entry.id} style={{ borderTop: `1px solid ${TABLETOP_THEME.goldSoft}`, paddingTop: 6, fontSize: 12, color: TABLETOP_THEME.text }}>
            <strong>P{entry.player}</strong> {entry.label}
            {entry.cards?.length > 0 && <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>{entry.cards.map((card, idx) => <SmallCardToken key={card.id || idx} card={card} />)}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function getGamePlayerName(game, playerNum) {
  const name = game?.players?.[playerNum]?.accountName;
  return name || `Player ${playerNum}`;
}

function FactionChoiceCard({ faction, selected, onSelect }) {
  const theme = getFactionTheme(faction.id);

  return (
    <div style={{ border: selected ? `3px solid ${theme.primary}` : "1px solid rgba(125, 211, 252, 0.38)", borderRadius: 8, padding: 14, background: selected ? theme.light : "rgba(255,255,255,0.94)", color: "#111827" }}>
      <h3 style={{ marginTop: 0, color: theme.primary }}>{faction.name}</h3>
      <FactionFeature title="Commander" feature={faction.commander} theme={theme} />
      <FactionFeature title="City" feature={faction.city} theme={theme} />
      <FactionFeature title="General" feature={faction.general} theme={theme} />
      <button onClick={() => onSelect(faction.id)}>{selected ? "Selected" : "Choose Faction"}</button>
    </div>
  );
}

function RulebookPanel() {
  const ruleSections = [
    {
      title: "Setup",
      rules: [
        "Each player starts at 42 life and draws 8 cards.",
        "A random player starts with priority.",
        "Aces count as value 14."
      ]
    },
    {
      title: "Priority",
      rules: [
        "The player with priority may attack, activate abilities, or pass.",
        "After an attack, the defender gets priority to block or pass.",
        "No new attack can be declared while an attack or damage is unresolved."
      ]
    },
    {
      title: "Attacking",
      rules: [
        "To attack from hand, discard payment cards with total value at least the attacker's value.",
        "A face-down lane card may attack from its lane by paying its value from hand.",
        "After both players pass with pending attacks, damage resolves automatically."
      ]
    },
    {
      title: "Blocking",
      rules: [
        "Hand attacks may be blocked by one or more cards from hand, paid for by cards from hand.",
        "Lane attacks may only be blocked by the defender's face-down card in that same lane.",
        "Damage equals attack effective value minus total block effective value."
      ]
    },
    {
      title: "End Turn",
      rules: [
        "After damage resolves, priority returns to the defender of the most recent attack.",
        "When both players pass with no pending attacks, players place face-down cards lane by lane.",
        "After all lanes are handled, both players draw back up to 8 and priority changes players.",
        "Life totals are checked only at the end of the turn, after lane placement and draw-up are complete."
      ]
    },
    {
      title: "Victory",
      rules: [
        "Players are not eliminated immediately when their life reaches 0 or less during a turn.",
        "At the end of the turn, if either player has 0 or less life, the player with the higher life total wins.",
        "If both players are tied at the end-of-turn life check, the game is a draw."
      ]
    }
  ];

  return (
    <section
      style={{
        marginTop: 22,
        padding: 18,
        border: "2px solid #7c2d12",
        borderRadius: 12,
        background: "linear-gradient(180deg, #fff7ed 0%, #f8e7c9 100%)",
        boxShadow: "0 10px 24px rgba(68, 32, 9, 0.16)",
        color: "#281407",
        fontFamily: "Georgia, 'Times New Roman', serif"
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, borderBottom: "1px solid rgba(124, 45, 18, 0.35)", paddingBottom: 10, marginBottom: 14 }}>
        <h2 style={{ margin: 0, color: "#7c2d12", letterSpacing: 0, fontSize: 28 }}>Field Rulebook</h2>
        <div style={{ fontSize: 13, color: "#854d0e", fontStyle: "italic" }}>Gauntlet Online</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 }}>
        {ruleSections.map((section) => (
          <div key={section.title} style={{ borderLeft: "4px solid #b45309", paddingLeft: 12 }}>
            <h3 style={{ margin: "0 0 8px 0", color: "#431407", fontSize: 18 }}>{section.title}</h3>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.45, fontSize: 14 }}>
              {section.rules.map((rule) => <li key={rule} style={{ marginBottom: 6 }}>{rule}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function TutorialScreen({ onBack, onPlayBasicAi, onPlayFactionAi, canPlayAsPlayer }) {
  const lessons = [
    {
      title: "1. Read Priority",
      text: "Only the player with priority can start an attack, use an available faction ability, or pass. If combat is unresolved, finish blocking and damage before starting another attack."
    },
    {
      title: "2. Attack From Hand",
      text: "Choose Attack from Hand, pick an attacking card, then select payment cards from your hand. Your payment total must be at least the attacker's value."
    },
    {
      title: "3. Defend or Take Damage",
      text: "After an attack, the defender gets priority. Block by selecting blocker cards and enough payment, or pass to move toward damage."
    },
    {
      title: "4. Resolve Damage",
      text: "When both players pass with pending attacks, damage resolves automatically. Damage is the attack value minus block value. Fully blocked attacks deal no damage."
    },
    {
      title: "5. Use Lanes",
      text: "Face-down lane cards are hidden from the opponent. Lane attacks can only be blocked by the defender's face-down card in that same lane."
    },
    {
      title: "6. End the Turn",
      text: "When both players pass with no pending attacks, the game enters end phase. Players place face-down lane cards lane by lane, then draw back up to 8."
    },
    {
      title: "7. Pick a Learning Mode",
      text: "Basic Mode removes faction powers so you can learn the core Gauntlet loop. Faction Mode adds commander, city, and general effects."
    }
  ];

  return (
    <div style={MENU_THEME.page}>
      <div style={MENU_THEME.frame}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, borderBottom: "1px solid rgba(125, 211, 252, 0.28)", paddingBottom: 16, marginBottom: 20 }}>
          <div>
            <div style={{ color: "#f59e0b", fontSize: 12, fontWeight: "bold", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Training Protocol</div>
            <h1 style={{ margin: 0, fontSize: 42, color: "#f8fafc", textShadow: "0 0 18px rgba(56,189,248,0.4)" }}>Learn Gauntlet</h1>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <MenuButton onClick={onPlayBasicAi} disabled={!canPlayAsPlayer}>Play Basic vs AI</MenuButton>
            <MenuButton variant="secondary" onClick={onPlayFactionAi} disabled={!canPlayAsPlayer}>Play Factions vs AI</MenuButton>
            <MenuButton variant="secondary" onClick={onBack}>Main Menu</MenuButton>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {lessons.map((lesson) => (
            <MenuCard key={lesson.title} title={lesson.title}>
              <p style={{ margin: 0, color: "#dbeafe", lineHeight: 1.45 }}>{lesson.text}</p>
            </MenuCard>
          ))}
        </div>
        <div style={{ marginTop: 18, padding: 14, borderRadius: 8, background: "rgba(2,6,23,0.42)", border: "1px solid rgba(125,211,252,0.28)", color: "#bfdbfe" }}>
          Best first game: play Basic Mode against Training AI to practice attack, block, pass, damage, and lanes. Choose Factions vs AI when you want commander, city, and general powers in the same training flow.
          {!canPlayAsPlayer && <div style={{ marginTop: 8, color: "#fecaca" }}>Sign in or enable guest play on the main menu to start the playable tutorial.</div>}
        </div>
      </div>
    </div>
  );
}

function OnboardingPanel({ canPlayAsPlayer, onStartTutorial, onStartBasicAi, onEnableHints, onDismiss }) {
  const steps = [
    { label: "Start here", text: "Learn priority, payment, blocking, and lanes in the tutorial." },
    { label: "Practice safely", text: "Play Basic vs AI before entering multiplayer or faction powers." },
    { label: "Turn on hints", text: "Use helper labels when you want the interface to explain each option." }
  ];

  return (
    <div style={{ position: "relative", overflow: "hidden", border: "1px solid rgba(250,204,21,0.46)", borderRadius: 10, padding: 16, marginBottom: 18, background: "linear-gradient(135deg, rgba(15,23,42,0.92), rgba(69,36,12,0.86)), radial-gradient(circle at 82% 24%, rgba(250,204,21,0.18), transparent 30%)", boxShadow: "0 18px 40px rgba(0,0,0,0.24)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", marginBottom: 12 }}>
        <div>
          <div style={{ color: "#f59e0b", fontSize: 12, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>New Player Route</div>
          <h2 style={{ margin: 0, color: "#f8fafc", fontSize: 28 }}>Learn the game in one guided match</h2>
          <p style={{ margin: "8px 0 0", color: "#bfdbfe", lineHeight: 1.45, maxWidth: 780 }}>
            Gauntlet is easiest to learn by playing a low-pressure Basic AI match first. You can still jump into campaign, draft, or multiplayer whenever you are ready.
          </p>
        </div>
        <button type="button" onClick={onDismiss} style={{ flex: "0 0 auto", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 6, padding: "6px 9px", background: "rgba(2,6,23,0.52)", color: "#dbeafe", fontWeight: 900 }}>Dismiss</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 14 }}>
        {steps.map((step, index) => (
          <div key={step.label} style={{ border: "1px solid rgba(125,211,252,0.22)", borderRadius: 8, padding: 10, background: "rgba(2,6,23,0.34)" }}>
            <strong style={{ display: "block", color: "#fde68a", marginBottom: 4 }}>{index + 1}. {step.label}</strong>
            <span style={{ color: "#dbeafe", fontSize: 13, lineHeight: 1.35 }}>{step.text}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <MenuButton onClick={onStartBasicAi}>Play Basic vs AI</MenuButton>
        <MenuButton variant="secondary" onClick={onStartTutorial}>Open Tutorial</MenuButton>
        <MenuButton variant="secondary" onClick={onEnableHints}>Turn On Hints</MenuButton>
        {!canPlayAsPlayer && <span style={{ color: "#bfdbfe", fontSize: 13 }}>This will use your guest name unless you sign in first.</span>}
      </div>
    </div>
  );
}

function ModeGuidePanel({ accountName, onStartBasicAi, onOpenCampaign, onOpenCollection, onEnableHints, onDismiss }) {
  const modePath = [
    {
      title: "1. Basic vs AI",
      tag: "Best first match",
      text: "Learn priority, payment, blocking, passing, and lane placement without faction text fighting for attention."
    },
    {
      title: "2. Faction Campaign",
      tag: "Learn flavor and powers",
      text: "Pick a faction story once the core loop makes sense. Campaign rewards packs as you clear chapters."
    },
    {
      title: "3. Collection",
      tag: "Build your pool",
      text: "Open earned packs, browse cards, and save a constructed deck when you know which faction you like."
    },
    {
      title: "4. Duel or Matchmaking",
      tag: "Play people",
      text: "Use normal rooms for friends, matchmaking for similar records, and best-of-three when you want a longer set."
    },
    {
      title: "5. Draft",
      tag: "Advanced mode",
      text: "Try bot draft first, then player draft once card choices and one-faction deckbuilding feel natural."
    }
  ];

  return (
    <div style={{ border: "1px solid rgba(125,211,252,0.42)", borderRadius: 10, padding: 16, marginBottom: 18, background: "linear-gradient(135deg, rgba(12,18,32,0.95), rgba(21,44,60,0.88)), radial-gradient(circle at 86% 18%, rgba(56,189,248,0.22), transparent 30%)", boxShadow: "0 18px 42px rgba(0,0,0,0.28)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", marginBottom: 12 }}>
        <div>
          <div style={{ color: "#67e8f9", fontSize: 12, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>First Login Guide</div>
          <h2 style={{ margin: 0, color: "#f8fafc", fontSize: 28 }}>Welcome{accountName ? `, ${accountName}` : ""}. Here is the cleanest path through Gauntlet.</h2>
          <p style={{ margin: "8px 0 0", color: "#bfdbfe", lineHeight: 1.45, maxWidth: 820 }}>
            You do not have to follow this order, but it is the smoothest route from learning the rules to playing real matches.
          </p>
        </div>
        <button type="button" onClick={onDismiss} style={{ flex: "0 0 auto", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 6, padding: "6px 9px", background: "rgba(2,6,23,0.52)", color: "#dbeafe", fontWeight: 900 }}>Got It</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10, marginBottom: 14 }}>
        {modePath.map((mode) => (
          <div key={mode.title} style={{ border: "1px solid rgba(125,211,252,0.2)", borderRadius: 8, padding: 10, background: "rgba(2,6,23,0.34)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline", marginBottom: 5 }}>
              <strong style={{ color: "#f8fafc" }}>{mode.title}</strong>
              <span style={{ color: "#fde68a", fontSize: 10, fontWeight: 900, textTransform: "uppercase" }}>{mode.tag}</span>
            </div>
            <div style={{ color: "#dbeafe", fontSize: 13, lineHeight: 1.35 }}>{mode.text}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <MenuButton onClick={onStartBasicAi}>Start Basic vs AI</MenuButton>
        <MenuButton variant="secondary" onClick={onOpenCampaign}>Open Campaign</MenuButton>
        <MenuButton variant="secondary" onClick={onOpenCollection}>Open Collection</MenuButton>
        <MenuButton variant="secondary" onClick={onEnableHints}>Turn On Hints</MenuButton>
      </div>
    </div>
  );
}

function CampaignScreen({ onBack, onStartChapter, canPlayAsPlayer, account }) {
  const campaignProgress = account?.progression?.campaign || {};

  return (
    <div style={MENU_THEME.page}>
      <div style={MENU_THEME.frame}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, borderBottom: "1px solid rgba(125, 211, 252, 0.28)", paddingBottom: 16, marginBottom: 20 }}>
          <div>
            <div style={{ color: "#f59e0b", fontSize: 12, fontWeight: "bold", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Commander Archives</div>
            <h1 style={{ margin: 0, fontSize: 42, color: "#f8fafc", textShadow: "0 0 18px rgba(56,189,248,0.4)" }}>Faction Campaigns</h1>
          </div>
          <MenuButton variant="secondary" onClick={onBack}>Main Menu</MenuButton>
        </div>
        {!canPlayAsPlayer && <div style={{ marginBottom: 14, color: "#fecaca" }}>Sign in or enable guest play on the main menu to start a campaign battle.</div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {Object.entries(CAMPAIGN_CHAPTERS).map(([factionId, campaign]) => {
            const theme = getFactionTheme(factionId);
            const completedChapters = Array.isArray(campaignProgress[factionId]) ? campaignProgress[factionId] : [];
            return (
              <MenuCard key={factionId} title={`${campaign.factionName}: ${campaign.commanderName}`}>
                <p style={{ marginTop: 0, color: "#bfdbfe", lineHeight: 1.45 }}>{campaign.pitch}</p>
                <div style={{ display: "grid", gap: 10 }}>
                  {campaign.chapters.map((chapter, index) => (
                    (() => {
                      const difficulty = getCampaignDifficulty(factionId, index);
                      const narration = getCampaignNarration(chapter.id);
                      const complexity = getCampaignComplexityPreview(factionId, index, chapter.opponentName);
                      const unlocked = index === 0 || completedChapters.includes(campaign.chapters[index - 1]?.id);
                      const completed = completedChapters.includes(chapter.id);
                      return (
                        <div key={chapter.id} style={{ padding: 10, borderRadius: 8, border: `1px solid ${unlocked ? theme.primary : "rgba(148,163,184,0.26)"}`, background: unlocked ? "rgba(2,6,23,0.36)" : "rgba(15,23,42,0.44)", opacity: unlocked ? 1 : 0.72 }}>
                          <div style={{ color: completed ? "#86efac" : "#facc15", fontSize: 12, fontWeight: "bold", textTransform: "uppercase" }}>Chapter {index + 1}{completed ? " - Cleared" : unlocked ? " - Pack Reward" : " - Locked"}</div>
                          <h3 style={{ margin: "3px 0", color: "#f8fafc" }}>{chapter.title}</h3>
                          {chapter.playableName && <div style={{ color: "#bfdbfe", fontSize: 12, marginBottom: 4 }}>Playable: {chapter.playableName}</div>}
                          <div style={{ color: theme.light, fontSize: 13, fontWeight: "bold", marginBottom: 6 }}>Opponent: {chapter.opponentName}</div>
                          <div style={{ color: "#fde68a", fontSize: 12, marginBottom: 6 }}>Boss: {difficulty.bossLife} life, {difficulty.attacksPerTurn} attacks/turn, values {difficulty.minAttackValue}-{difficulty.maxAttackValue}</div>
                          {complexity.length > 0 && (
                            <div style={{ margin: "0 0 8px 0", padding: 8, borderRadius: 6, background: "rgba(2,6,23,0.38)", border: "1px solid rgba(125,211,252,0.18)", color: "#bfdbfe", fontSize: 12, lineHeight: 1.35 }}>
                              <strong style={{ color: "#fde68a" }}>Advanced rules:</strong> {complexity.join(" ")}
                            </div>
                          )}
                          <p style={{ margin: "0 0 10px 0", color: "#dbeafe", lineHeight: 1.4 }}>{chapter.story}</p>
                          {narration.beforeBattle && (
                            <div style={{ margin: "0 0 8px 0", padding: 8, borderRadius: 6, background: "rgba(15,23,42,0.58)", border: "1px solid rgba(253,230,138,0.2)", color: "#fde68a", fontSize: 12, lineHeight: 1.35 }}>
                              <strong>Before Battle:</strong> {narration.beforeBattle}
                            </div>
                          )}
                          {narration.afterBattle && (
                            <div style={{ margin: "0 0 10px 0", padding: 8, borderRadius: 6, background: "rgba(15,23,42,0.44)", border: "1px solid rgba(125,211,252,0.18)", color: "#bfdbfe", fontSize: 12, lineHeight: 1.35 }}>
                              <strong>After Battle:</strong> {narration.afterBattle}
                            </div>
                          )}
                          {chapter.dialogue?.length > 0 && <div style={{ margin: "0 0 10px 0", color: "#e0f2fe", fontSize: 12, display: "grid", gap: 3 }}>{chapter.dialogue.slice(0, 3).map((line) => <div key={line}>{line}</div>)}</div>}
                          <MenuButton onClick={() => onStartChapter(factionId, chapter.id)} disabled={!canPlayAsPlayer || !unlocked}>{unlocked ? "Begin Battle" : `Clear Chapter ${index} First`}</MenuButton>
                        </div>
                      );
                    })()
                  ))}
                </div>
              </MenuCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [role, setRole] = useState(null);
  const [player, setPlayer] = useState(null);
  const [game, setGame] = useState(null);
  const [lobby, setLobby] = useState(null);
  const [draftState, setDraftState] = useState(null);
  const [error, setError] = useState("");
  const [peekResult, setPeekResult] = useState("");
  const [useHeraBonus, setUseHeraBonus] = useState(false);
  const [roomCodeInput, setRoomCodeInput] = useState(INITIAL_JOIN_ROOM_CODE);
  const [actionLog, setActionLog] = useState([]);
  const [factionVoice, setFactionVoice] = useState(null);
  const [incomingAttackAlert, setIncomingAttackAlert] = useState(null);
  const [incomingAttackMinimized, setIncomingAttackMinimized] = useState(false);
  const [account, setAccount] = useState(null);
  const [authToken, setAuthToken] = useState(() => localStorage.getItem(STORAGE_KEYS.authToken) || "");
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ name: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [playAsGuest, setPlayAsGuest] = useState(false);
  const [guestName, setGuestName] = useState(() => localStorage.getItem(STORAGE_KEYS.guestName) || "Guest");
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [musicVolume, setMusicVolume] = useState(0.18);
  const [accountSoundMuted, setAccountSoundMuted] = useState(false);
  const [collapsedPanels, setCollapsedPanels] = useState({ powers: false, actions: false, events: false, attacks: true });
  const [supportMessage, setSupportMessage] = useState("");
  const [copyNotice, setCopyNotice] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardError, setLeaderboardError] = useState("");
  const [lastOpenedPack, setLastOpenedPack] = useState([]);
  const [openingPackId, setOpeningPackId] = useState("");
  const [matchmakingStatus, setMatchmakingStatus] = useState({ inQueue: false, message: "" });
  const [draftLeagueStatus, setDraftLeagueStatus] = useState({ inQueue: false, message: "" });
  const [draftPickPending, setDraftPickPending] = useState(false);
  const [draftSaveMessage, setDraftSaveMessage] = useState("");
  const [friendsData, setFriendsData] = useState({ friends: [], messages: [] });
  const [selectedFriendId, setSelectedFriendId] = useState("");
  const [friendNameInput, setFriendNameInput] = useState("");
  const [friendMessageInput, setFriendMessageInput] = useState("");
  const [friendsError, setFriendsError] = useState("");
  const [friendReadAt, setFriendReadAt] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.friendReadAt) || "{}");
    } catch {
      return {};
    }
  });
  const [showTutorial, setShowTutorial] = useState(false);
  const [showCampaign, setShowCampaign] = useState(false);
  const [showCollection, setShowCollection] = useState(false);
  const [showHotkeys, setShowHotkeys] = useState(false);
  const [showHelperLabels, setShowHelperLabels] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => localStorage.getItem(STORAGE_KEYS.onboardingDismissed) !== "true");
  const [showModeGuide, setShowModeGuide] = useState(false);
  const [showOpponentAbilities, setShowOpponentAbilities] = useState(false);
  const [inspectedCard, setInspectedCard] = useState(null);
  const [previewedCard, setPreviewedCard] = useState(null);
  const [showDiscardViewer, setShowDiscardViewer] = useState(false);
  const musicStopRef = useRef(null);
  const musicVolumeRef = useRef(musicVolume);
  const voiceAudioRef = useRef(null);
  const seenIncomingAttackIdsRef = useRef(new Set());
  const hotkeyActionsRef = useRef({});

  const [attackMode, setAttackMode] = useState(null);
  const [blockMode, setBlockMode] = useState(null);
  const [placementMode, setPlacementMode] = useState(null);
  const [abilityMode, setAbilityMode] = useState(null);

  const [selectedAttackCardIndex, setSelectedAttackCardIndex] = useState(null);
  const [selectedBlockCardIndex, setSelectedBlockCardIndex] = useState(null);
  const [selectedBlockCardIndexes, setSelectedBlockCardIndexes] = useState([]);
  const [selectedPlacementCardIndex, setSelectedPlacementCardIndex] = useState(null);
  const [payments, setPayments] = useState([]);
  const [expandedPower, setExpandedPower] = useState("commander");

  useEffect(() => {
    if (!account?.id) {
      setShowModeGuide(false);
      return;
    }
    try {
      const seenByAccount = JSON.parse(localStorage.getItem(STORAGE_KEYS.accountModeGuideSeen) || "{}");
      setShowModeGuide(!seenByAccount[account.id]);
    } catch {
      setShowModeGuide(true);
    }
  }, [account?.id]);

  useEffect(() => {
    function handleGameplayHotkey(event) {
      const tagName = event.target?.tagName?.toLowerCase();
      if (tagName === "input" || tagName === "textarea" || tagName === "select" || event.target?.isContentEditable) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const key = event.key === "?" ? "?" : event.key.toLowerCase();
      if (key === "h" || key === "?") {
        event.preventDefault();
        setShowHotkeys((value) => !value);
        return;
      }

      const action = hotkeyActionsRef.current[key];
      if (action) {
        event.preventDefault();
        action();
      }
    }

    window.addEventListener("keydown", handleGameplayHotkey, true);
    return () => window.removeEventListener("keydown", handleGameplayHotkey, true);
  }, []);

  useEffect(() => {
    if (!factionVoice) return undefined;
    const timer = window.setTimeout(() => setFactionVoice(null), 4500);
    return () => window.clearTimeout(timer);
  }, [factionVoice]);

  const activeMusicTrack = !game || role === "spectator" || !player
    ? "menu"
    : game.gameMode === "basic"
      ? "basic"
      : game.players[player]?.faction?.id || "menu";

  useEffect(() => {
    if (!account?.id) {
      setAccountSoundMuted(false);
      return;
    }
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.accountSoundMuted) || "{}");
      setAccountSoundMuted(!!saved[account.id]);
    } catch {
      setAccountSoundMuted(false);
    }
  }, [account?.id]);

  function setSignedInSoundMuted(nextMuted) {
    if (!account?.id) return;
    setAccountSoundMuted(nextMuted);
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.accountSoundMuted) || "{}");
      saved[account.id] = nextMuted;
      localStorage.setItem(STORAGE_KEYS.accountSoundMuted, JSON.stringify(saved));
    } catch {
      localStorage.setItem(STORAGE_KEYS.accountSoundMuted, JSON.stringify({ [account.id]: nextMuted }));
    }
  }

  useEffect(() => {
    if (!authToken) return;
    fetch(`${SOCKET_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` }
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not restore sign-in.");
        setAccount(data.account);
      })
      .catch(() => {
        localStorage.removeItem(STORAGE_KEYS.authToken);
        setAuthToken("");
        setAccount(null);
      });
  }, [authToken]);

  const loadLeaderboard = useCallback(() => {
    fetch(`${SOCKET_URL}/api/leaderboard`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load leaderboard.");
        setLeaderboard(data.leaderboard || []);
        setLeaderboardError("");
      })
      .catch((leaderboardLoadError) => setLeaderboardError(leaderboardLoadError.message));
  }, []);

  useEffect(() => {
    loadLeaderboard();
    const intervalId = window.setInterval(loadLeaderboard, 10000);
    return () => window.clearInterval(intervalId);
  }, [loadLeaderboard]);

  const loadFriends = useCallback(async () => {
    if (!authToken) {
      setFriendsData({ friends: [], messages: [] });
      setSelectedFriendId("");
      return;
    }

    try {
      const response = await fetch(`${SOCKET_URL}/api/friends`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load friends.");
      setFriendsData({ friends: data.friends || [], messages: data.messages || [] });
      setSelectedFriendId((current) => data.friends?.some((friend) => friend.id === current) ? current : "");
      setFriendsError("");
    } catch (friendLoadError) {
      setFriendsError(friendLoadError.message);
    }
  }, [authToken]);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  useEffect(() => {
    if (!authToken) return undefined;
    const intervalId = window.setInterval(loadFriends, 5000);
    return () => window.clearInterval(intervalId);
  }, [authToken, loadFriends]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.friendReadAt, JSON.stringify(friendReadAt));
  }, [friendReadAt]);

  useEffect(() => {
    musicVolumeRef.current = musicVolume;
    musicStopRef.current?.setVolume(musicVolume);
  }, [musicVolume]);

  useEffect(() => {
    if (musicStopRef.current) {
      musicStopRef.current.stop();
      musicStopRef.current = null;
    }
    if (musicEnabled && !accountSoundMuted) {
      musicStopRef.current = startMusicTrack(activeMusicTrack, musicVolumeRef.current);
    }
    return () => {
      if (musicStopRef.current) {
        musicStopRef.current.stop();
        musicStopRef.current = null;
      }
    };
  }, [activeMusicTrack, musicEnabled, accountSoundMuted]);

  useEffect(() => {
    if (!accountSoundMuted) return;
    if (voiceAudioRef.current) {
      voiceAudioRef.current.pause();
      voiceAudioRef.current = null;
    }
    window.speechSynthesis?.cancel();
    setFactionVoice(null);
  }, [accountSoundMuted]);

  useEffect(() => {
    const onAssign = (payload) => {
      setError("");
      setRole(payload.role);
      setPlayer(payload.playerNum);
      setMatchmakingStatus({ inQueue: false, message: "" });
      setDraftLeagueStatus({ inQueue: false, message: "" });
      saveReconnectInfo({ roomCode: payload.roomCode, reconnectToken: payload.reconnectToken, role: payload.role });
    };

    const onAssignSpectator = (payload) => {
      setError("");
      setRole("spectator");
      setPlayer(null);
      saveReconnectInfo({ roomCode: payload.roomCode, role: "spectator" });
    };

    const onState = (newGame) => {
      setError("");
      setGame(newGame);
    };
    const onLobbyState = (newLobby) => {
      setError("");
      setLobby(newLobby);
    };
    const onDraftState = (newDraft) => {
      setError("");
      setDraftState(newDraft);
      setDraftPickPending(false);
    };
    const onError = (msg) => {
      if (String(msg || "").toLowerCase().includes("room is no longer active")) {
        clearReconnectInfo();
        setError("");
        return;
      }
      setError(msg);
      setDraftPickPending(false);
    };
    const onPeek = (text) => setPeekResult(text);
    const onMatchmakingStatus = (status) => setMatchmakingStatus(status);
    const onDraftLeagueStatus = (status) => setDraftLeagueStatus(status);
    const onAccountUpdated = (updatedAccount) => setAccount(updatedAccount);
    const onDraftDeckSaved = (payload) => setDraftSaveMessage(payload?.message || "Draft deck saved.");
    const onGameEnded = () => loadLeaderboard();
    const attemptReconnect = () => {
      const reconnectToken = localStorage.getItem(STORAGE_KEYS.reconnectToken);
      const roomCode = localStorage.getItem(STORAGE_KEYS.roomCode);
      const savedRole = localStorage.getItem(STORAGE_KEYS.role);
      const savedAuthToken = localStorage.getItem(STORAGE_KEYS.authToken);
      if (roomCode && (reconnectToken || savedRole === "spectator")) {
        socket.emit("reconnectToRoom", { roomCode, reconnectToken, role: savedRole, authToken: savedAuthToken });
      }
    };

    socket.on("connect", attemptReconnect);
    socket.on("assign", onAssign);
    socket.on("assignSpectator", onAssignSpectator);
    socket.on("state", onState);
    socket.on("lobbyState", onLobbyState);
    socket.on("draftState", onDraftState);
    socket.on("errorMessage", onError);
    socket.on("peekResult", onPeek);
    socket.on("matchmakingStatus", onMatchmakingStatus);
    socket.on("draftLeagueStatus", onDraftLeagueStatus);
    socket.on("accountUpdated", onAccountUpdated);
    socket.on("draftDeckSaved", onDraftDeckSaved);
    socket.on("gameEnded", onGameEnded);
    attemptReconnect();

    return () => {
      socket.off("connect", attemptReconnect);
      socket.off("assign", onAssign);
      socket.off("assignSpectator", onAssignSpectator);
      socket.off("state", onState);
      socket.off("lobbyState", onLobbyState);
      socket.off("draftState", onDraftState);
      socket.off("errorMessage", onError);
      socket.off("peekResult", onPeek);
      socket.off("matchmakingStatus", onMatchmakingStatus);
      socket.off("draftLeagueStatus", onDraftLeagueStatus);
      socket.off("accountUpdated", onAccountUpdated);
      socket.off("draftDeckSaved", onDraftDeckSaved);
      socket.off("gameEnded", onGameEnded);
    };
  }, [loadLeaderboard]);

  useEffect(() => {
    if (Array.isArray(game?.eventLog)) {
      setActionLog(game.eventLog);
      return;
    }
    if (!game?.message) return;
    setActionLog((prev) => (prev[0]?.text === game.message ? prev : [{ text: game.message, turn: game.turn || 1, phase: game.phase || "game" }, ...prev].slice(0, 50)));
  }, [game?.eventLog, game?.message, game?.phase, game?.turn]);

  useEffect(() => {
    if (!game || role !== "player" || !player) {
      seenIncomingAttackIdsRef.current = new Set();
      setIncomingAttackAlert(null);
      return;
    }

    const opponentNumber = game.gameMode === "freeForAll" ? null : player === 1 ? 2 : 1;
    const incomingAttacks = [
      ...(game.handAttacks || [])
        .filter((attack) => game.gameMode === "freeForAll" ? attack.targetPlayer === player : attack.player === opponentNumber)
        .map((attack) => ({
          id: attack.id,
          label: `${getCardShortLabel(attack.card)} from hand`,
          value: attack.effectiveValue
        })),
      ...(game.lanes || [])
        .map((lane, laneIndex) => ({ lane, laneIndex }))
        .filter(({ lane }) => game.gameMode === "freeForAll" ? lane.attack?.targetPlayer === player : lane.attack?.player === opponentNumber)
        .map(({ lane, laneIndex }) => ({
          id: lane.attack.id || `lane-${laneIndex}-${lane.attack.card?.id || lane.attack.card?.name || "attack"}`,
          label: `${getCardShortLabel(lane.attack.card)} from lane ${laneIndex + 1}`,
          value: lane.attack.effectiveValue
        }))
    ];

    const currentIds = new Set(incomingAttacks.map((attack) => attack.id));
    seenIncomingAttackIdsRef.current.forEach((id) => {
      if (!currentIds.has(id)) seenIncomingAttackIdsRef.current.delete(id);
    });

    const newestAttack = incomingAttacks.find((attack) => !seenIncomingAttackIdsRef.current.has(attack.id));
    if (!newestAttack) return;

    seenIncomingAttackIdsRef.current.add(newestAttack.id);
    setIncomingAttackAlert({
      id: newestAttack.id,
      text: `Incoming attack: ${newestAttack.label} (effective ${newestAttack.value}). Block it or take damage.`
    });
    setIncomingAttackMinimized(false);
  }, [game, role, player]);

  const speakFactionQuote = useCallback((factionId, quote) => {
    if (voiceAudioRef.current) {
      voiceAudioRef.current.pause();
      voiceAudioRef.current = null;
    }
    if (accountSoundMuted) {
      window.speechSynthesis?.cancel();
      return;
    }

    const speakWithBrowserVoice = () => {
      if (typeof window === "undefined" || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
      window.speechSynthesis.cancel();
      const utterance = new window.SpeechSynthesisUtterance(quote);
      const profile = FACTION_VOICE_PROFILES[factionId] || FACTION_VOICE_PROFILES.default;
      utterance.rate = profile.rate;
      utterance.pitch = profile.pitch;
      utterance.volume = profile.volume;
      window.speechSynthesis.speak(utterance);
    };

    const voiceClip = getFactionVoiceAudio(factionId, quote);
    if (voiceClip && typeof window !== "undefined" && window.Audio) {
      window.speechSynthesis?.cancel();
      const audio = new window.Audio(resolveAssetPath(voiceClip));
      audio.volume = 1;
      voiceAudioRef.current = audio;
      audio.play().catch(speakWithBrowserVoice);
      return;
    }

    speakWithBrowserVoice();
  }, [accountSoundMuted]);

  useEffect(() => {
    if (!game || role === "spectator" || !player) return;
    if (game.phase !== "priority") return;
    if (blockMode || attackMode || placementMode || abilityMode) return;

    const opponentNumber = game.gameMode === "freeForAll" ? null : player === 1 ? 2 : 1;
    const incomingHandAttacks = (game.handAttacks || []).filter(
      (a) => (game.gameMode === "freeForAll" ? a.targetPlayer === player : a.player === opponentNumber) && (!a.block || a.block.length === 0)
    );

    if (incomingHandAttacks.length === 1 && game.priority === player) {
      setBlockMode({ type: "handAttack", handAttackId: incomingHandAttacks[0].id });
    }
  }, [game, role, player, blockMode, attackMode, placementMode, abilityMode]);

  useEffect(() => {
    if (!blockMode || !game) return;
    if (game.phase !== "priority") {
      resetSelections();
      return;
    }
    if (blockMode.type === "handAttack") {
      const attack = (game.handAttacks || []).find((entry) => entry.id === blockMode.handAttackId);
      if (!attack || attack.block?.length > 0 || game.priorityPassed?.[player]) resetSelections();
      return;
    }
    const laneAttack = game.lanes?.[blockMode.lane]?.attack;
    if (!laneAttack || game.lanes?.[blockMode.lane]?.block?.length > 0 || game.priorityPassed?.[player]) resetSelections();
  }, [blockMode, game, player]);

  useEffect(() => {
    function handleAdvanceHotkey(event) {
      if (event.code !== "Space" || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
      const tagName = event.target?.tagName;
      if (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(tagName) || event.target?.isContentEditable) return;
      if (!game || role !== "player" || !player || game.phase === "gameOver" || game.winner != null) return;

      if (blockMode) {
        event.preventDefault();
        passCurrentBlock();
        return;
      }

      if (placementMode) {
        event.preventDefault();
        skipPlacement(placementMode.lane);
        return;
      }

      if (game.phase === "end") {
        const activeOrder = (game.playerOrder || Object.keys(game.players || {}).map(Number))
          .filter((p) => !game.players?.[p]?.eliminated);
        const firstIndex = Math.max(0, activeOrder.indexOf(game.endPlacementFirstPlayer));
        const currentPlayer = game.gameMode === "freeForAll"
          ? activeOrder[(firstIndex + (game.endPlacementStep || 0)) % Math.max(1, activeOrder.length)]
          : game.endPlacementStep === 0 ? game.endPlacementFirstPlayer : (game.endPlacementFirstPlayer === 1 ? 2 : 1);
        if (currentPlayer === player && Number.isInteger(game.endPlacementLaneIndex)) {
          event.preventDefault();
          skipPlacement(game.endPlacementLaneIndex);
        }
        return;
      }

      if (game.phase === "priority" && game.priority === player) {
        event.preventDefault();
        const opponentNumber = game.gameMode === "freeForAll" ? null : player === 1 ? 2 : 1;
        const incomingHandAttack = (game.handAttacks || []).find((attack) => (game.gameMode === "freeForAll" ? attack.targetPlayer === player : attack.player === opponentNumber) && (!attack.block || attack.block.length === 0));
        if (incomingHandAttack && !game.priorityPassed?.[player]) {
          passHandAttack(incomingHandAttack.id);
        } else {
          passPriority();
        }
      }
    }

    window.addEventListener("keydown", handleAdvanceHotkey);
    return () => window.removeEventListener("keydown", handleAdvanceHotkey);
  });

  function resetSelections() {
    setAttackMode(null);
    setBlockMode(null);
    setPlacementMode(null);
    setAbilityMode(null);
    setPayments([]);
    setSelectedAttackCardIndex(null);
    setSelectedBlockCardIndex(null);
    setSelectedBlockCardIndexes([]);
    setSelectedPlacementCardIndex(null);
    setUseHeraBonus(false);
    setPeekResult("");
  }

  async function submitAuth() {
    setAuthError("");
    try {
      const response = await fetch(`${SOCKET_URL}/api/auth/${authMode === "register" ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authForm)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Authentication failed.");
      localStorage.setItem(STORAGE_KEYS.authToken, data.token);
      setAuthToken(data.token);
      setAccount(data.account);
      setAuthForm({ name: "", password: "" });
    } catch (authSubmitError) {
      setAuthError(authSubmitError.message);
    }
  }

  async function selectAccountCosmetic(selected) {
    if (!authToken) return;
    try {
      const response = await fetch(`${SOCKET_URL}/api/account/progression`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ selected })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update progression.");
      setAccount(data.account);
    } catch (progressionError) {
      setError(progressionError.message);
    }
  }

  async function openBoosterPack(packId) {
    if (!authToken || openingPackId) return;
    setOpeningPackId(packId);
    setLastOpenedPack([]);
    try {
      const [response] = await Promise.all([
        fetch(`${SOCKET_URL}/api/collection/open-pack`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ packId })
        }),
        new Promise((resolve) => window.setTimeout(resolve, 650))
      ]);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not open booster pack.");
      setAccount(data.account);
      setLastOpenedPack(data.openedCards || []);
    } catch (collectionError) {
      setError(collectionError.message);
    } finally {
      setOpeningPackId("");
    }
  }

  async function buyBoosterPack(packId) {
    if (!authToken) {
      setError("Sign in to buy packs.");
      return;
    }
    try {
      const response = await fetch(`${SOCKET_URL}/api/collection/pack-purchase-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ packId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Pack purchases are not configured yet.");
      window.open(data.checkoutUrl, "_blank", "noopener,noreferrer");
    } catch (purchaseError) {
      setError(purchaseError.message);
    }
  }

  async function saveConstructedDeck(deckPayload) {
    if (!authToken) throw new Error("Sign in to save a constructed deck.");
    const response = await fetch(`${SOCKET_URL}/api/collection/save-constructed-deck`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify(deckPayload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not save constructed deck.");
    setAccount(data.account);
    return data.savedConstructedDeck;
  }

  function signOut() {
    localStorage.removeItem(STORAGE_KEYS.authToken);
    setAuthToken("");
    setAccount(null);
    setLastOpenedPack([]);
    setOpeningPackId("");
    setFriendsData({ friends: [], messages: [] });
    setSelectedFriendId("");
    setFriendNameInput("");
    setFriendMessageInput("");
    setFriendsError("");
  }

  function playerIdentityPayload() {
    const reconnectToken = localStorage.getItem(STORAGE_KEYS.reconnectToken) || "";
    if (account && authToken) return { authToken, reconnectToken };
    const normalizedGuestName = guestName.trim() || "Guest";
    localStorage.setItem(STORAGE_KEYS.guestName, normalizedGuestName);
    return { guestName: normalizedGuestName, reconnectToken };
  }

  function createRoom() {
    clearReconnectInfo();
    socket.emit("createRoom", playerIdentityPayload());
  }

  function createFreeForAllRoom() {
    clearReconnectInfo();
    setError("");
    let answered = false;
    const timeoutId = window.setTimeout(() => {
      if (answered) return;
      setError("Free-for-all room creation did not get a server response. Push/deploy the latest server/index.js to Render, then try again.");
    }, 3500);
    socket.emit("createFreeForAllRoom", playerIdentityPayload(), (response) => {
      answered = true;
      window.clearTimeout(timeoutId);
      if (response?.error) setError(response.error);
    });
  }

  function createDraftRoom() {
    clearReconnectInfo();
    setError("");
    let answered = false;
    const timeoutId = window.setTimeout(() => {
      if (answered) return;
      setError("Draft room creation did not get a server response. Push/deploy the latest server/index.js to Render, then try again.");
    }, 3500);
    socket.emit("createDraftRoom", playerIdentityPayload(), (response) => {
      answered = true;
      window.clearTimeout(timeoutId);
      if (response?.error) setError(response.error);
    });
  }

  function createBotDraftRoom() {
    clearReconnectInfo();
    setError("");
    let answered = false;
    const timeoutId = window.setTimeout(() => {
      if (answered) return;
      setError("Bot draft creation did not get a server response. Push/deploy the latest server/index.js to Render, then try again.");
    }, 3500);
    socket.emit("createBotDraftRoom", playerIdentityPayload(), (response) => {
      answered = true;
      window.clearTimeout(timeoutId);
      if (response?.error) setError(response.error);
    });
  }

  function startDraft() {
    socket.emit("startDraft");
  }

  function pickDraftCard(cardCopyId) {
    if (draftPickPending || draftState?.myCurrentPack?.pickedThisPass) return;
    setDraftPickPending(true);
    socket.emit("draftPick", { cardCopyId });
  }

  function toggleDraftDeckCard(cardCopyId) {
    if (!draftState?.myPool) return;
    const currentIds = new Set((draftState.myDeckAdditions || []).map((card) => card.draftCopyId));
    const chosenCard = draftState.myPool.find((card) => card.draftCopyId === cardCopyId);
    const currentFactionIds = [...new Set((draftState.myDeckAdditions || []).map((card) => card.factionId).filter(Boolean))];
    if (chosenCard && !currentIds.has(cardCopyId) && currentFactionIds.length === 1 && chosenCard.factionId !== currentFactionIds[0]) {
      setError("Draft decks can only include cards from one faction. Remove the current faction cards first to switch.");
      return;
    }
    if (chosenCard && !currentIds.has(cardCopyId)) {
      const chosenValue = getReplacementValue(chosenCard);
      const sameValueCount = (draftState.myDeckAdditions || []).filter((card) => getReplacementValue(card) === chosenValue).length;
      if (chosenValue == null || sameValueCount >= MAX_REPLACEMENTS_PER_VALUE) {
        setError(`Draft decks can only swap up to ${MAX_REPLACEMENTS_PER_VALUE} cards of the same value.`);
        return;
      }
    }
    if (currentIds.has(cardCopyId)) currentIds.delete(cardCopyId);
    else currentIds.add(cardCopyId);
    setDraftSaveMessage("");
    const selections = draftState.myPool
      .filter((card) => currentIds.has(card.draftCopyId))
      .reduce((selected, card) => {
        const existing = (draftState.myDeckAdditions || []).find((selectedCard) => selectedCard.draftCopyId === card.draftCopyId);
        const value = getReplacementValue(card);
        const usedSuits = new Set(selected.filter((selection) => selection.value === value).map((selection) => selection.suit));
        const preferred = normalizeReplacementSuitId(existing?.replacementSuit || existing?.suit || card.replacementSuit || card.suit);
        const suit = preferred && !usedSuits.has(preferred)
          ? preferred
          : REPLACEMENT_SUITS.find((entry) => !usedSuits.has(entry.id))?.id || preferred;
        selected.push({
          value,
          cardCopyId: card.draftCopyId,
          suit
        });
        return selected;
      }, [])
      .map((selection) => ({
        cardCopyId: selection.cardCopyId,
        suit: selection.suit
      }));
    socket.emit("setDraftDeckAdditions", { cardCopyIds: [...currentIds], selections });
  }

  function setDraftDeckCardSuit(cardCopyId, suit) {
    if (!draftState?.myDeckAdditions) return;
    const targetCard = draftState.myDeckAdditions.find((card) => card.draftCopyId === cardCopyId);
    const targetValue = getReplacementValue(targetCard);
    const targetSuit = normalizeReplacementSuitId(suit);
    if (draftState.myDeckAdditions.some((card) => card.draftCopyId !== cardCopyId && getReplacementValue(card) === targetValue && normalizeReplacementSuitId(card.replacementSuit || card.suit) === targetSuit)) {
      setError(`Another value ${targetValue} card is already replacing ${targetSuit}. Choose a different suit first.`);
      return;
    }
    const selections = draftState.myDeckAdditions.map((card) => ({
      cardCopyId: card.draftCopyId,
      suit: card.draftCopyId === cardCopyId ? targetSuit : normalizeReplacementSuitId(card.replacementSuit || card.suit)
    }));
    setDraftSaveMessage("");
    socket.emit("setDraftDeckAdditions", { cardCopyIds: selections.map((selection) => selection.cardCopyId), selections });
  }

  function saveDraftDeck() {
    setDraftSaveMessage("");
    socket.emit("saveDraftDeck");
  }

  function startTutorialVsAi(mode = "basic") {
    clearReconnectInfo();
    setShowTutorial(false);
    setError("");
    socket.emit("createAiTutorialRoom", { ...playerIdentityPayload(), mode });
  }

  function dismissOnboarding() {
    localStorage.setItem(STORAGE_KEYS.onboardingDismissed, "true");
    setShowOnboarding(false);
  }

  function reopenOnboardingTips() {
    localStorage.removeItem(STORAGE_KEYS.onboardingDismissed);
    setShowModeGuide(false);
    setShowOnboarding(true);
    setError("");
  }

  function startOnboardingBasicAi() {
    if (!account) setPlayAsGuest(true);
    dismissOnboarding();
    startTutorialVsAi("basic");
  }

  function openOnboardingTutorial() {
    dismissOnboarding();
    setShowTutorial(true);
  }

  function enableOnboardingHints() {
    setShowHelperLabels(true);
    dismissOnboarding();
  }

  function dismissModeGuide() {
    if (account?.id) {
      try {
        const seenByAccount = JSON.parse(localStorage.getItem(STORAGE_KEYS.accountModeGuideSeen) || "{}");
        localStorage.setItem(STORAGE_KEYS.accountModeGuideSeen, JSON.stringify({ ...seenByAccount, [account.id]: true }));
      } catch {
        localStorage.setItem(STORAGE_KEYS.accountModeGuideSeen, JSON.stringify({ [account.id]: true }));
      }
    }
    setShowModeGuide(false);
  }

  function startModeGuideBasicAi() {
    dismissModeGuide();
    startTutorialVsAi("basic");
  }

  function openModeGuideCampaign() {
    dismissModeGuide();
    setShowCampaign(true);
  }

  function openModeGuideCollection() {
    dismissModeGuide();
    setShowCollection(true);
  }

  function enableModeGuideHints() {
    setShowHelperLabels(true);
    dismissModeGuide();
  }

  function startCampaignChapter(factionId, chapterId) {
    clearReconnectInfo();
    setShowCampaign(false);
    setError("");
    socket.emit("createCampaignRoom", { ...playerIdentityPayload(), factionId, chapterId });
  }

  function continueCampaignChapter(factionId, chapterId) {
    socket.emit("leaveRoom");
    resetSelections();
    setGame(null);
    setLobby(null);
    setRole(null);
    setPlayer(null);
    setActionLog([]);
    setIncomingAttackAlert(null);
    startCampaignChapter(factionId, chapterId);
  }

  function joinRoom(asSpectator = false) {
    clearReconnectInfo();
    setError("");
    socket.emit("joinRoom", { roomCode: roomCodeInput, asSpectator, ...(asSpectator ? {} : playerIdentityPayload()) });
  }

  function joinMatchmaking(bestOf = 1) {
    if (!authToken) {
      setMatchmakingStatus({ inQueue: false, message: "Sign in to use matchmaking." });
      return;
    }
    socket.emit("joinMatchmaking", { authToken, bestOf });
  }

  function leaveMatchmaking() {
    socket.emit("leaveMatchmaking");
  }

  function joinDraftLeague(draftType = "player", bestOf = 1) {
    if (!authToken) {
      setDraftLeagueStatus({ inQueue: false, message: "Sign in to use draft league matchmaking." });
      return;
    }
    socket.emit("joinDraftLeague", { authToken, draftType, bestOf });
  }

  function leaveDraftLeague() {
    socket.emit("leaveDraftLeague");
  }

  function chooseFaction(factionId) {
    socket.emit("selectFaction", { factionId });
  }

  function setGameMode(mode) {
    socket.emit("setGameMode", { mode });
  }

  function startGame() {
    socket.emit("startGame");
  }

  async function submitFriendRequest() {
    setFriendsError("");
    try {
      const response = await fetch(`${SOCKET_URL}/api/friends`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ name: friendNameInput })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not add friend.");
      setFriendsData({ friends: data.friends || [], messages: data.messages || [] });
      setSelectedFriendId(data.friends?.find((friend) => friend.name.toLowerCase() === friendNameInput.trim().toLowerCase())?.id || selectedFriendId || data.friends?.[0]?.id || "");
      setFriendNameInput("");
    } catch (friendAddError) {
      setFriendsError(friendAddError.message);
    }
  }

  async function removeFriend(friendId) {
    setFriendsError("");
    try {
      const response = await fetch(`${SOCKET_URL}/api/friends/${friendId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not remove friend.");
      setFriendsData({ friends: data.friends || [], messages: data.messages || [] });
      setSelectedFriendId(data.friends?.[0]?.id || "");
      setFriendMessageInput("");
    } catch (friendRemoveError) {
      setFriendsError(friendRemoveError.message);
    }
  }

  async function sendFriendMessage(friendId) {
    setFriendsError("");
    try {
      const response = await fetch(`${SOCKET_URL}/api/friends/${friendId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ text: friendMessageInput })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not send message.");
      setFriendsData({ friends: data.friends || [], messages: data.messages || [] });
      setSelectedFriendId(friendId);
      setFriendMessageInput("");
    } catch (friendMessageError) {
      setFriendsError(friendMessageError.message);
    }
  }

  function returnToMainMenu() {
    socket.emit("leaveRoom");
    clearReconnectInfo();
    resetSelections();
    setGame(null);
    setLobby(null);
    setDraftState(null);
    setRole(null);
    setPlayer(null);
    setRoomCodeInput("");
    setActionLog([]);
    setError("");
    setFactionVoice(null);
    setIncomingAttackAlert(null);
    setShowCampaign(false);
    setShowTutorial(false);
    seenIncomingAttackIdsRef.current = new Set();
    setMatchmakingStatus({ inQueue: false, message: "" });
    setDraftLeagueStatus({ inQueue: false, message: "" });
  }

  function togglePayment(i) {
    if (attackMode?.from === "hand" && i === selectedAttackCardIndex) return;
    if (blockMode?.type === "handAttack" && selectedBlockCardIndexes.includes(i)) return;
    setPayments((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
  }

  function selectAttackCard(i) {
    setSelectedAttackCardIndex(i);
    setPayments((prev) => prev.filter((x) => x !== i));
  }

  function selectBlockCard(i) {
    setSelectedBlockCardIndex(i);
    setSelectedBlockCardIndexes((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
    setPayments((prev) => prev.filter((x) => x !== i));
  }

  function togglePanel(panel) {
    setCollapsedPanels((prev) => ({ ...prev, [panel]: !prev[panel] }));
  }

  hotkeyActionsRef.current = {};

  const friendUnreadCounts = (friendsData.friends || []).reduce((counts, friend) => {
    const lastRead = Date.parse(friendReadAt?.[account?.id]?.[friend.id] || 0);
    counts[friend.id] = (friendsData.messages || []).filter((message) => (
      message.fromId === friend.id &&
      message.toId === account?.id &&
      Date.parse(message.createdAt || 0) > lastRead
    )).length;
    return counts;
  }, {});
  const friendUnreadTotal = Object.values(friendUnreadCounts).reduce((sum, count) => sum + count, 0);

  function selectFriendWithReadReceipt(friendId) {
    setSelectedFriendId(friendId);
    if (!friendId || !account?.id) return;
    setFriendReadAt((prev) => ({
      ...prev,
      [account.id]: {
        ...(prev?.[account.id] || {}),
        [friendId]: new Date().toISOString()
      }
    }));
  }

  const canPlayAsPlayer = !!account || playAsGuest;

  if (showCampaign) {
    return (
      <CampaignScreen
        onBack={() => setShowCampaign(false)}
        onStartChapter={startCampaignChapter}
        canPlayAsPlayer={canPlayAsPlayer}
        account={account}
      />
    );
  }

  if (showCollection) {
    return (
      <CollectionScreen
        account={account}
        lastOpenedPack={lastOpenedPack}
        openingPackId={openingPackId}
        onOpenPack={openBoosterPack}
        onBuyPack={buyBoosterPack}
        onSaveConstructedDeck={saveConstructedDeck}
        onBack={() => setShowCollection(false)}
      />
    );
  }

  if (showTutorial) {
    return (
      <TutorialScreen
        onBack={() => setShowTutorial(false)}
        onPlayBasicAi={() => startTutorialVsAi("basic")}
        onPlayFactionAi={() => startTutorialVsAi("factions")}
        canPlayAsPlayer={canPlayAsPlayer}
      />
    );
  }

  if (draftState || lobby?.gameMode === "draft") {
    return (
      <DraftScreen
        draft={draftState}
        lobby={lobby}
        player={player}
        isSpectator={role === "spectator"}
        account={account}
        draftPickPending={draftPickPending}
        draftSaveMessage={draftSaveMessage}
        onBack={returnToMainMenu}
        onCopyRoom={copyRoomCode}
        onStartDraft={startDraft}
        onPickCard={pickDraftCard}
        onToggleDeckCard={toggleDraftDeckCard}
        onSetDeckCardSuit={setDraftDeckCardSuit}
        onSaveDraftDeck={saveDraftDeck}
      />
    );
  }

  if (!role && !lobby) {
    return (
      <div style={MENU_THEME.page}>
        <div style={MENU_THEME.frame}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, borderBottom: "1px solid rgba(125, 211, 252, 0.28)", paddingBottom: 18, marginBottom: 20 }}>
          <div>
            <div style={{ color: "#f59e0b", fontSize: 12, fontWeight: "bold", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Battle Net Terminal</div>
            <h1 style={{ margin: 0, fontSize: 46, color: "#f8fafc", textShadow: "0 0 18px rgba(56,189,248,0.4)" }}>Gauntlet Online</h1>
          </div>
          <div style={{ display: "grid", justifyItems: "end", gap: 8 }}>
            <div style={{ color: "#93c5fd", fontSize: 13, textAlign: "right" }}>Two-player card command</div>
            <HelperToggle enabled={showHelperLabels} onToggle={() => setShowHelperLabels((value) => !value)} light />
            <MusicControl
              trackKey={activeMusicTrack}
              enabled={musicEnabled}
              volume={musicVolume}
              onToggle={() => setMusicEnabled((value) => !value)}
              onVolumeChange={setMusicVolume}
              account={account}
              soundMuted={accountSoundMuted}
              onSoundMutedChange={setSignedInSoundMuted}
            />
            <DonateButton onUnavailable={() => setSupportMessage("Support link coming soon.")} />
          </div>
        </div>
        {supportMessage && <div style={{ color: "#fde68a", marginBottom: 12, fontSize: 13 }}>{supportMessage}</div>}
        {error && <div style={{ color: "#fca5a5", marginBottom: 12 }}><strong>Error:</strong> {error}</div>}
        {account && showModeGuide && (
          <ModeGuidePanel
            accountName={account.name}
            onStartBasicAi={startModeGuideBasicAi}
            onOpenCampaign={openModeGuideCampaign}
            onOpenCollection={openModeGuideCollection}
            onEnableHints={enableModeGuideHints}
            onDismiss={dismissModeGuide}
          />
        )}
        {showOnboarding && (
          <OnboardingPanel
            canPlayAsPlayer={canPlayAsPlayer}
            onStartTutorial={openOnboardingTutorial}
            onStartBasicAi={startOnboardingBasicAi}
            onEnableHints={enableOnboardingHints}
            onDismiss={dismissOnboarding}
          />
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          <MenuCard title="Tutorial">
            <p style={{ marginTop: 0, color: "#bfdbfe" }}>Learn the priority, attack, block, damage, and lane flow before your first match.</p>
            <MenuButton onClick={() => setShowTutorial(true)} style={{ marginRight: 8, marginBottom: 8 }}>Start Tutorial</MenuButton>
            <MenuButton variant="secondary" onClick={reopenOnboardingTips}>Show Onboarding Tips</MenuButton>
          </MenuCard>
          <MenuCard title="Campaign">
            <p style={{ marginTop: 0, color: "#bfdbfe" }}>Play as each faction commander through story battles against figures from their own history.</p>
            <MenuButton onClick={() => setShowCampaign(true)}>Choose Campaign</MenuButton>
          </MenuCard>
          <MenuCard title="Collection">
            <p style={{ marginTop: 0, color: "#bfdbfe" }}>Open earned campaign packs, view your cards, and buy $1 faction packs once checkout is configured.</p>
            <MenuButton onClick={() => setShowCollection(true)} disabled={!account}>Open Collection</MenuButton>
            {!account && <p style={{ color: "#bfdbfe", fontSize: 13 }}>Sign in to use your collection.</p>}
          </MenuCard>
          <AccountPanel
            account={account}
            mode={authMode}
            form={authForm}
            error={authError}
            onModeChange={setAuthMode}
            onFormChange={setAuthForm}
            onSubmit={submitAuth}
            onSignOut={signOut}
          />
          <ProgressionPanel account={account} onSelectCosmetic={selectAccountCosmetic} />
          <MenuCard title="Create Room">
            <MenuButton onClick={createRoom} disabled={!canPlayAsPlayer} style={{ marginRight: 8, marginBottom: 8 }}>Create Duel Room</MenuButton>
            <MenuButton variant="secondary" onClick={createFreeForAllRoom} disabled={!canPlayAsPlayer}>Create Free-For-All</MenuButton>
            <MenuButton variant="secondary" onClick={createDraftRoom} disabled={!canPlayAsPlayer} style={{ marginLeft: 8, marginBottom: 8 }}>Create Draft Room</MenuButton>
            <MenuButton variant="secondary" onClick={createBotDraftRoom} disabled={!canPlayAsPlayer} style={{ marginLeft: 8, marginBottom: 8 }}>Bot Draft</MenuButton>
            <p style={{ color: "#bfdbfe", fontSize: 13, marginBottom: 0 }}>Duel is 2 players. Free-for-all supports 2-4 players. Draft supports up to 8 players. Bot Draft seats you with 7 automated drafters.</p>
            <HelperText enabled={showHelperLabels}>Choose Duel for the tuned two-player table, Free-for-All for 2-4 seated players, Draft Room for live drafters, or Bot Draft for an Arena-style solo draft table.</HelperText>
            {!canPlayAsPlayer && <p style={{ color: "#bfdbfe", fontSize: 13 }}>Sign in or play as a guest to create a room.</p>}
          </MenuCard>
          <MenuCard title="Join Room">
            <input value={roomCodeInput} onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())} placeholder="Enter room code" style={{ ...MENU_THEME.input, marginRight: 10, marginBottom: 10 }} />
            <div>
              <MenuButton onClick={() => joinRoom(false)} disabled={!canPlayAsPlayer} style={{ marginRight: 8 }}>Join as Player</MenuButton>
              <MenuButton variant="secondary" onClick={() => joinRoom(true)}>Join as Spectator</MenuButton>
            </div>
            {!canPlayAsPlayer && <p style={{ color: "#bfdbfe", fontSize: 13 }}>Player seats need an account or guest name. Spectating is open.</p>}
          </MenuCard>
          <ShareGameQrCard />
          <MatchmakingPanel
            account={account}
            status={matchmakingStatus}
            onJoin={() => joinMatchmaking(1)}
            onLeave={leaveMatchmaking}
            extraActions={<MenuButton variant="secondary" onClick={() => joinMatchmaking(3)} disabled={!account}>Find BO3 Match</MenuButton>}
          />
          <MatchmakingPanel
            account={account}
            status={draftLeagueStatus}
            onJoin={() => joinDraftLeague("player", 1)}
            onLeave={leaveDraftLeague}
            title="Draft League"
            description="Queue with your saved one-faction draft deck against an account opponent with a similar draft league record. Player Draft and Bot Draft decks use separate queues."
            joinLabel="Player Draft"
            cancelLabel="Leave Draft Queue"
            signedOutText="Sign in and save a draft deck to use draft league matchmaking."
            extraActions={(
              <>
                <MenuButton variant="secondary" onClick={() => joinDraftLeague("player", 3)} disabled={!account}>Player Draft BO3</MenuButton>
                <MenuButton variant="secondary" onClick={() => joinDraftLeague("bot", 1)} disabled={!account}>Bot Draft</MenuButton>
                <MenuButton variant="secondary" onClick={() => joinDraftLeague("bot", 3)} disabled={!account}>Bot Draft BO3</MenuButton>
              </>
            )}
          />
          <FriendsPanel
            account={account}
            friendsData={friendsData}
            selectedFriendId={selectedFriendId}
            friendName={friendNameInput}
            messageText={friendMessageInput}
            error={friendsError}
            onSelectFriend={selectFriendWithReadReceipt}
            onFriendNameChange={setFriendNameInput}
            onMessageTextChange={setFriendMessageInput}
            onAddFriend={submitFriendRequest}
            onRemoveFriend={removeFriend}
            onSendMessage={sendFriendMessage}
            onRefresh={loadFriends}
            unreadCounts={friendUnreadCounts}
            unreadTotal={friendUnreadTotal}
          />
          <MenuCard title="Guest Play">
            <label style={{ display: "block", marginBottom: 10 }}>
              <input
                type="checkbox"
                checked={playAsGuest}
                onChange={(e) => setPlayAsGuest(e.target.checked)}
                disabled={!!account}
                style={{ marginRight: 8 }}
              />
              Play as guest
            </label>
            <input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Guest name"
              disabled={!!account || !playAsGuest}
              style={{ ...MENU_THEME.input, width: "100%", boxSizing: "border-box", opacity: !!account || !playAsGuest ? 0.58 : 1 }}
            />
            {account && <p style={{ color: "#bfdbfe", fontSize: 13 }}>You are already signed in, so your account name will be used.</p>}
          </MenuCard>
          <LeaderboardPanel leaderboard={leaderboard} error={leaderboardError} />
        </div>
        <RulebookPanel />
        </div>
      </div>
    );
  }

  if (!game) {
    const myFactionId = role === "player" ? lobby?.players?.[player]?.factionId || null : null;
    const isBasicMode = lobby?.gameMode === "basic";
    const isFreeForAllMode = lobby?.gameMode === "freeForAll";
    const lobbyPlayerNumbers = Object.keys(lobby?.players || {}).map(Number).sort((a, b) => a - b);
    const connectedLobbyPlayers = lobbyPlayerNumbers.filter((p) => lobby?.players?.[p]?.connected);
    const bothReady = isFreeForAllMode
      ? connectedLobbyPlayers.length >= 2 && connectedLobbyPlayers.every((p) => !!lobby?.players?.[p]?.factionId)
      : isBasicMode
        ? lobby?.players?.[1]?.connected && lobby?.players?.[2]?.connected
        : lobby?.players?.[1]?.factionId && lobby?.players?.[2]?.factionId;
    const myStartConfirmed = role === "player" ? !!lobby?.players?.[player]?.readyToStart : false;

    return (
      <div style={MENU_THEME.page}>
        <div style={MENU_THEME.frame}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, borderBottom: "1px solid rgba(125, 211, 252, 0.28)", paddingBottom: 16, marginBottom: 18 }}>
          <div>
            <div style={{ color: "#f59e0b", fontSize: 12, fontWeight: "bold", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Faction Command</div>
            <h1 style={{ margin: 0, fontSize: 40, color: "#f8fafc", textShadow: "0 0 18px rgba(56,189,248,0.4)" }}>Gauntlet Online</h1>
          </div>
          <div style={{ color: "#bfdbfe", fontSize: 13, textAlign: "right", display: "grid", gap: 8, justifyItems: "end" }}>
            <HelperToggle enabled={showHelperLabels} onToggle={() => setShowHelperLabels((value) => !value)} light />
            <RoomCodeDisplay
              code={lobby?.roomCode}
              roleLabel={role === "spectator" ? "Spectator" : `Player ${player}`}
              onCopy={copyRoomCode}
              color="#bfdbfe"
            />
            <MenuButton variant="secondary" onClick={returnToMainMenu}>Main Menu</MenuButton>
          </div>
        </div>
        {copyNotice && <div style={{ color: "#fde68a", marginBottom: 12, fontSize: 13 }}>{copyNotice}</div>}
        {account && <p style={{ color: "#dbeafe" }}><strong>Account:</strong> {account.name}</p>}
        {error && <div style={{ color: "#fca5a5", marginBottom: 12 }}><strong>Error:</strong> {error}</div>}
        <MenuCard title="Lobby">
          <p><strong>Mode:</strong> {isFreeForAllMode ? "Free-for-all" : isBasicMode ? "Basic Mode" : "Faction Mode"}</p>
          <LobbySeatGrid lobby={lobby} />
          <HelperText enabled={showHelperLabels}>{isFreeForAllMode ? "Each connected seat must choose a faction and confirm. Empty seats can stay open." : "Both player seats need to be ready before the match begins."}</HelperText>
          <p><strong>Spectators:</strong> {lobby?.spectatorCount || 0}</p>
        </MenuCard>
        {role === "player" && (
          <>
            {!isFreeForAllMode && <MenuCard title="Game Mode">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <MenuButton onClick={() => setGameMode("factions")} disabled={player !== 1 || !isBasicMode}>Faction Mode</MenuButton>
                <MenuButton variant="secondary" onClick={() => setGameMode("basic")} disabled={player !== 1 || isBasicMode}>Basic Mode</MenuButton>
              </div>
              <p style={{ marginBottom: 0, color: "#bfdbfe", fontSize: 13 }}>{player === 1 ? "Player 1 chooses the room mode before the game starts." : "Waiting for Player 1 to choose the room mode."}</p>
            </MenuCard>}
            {!isBasicMode && (
              <>
                <h2 style={{ color: "#f8fafc" }}>Select Your Faction</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 20 }}>
                  {(lobby?.factions || []).map((faction) => <FactionChoiceCard key={faction.id} faction={faction} selected={myFactionId === faction.id} onSelect={chooseFaction} />)}
                </div>
              </>
            )}
            {isBasicMode && <MenuCard title="Basic Mode"><p style={{ margin: 0 }}>No faction cards, no faction powers, and no faction bonuses. Just the core Gauntlet combat rules.</p></MenuCard>}
            <MenuButton onClick={startGame} disabled={!bothReady}>{myStartConfirmed ? "Waiting for Other Player" : "Confirm Start"}</MenuButton>
            <p style={{ color: "#bfdbfe", fontSize: 13 }}>{isFreeForAllMode ? "All connected seated players must pick a faction and confirm. You can start with 2-4 players." : "Both players must confirm before the match begins."}</p>
          </>
        )}
        {role === "spectator" && <MenuCard title="Watching Lobby"><p>Waiting for the players to start the game.</p></MenuCard>}
        </div>
      </div>
    );
  }

  const isSpectator = role === "spectator";
  const me = !isSpectator ? game.players[player] : null;
  const isFreeForAllGame = game.gameMode === "freeForAll";
  const opponent = !isSpectator && !isFreeForAllGame ? game.players[player === 1 ? 2 : 1] : null;
  const isBasicGame = game.gameMode === "basic";
  const isMyPriority = !isSpectator && game.priority === player;
  const myTheme = !isSpectator && me ? getFactionTheme(me.faction.id) : FACTION_COLORS.default;
  const oppTheme = !isSpectator && opponent ? getFactionTheme(opponent.faction.id) : FACTION_COLORS.default;
  const boardBackground = !isSpectator && me ? getBoardBackground(me.faction.id) : "linear-gradient(135deg, #f8fafc 0%, #e5e7eb 100%)";
  const battlefieldTexture = getBattlefieldTexture(me?.faction?.id || opponent?.faction?.id || "rumin");
  const tabletopBoardBackground = `
    radial-gradient(circle at 50% 22%, rgba(255, 214, 140, 0.12), transparent 28%),
    ${battlefieldTexture},
    linear-gradient(180deg, rgba(8, 5, 3, 0.44), rgba(8, 5, 3, 0.76)),
    ${boardBackground},
    repeating-linear-gradient(90deg, rgba(92, 52, 25, 0.44) 0 2px, transparent 2px 140px),
    linear-gradient(90deg, #2a160b 0%, #5b341b 42%, #2b170d 100%)
  `;
  const gameIsOver = game.phase === "gameOver" || game.winner != null;
  const matchPlayerNumbers = Object.keys(game.players || {}).map(Number).sort((a, b) => a - b);

  if (gameIsOver) {
    const isDraw = game.winner == null;
    const didWin = !isSpectator && game.winner === player;
    const didLose = !isSpectator && game.winner != null && game.winner !== player;
    const resultTitle = isDraw ? "Draw" : didWin ? "Victory" : didLose ? "Defeat" : `Player ${game.winner} Wins`;
    const resultDetail = game.message || (isDraw ? "The game ended in a draw." : `Player ${game.winner} wins.`);
    const resultColor = isDraw ? "#dbeafe" : didWin ? "#dcfce7" : didLose ? "#fee2e2" : "#f3f4f6";
    const resultBorder = isDraw ? "#2563eb" : didWin ? "#16a34a" : didLose ? "#dc2626" : "#111827";
    const celebrationAccent = isDraw ? "#60a5fa" : didWin ? myTheme.primary : "#ef4444";
    const confettiPieces = Array.from({ length: 18 }, (_, index) => index);
    const nextCampaignChapter = didWin && game.campaign ? getNextCampaignChapter(game.campaign.factionId, game.campaign.chapterId) : null;
    const campaignEndDialogue = game.campaign ? buildCampaignEndDialogue(game.campaign) : [];

    return (
      <div style={{ minHeight: "100dvh", boxSizing: "border-box", padding: 18, display: "grid", placeItems: "center", background: `${getBattlefieldTexture(me?.faction?.id || "rumin")}, ${boardBackground}`, fontFamily: "Arial, sans-serif" }}>
        <style>{`
          @keyframes gauntletConfettiFall {
            from { transform: translateY(-60px) rotate(0deg); opacity: 0; }
            18% { opacity: 1; }
            to { transform: translateY(380px) rotate(460deg); opacity: 0; }
          }
          @keyframes resultBannerPulse {
            0%, 100% { box-shadow: 0 18px 50px rgba(0,0,0,0.34), 0 0 0 rgba(255,255,255,0); }
            50% { box-shadow: 0 22px 64px rgba(0,0,0,0.42), 0 0 30px ${celebrationAccent}55; }
          }
          .result-confetti {
            position: absolute;
            inset: 0;
            pointer-events: none;
            overflow: hidden;
            border-radius: 18px;
          }
          .result-confetti span {
            position: absolute;
            top: -24px;
            width: 8px;
            height: 14px;
            background: ${celebrationAccent};
            animation: gauntletConfettiFall 1500ms ease-in infinite;
          }
        `}</style>
        <div style={{ position: "relative", overflow: "hidden", width: "min(760px, 100%)", border: `3px solid ${resultBorder}`, borderRadius: 18, background: `linear-gradient(180deg, rgba(255,247,220,0.96), ${resultColor})`, boxShadow: "0 18px 50px rgba(0,0,0,0.34)", padding: 28, textAlign: "center", animation: didWin ? "resultBannerPulse 1800ms ease-in-out infinite" : undefined }}>
          {didWin && (
            <div className="result-confetti">
              {confettiPieces.map((piece) => (
                <span key={piece} style={{ left: `${(piece * 37) % 100}%`, background: piece % 3 === 0 ? "#fde68a" : piece % 3 === 1 ? celebrationAccent : "#f97316", animationDelay: `${piece * 80}ms`, animationDuration: `${1200 + (piece % 5) * 120}ms` }} />
              ))}
            </div>
          )}
          <div style={{ color: myTheme.primary, fontSize: 13, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>After Battle</div>
          <h1 style={{ margin: "0 0 10px 0", fontFamily: "Georgia, serif", fontSize: "clamp(36px, 7vw, 58px)", color: "#2a160b", textShadow: "0 2px 0 rgba(255,255,255,0.48)" }}>{resultTitle}</h1>
          <p style={{ margin: "0 auto 20px auto", maxWidth: 560, fontSize: 18, color: "#2f1c10" }}>{resultDetail}</p>
          {game.campaign?.afterBattle && (
            <div style={{ margin: "0 auto 20px auto", maxWidth: 620, padding: 14, borderRadius: 10, background: "rgba(15,23,42,0.08)", border: `1px solid ${resultBorder}`, textAlign: "left", lineHeight: 1.45, color: "#2f1c10" }}>
              <strong>After Battle:</strong> {game.campaign.afterBattle}
            </div>
          )}
          <CampaignDialogueBlock title="Ending Dialogue" lines={campaignEndDialogue} light />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 22, textAlign: "left" }}>
            {Object.keys(game.players || {}).map(Number).sort((a, b) => a - b).map((p) => {
              const theme = getFactionTheme(game.players[p].faction.id);
              return (
                <div key={p} style={{ border: `1px solid ${theme.border}`, borderRadius: 8, background: "rgba(255,255,255,0.72)", padding: 12 }}>
                  <div style={{ fontWeight: "bold", color: theme.primary }}>{getGamePlayerName(game, p)} <span style={{ color: "#555", fontWeight: "normal" }}>(Player {p})</span> - {game.players[p].faction.name}</div>
                  <div>{game.players[p].life} life</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
            {nextCampaignChapter && (
              <MenuButton onClick={() => continueCampaignChapter(game.campaign.factionId, nextCampaignChapter.id)}>
                Next Mission: {nextCampaignChapter.title}
              </MenuButton>
            )}
            {game.campaign && (
              <MenuButton
                variant="secondary"
                onClick={() => {
                  socket.emit("leaveRoom");
                  resetSelections();
                  setGame(null);
                  setLobby(null);
                  setRole(null);
                  setPlayer(null);
                  setShowCampaign(true);
                }}
              >
                Campaign
              </MenuButton>
            )}
            <MenuButton variant={nextCampaignChapter ? "secondary" : "primary"} onClick={returnToMainMenu}>Main Menu</MenuButton>
          </div>
        </div>
      </div>
    );
  }

  if (isFreeForAllGame) {
    const playerNumbers = Object.keys(game.players || {}).map(Number).sort((a, b) => a - b);
    const activePlayers = playerNumbers.filter((p) => !game.players[p]?.eliminated);
    const targetOptions = activePlayers.filter((p) => p !== player);
    const currentTarget = Number(attackMode?.targetPlayer) || targetOptions[0] || "";
    const hasAnyUnresolvedAttack = (game.handAttacks || []).length > 0 || (game.lanes || []).some((lane) => !!lane.attack);
    const incomingHandAttack = !isSpectator
      ? (game.handAttacks || []).find((a) => a.targetPlayer === player && (!a.block || a.block.length === 0))
      : null;
    const incomingLaneAttack = !isSpectator
      ? (game.lanes || [])
          .map((lane, laneIndex) => ({ lane, laneIndex }))
          .find(({ lane }) => lane.attack?.targetPlayer === player && (!lane.block || lane.block.length === 0))
      : null;
    const defenderMayBlock = !isSpectator && game.phase === "priority" && game.priority === player && !game.priorityPassed?.[player];
    const canDeclareAttack = !isSpectator && game.phase === "priority" && isMyPriority && !hasAnyUnresolvedAttack && !attackMode && !blockMode && !placementMode && !me?.eliminated;
    const activeAttackCard =
      !isSpectator &&
      (attackMode?.from === "hand" && selectedAttackCardIndex != null
        ? me.hand[selectedAttackCardIndex]
        : attackMode?.from === "lane"
          ? game.lanes[attackMode.lane]?.facedown?.[player]
          : null);
    const activeBlockCards = !isSpectator && blockMode?.type === "handAttack" ? selectedBlockCardIndexes.map((idx) => me.hand[idx]).filter(Boolean) : [];
    const activeBlockCard = !isSpectator && blockMode?.type === "laneAttack" ? game.lanes[blockMode.lane]?.facedown?.[player] : activeBlockCards[0] || null;
    const paymentTotal = !isSpectator ? payments.reduce((sum, i) => sum + getCardNumericValue(me.hand[i]), 0) : 0;
    const activeAttackRequired = activeAttackCard ? getCardNumericValue(activeAttackCard) : 0;
    const activeBlockRequired = blockMode?.type === "handAttack"
      ? activeBlockCards.reduce((sum, card) => sum + getCardNumericValue(card), 0)
      : activeBlockCard ? getCardNumericValue(activeBlockCard) : 0;
    const ffaAttackConfirmReason =
      attackMode && !activeAttackCard
        ? "Choose an attacking card first."
        : attackMode && !currentTarget
          ? "Choose a target player."
          : attackMode && paymentTotal < activeAttackRequired
            ? `Select payment cards worth at least ${activeAttackRequired}. Current payment is ${paymentTotal}.`
            : "";
    const ffaBlockConfirmReason =
      blockMode?.type === "handAttack" && activeBlockCards.length === 0
        ? "Choose one or more cards to block with."
        : blockMode?.type === "laneAttack" && !activeBlockCard
          ? "You need a face-down card in that lane to block."
          : blockMode && paymentTotal < activeBlockRequired
            ? `Select payment cards worth at least ${activeBlockRequired}. Current payment is ${paymentTotal}.`
            : "";
    const ffaPlacementConfirmReason = placementMode && selectedPlacementCardIndex == null ? "Choose a hand card to place face-down." : "";
    const currentEndLane = game.endPlacementLaneIndex;
    const firstIndex = Math.max(0, activePlayers.indexOf(game.endPlacementFirstPlayer));
    const currentEndPlayer = activePlayers.length > 0 ? activePlayers[(firstIndex + (game.endPlacementStep || 0)) % activePlayers.length] : null;
    const isMyEndPlacementTurn = !isSpectator && game.phase === "end" && currentEndPlayer === player;
    const ffaUndoRequest = game.undoRequest;
    const ffaUndoNeedsMe = !isSpectator && ffaUndoRequest?.approvalsNeeded?.includes(player) && !ffaUndoRequest?.approvals?.[player];

    const startFfaHandAttack = () => {
      resetSelections();
      setAttackMode({ from: "hand", targetPlayer: targetOptions[0] || "" });
    };
    const startFfaLaneAttack = (lane) => {
      resetSelections();
      setAttackMode({ from: "lane", lane, targetPlayer: targetOptions[0] || "" });
    };
    const confirmFfaAttack = () => {
      if (!attackMode || !currentTarget) return;
      if (attackMode.from === "hand" && selectedAttackCardIndex == null) return;
      if (activeAttackCard && paymentTotal < activeAttackRequired) {
        factionVoiceFor(`Need ${activeAttackRequired} payment; selected ${paymentTotal}.`);
        return;
      }
      socket.emit("confirmAttack", {
        from: attackMode.from,
        lane: attackMode.lane,
        attackCardIndex: selectedAttackCardIndex,
        paymentIndexes: payments,
        useHeraBonus,
        targetPlayer: currentTarget
      });
      resetSelections();
    };
    const confirmFfaBlock = () => {
      if (!blockMode) return;
      if (blockMode.type === "handAttack" && selectedBlockCardIndexes.length === 0) return;
      socket.emit("confirmBlock", {
        lane: blockMode.type === "laneAttack" ? blockMode.lane : null,
        handAttackId: blockMode.type === "handAttack" ? blockMode.handAttackId : null,
        blockCardIndex: selectedBlockCardIndexes[0] ?? null,
        blockCardIndexes: selectedBlockCardIndexes,
        paymentIndexes: payments,
        useHeraBonus
      });
      resetSelections();
    };
    const passFfaBlock = () => {
      socket.emit("confirmBlock", {
        lane: blockMode?.type === "laneAttack" ? blockMode.lane : incomingLaneAttack?.laneIndex ?? null,
        handAttackId: blockMode?.type === "handAttack" ? blockMode.handAttackId : incomingHandAttack?.id ?? null,
        blockCardIndex: -1,
        blockCardIndexes: [],
        paymentIndexes: [],
        useHeraBonus: false
      });
      resetSelections();
    };
    const confirmFfaPlacement = () => {
      if (!placementMode || selectedPlacementCardIndex == null) return;
      socket.emit("placeFacedown", { lane: placementMode.lane, handIndex: selectedPlacementCardIndex });
      resetSelections();
    };
    const skipFfaPlacement = (lane) => {
      socket.emit("skipEndPlacement", { lane });
      resetSelections();
    };
    const startFfaHandBlock = () => {
      if (!incomingHandAttack) return;
      resetSelections();
      setBlockMode({ type: "handAttack", handAttackId: incomingHandAttack.id });
    };
    const startFfaLaneBlock = () => {
      if (!incomingLaneAttack) return;
      resetSelections();
      setBlockMode({ type: "laneAttack", lane: incomingLaneAttack.laneIndex });
    };
    const ffaQuickActionPad = !isSpectator && game.phase !== "gameOver" ? (
      <div
        className="near-hand-actions ffa-quick-actions"
        style={{
          border: `2px solid ${myTheme.border}`,
          borderRadius: 10,
          background: myTheme.light,
          padding: 10,
          display: "grid",
          alignContent: "start",
          gap: 8,
          minWidth: 190
        }}
      >
        <div style={{ fontSize: 12, fontWeight: "bold", color: myTheme.primary, textTransform: "uppercase" }}>Quick Actions</div>
        {(attackMode || blockMode) && (
          <div style={{ border: "1px solid rgba(17,24,39,0.16)", borderRadius: 6, padding: "5px 6px", color: "#111827", fontSize: 12, background: "rgba(255,255,255,0.58)", fontWeight: "bold" }}>
            Payment {paymentTotal}/{attackMode ? activeAttackRequired : activeBlockRequired || "-"}
          </div>
        )}
        {attackMode && (
          <>
            <div style={{ color: "#555", fontSize: 12 }}>
              {attackMode.from === "hand" ? "Choose an attack card, target, and payment." : "Choose a target and payment."}
            </div>
            <QuickActionButton className="quick-action-primary" onClick={confirmFfaAttack} disabled={!!ffaAttackConfirmReason} reason={ffaAttackConfirmReason}>Confirm Attack</QuickActionButton>
            <QuickActionButton className="quick-action-secondary" onClick={resetSelections}>Cancel</QuickActionButton>
          </>
        )}
        {blockMode && (
          <>
            <div style={{ color: "#555", fontSize: 12 }}>Choose block cards if needed, then pay at least the block value.</div>
            <QuickActionButton className="quick-action-primary" onClick={confirmFfaBlock} disabled={!!ffaBlockConfirmReason} reason={ffaBlockConfirmReason}>Confirm Block</QuickActionButton>
            <QuickActionButton className="quick-action-danger" onClick={passFfaBlock}>Take Damage</QuickActionButton>
            <QuickActionButton className="quick-action-secondary" onClick={resetSelections}>Cancel</QuickActionButton>
          </>
        )}
        {placementMode && (
          <>
            <div style={{ color: "#555", fontSize: 12 }}>Choose one hand card to place face-down in lane {placementMode.lane + 1}.</div>
            <QuickActionButton className="quick-action-primary" onClick={confirmFfaPlacement} disabled={!!ffaPlacementConfirmReason} reason={ffaPlacementConfirmReason}>Place Facedown</QuickActionButton>
            <QuickActionButton className="quick-action-secondary" onClick={() => skipFfaPlacement(placementMode.lane)}>Skip Lane</QuickActionButton>
            <QuickActionButton className="quick-action-secondary" onClick={resetSelections}>Cancel</QuickActionButton>
          </>
        )}
        {!attackMode && !blockMode && !placementMode && (
          <>
            {incomingHandAttack && defenderMayBlock && <QuickActionButton className="quick-action-primary" onClick={startFfaHandBlock}>Block with Cards</QuickActionButton>}
            {incomingHandAttack && defenderMayBlock && <QuickActionButton className="quick-action-danger" onClick={passFfaBlock}>Take {incomingHandAttack.effectiveValue} Damage</QuickActionButton>}
            {incomingLaneAttack && defenderMayBlock && <QuickActionButton className="quick-action-primary" onClick={startFfaLaneBlock}>Block Lane</QuickActionButton>}
            {incomingLaneAttack && defenderMayBlock && <QuickActionButton className="quick-action-danger" onClick={passFfaBlock}>Take Damage</QuickActionButton>}
            {canDeclareAttack && <QuickActionButton className="quick-action-primary" onClick={startFfaHandAttack}>Attack from Hand</QuickActionButton>}
            {game.phase === "priority" && isMyPriority && <QuickActionButton className="quick-action-primary" onClick={passPriority}>Pass / Continue</QuickActionButton>}
            {game.phase === "end" && isMyEndPlacementTurn && <QuickActionButton className="quick-action-secondary" onClick={() => skipFfaPlacement(currentEndLane)}>Skip Lane {currentEndLane + 1}</QuickActionButton>}
          </>
        )}
        {(ffaAttackConfirmReason || ffaBlockConfirmReason || ffaPlacementConfirmReason) && (
          <div style={{ color: "#92400e", fontSize: 12, fontWeight: "bold" }}>{ffaAttackConfirmReason || ffaBlockConfirmReason || ffaPlacementConfirmReason}</div>
        )}
        <div style={{ color: "#555", fontSize: 12 }}>{game.message || "Choose an action."}</div>
      </div>
    ) : null;

    return (
      <div style={{ minHeight: "100dvh", boxSizing: "border-box", padding: 10, background: boardBackground, fontFamily: "Arial, sans-serif", color: "#111827" }}>
        <CardInspectModal card={inspectedCard} onClose={() => setInspectedCard(null)} />
        {showDiscardViewer && (
          <DiscardPileModal
            game={game}
            playerNumbers={matchPlayerNumbers}
            onClose={() => setShowDiscardViewer(false)}
            onInspect={setInspectedCard}
            onPreview={setPreviewedCard}
          />
        )}
        <style>{`
          .ffa-hand { display: grid; grid-template-columns: repeat(auto-fit, minmax(86px, 1fr)); gap: 6px; }
          .ffa-hand-content { display: grid; grid-template-columns: minmax(0, 1fr) 220px; gap: 8px; align-items: start; }
          .ffa-card { min-height: 112px !important; font-size: 11px !important; padding: 5px !important; }
          .quick-action-button { border: 1px solid rgba(17, 24, 39, 0.24); border-radius: 8px; padding: 9px 10px; font-weight: 800; cursor: pointer; box-shadow: 0 1px 0 rgba(255,255,255,0.4) inset; }
          .quick-action-button:disabled { opacity: 0.45; cursor: not-allowed; }
          .quick-action-primary { background: #1f2937; color: white; }
          .quick-action-secondary { background: rgba(255,255,255,0.78); color: #111827; }
          .quick-action-danger { background: #b91c1c; color: white; }
          @media (max-width: 760px) {
            .ffa-root { padding: 6px !important; }
            .ffa-grid { grid-template-columns: 1fr !important; }
            .ffa-hand-content { grid-template-columns: 1fr !important; }
            .ffa-hand {
              display: flex !important;
              overflow-x: auto !important;
              overflow-y: hidden !important;
              gap: 4px !important;
              padding-bottom: 6px !important;
              touch-action: pan-x !important;
              scroll-snap-type: x proximity;
            }
            .ffa-card {
              flex: 0 0 92px !important;
              width: 92px !important;
              min-width: 92px !important;
              min-height: 132px !important;
              scroll-snap-align: start;
            }
          }
        `}</style>
        <div className="ffa-root" style={{ display: "grid", gridTemplateRows: "auto auto minmax(0, 1fr) auto", gap: 8, maxWidth: 1500, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0 }}>Gauntlet Online</h2>
              <div style={{ fontSize: 13, fontWeight: "bold" }}>Free-for-all - Turn {game.turn} - {game.phase} - Priority Player {game.priority}</div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <RoomCodeDisplay code={game.roomCode} roleLabel={isSpectator ? "Spectator" : `Player ${player}`} onCopy={copyRoomCode} />
              <button onClick={() => setShowHotkeys((value) => !value)}>Shortcuts</button>
              {!isSpectator && <button onClick={() => setShowOpponentAbilities((value) => !value)}>{showOpponentAbilities ? "Hide Abilities" : "Show Abilities"}</button>}
              <HelperToggle enabled={showHelperLabels} onToggle={() => setShowHelperLabels((value) => !value)} />
              <button onClick={returnToMainMenu}>Main Menu</button>
            </div>
          </div>
          <HotkeyWindow visible={showHotkeys} onClose={() => setShowHotkeys(false)} />
          {copyNotice && <div style={{ color: "#fde68a", fontWeight: "bold" }}>{copyNotice}</div>}
          {error && <div style={{ color: "#b91c1c", fontWeight: "bold" }}>{error}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
            {playerNumbers.map((p) => {
              const pTheme = getFactionTheme(game.players[p].faction.id);
              return (
                <div key={p} style={{ border: `2px solid ${game.priority === p ? "#f59e0b" : pTheme.border}`, borderRadius: 8, background: game.players[p].eliminated ? "rgba(31,41,55,0.18)" : "rgba(255,255,255,0.9)", padding: 8 }}>
                  <strong style={{ color: pTheme.primary }}>{getGamePlayerName(game, p)} {p === player ? "(You)" : ""}</strong>
                  <div>Player {p} - {game.players[p].faction.name}</div>
                  <div>{game.players[p].life} life - {game.players[p].connected ? "Connected" : "Disconnected"}</div>
                  {p !== player && <div>{game.players[p].handCount ?? game.players[p].hand?.length ?? 0} cards in hand</div>}
                  {game.players[p].eliminated && <div style={{ color: "#991b1b", fontWeight: "bold" }}>Eliminated</div>}
                  {p !== player && showOpponentAbilities && (
                    <div style={{ borderTop: `1px solid ${pTheme.border}`, marginTop: 6, paddingTop: 6, fontSize: 12, display: "grid", gap: 6, textAlign: "center" }}>
                      {["commander", "city", "general"].map((key) => game.players[p].faction?.[key] && (
                        <div key={key} style={{ border: `1px solid ${pTheme.border}`, borderRadius: 7, padding: 7, background: "rgba(255,255,255,0.62)" }}>
                          <span style={{ color: "#64748b", fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>{key}</span>
                          <strong style={{ display: "block", color: pTheme.primary }}>{game.players[p].faction[key].name}</strong>
                          <div>{game.players[p].faction[key].text}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <CombatStrip game={game} />
          <div className="ffa-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 300px", gap: 8, minHeight: 0 }}>
            <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
              <SectionCard title="Lanes" borderColor="#111" background="rgba(255,255,255,0.92)" style={{ padding: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(120px, 1fr))", gap: 7, overflowX: "auto" }}>
                  {game.lanes.map((lane, i) => (
                    <div key={i} style={{ border: `2px solid ${lane.attack ? "#991b1b" : "#111"}`, borderRadius: 8, padding: 7, background: lane.attack ? "#fff1f2" : "#f8fafc", fontSize: 12 }}>
                      <strong>Lane {i + 1}</strong>
                      <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
                        {playerNumbers.map((p) => (
                          <LaneCardLabel key={p} label={`P${p}`} card={lane.facedown?.[p]} hidden={p !== player && !!lane.facedown?.[p]} />
                        ))}
                      </div>
                      {lane.attack && <div style={{ marginTop: 6 }}><strong>Attack:</strong> P{lane.attack.player} to P{lane.attack.targetPlayer} {getCardShortLabel(lane.attack.card)} ({lane.attack.effectiveValue})</div>}
                      {lane.block?.length > 0 && <div><strong>Blocks:</strong> {lane.block.map((entry, idx) => <span key={idx}> P{entry.player}:{getCardShortLabel(entry.card)} ({entry.effectiveValue || 0})</span>)}</div>}
                      {!isSpectator && canDeclareAttack && lane.facedown?.[player] && !lane.attack && <button onClick={() => startFfaLaneAttack(i)} style={{ marginTop: 6 }}>Attack</button>}
                      {!isSpectator && defenderMayBlock && lane.attack?.targetPlayer === player && lane.block.length === 0 && <button onClick={() => { resetSelections(); setBlockMode({ type: "laneAttack", lane: i }); }} style={{ marginTop: 6 }}>Block Lane</button>}
                      {!isSpectator && isMyEndPlacementTurn && i === currentEndLane && !game.endPlaced?.[player]?.[i] && <div style={{ marginTop: 6 }}><button onClick={() => { resetSelections(); setPlacementMode({ lane: i }); }}>Place</button><button onClick={() => skipFfaPlacement(i)} style={{ marginLeft: 6 }}>Skip</button></div>}
                    </div>
                  ))}
                </div>
              </SectionCard>
              {!isSpectator && <SectionCard title={`Your Hand (${me.hand.length})`} borderColor={myTheme.border} background="rgba(255,255,255,0.96)" style={{ padding: 8 }}>
                <div className="ffa-hand-content">
                  <div className="ffa-hand">
                    {me.hand.map((card, i) => {
                      const selected = payments.includes(i) || selectedAttackCardIndex === i || selectedBlockCardIndexes.includes(i) || selectedPlacementCardIndex === i;
                      return (
                        <div key={card.id || i} className="ffa-card">
                          <CardBox card={card} selected={selected} accent={myTheme.primary} bg={selected ? "#dbeafe" : "white"} onInspect={setInspectedCard} onPreview={setPreviewedCard}>
                            {(attackMode?.from === "hand" || blockMode?.type === "handAttack" || placementMode || attackMode || blockMode) && (
                              <div className="card-action-rail">
                                {attackMode?.from === "hand" && <button onClick={() => selectAttackCard(i)} style={{ width: "100%", fontSize: 10 }}>Attack</button>}
                                {blockMode?.type === "handAttack" && <button onClick={() => selectBlockCard(i)} style={{ width: "100%", fontSize: 10 }}>{selectedBlockCardIndexes.includes(i) ? "Remove" : "Block"}</button>}
                                {placementMode && <button onClick={() => setSelectedPlacementCardIndex(i)} style={{ width: "100%", fontSize: 10 }}>Place</button>}
                                {(attackMode || blockMode) && <button onClick={() => togglePayment(i)} style={{ width: "100%", fontSize: 10 }}>Pay</button>}
                              </div>
                            )}
                            <div className="card-actions" style={{ display: "grid", gap: 4 }}>
                              <div style={{ fontSize: 9, color: "#4b5563" }}>Index {i}</div>
                            </div>
                          </CardBox>
                        </div>
                      );
                    })}
                  </div>
                  {ffaQuickActionPad}
                </div>
              </SectionCard>}
            </div>
            {!isSpectator && <SectionCard title="Actions" borderColor={myTheme.border} background="rgba(255,255,255,0.96)" style={{ padding: 10, alignSelf: "start" }}>
              <p style={{ marginTop: 0 }}>{game.message || "Choose an action."}</p>
              {ffaUndoRequest && (
                <div style={{ marginBottom: 10, padding: 10, borderRadius: 8, background: "#fef3c7", border: "1px solid #f59e0b" }}>
                  <strong>Undo requested:</strong> Player {ffaUndoRequest.requester} wants to undo {ffaUndoRequest.label}.
                  {ffaUndoNeedsMe && <div style={{ display: "flex", gap: 8, marginTop: 8 }}><button onClick={() => respondUndo(true)}>Approve Undo</button><button onClick={() => respondUndo(false)}>Decline</button></div>}
                </div>
              )}
              <HelperText enabled={showHelperLabels}>This panel shows the detailed setup for the action you are currently building.</HelperText>
              {!attackMode && !blockMode && !placementMode && <p style={{ color: "#555" }}>Use Quick Actions beside your hand for the main turn commands.</p>}
              {attackMode && <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                <label>Target <select value={currentTarget} onChange={(e) => setAttackMode((prev) => ({ ...prev, targetPlayer: Number(e.target.value) }))}>{targetOptions.map((p) => <option key={p} value={p}>Player {p}</option>)}</select></label>
                <div>Selected: {activeAttackCard ? getCardShortLabel(activeAttackCard) : "none"} - Pay {paymentTotal}/{activeAttackRequired}</div>
                <button onClick={confirmFfaAttack} disabled={!activeAttackCard || !currentTarget}>Confirm Attack</button>
                <button onClick={resetSelections}>Cancel</button>
              </div>}
              {blockMode && <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                <div>Block payment: {paymentTotal}/{activeBlockRequired || "-"}</div>
                <button onClick={confirmFfaBlock} disabled={activeBlockRequired <= 0 || paymentTotal < activeBlockRequired}>Confirm Block</button>
                <button onClick={passFfaBlock} style={{ color: "#991b1b" }}>Take Damage</button>
                <button onClick={resetSelections}>Cancel</button>
              </div>}
              {placementMode && <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                <div>Place in lane {placementMode.lane + 1}: {selectedPlacementCardIndex != null ? getCardShortLabel(me.hand[selectedPlacementCardIndex]) : "choose a card"}</div>
                <button onClick={confirmFfaPlacement} disabled={selectedPlacementCardIndex == null}>Confirm Placement</button>
                <button onClick={resetSelections}>Cancel</button>
              </div>}
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <button onClick={requestUndo}>Request Undo</button>
                <button onClick={concedeGame} style={{ color: "#991b1b" }}>Concede</button>
              </div>
              <PaymentLogPanel game={game} />
            </SectionCard>}
          </div>
        </div>
      </div>
    );
  }

  const opponentNumber = !isSpectator ? (player === 1 ? 2 : 1) : null;
  const hasIncomingAttack =
    !isSpectator &&
    ((game.handAttacks || []).some((a) => a.player === opponentNumber) ||
      (game.lanes || []).some((lane) => lane.attack && lane.attack.player === opponentNumber));
  const defenderMayBlock = !isSpectator && game.phase === "priority" && game.priority === player && !game.priorityPassed?.[player];
  const incomingHandAttack = !isSpectator
    ? (game.handAttacks || []).find((a) => a.player === opponentNumber && (!a.block || a.block.length === 0))
    : null;
  const incomingLaneAttack = !isSpectator
    ? (game.lanes || [])
        .map((lane, laneIndex) => ({ lane, laneIndex }))
        .find(({ lane }) => lane.attack?.player === opponentNumber && (!lane.block || lane.block.length === 0))
    : null;

  const hasAnyUnresolvedAttack =
    (game.handAttacks || []).length > 0 || (game.lanes || []).some((lane) => !!lane.attack);

  const canDeclareAttack =
    !isSpectator &&
    game.winner == null &&
    game.phase === "priority" &&
    isMyPriority &&
    !hasAnyUnresolvedAttack &&
    !attackMode &&
    !blockMode &&
    !placementMode &&
    !abilityMode;

  const activeAttackCard =
    !isSpectator &&
    (attackMode?.from === "hand" && selectedAttackCardIndex != null
      ? me.hand[selectedAttackCardIndex]
      : attackMode?.from === "lane"
        ? game.lanes[attackMode.lane]?.facedown?.[player]
        : null);

  const activeBlockCards =
    !isSpectator && blockMode?.type === "handAttack"
      ? selectedBlockCardIndexes.map((idx) => me.hand[idx]).filter(Boolean)
      : [];
  const activeBlockCard =
    !isSpectator && blockMode?.type === "laneAttack"
      ? game.lanes[blockMode.lane]?.facedown?.[player]
      : activeBlockCards[0] || (selectedBlockCardIndex != null ? me.hand[selectedBlockCardIndex] : null);
  const activeBlockRequired =
    blockMode?.type === "handAttack"
      ? activeBlockCards.reduce((sum, card) => sum + getCardNumericValue(card), 0)
      : activeBlockCard
        ? getCardNumericValue(activeBlockCard)
        : 0;
  const activePlacementCard = !isSpectator && placementMode && selectedPlacementCardIndex != null ? me.hand[selectedPlacementCardIndex] : null;

  const heraBonusAvailable =
    !isSpectator &&
    me.faction.id === "bizi" &&
    !me.turnData.heraUsed &&
    (me.turnData.suitsPlayedThisTurn || []).length > 0 &&
    payments.some((i) => me.hand[i] && me.turnData.suitsPlayedThisTurn.includes(me.hand[i].suit));

  const paymentTotal =
    !isSpectator
      ? payments.reduce((sum, i) => sum + getCardNumericValue(me.hand[i]), 0) + (useHeraBonus && heraBonusAvailable ? 2 : 0)
      : 0;
  const meerusFreeAttackApplies =
    activeAttackCard &&
    me?.faction?.id === "rumin" &&
    (me?.turnData?.attacksDeclaredThisTurn || 0) === 2 &&
    me?.turnData?.meerusFreeAttackAvailable &&
    getCardNumericValue(activeAttackCard) <= 3;
  const activeAttackRequired = activeAttackCard ? (meerusFreeAttackApplies ? 0 : getCardNumericValue(activeAttackCard)) : 0;
  const paymentWarning =
    attackMode && activeAttackCard && paymentTotal < activeAttackRequired
      ? `Need ${activeAttackRequired} payment; selected ${paymentTotal}.`
      : blockMode && activeBlockRequired > 0 && paymentTotal < activeBlockRequired
        ? `Need ${activeBlockRequired} payment; selected ${paymentTotal}.`
        : "";
  const attackConfirmReason =
    attackMode && !activeAttackCard
      ? "Choose an attacking card first."
      : attackMode && paymentTotal < activeAttackRequired
        ? `Select payment cards worth at least ${activeAttackRequired}. Current payment is ${paymentTotal}.`
        : "";
  const blockConfirmReason =
    blockMode?.type === "handAttack" && activeBlockCards.length === 0
      ? "Choose one or more cards to block with."
      : blockMode?.type === "laneAttack" && !activeBlockCard
        ? "You need a face-down card in that lane to block."
        : blockMode && paymentTotal < activeBlockRequired
          ? `Select payment cards worth at least ${activeBlockRequired}. Current payment is ${paymentTotal}.`
          : "";
  const placementConfirmReason = placementMode && !activePlacementCard ? "Choose a hand card to place face-down." : "";

  const currentEndLane = game.endPlacementLaneIndex;
  const isMyEndPlacementTurn =
    !isSpectator &&
    game.phase === "end" &&
    currentEndLane >= 0 &&
    currentEndLane <= 2 &&
    game.endPlacementFirstPlayer != null &&
    (() => {
      const first = game.endPlacementFirstPlayer;
      const second = first === 1 ? 2 : 1;
      const currentPlayer = game.endPlacementStep === 0 ? first : second;
      return currentPlayer === player;
    })();

  const clickableTargets = isSpectator
    ? { poleaPlaceLanes: [], poleaSwitchableLanes: [], poleaPeekTargets: [], poleaBuffLaneCards: [], poleaBuffLaneAttacks: [], poleaBuffHandAttacks: [], lafayetteLanes: [], focusLaneCards: [], focusLaneAttacks: [], focusHandAttacks: [] }
    : {
        poleaPlaceLanes: [0, 1, 2].filter((laneIdx) => !game.lanes[laneIdx].facedown[player]),
        poleaSwitchableLanes: [0, 1, 2].filter((laneIdx) => !!game.lanes[laneIdx].facedown[player]),
        poleaPeekTargets: [1, 2].flatMap((p) => [0, 1, 2].filter((laneIdx) => !!game.lanes[laneIdx].facedown[p]).map((laneIdx) => ({ targetPlayer: p, lane: laneIdx }))),
        poleaBuffLaneCards: [0, 1, 2].filter((laneIdx) => !!game.lanes[laneIdx].facedown[player]),
        poleaBuffLaneAttacks: [0, 1, 2].filter((laneIdx) => game.lanes[laneIdx].attack && game.lanes[laneIdx].attack.player === player),
        poleaBuffHandAttacks: game.handAttacks.filter((a) => a.player === player),
        lafayetteLanes: [0, 1, 2].filter((laneIdx) => !!game.lanes[laneIdx].facedown[player]),
        focusLaneCards: [0, 1, 2].filter((laneIdx) => !!game.lanes[laneIdx].facedown[player]),
        focusLaneAttacks: [0, 1, 2].filter((laneIdx) => game.lanes[laneIdx].attack && game.lanes[laneIdx].attack.player === player),
        focusHandAttacks: game.handAttacks.filter((a) => a.player === player)
      };

  function startAttackFromHand() { resetSelections(); setAttackMode({ from: "hand" }); }
  function startAttackFromLane(lane) { resetSelections(); setAttackMode({ lane, from: "lane" }); }
  function startBlockLaneAttack(lane) { resetSelections(); setBlockMode({ type: "laneAttack", lane }); }
  function startPlacement(lane) { resetSelections(); setPlacementMode({ lane }); }

  function startPolea() {
    resetSelections();
    setAbilityMode({ type: "polea", mode: "", handIndex: "", lane: "", laneA: "", laneB: "", targetPlayer: "", targetType: "", handAttackId: "" });
  }

  function startLafayette() { resetSelections(); setAbilityMode({ type: "lafayette", lane: "", handIndex: "" }); }
  function startFocus() { resetSelections(); setAbilityMode({ type: "focus", targetType: "", lane: "", handAttackId: "" }); }

  function confirmAttack() {
    if (!attackMode) return;
    if (attackMode.from === "hand" && selectedAttackCardIndex == null) return;
    if (activeAttackCard && paymentTotal < activeAttackRequired) {
      factionVoiceFor(`Need ${activeAttackRequired} payment; selected ${paymentTotal}.`);
      return;
    }
    socket.emit("confirmAttack", { from: attackMode.from, lane: attackMode.lane, attackCardIndex: selectedAttackCardIndex, paymentIndexes: payments, useHeraBonus, targetPlayer: attackMode.targetPlayer });
    resetSelections();
  }

  function confirmBlock() {
    if (!blockMode) return;
    if (blockMode.type === "handAttack" && selectedBlockCardIndexes.length === 0) return;
    if (blockMode.type === "laneAttack" && !activeBlockCard) return;
    socket.emit("confirmBlock", {
      lane: blockMode.type === "laneAttack" ? blockMode.lane : null,
      handAttackId: blockMode.type === "handAttack" ? blockMode.handAttackId : null,
      blockCardIndex: selectedBlockCardIndexes[0] ?? null,
      blockCardIndexes: selectedBlockCardIndexes,
      paymentIndexes: payments,
      useHeraBonus
    });
    resetSelections();
  }

  function passHandAttack(handAttackId) {
    resetSelections();
    socket.emit("confirmBlock", {
      lane: null,
      handAttackId,
      blockCardIndex: -1,
      blockCardIndexes: [],
      paymentIndexes: [],
      useHeraBonus: false
    });
  }

  function passLaneAttack(lane) {
    resetSelections();
    socket.emit("confirmBlock", {
      lane,
      handAttackId: null,
      blockCardIndex: -1,
      blockCardIndexes: [],
      paymentIndexes: [],
      useHeraBonus: false
    });
  }

  function passCurrentBlock() {
    if (blockMode?.type === "handAttack") {
      passHandAttack(blockMode.handAttackId);
      return;
    }
    if (blockMode?.type === "laneAttack") {
      passLaneAttack(blockMode.lane);
      return;
    }
    passPriority();
  }

  function confirmPlacement() {
    if (!placementMode || selectedPlacementCardIndex == null) return;
    socket.emit("placeFacedown", { lane: placementMode.lane, handIndex: selectedPlacementCardIndex });
    resetSelections();
  }

  function confirmAbility() {
    if (!abilityMode) return;

    if (abilityMode.type === "polea") {
      const mode = Number(abilityMode.mode);
      if (![1, 2, 3, 4].includes(mode)) return;

      if (mode === 1) socket.emit("usePolea", { mode, handIndex: Number(abilityMode.handIndex), lane: Number(abilityMode.lane) });
      if (mode === 2) socket.emit("usePolea", { mode, laneA: Number(abilityMode.laneA), laneB: Number(abilityMode.laneB) });
      if (mode === 3) socket.emit("usePolea", { mode, targetPlayer: Number(abilityMode.targetPlayer), lane: Number(abilityMode.lane) });
      if (mode === 4) {
        const payload = { mode, targetType: abilityMode.targetType };
        if (abilityMode.targetType === "laneCard" || abilityMode.targetType === "laneAttack") payload.lane = Number(abilityMode.lane);
        if (abilityMode.targetType === "handAttack") payload.handAttackId = abilityMode.handAttackId;
        socket.emit("usePolea", payload);
      }
    }

    if (abilityMode.type === "lafayette") socket.emit("useLafayette", { lane: Number(abilityMode.lane), handIndex: Number(abilityMode.handIndex) });

    if (abilityMode.type === "focus") {
      const payload = { targetType: abilityMode.targetType };
      if (abilityMode.targetType === "laneCard" || abilityMode.targetType === "laneAttack") payload.lane = Number(abilityMode.lane);
      if (abilityMode.targetType === "handAttack") payload.handAttackId = abilityMode.handAttackId;
      socket.emit("useFocusBuff", payload);
    }

    resetSelections();
  }

  function skipPlacement(lane) { socket.emit("skipEndPlacement", { lane }); resetSelections(); }
  function passPriority() { socket.emit("passPriority"); resetSelections(); }
  function requestUndo() { socket.emit("requestUndo"); }
  function respondUndo(approve) { socket.emit("respondUndo", { approve }); }
  function concedeGame() {
    if (window.confirm("Concede this game? This will immediately give your opponent the win.")) {
      socket.emit("concedeGame");
      resetSelections();
    }
  }
  function offerDraw() {
    const accepting = game.drawOfferBy && game.drawOfferBy !== player;
    const prompt = accepting
      ? "Accept the intentional draw offer? This will end the game as a draw."
      : "Offer an intentional draw to your opponent?";
    if (window.confirm(prompt)) {
      socket.emit("offerDraw");
      resetSelections();
    }
  }

  function confirmCurrentAction() {
    if (attackMode) {
      confirmAttack();
      return;
    }
    if (blockMode) {
      confirmBlock();
      return;
    }
    if (placementMode) {
      confirmPlacement();
      return;
    }
    if (abilityMode) {
      confirmAbility();
    }
  }

  function startIncomingBlock() {
    if (!defenderMayBlock) return;
    if (incomingHandAttack) {
      resetSelections();
      setBlockMode({ type: "handAttack", handAttackId: incomingHandAttack.id });
      return;
    }
    if (incomingLaneAttack) {
      resetSelections();
      setBlockMode({ type: "laneAttack", lane: incomingLaneAttack.laneIndex });
    }
  }

  function startFirstLaneAttack() {
    if (!canDeclareAttack) return;
    const laneIndex = game.lanes.findIndex((lane) => lane.facedown?.[player] && !lane.attack);
    if (laneIndex >= 0) startAttackFromLane(laneIndex);
  }

  async function copyRoomCode(code, mode = "code") {
    if (!code) return;
    const value = mode === "link" ? roomJoinUrl(code) : code;
    const label = mode === "link" ? "join link" : `room ${code}`;
    try {
      await navigator.clipboard.writeText(value);
      setCopyNotice(`Copied ${label}.`);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = value;
      textArea.setAttribute("readonly", "");
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopyNotice(copied ? `Copied ${label}.` : `Select ${value} and press Ctrl+C to copy it.`);
    }
  }

  hotkeyActionsRef.current = {
    a: () => { if (canDeclareAttack) startAttackFromHand(); },
    l: startFirstLaneAttack,
    b: startIncomingBlock,
    t: () => { if (blockMode || hasIncomingAttack) passCurrentBlock(); },
    p: () => { if (!isSpectator && game.phase === "priority" && game.priority === player) passPriority(); },
    e: () => { if (isMyEndPlacementTurn) startPlacement(currentEndLane); },
    s: () => { if (isMyEndPlacementTurn) skipPlacement(currentEndLane); },
    c: confirmCurrentAction,
    x: resetSelections,
    escape: resetSelections
  };

  function phaseHelpText() {
    if (isSpectator) return "Watching game.";
    if (game.winner != null || game.phase === "gameOver") return "Game over.";
    if (game.phase === "priority") {
      if (hasIncomingAttack && game.priorityPassed?.[player]) return "You passed on this attack. Waiting to move to damage.";
      if (hasIncomingAttack) return "You may block or take damage before declaring a new attack.";
      if (hasAnyUnresolvedAttack) return "Combat is unresolved. Finish blocks and damage before another attack.";
      return isMyPriority ? "It is your priority. You may attack, use abilities, or pass." : "Waiting for the other player.";
    }
    if (game.phase === "damage") return "Damage is resolving automatically.";
    if (game.phase === "end") return isMyEndPlacementTurn ? `End of Turn: Lane ${currentEndLane + 1}. Place one facedown card or skip.` : `End of Turn: Lane ${currentEndLane + 1}. Waiting for the other player.`;
    return "";
  }

  function quickActionHelpText() {
    if (game.phase === "damage" && game.message && /waiting/i.test(game.message)) return game.message;
    return phaseHelpText();
  }

  function phaseDisplayName() {
    if (game.phase === "priority") return "Command";
    if (game.phase === "damage") return "Resolving";
    if (game.phase === "end") return "Set Lanes";
    if (game.phase === "gameOver") return "Game Over";
    return game.phase;
  }

  function factionVoiceFor(message) {
    if (!message || isSpectator || !me) return;
    const quote = getFactionVoiceLine(me.faction.id, message);
    setFactionVoice({ quote, detail: message });
    speakFactionQuote(me.faction.id, quote);
  }

  function handlePowerClick(power) {
    setExpandedPower(power.id);
    if (power.id !== "commander" || isSpectator || !me) return;

    const quote = getFactionVoiceLine(me.faction.id, `${power.feature?.name || "commander"}-${Date.now()}`);
    setFactionVoice({ quote, detail: `${power.feature?.name || me.faction.name} speaks` });
    speakFactionQuote(me.faction.id, quote);
  }

  const undoRequest = game.undoRequest;
  const undoNeedsMyApproval = !isSpectator && undoRequest?.approvalsNeeded?.includes(player) && !undoRequest?.approvals?.[player];
  const drawActionLabel = game.drawOfferBy && game.drawOfferBy !== player ? "Accept Draw" : game.drawOfferBy === player ? "Draw Offered" : "Offer Draw";
  const actionControls = !isSpectator && game.phase !== "gameOver" ? (
    <div className="action-icon-dock">
      <ActionIconButton icon="↶" label="Request Undo" onClick={requestUndo} iconOnly />
      <ActionIconButton icon="☰" label="Main Menu" onClick={returnToMainMenu} iconOnly />
      {!isBasicGame && me.faction.id === "frumo" && game.phase === "priority" && isMyPriority && <button onClick={startPolea} disabled={me.turnData.poleaUsed}>Use Polea</button>}
      {!isBasicGame && me.faction.id === "frumo" && game.phase === "priority" && isMyPriority && <button onClick={startLafayette} disabled={me.turnData.lafayetteUsed}>Use Lafayette</button>}
      {!isBasicGame && me.faction.id === "bizi" && game.phase === "priority" && isMyPriority && <button onClick={startFocus} disabled={me.turnData.focusBuffUsed || me.accelerationCounters <= 0}>Use Focus Buff</button>}
      <ActionIconButton icon="½" label={drawActionLabel} onClick={offerDraw} disabled={game.drawOfferBy === player} iconOnly />
      <ActionIconButton icon="×" label="Concede" onClick={concedeGame} danger iconOnly />
    </div>
  ) : null;

  const nearHandActionPad = !isSpectator && game.phase !== "gameOver" ? (
    <div
      className="near-hand-actions"
      style={{
        border: `1px solid ${myTheme.border}`,
        borderRadius: 6,
        background: "rgba(12,8,5,0.84)",
        padding: 8,
        display: "grid",
        alignContent: "start",
        gap: 6,
        minWidth: 0,
        maxHeight: attackMode || blockMode || placementMode ? 190 : 124,
        overflowY: "auto"
      }}
    >
      <div style={{ fontSize: 12, fontWeight: "bold", color: "#f7d99e", textTransform: "uppercase" }}>Quick Actions</div>
      {(attackMode || blockMode) && (
        <div style={{ border: "1px solid rgba(247,217,158,0.28)", borderRadius: 5, padding: "5px 6px", color: "#fff4d6", fontSize: 12, background: "rgba(255,239,207,0.06)" }}>
          Payment {paymentTotal}/{attackMode ? activeAttackRequired : activeBlockRequired || "-"}
        </div>
      )}
      {attackMode && (
        <>
          <QuickActionButton className="quick-action-primary" onClick={confirmAttack} disabled={!!attackConfirmReason} reason={attackConfirmReason}>Confirm Attack</QuickActionButton>
          <QuickActionButton className="quick-action-secondary" onClick={resetSelections}>Cancel</QuickActionButton>
        </>
      )}
      {blockMode && (
        <>
          <QuickActionButton className="quick-action-primary" onClick={confirmBlock} disabled={!!blockConfirmReason} reason={blockConfirmReason}>Confirm Block</QuickActionButton>
          <QuickActionButton className="quick-action-danger" onClick={passCurrentBlock}>Take Damage</QuickActionButton>
          <QuickActionButton className="quick-action-secondary" onClick={resetSelections}>Cancel</QuickActionButton>
        </>
      )}
      {placementMode && (
        <>
          <div className="mobile-action-detail">
            <strong>Lane {placementMode.lane + 1}</strong>
            <span>{activePlacementCard ? `Selected: ${getCardShortLabel(activePlacementCard)}` : "Choose a hand card, then place it face-down."}</span>
          </div>
          <QuickActionButton className="quick-action-primary" onClick={confirmPlacement} disabled={!!placementConfirmReason} reason={placementConfirmReason}>Place Facedown</QuickActionButton>
          <QuickActionButton className="quick-action-secondary" onClick={() => skipPlacement(placementMode.lane)}>Skip Lane</QuickActionButton>
          <QuickActionButton className="quick-action-secondary" onClick={resetSelections}>Cancel</QuickActionButton>
        </>
      )}
      {abilityMode && (
        <>
          <div className="mobile-action-detail">
            {abilityMode.type === "polea" && (
              <>
                <label>Mode
                  <select value={abilityMode.mode} onChange={(e) => setAbilityMode((prev) => ({ ...prev, mode: e.target.value, handIndex: "", lane: "", laneA: "", laneB: "", targetPlayer: "", targetType: "", handAttackId: "" }))}>
                    <option value="">Select mode</option>
                    <option value="1">Put hand card into empty lane</option>
                    <option value="2">Switch lane cards</option>
                    <option value="3">Look at face-down card</option>
                    <option value="4">Give +1 value</option>
                  </select>
                </label>
                {String(abilityMode.mode) === "1" && (
                  <>
                    <label>Hand card
                      <select value={abilityMode.handIndex} onChange={(e) => setAbilityMode((prev) => ({ ...prev, handIndex: e.target.value }))}>
                        <option value="">Select hand card</option>
                        {me.hand.map((card, idx) => <option key={card.id} value={idx}>{idx}: {getCardShortLabel(card)}</option>)}
                      </select>
                    </label>
                    <label>Empty lane
                      <select value={abilityMode.lane} onChange={(e) => setAbilityMode((prev) => ({ ...prev, lane: e.target.value }))}>
                        <option value="">Select lane</option>
                        {clickableTargets.poleaPlaceLanes.map((laneIdx) => <option key={laneIdx} value={laneIdx}>Lane {laneIdx + 1}</option>)}
                      </select>
                    </label>
                  </>
                )}
                {String(abilityMode.mode) === "2" && (
                  <>
                    <label>First lane
                      <select value={abilityMode.laneA} onChange={(e) => setAbilityMode((prev) => ({ ...prev, laneA: e.target.value }))}>
                        <option value="">Select lane</option>
                        {clickableTargets.poleaSwitchableLanes.map((laneIdx) => <option key={laneIdx} value={laneIdx}>Lane {laneIdx + 1}</option>)}
                      </select>
                    </label>
                    <label>Second lane
                      <select value={abilityMode.laneB} onChange={(e) => setAbilityMode((prev) => ({ ...prev, laneB: e.target.value }))}>
                        <option value="">Select lane</option>
                        {clickableTargets.poleaSwitchableLanes.map((laneIdx) => <option key={laneIdx} value={laneIdx}>Lane {laneIdx + 1}</option>)}
                      </select>
                    </label>
                  </>
                )}
                {String(abilityMode.mode) === "3" && (
                  <label>Face-down target
                    <select value={abilityMode.targetPlayer !== "" && abilityMode.lane !== "" ? `${abilityMode.targetPlayer}-${abilityMode.lane}` : ""} onChange={(e) => { const [targetPlayer, lane] = e.target.value.split("-"); setAbilityMode((prev) => ({ ...prev, targetPlayer: targetPlayer ?? "", lane: lane ?? "" })); }}>
                      <option value="">Select face-down card</option>
                      {clickableTargets.poleaPeekTargets.map((t, idx) => <option key={`${t.targetPlayer}-${t.lane}-${idx}`} value={`${t.targetPlayer}-${t.lane}`}>Player {t.targetPlayer} - Lane {t.lane + 1}</option>)}
                    </select>
                  </label>
                )}
                {String(abilityMode.mode) === "4" && (
                  <>
                    <label>Target type
                      <select value={abilityMode.targetType} onChange={(e) => setAbilityMode((prev) => ({ ...prev, targetType: e.target.value, lane: "", handAttackId: "" }))}>
                        <option value="">Select target type</option>
                        <option value="laneCard">Your face-down lane card</option>
                        <option value="laneAttack">Your lane attack</option>
                        <option value="handAttack">Your hand attack</option>
                      </select>
                    </label>
                    {(abilityMode.targetType === "laneCard" || abilityMode.targetType === "laneAttack") && (
                      <label>Lane
                        <select value={abilityMode.lane} onChange={(e) => setAbilityMode((prev) => ({ ...prev, lane: e.target.value }))}>
                          <option value="">Select lane</option>
                          {(abilityMode.targetType === "laneCard" ? clickableTargets.poleaBuffLaneCards : clickableTargets.poleaBuffLaneAttacks).map((laneIdx) => <option key={laneIdx} value={laneIdx}>Lane {laneIdx + 1}</option>)}
                        </select>
                      </label>
                    )}
                    {abilityMode.targetType === "handAttack" && (
                      <label>Hand attack
                        <select value={abilityMode.handAttackId} onChange={(e) => setAbilityMode((prev) => ({ ...prev, handAttackId: e.target.value }))}>
                          <option value="">Select hand attack</option>
                          {clickableTargets.poleaBuffHandAttacks.map((a) => <option key={a.id} value={a.id}>{a.id} - {getCardShortLabel(a.card)}</option>)}
                        </select>
                      </label>
                    )}
                  </>
                )}
              </>
            )}
            {abilityMode.type === "lafayette" && (
              <>
                <label>Lane card
                  <select value={abilityMode.lane} onChange={(e) => setAbilityMode((prev) => ({ ...prev, lane: e.target.value }))}>
                    <option value="">Select lane</option>
                    {clickableTargets.lafayetteLanes.map((laneIdx) => <option key={laneIdx} value={laneIdx}>Lane {laneIdx + 1}</option>)}
                  </select>
                </label>
                <label>Hand card
                  <select value={abilityMode.handIndex} onChange={(e) => setAbilityMode((prev) => ({ ...prev, handIndex: e.target.value }))}>
                    <option value="">Select hand card</option>
                    {me.hand.map((card, idx) => <option key={card.id} value={idx}>{idx}: {getCardShortLabel(card)}</option>)}
                  </select>
                </label>
              </>
            )}
            {abilityMode.type === "focus" && (
              <>
                <span>Acceleration: {me.accelerationCounters}</span>
                <label>Target type
                  <select value={abilityMode.targetType} onChange={(e) => setAbilityMode((prev) => ({ ...prev, targetType: e.target.value, lane: "", handAttackId: "" }))}>
                    <option value="">Select target type</option>
                    <option value="laneCard">Your face-down lane card</option>
                    <option value="laneAttack">Your lane attack</option>
                    <option value="handAttack">Your hand attack</option>
                  </select>
                </label>
                {(abilityMode.targetType === "laneCard" || abilityMode.targetType === "laneAttack") && (
                  <label>Lane
                    <select value={abilityMode.lane} onChange={(e) => setAbilityMode((prev) => ({ ...prev, lane: e.target.value }))}>
                      <option value="">Select lane</option>
                      {(abilityMode.targetType === "laneCard" ? clickableTargets.focusLaneCards : clickableTargets.focusLaneAttacks).map((laneIdx) => <option key={laneIdx} value={laneIdx}>Lane {laneIdx + 1}</option>)}
                    </select>
                  </label>
                )}
                {abilityMode.targetType === "handAttack" && (
                  <label>Hand attack
                    <select value={abilityMode.handAttackId} onChange={(e) => setAbilityMode((prev) => ({ ...prev, handAttackId: e.target.value }))}>
                      <option value="">Select hand attack</option>
                      {clickableTargets.focusHandAttacks.map((a) => <option key={a.id} value={a.id}>{a.id} - {getCardShortLabel(a.card)}</option>)}
                    </select>
                  </label>
                )}
              </>
            )}
          </div>
          <QuickActionButton className="quick-action-primary" onClick={confirmAbility}>Confirm Ability</QuickActionButton>
          <QuickActionButton className="quick-action-secondary" onClick={resetSelections}>Cancel</QuickActionButton>
        </>
      )}
      {!attackMode && !blockMode && !placementMode && !abilityMode && (
        <>
          {hasIncomingAttack && incomingHandAttack && defenderMayBlock && <QuickActionButton className="quick-action-primary" onClick={() => setBlockMode({ type: "handAttack", handAttackId: incomingHandAttack.id })}>Block with Cards</QuickActionButton>}
          {hasIncomingAttack && incomingHandAttack && defenderMayBlock && <QuickActionButton className="quick-action-danger" onClick={() => passHandAttack(incomingHandAttack.id)}>Take {incomingHandAttack.effectiveValue} Damage</QuickActionButton>}
          {hasIncomingAttack && incomingLaneAttack && defenderMayBlock && <QuickActionButton className="quick-action-primary" onClick={() => startBlockLaneAttack(incomingLaneAttack.laneIndex)}>Block Lane</QuickActionButton>}
          {hasIncomingAttack && incomingLaneAttack && defenderMayBlock && <QuickActionButton className="quick-action-danger" onClick={() => passLaneAttack(incomingLaneAttack.laneIndex)}>Take Damage</QuickActionButton>}
          {canDeclareAttack && <QuickActionButton className="quick-action-primary" onClick={startAttackFromHand}>Attack from Hand</QuickActionButton>}
          {game.phase === "priority" && isMyPriority && <QuickActionButton className="quick-action-primary" onClick={passPriority}>Pass / Continue</QuickActionButton>}
          {game.phase === "end" && isMyEndPlacementTurn && !game.lanes[currentEndLane]?.facedown?.[player] && <QuickActionButton className="quick-action-primary" onClick={() => startPlacement(currentEndLane)}>Place Lane {currentEndLane + 1}</QuickActionButton>}
          {game.phase === "end" && isMyEndPlacementTurn && <QuickActionButton className="quick-action-secondary" onClick={() => skipPlacement(currentEndLane)}>Skip Lane {currentEndLane + 1}</QuickActionButton>}
        </>
      )}
      {(attackConfirmReason || blockConfirmReason || placementConfirmReason) && (
        <div style={{ color: "#fcd34d", fontSize: 12, fontWeight: "bold" }}>{attackConfirmReason || blockConfirmReason || placementConfirmReason}</div>
      )}
      {paymentWarning && <div style={{ color: "#991b1b", fontSize: 12, fontWeight: "bold" }}>{paymentWarning}</div>}
      <div style={{ color: game.phase === "damage" && game.message && /waiting/i.test(game.message) ? "#f7d99e" : TABLETOP_THEME.muted, fontSize: 12, fontWeight: game.phase === "damage" && game.message && /waiting/i.test(game.message) ? "bold" : "normal" }}>
        {quickActionHelpText()}
      </div>
    </div>
  ) : null;
  const sidePreviewCard = previewedCard || inspectedCard;
  const deckCountSummary = matchPlayerNumbers.map((p) => `P${p} ${game.players?.[p]?.deckCount ?? game.players?.[p]?.deck?.length ?? 0}`).join(" / ");
  const discardCountSummary = matchPlayerNumbers.map((p) => `P${p} ${game.players?.[p]?.discardCount ?? game.players?.[p]?.discard?.length ?? 0}`).join(" / ");

  const powerCards = !isSpectator && !isBasicGame
    ? [
        { id: "commander", title: "Commander", feature: me.faction.commander },
        { id: "city", title: "City", feature: me.faction.city },
        { id: "general", title: "General", feature: me.faction.general }
      ]
    : [];
  const selectedPower = powerCards.find((power) => power.id === expandedPower) || powerCards[0];
  const normalizedEvents = (actionLog || [])
    .map((entry, index) => (typeof entry === "string" ? { id: `legacy-${index}`, text: entry, turn: game.turn || 1, phase: game.phase || "game" } : entry))
    .filter((entry) => entry?.text)
    .slice()
    .sort((a, b) => {
      const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
      const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
      return bTime - aTime;
    });
  const recentTurnFloor = Math.max(1, (game.turn || 1) - 1);
  const currentTurnEvents = normalizedEvents.filter((entry) => (entry.turn || 1) >= recentTurnFloor);
  const olderEvents = normalizedEvents.filter((entry) => (entry.turn || 1) < recentTurnFloor);

  function renderEventEntry(entry, idx, compact = false) {
    return (
      <div key={entry.id || `${entry.text}-${idx}`} style={{ padding: compact ? 8 : 10, borderRadius: 8, background: idx === 0 && !compact ? myTheme.light : "#f3f4f6", border: "1px solid rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize: 11, color: "#555", marginBottom: 3 }}>Turn {entry.turn || 1} - {entry.phase || "game"}</div>
        <div>{entry.text}</div>
      </div>
    );
  }

  let rightPanel;

  if (isSpectator) {
    rightPanel = <div><h3 style={{ marginTop: 0 }}>Spectator View</h3><p>You are watching this match.</p><p><strong>Spectators:</strong> {game.spectatorCount || 0}</p></div>;
  } else if (attackMode) {
    rightPanel = (
      <div>
        <h3 style={{ marginTop: 0, color: myTheme.primary }}>Attack Setup</h3>
        <div style={{ marginBottom: 10, padding: 10, borderRadius: 10, background: myTheme.light }}>
          <p style={{ margin: 0 }}><strong>From:</strong> {attackMode.from}</p>
          {attackMode.from === "lane" && <p style={{ margin: "6px 0 0 0" }}><strong>Lane:</strong> {attackMode.lane + 1}</p>}
          <p style={{ margin: "6px 0 0 0" }}><strong>Selected attack card:</strong> {activeAttackCard ? getCardShortLabel(activeAttackCard) : "None selected"}</p>
        </div>
        {me.faction.id === "bizi" && !me.turnData.heraUsed && (me.turnData.suitsPlayedThisTurn || []).length > 0 && <label style={{ display: "block", marginBottom: 10 }}><input type="checkbox" checked={useHeraBonus} onChange={(e) => setUseHeraBonus(e.target.checked)} /> Use Hera payment bonus</label>}
        <p><strong>Payment total:</strong> {paymentTotal}</p>
        <p><strong>Required:</strong> {activeAttackCard ? activeAttackRequired : "-"}</p>
        {meerusFreeAttackApplies && <p style={{ color: myTheme.primary, fontWeight: "bold" }}>Meerus: this third attack costs 0.</p>}
        {paymentWarning && <div style={{ marginBottom: 10, color: "#991b1b", fontWeight: "bold" }}>{paymentWarning}</div>}
        <button onClick={confirmAttack} disabled={!activeAttackCard} style={{ marginRight: 10 }}>Confirm Attack</button>
        <button onClick={resetSelections}>Cancel</button>
      </div>
    );
  } else if (blockMode) {
    if (blockMode.type === "handAttack") {
      const attack = game.handAttacks.find((a) => a.id === blockMode.handAttackId);
      const required = activeBlockRequired;

      rightPanel = (
        <div>
          <h3 style={{ marginTop: 0, color: oppTheme.primary }}>Block Hand Attack</h3>
          <div style={{ marginBottom: 10, padding: 10, borderRadius: 10, background: oppTheme.light }}>
            <p style={{ margin: 0 }}><strong>Incoming attack:</strong> {attack ? `${getCardShortLabel(attack.card)} (effective ${attack.effectiveValue})` : "None"}</p>
            <p style={{ margin: "6px 0 0 0" }}><strong>Selected block cards:</strong> {activeBlockCards.length > 0 ? activeBlockCards.map(getCardShortLabel).join(", ") : "None selected"}</p>
          </div>
          {me.faction.id === "bizi" && !me.turnData.heraUsed && (me.turnData.suitsPlayedThisTurn || []).length > 0 && <label style={{ display: "block", marginBottom: 10 }}><input type="checkbox" checked={useHeraBonus} onChange={(e) => setUseHeraBonus(e.target.checked)} /> Use Hera payment bonus</label>}
          <p><strong>Payment total:</strong> {paymentTotal}</p>
          <p><strong>Required:</strong> {activeBlockCards.length > 0 ? required : "-"}</p>
          {paymentWarning && <div style={{ marginBottom: 10, color: "#991b1b", fontWeight: "bold" }}>{paymentWarning}</div>}
          <button onClick={confirmBlock} disabled={activeBlockCards.length === 0 || paymentTotal < required} style={{ marginRight: 10 }}>Confirm Block</button>
          <button onClick={passCurrentBlock} style={{ marginRight: 10 }}>Pass / Take Damage</button>
          <button onClick={resetSelections}>Cancel</button>
        </div>
      );
    } else {
      const laneAttack = game.lanes[blockMode.lane]?.attack;
      const laneBlocker = game.lanes[blockMode.lane]?.facedown?.[player];
      const required = laneBlocker ? getCardNumericValue(laneBlocker) : 0;

      rightPanel = (
        <div>
          <h3 style={{ marginTop: 0, color: oppTheme.primary }}>Block Lane Attack</h3>
          <div style={{ marginBottom: 10, padding: 10, borderRadius: 10, background: oppTheme.light }}>
            <p style={{ margin: 0 }}><strong>Lane:</strong> {blockMode.lane + 1}</p>
            <p style={{ margin: "6px 0 0 0" }}><strong>Incoming attack:</strong> {laneAttack ? `${getCardShortLabel(laneAttack.card)} (effective ${laneAttack.effectiveValue})` : "None"}</p>
            <p style={{ margin: "6px 0 0 0" }}><strong>Lane blocker:</strong> {laneBlocker ? getCardShortLabel(laneBlocker) : "No card in this lane"}</p>
          </div>
          <p><strong>Payment total:</strong> {paymentTotal}</p>
          <p><strong>Required:</strong> {laneBlocker ? required : "-"}</p>
          {paymentWarning && <div style={{ marginBottom: 10, color: "#991b1b", fontWeight: "bold" }}>{paymentWarning}</div>}
          <button onClick={confirmBlock} disabled={!laneBlocker || paymentTotal < required} style={{ marginRight: 10 }}>Confirm Lane Block</button>
          <button onClick={passCurrentBlock} style={{ marginRight: 10 }}>Pass / Take Damage</button>
          <button onClick={resetSelections}>Cancel</button>
        </div>
      );
    }
  } else if (placementMode) {
    rightPanel = (
      <div>
        <h3 style={{ marginTop: 0, color: myTheme.primary }}>Facedown Placement</h3>
        <div style={{ marginBottom: 10, padding: 10, borderRadius: 10, background: myTheme.light }}>
          <p style={{ margin: 0 }}><strong>Lane:</strong> {placementMode.lane + 1}</p>
          <p style={{ margin: "6px 0 0 0" }}><strong>Selected card:</strong> {activePlacementCard ? getCardShortLabel(activePlacementCard) : "None selected"}</p>
        </div>
        <button onClick={confirmPlacement} disabled={!activePlacementCard} style={{ marginRight: 10 }}>Confirm Placement</button>
        <button onClick={resetSelections}>Cancel</button>
      </div>
    );
  } else if (abilityMode?.type === "polea") {
    rightPanel = (
      <div>
        <h3 style={{ marginTop: 0, color: myTheme.primary }}>Polea Ability</h3>
        <label style={{ display: "block", marginBottom: 10 }}>Mode
          <select value={abilityMode.mode} onChange={(e) => setAbilityMode((prev) => ({ ...prev, mode: e.target.value, handIndex: "", lane: "", laneA: "", laneB: "", targetPlayer: "", targetType: "", handAttackId: "" }))} style={{ display: "block", width: "100%", marginTop: 4 }}>
            <option value="">Select mode</option><option value="1">Put hand card into empty lane</option><option value="2">Switch up to 2 lane cards you control</option><option value="3">Look at 1 face-down card</option><option value="4">Give +1 value until end of turn</option>
          </select>
        </label>
        {String(abilityMode.mode) === "1" && <><label style={{ display: "block", marginBottom: 10 }}>Choose hand card<select value={abilityMode.handIndex} onChange={(e) => setAbilityMode((prev) => ({ ...prev, handIndex: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 4 }}><option value="">Select hand card</option>{me.hand.map((card, idx) => <option key={card.id} value={idx}>{idx}: {getCardShortLabel(card)}</option>)}</select></label><label style={{ display: "block", marginBottom: 10 }}>Choose empty lane<select value={abilityMode.lane} onChange={(e) => setAbilityMode((prev) => ({ ...prev, lane: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 4 }}><option value="">Select lane</option>{clickableTargets.poleaPlaceLanes.map((laneIdx) => <option key={laneIdx} value={laneIdx}>Lane {laneIdx + 1}</option>)}</select></label></>}
        {String(abilityMode.mode) === "2" && <><label style={{ display: "block", marginBottom: 10 }}>First occupied lane<select value={abilityMode.laneA} onChange={(e) => setAbilityMode((prev) => ({ ...prev, laneA: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 4 }}><option value="">Select lane</option>{clickableTargets.poleaSwitchableLanes.map((laneIdx) => <option key={laneIdx} value={laneIdx}>Lane {laneIdx + 1}</option>)}</select></label><label style={{ display: "block", marginBottom: 10 }}>Second occupied lane<select value={abilityMode.laneB} onChange={(e) => setAbilityMode((prev) => ({ ...prev, laneB: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 4 }}><option value="">Select lane</option>{clickableTargets.poleaSwitchableLanes.map((laneIdx) => <option key={laneIdx} value={laneIdx}>Lane {laneIdx + 1}</option>)}</select></label></>}
        {String(abilityMode.mode) === "3" && <><label style={{ display: "block", marginBottom: 10 }}>Choose face-down target<select value={abilityMode.targetPlayer !== "" && abilityMode.lane !== "" ? `${abilityMode.targetPlayer}-${abilityMode.lane}` : ""} onChange={(e) => { const [targetPlayer, lane] = e.target.value.split("-"); setAbilityMode((prev) => ({ ...prev, targetPlayer: targetPlayer ?? "", lane: lane ?? "" })); }} style={{ display: "block", width: "100%", marginTop: 4 }}><option value="">Select face-down card</option>{clickableTargets.poleaPeekTargets.map((t, idx) => <option key={`${t.targetPlayer}-${t.lane}-${idx}`} value={`${t.targetPlayer}-${t.lane}`}>Player {t.targetPlayer} - Lane {t.lane + 1}</option>)}</select></label>{peekResult && <div style={{ marginBottom: 10, padding: 10, background: "#f3f4f6", borderRadius: 8 }}><strong>Peek Result:</strong> {peekResult}</div>}</>}
        {String(abilityMode.mode) === "4" && <><label style={{ display: "block", marginBottom: 10 }}>Target type<select value={abilityMode.targetType} onChange={(e) => setAbilityMode((prev) => ({ ...prev, targetType: e.target.value, lane: "", handAttackId: "" }))} style={{ display: "block", width: "100%", marginTop: 4 }}><option value="">Select target type</option><option value="laneCard">Your face-down lane card</option><option value="laneAttack">Your lane attack</option><option value="handAttack">Your hand attack</option></select></label>{abilityMode.targetType === "laneCard" && <label style={{ display: "block", marginBottom: 10 }}>Choose lane card<select value={abilityMode.lane} onChange={(e) => setAbilityMode((prev) => ({ ...prev, lane: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 4 }}><option value="">Select lane</option>{clickableTargets.poleaBuffLaneCards.map((laneIdx) => <option key={laneIdx} value={laneIdx}>Lane {laneIdx + 1}</option>)}</select></label>}{abilityMode.targetType === "laneAttack" && <label style={{ display: "block", marginBottom: 10 }}>Choose lane attack<select value={abilityMode.lane} onChange={(e) => setAbilityMode((prev) => ({ ...prev, lane: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 4 }}><option value="">Select attacking lane</option>{clickableTargets.poleaBuffLaneAttacks.map((laneIdx) => <option key={laneIdx} value={laneIdx}>Lane {laneIdx + 1}</option>)}</select></label>}{abilityMode.targetType === "handAttack" && <label style={{ display: "block", marginBottom: 10 }}>Choose hand attack<select value={abilityMode.handAttackId} onChange={(e) => setAbilityMode((prev) => ({ ...prev, handAttackId: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 4 }}><option value="">Select hand attack</option>{clickableTargets.poleaBuffHandAttacks.map((a) => <option key={a.id} value={a.id}>{a.id} - {getCardShortLabel(a.card)}</option>)}</select></label>}</>}
        <button onClick={confirmAbility} style={{ marginRight: 10 }}>Confirm Ability</button><button onClick={resetSelections}>Cancel</button>
      </div>
    );
  } else if (abilityMode?.type === "lafayette") {
    rightPanel = (
      <div><h3 style={{ marginTop: 0, color: myTheme.primary }}>Lafayette Ability</h3><label style={{ display: "block", marginBottom: 10 }}>Lane with your face-down card<select value={abilityMode.lane} onChange={(e) => setAbilityMode((prev) => ({ ...prev, lane: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 4 }}><option value="">Select lane</option>{clickableTargets.lafayetteLanes.map((laneIdx) => <option key={laneIdx} value={laneIdx}>Lane {laneIdx + 1}</option>)}</select></label><label style={{ display: "block", marginBottom: 10 }}>Hand card to swap in<select value={abilityMode.handIndex} onChange={(e) => setAbilityMode((prev) => ({ ...prev, handIndex: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 4 }}><option value="">Select hand card</option>{me.hand.map((card, idx) => <option key={card.id} value={idx}>{idx}: {getCardShortLabel(card)}</option>)}</select></label><button onClick={confirmAbility} style={{ marginRight: 10 }}>Confirm Ability</button><button onClick={resetSelections}>Cancel</button></div>
    );
  } else if (abilityMode?.type === "focus") {
    rightPanel = (
      <div><h3 style={{ marginTop: 0, color: myTheme.primary }}>Focus Ability</h3><p><strong>Acceleration Counters:</strong> {me.accelerationCounters}</p><label style={{ display: "block", marginBottom: 10 }}>Target type<select value={abilityMode.targetType} onChange={(e) => setAbilityMode((prev) => ({ ...prev, targetType: e.target.value, lane: "", handAttackId: "" }))} style={{ display: "block", width: "100%", marginTop: 4 }}><option value="">Select target type</option><option value="laneCard">Your face-down lane card</option><option value="laneAttack">Your lane attack</option><option value="handAttack">Your hand attack</option></select></label>{abilityMode.targetType === "laneCard" && <label style={{ display: "block", marginBottom: 10 }}>Choose lane card<select value={abilityMode.lane} onChange={(e) => setAbilityMode((prev) => ({ ...prev, lane: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 4 }}><option value="">Select lane</option>{clickableTargets.focusLaneCards.map((laneIdx) => <option key={laneIdx} value={laneIdx}>Lane {laneIdx + 1}</option>)}</select></label>}{abilityMode.targetType === "laneAttack" && <label style={{ display: "block", marginBottom: 10 }}>Choose lane attack<select value={abilityMode.lane} onChange={(e) => setAbilityMode((prev) => ({ ...prev, lane: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 4 }}><option value="">Select attacking lane</option>{clickableTargets.focusLaneAttacks.map((laneIdx) => <option key={laneIdx} value={laneIdx}>Lane {laneIdx + 1}</option>)}</select></label>}{abilityMode.targetType === "handAttack" && <label style={{ display: "block", marginBottom: 10 }}>Choose hand attack<select value={abilityMode.handAttackId} onChange={(e) => setAbilityMode((prev) => ({ ...prev, handAttackId: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 4 }}><option value="">Select hand attack</option>{clickableTargets.focusHandAttacks.map((a) => <option key={a.id} value={a.id}>{a.id} - {getCardShortLabel(a.card)}</option>)}</select></label>}<button onClick={confirmAbility} style={{ marginRight: 10 }}>Confirm Ability</button><button onClick={resetSelections}>Cancel</button></div>
    );
  } else {
    rightPanel = <div><h3 style={{ marginTop: 0, color: myTheme.primary }}>Action Panel</h3><p>No action selected.</p>{!isSpectator && <p style={{ color: "#555" }}>Choose an attack, block, placement, or faction ability from the left.</p>}</div>;
  }

  return (
    <div className="game-root" style={{ padding: 8, fontFamily: "Arial, sans-serif", height: "100dvh", boxSizing: "border-box", overflow: "hidden", display: "grid", gridTemplateRows: "auto auto minmax(0, 1fr)", background: tabletopBoardBackground, backgroundAttachment: "fixed", color: TABLETOP_THEME.text }}>
      <CardInspectModal card={inspectedCard} onClose={() => setInspectedCard(null)} />
      {showDiscardViewer && (
        <DiscardPileModal
          game={game}
          playerNumbers={matchPlayerNumbers}
          onClose={() => setShowDiscardViewer(false)}
          onInspect={setInspectedCard}
          onPreview={setPreviewedCard}
        />
      )}
      <style>{`
        .game-root button {
          border-radius: 5px;
          border: 1px solid rgba(205,154,86,0.54);
          background: linear-gradient(180deg, #7a4a22 0%, #4c2a16 48%, #1e120b 100%);
          color: #f5ead5;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -10px 18px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.24);
          transition: transform 120ms ease, box-shadow 120ms ease, filter 120ms ease, border-color 120ms ease;
          cursor: pointer;
        }
        .game-root button:not(:disabled):hover {
          transform: translateY(-1px);
          border-color: rgba(247,217,158,0.76);
          filter: brightness(1.08);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -10px 18px rgba(0,0,0,0.2), 0 6px 16px rgba(0,0,0,0.34);
        }
        .game-root button:not(:disabled):active {
          transform: translateY(1px) scale(0.985);
          box-shadow: inset 0 2px 10px rgba(0,0,0,0.42), 0 1px 4px rgba(0,0,0,0.28);
        }
        .game-root button:disabled {
          opacity: 0.48;
          filter: grayscale(0.6);
          box-shadow: none;
        }
        .game-root select,
        .game-root input {
          border-radius: 4px;
          border: 1px solid rgba(205,154,86,0.42);
          background: rgba(16,10,7,0.84);
          color: #f5ead5;
        }
        .mobile-action-detail {
          display: none;
        }
        .mobile-life-hud {
          display: none;
        }
        .incoming-attack-banner {
          margin-bottom: 6px;
          padding: 8px 10px;
          border-radius: 7px;
          border: 2px solid #dc2626;
          background: linear-gradient(180deg, rgba(127,29,29,0.98), rgba(45,12,12,0.98));
          color: #fff7ed;
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
          flex: 0 0 auto;
          font-weight: 800;
          box-shadow: 0 8px 22px rgba(0,0,0,0.26), inset 0 0 0 1px rgba(254,202,202,0.24);
        }
        .incoming-attack-banner button,
        .incoming-attack-pill button {
          border: 1px solid rgba(254,202,202,0.5);
          border-radius: 5px;
          background: rgba(255,255,255,0.12);
          color: #fff7ed;
          font-weight: 800;
          cursor: pointer;
        }
        .incoming-attack-pill {
          margin-bottom: 6px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          align-self: flex-start;
          padding: 5px 8px;
          border-radius: 999px;
          border: 1px solid rgba(254,202,202,0.65);
          background: rgba(127,29,29,0.96);
          color: #fff7ed;
          font-size: 12px;
          font-weight: 800;
        }
        .compact-power-card {
          position: relative;
          overflow: hidden;
        }
        .compact-power-card::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(110deg, transparent 0 36%, rgba(255,255,255,0.26) 48%, transparent 60%);
          transform: translateX(-120%);
          transition: transform 280ms ease;
          pointer-events: none;
        }
        .compact-power-card:hover::after,
        .compact-power-card-active::after {
          transform: translateX(120%);
        }
        .compact-power-portrait {
          width: 62px;
          height: 70px;
          border-radius: 9px;
          overflow: hidden;
          background: radial-gradient(circle at 50% 28%, rgba(247,217,158,0.3), transparent 38%), #111;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.2), 0 6px 12px rgba(0,0,0,0.28);
        }
        .match-top-frame {
          display: grid;
          grid-template-columns: 210px minmax(0, 1fr) 292px;
          gap: 8px;
          align-items: stretch;
          min-height: 92px;
          margin-bottom: 6px;
        }
        .gauntlet-logo-panel,
        .top-opponent-panel,
        .top-action-panel,
        .bottom-player-panel,
        .table-side-panel {
          border: 1px solid rgba(205,154,86,0.42);
          border-radius: 6px;
          background: ${TABLETOP_THEME.panel};
          box-shadow: ${TABLETOP_THEME.shadow};
          outline: 1px solid rgba(43,25,12,0.92);
          outline-offset: -5px;
        }
        .gauntlet-logo-panel {
          display: grid;
          align-content: center;
          padding: 10px 14px;
        }
        .gauntlet-logo-panel h2 {
          font-family: Georgia, serif;
          font-size: 27px;
          line-height: 0.92;
          margin: 0;
          letter-spacing: 0;
        }
        .top-opponent-panel {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
          align-items: stretch;
          padding: 8px;
        }
        .top-state-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          align-content: center;
          justify-content: flex-end;
          width: min(360px, 31vw);
        }
        .deck-slot {
          min-height: 0;
          min-width: 72px;
          border: 1px solid rgba(205,154,86,0.28);
          border-radius: 5px;
          display: grid;
          grid-template-rows: auto 1fr auto;
          gap: 4px;
          place-items: center;
          color: ${TABLETOP_THEME.muted};
          background: rgba(8,5,3,0.34);
          font-family: Georgia, serif;
          font-size: 11px;
          padding: 5px 7px;
          text-align: center;
        }
        button.deck-slot {
          cursor: pointer;
          background: rgba(8,5,3,0.34);
          color: ${TABLETOP_THEME.muted};
          font-family: Georgia, serif;
          box-shadow: none;
        }
        button.deck-slot:hover,
        button.deck-slot:focus-visible {
          border-color: rgba(247,217,158,0.7);
          box-shadow: 0 0 0 2px rgba(245,158,11,0.18), 0 4px 12px rgba(0,0,0,0.28);
        }
        .deck-slot-live {
          border-color: rgba(34,197,94,0.48);
          box-shadow: inset 0 0 0 1px rgba(34,197,94,0.16), 0 4px 12px rgba(0,0,0,0.24);
        }
        .command-slot {
          min-width: 104px;
          border-color: rgba(247,217,158,0.54);
        }
        .command-slot .deck-slot-card {
          width: 58px;
          height: 34px;
          font-size: 10px;
        }
        .deck-slot.compact {
          grid-template-rows: 1fr;
          min-width: 54px;
          font-size: 12px;
          padding: 8px 9px;
        }
        .deck-slot-card {
          width: 34px;
          height: 48px;
          border: 1px solid rgba(247,217,158,0.58);
          border-radius: 4px;
          display: grid;
          place-items: center;
          color: #ffe5a9;
          background:
            radial-gradient(circle at 50% 42%, rgba(247,217,158,0.28), transparent 24%),
            linear-gradient(135deg, rgba(42,24,13,0.98), rgba(9,6,4,0.98));
          box-shadow: inset 0 0 0 2px rgba(0,0,0,0.36), 0 4px 10px rgba(0,0,0,0.38);
          font-size: 16px;
          line-height: 1;
        }
        .deck-slot-card.empty {
          color: rgba(247,217,158,0.46);
          background: linear-gradient(180deg, rgba(25,15,9,0.78), rgba(7,5,4,0.82));
          font-size: 9px;
          text-transform: uppercase;
        }
        .deck-slot-card.status-card {
          width: 46px;
          font-size: 10px;
          padding: 0 4px;
        }
        .deck-slot-count {
          color: #fff4d6;
          font-family: Arial, sans-serif;
          font-size: 10px;
          font-weight: 800;
          line-height: 1.15;
          max-width: 86px;
          overflow-wrap: anywhere;
        }
        .top-action-panel {
          display: grid;
          grid-template-rows: auto 1fr;
          gap: 6px;
          padding: 8px;
        }
        .top-action-panel .music-control {
          display: grid;
          min-width: 0;
        }
        .top-action-panel .music-control > div {
          gap: 6px !important;
          font-size: 11px !important;
        }
        .top-action-panel .music-control input {
          width: 86px !important;
        }
        .top-action-icons {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 42px 42px;
          gap: 8px;
          align-items: center;
        }
        .action-icon-dock {
          display: grid;
          grid-template-columns: repeat(4, 42px);
          gap: 8px;
          align-items: center;
          justify-content: end;
        }
        .match-table-frame {
          min-height: 0;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(270px, 300px);
          grid-template-rows: minmax(0, 1fr);
          gap: 10px;
          overflow: hidden;
        }
        .table-main-panel {
          min-height: 0;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          gap: 6px;
          overflow: hidden;
        }
        .current-play-panel {
          justify-self: center;
          width: min(420px, 72%);
          border: 1px solid rgba(205,154,86,0.4);
          border-radius: 5px;
          background: rgba(14,9,6,0.82);
          color: ${TABLETOP_THEME.text};
          padding: 6px 10px;
          text-align: center;
          box-shadow: ${TABLETOP_THEME.shadow};
          max-height: 132px;
          overflow: auto;
        }
        .current-play-panel strong {
          color: #f7d99e;
          font-family: Georgia, serif;
        }
        .bottom-player-panel {
          display: grid;
          grid-template-columns: minmax(220px, 300px) minmax(0, 1fr);
          gap: 8px;
          align-items: stretch;
          padding: 7px;
          min-height: 0;
          max-height: 270px;
          overflow: hidden;
        }
        .bottom-left-actions {
          min-height: 0;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          gap: 7px;
          overflow: hidden;
        }
        .table-side-panel {
          min-height: 0;
          display: grid;
          grid-template-rows: minmax(0, 0.9fr) minmax(0, 0.72fr) minmax(178px, 0.74fr);
          gap: 8px;
          padding: 8px;
          overflow: hidden;
        }
        .table-side-panel > .section-card-shell {
          min-height: 0;
          overflow: auto;
          margin-bottom: 0 !important;
        }
        .passive-status-actions button,
        .passive-status-actions select,
        .passive-status-actions label {
          display: none !important;
        }
        .passive-status-actions {
          color: ${TABLETOP_THEME.text};
        }
        .card-preview-panel {
          min-height: 0;
          border: 1px solid rgba(247,217,158,0.42);
          border-radius: 5px;
          background: linear-gradient(180deg, rgba(20,12,7,0.74), rgba(6,4,3,0.68));
          padding: 8px;
          display: grid;
          align-content: stretch;
          justify-items: center;
          gap: 8px;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.04);
          overflow: hidden;
        }
        .card-preview-panel h3 {
          margin: 0;
          font-family: Georgia, serif;
          text-transform: uppercase;
          letter-spacing: 0;
          font-size: 16px;
        }
        .card-preview-panel .card-box {
          width: min(154px, 100%) !important;
          min-width: 0 !important;
          min-height: 148px !important;
          max-height: 100% !important;
        }
        .card-preview-panel .card-box button {
          min-height: 22px !important;
          padding-top: 3px !important;
          padding-bottom: 3px !important;
        }
        .game-root .section-card-shell {
          position: relative;
        }
        .game-root .board-lanes,
        .game-root .power-section,
        .game-root .response-strip,
        .game-root .recent-events-section,
        .game-root .opponent-intel,
        .game-root .game-side > .section-card-shell,
        .game-root > .section-card-shell {
          background: ${TABLETOP_THEME.panel} !important;
          border-color: ${TABLETOP_THEME.goldSoft} !important;
          color: ${TABLETOP_THEME.text};
          border-radius: 7px !important;
          box-shadow: ${TABLETOP_THEME.shadow};
          outline: 1px solid rgba(43,25,12,0.92);
          outline-offset: -5px;
        }
        .game-root .board-lanes::before,
        .game-root .power-section::before,
        .game-root .response-strip::before,
        .game-root .recent-events-section::before,
        .game-root .game-side > .section-card-shell::before {
          content: "";
          position: absolute;
          inset: 5px;
          pointer-events: none;
          border: 1px solid rgba(205,154,86,0.28);
          border-radius: 4px;
        }
        .game-root h2,
        .game-root h3 {
          color: #f7d99e;
          text-shadow: 0 1px 2px rgba(0,0,0,0.58);
        }
        .game-root p,
        .game-root span,
        .game-root label,
        .game-root div {
          scrollbar-color: rgba(205,154,86,0.66) rgba(16,10,7,0.7);
        }
        .game-root .lane-card {
          background: radial-gradient(circle at 50% 25%, rgba(247,217,158,0.2), transparent 36%), linear-gradient(180deg, rgba(43,27,16,0.94), rgba(10,7,5,0.94)) !important;
          border-color: rgba(247,217,158,0.78) !important;
          border-radius: 6px !important;
          color: ${TABLETOP_THEME.text};
          min-height: clamp(118px, 22dvh, 158px) !important;
          padding: 6px !important;
          overflow-y: auto !important;
          justify-content: flex-start !important;
          gap: 5px !important;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.1), inset 0 -24px 48px rgba(0,0,0,0.34), 0 10px 24px rgba(0,0,0,0.36), 0 0 0 1px rgba(0,0,0,0.8) !important;
        }
        .game-root .lane-card > p {
          color: #ffe1a3;
          text-align: center;
          letter-spacing: 0;
          text-transform: uppercase;
          margin-bottom: 4px !important;
          text-shadow: 0 1px 3px rgba(0,0,0,0.72);
        }
        .lane-card-line {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          align-items: baseline;
          padding: 3px 4px;
          border-bottom: 1px solid rgba(247,217,158,0.18);
          background: rgba(255,239,207,0.05);
          border-radius: 4px;
          font-size: 12px;
        }
        .lane-card-line span {
          color: ${TABLETOP_THEME.muted};
          font-size: 9px;
          text-transform: uppercase;
          font-weight: 800;
        }
        .lane-card-line strong {
          color: #fff4d6;
          font-size: 12px;
        }
        .game-root .card-box button {
          color: #23160d;
          background: linear-gradient(180deg, #f7dfb9, #c7965d);
          border-color: rgba(82,50,26,0.45);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.42);
        }
        .game-root .card-action-rail {
          position: absolute;
          left: 5px;
          right: 5px;
          top: 44px;
          z-index: 8;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(42px, 1fr));
          gap: 3px;
          padding: 3px;
          border: 1px solid rgba(82,50,26,0.4);
          border-radius: 5px;
          background: linear-gradient(180deg, rgba(255,247,237,0.98), rgba(232,194,142,0.96));
          box-shadow: 0 5px 12px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.54);
        }
        .game-root .card-action-rail button {
          min-height: 25px;
          padding: 4px 5px;
          font-size: 10px;
          line-height: 1.05;
          font-weight: 900;
          border-radius: 4px;
          cursor: pointer;
        }
        .game-root .hand-section {
          background: transparent !important;
          border: 0 !important;
          outline: 0 !important;
          box-shadow: none !important;
          color: ${TABLETOP_THEME.text};
        }
        .game-root .hand-card-row {
          padding: 4px 2px 7px 2px;
        }
        .game-root .hand-section h3 {
          margin-bottom: 6px !important;
        }
        .game-root .top-play-area {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(300px, 0.7fr);
          gap: 8px;
          align-items: start;
          flex: 0 0 auto;
          margin-bottom: 8px;
        }
        .game-root .tabletop-status-strip {
          display: grid;
          grid-template-columns: repeat(4, minmax(120px, 1fr));
          gap: 7px;
          padding: 6px;
          margin-bottom: 8px;
          border-top: 1px solid rgba(205,154,86,0.28);
          border-bottom: 1px solid rgba(205,154,86,0.28);
          background: rgba(10,7,5,0.42);
        }
        .game-root .player-intel-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(260px, 0.72fr);
          gap: 8px;
          align-items: stretch;
          margin-bottom: 8px;
        }
        .player-frame-stack {
          display: grid;
          grid-template-rows: auto auto;
          gap: 8px;
          min-height: 100%;
        }
        .player-frame-row {
          display: flex;
          gap: 8px;
        }
        .player-frame-row-bottom {
          align-items: end;
        }
        .player-frame {
          width: 100%;
          min-width: 0;
          border: 1px solid;
          border-radius: 6px;
          padding: 9px 10px;
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          align-items: start;
          gap: 6px;
          box-shadow: ${TABLETOP_THEME.shadow};
        }
        .player-frame-top {
          border-bottom-width: 3px;
        }
        .player-frame-bottom {
          border-top-width: 3px;
        }
        .player-frame-stats {
          display: flex;
          gap: 6px 10px;
          align-items: center;
          justify-content: flex-start;
          flex-wrap: wrap;
          color: #f5ead5;
          font-weight: 800;
          font-size: 12px;
          min-width: 0;
        }
        .player-frame-stats > span {
          min-width: 0;
          max-width: min(40vw, 430px);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .player-frame-stats > span[title^="CCG"] {
          flex: 1 1 240px;
          max-width: 100%;
        }
        .player-stat-icon {
          color: #f7d99e;
          margin-right: 4px;
          text-shadow: 0 1px 2px rgba(0,0,0,0.7);
        }
        .game-root .opponent-intel {
          margin-bottom: 0 !important;
          min-height: 100%;
        }
        .game-root .near-hand-actions {
          max-height: 132px;
          overflow: auto;
          padding: 6px !important;
        }
        .game-root .board-lanes {
          min-height: 0;
          height: auto;
          display: flex;
          flex-direction: column;
          justify-content: start;
          align-self: stretch;
          padding: 6px 8px !important;
          margin-bottom: 0 !important;
          overflow: hidden;
        }
        .game-root .board-lanes h3 {
          font-size: 14px !important;
          margin-bottom: 4px !important;
        }
        .game-root .lane-grid {
          align-items: stretch;
          min-height: 0;
        }
        .game-root .lane-card {
          min-height: 116px !important;
        }
        .game-root .game-side {
          gap: 8px;
        }
        .game-root .recent-events-list > div,
        .game-root .payment-log-list > div {
          background: rgba(14,9,6,0.62);
          border-color: rgba(205,154,86,0.24) !important;
          color: ${TABLETOP_THEME.text};
        }
        .game-root .recent-events-list > div {
          background: linear-gradient(180deg, rgba(62,39,22,0.92), rgba(20,13,8,0.94)) !important;
          border: 1px solid rgba(247,217,158,0.5) !important;
          color: #fff7e6 !important;
          box-shadow: inset 3px 0 0 rgba(245,158,11,0.82), 0 4px 12px rgba(0,0,0,0.2);
        }
        .game-root .recent-events-list > div div:first-child {
          color: #f7d99e !important;
          font-weight: 800;
        }
        .game-root .quick-action-button {
          border: 1px solid rgba(205,154,86,0.6);
          border-radius: 5px;
        }
        .game-root .icon-action-button {
          min-width: 42px;
          min-height: 38px;
          padding: 6px 8px;
          display: inline-grid;
          grid-template-columns: auto 1fr;
          gap: 6px;
          align-items: center;
          border-radius: 5px;
          font-size: 12px;
          font-weight: 800;
        }
        .game-root .icon-action-mark {
          width: 20px;
          height: 20px;
          display: inline-grid;
          place-items: center;
          border: 1px solid rgba(247,217,158,0.42);
          border-radius: 4px;
          color: #f7d99e;
          background: rgba(8,5,3,0.38);
          font-size: 14px;
          line-height: 1;
        }
        .game-root .icon-action-label {
          white-space: nowrap;
        }
        .game-root .icon-action-only {
          width: 42px;
          height: 38px;
          padding: 5px;
          grid-template-columns: 1fr;
          justify-items: center;
        }
        .game-root .icon-action-only .icon-action-mark {
          width: 26px;
          height: 26px;
        }
        .game-root .icon-action-danger {
          color: #fecaca;
          border-color: rgba(248,113,113,0.64);
          background: linear-gradient(180deg, #571c16, #24100c);
        }
        .game-root .icon-action-danger .icon-action-mark {
          color: #fecaca;
          border-color: rgba(248,113,113,0.56);
        }
        .game-main {
          display: grid;
          grid-template-rows: minmax(98px, 0.5fr) auto minmax(238px, 1.12fr);
          gap: 5px;
          overflow: hidden !important;
          padding-right: 0 !important;
          min-height: 0;
        }
        .board-lanes { order: 1; }
        .response-strip { order: 2; }
        .power-section { order: 3; }
        .bottom-player-panel { order: 4; }
        .hand-content {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 0;
          align-items: stretch;
        }
        .hand-card-row {
          display: flex;
          flex-wrap: nowrap;
          gap: 7px;
          overflow-x: auto;
          overflow-y: hidden;
          padding-bottom: 5px;
          -webkit-overflow-scrolling: touch;
          touch-action: pan-x;
        }
        .game-root .bottom-player-panel .card-box {
          width: 104px !important;
          min-width: 104px !important;
          height: 214px !important;
          min-height: 214px !important;
          padding-bottom: 62px !important;
          overflow: hidden;
        }
        .game-root .bottom-player-panel .card-box button[title] {
          height: 44px !important;
        }
        .game-root .bottom-player-panel .card-actions {
          margin-top: auto;
          display: grid !important;
          gap: 3px !important;
          min-height: 52px;
          position: absolute;
          left: 6px;
          right: 6px;
          bottom: 6px;
          z-index: 3;
        }
        .game-root .bottom-player-panel .card-actions > div:first-child,
        .game-root .bottom-player-panel .card-actions .helper-text {
          display: none !important;
        }
        .game-root .bottom-player-panel .card-actions button {
          min-height: 24px !important;
          padding: 4px 4px !important;
          line-height: 1.05 !important;
          font-weight: 800;
        }
        .game-root .power-section {
          max-height: 116px;
          overflow: auto;
          margin-bottom: 0 !important;
        }
        .game-root .response-strip {
          display: none !important;
        }
        .recent-events-section {
          flex: 1 1 220px;
          min-height: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .recent-events-list {
          flex: 1 1 auto;
          min-height: 0;
          max-height: min(46dvh, 560px);
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding-right: 4px;
        }
        .quick-action-button {
          width: 100%;
          min-height: 36px;
          border: 0;
          border-radius: 10px;
          padding: 8px 10px;
          color: #fff;
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 0;
          box-shadow: 0 3px 0 rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.22);
          cursor: pointer;
          transition: transform 120ms ease, filter 120ms ease, box-shadow 120ms ease;
        }
        .quick-action-button:not(:disabled):hover {
          transform: translateY(-1px);
          filter: brightness(1.08);
          box-shadow: 0 6px 14px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.28);
        }
        .quick-action-button:not(:disabled):active {
          transform: translateY(1px) scale(0.985);
          box-shadow: inset 0 2px 10px rgba(0,0,0,0.35);
        }
        .quick-action-button:disabled {
          cursor: not-allowed;
          filter: grayscale(0.65);
          opacity: 0.55;
          box-shadow: none;
        }
        .quick-action-primary {
          background: linear-gradient(180deg, ${myTheme.primary}, ${myTheme.border});
        }
        .quick-action-secondary {
          background: linear-gradient(180deg, #475569, #1f2937);
        }
        .quick-action-danger {
          background: linear-gradient(180deg, #dc2626, #7f1d1d);
        }
        @media (max-width: 760px) {
          .game-root {
            height: 100dvh !important;
            min-height: 100dvh !important;
            overflow: hidden !important;
            padding: 4px !important;
            grid-template-rows: auto minmax(0, 1fr) !important;
            gap: 4px !important;
          }
          .match-top-frame {
            grid-template-columns: minmax(0, 1fr) auto !important;
            min-height: 0 !important;
            max-height: 82px !important;
            gap: 4px !important;
            margin-bottom: 0 !important;
          }
          .mobile-life-hud {
            display: grid !important;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 3px;
            padding: 4px 6px;
            border: 1px solid rgba(205,154,86,0.52);
            border-radius: 6px;
            background: linear-gradient(180deg, rgba(16,10,7,0.96), rgba(8,5,3,0.94));
            color: #fff4d6;
            box-shadow: 0 4px 14px rgba(0,0,0,0.28);
            font-size: 10px;
            line-height: 1.05;
          }
          .mobile-life-hud span {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .mobile-life-hud strong {
            color: #f7d99e;
          }
          .incoming-attack-banner {
            padding: 5px 7px !important;
            font-size: 11px !important;
            line-height: 1.12 !important;
            margin-bottom: 3px !important;
          }
          .incoming-attack-banner button {
            padding: 3px 5px !important;
            font-size: 10px !important;
          }
          .incoming-attack-pill {
            margin-bottom: 3px !important;
            padding: 3px 7px !important;
            font-size: 10px !important;
          }
          .gauntlet-logo-panel {
            display: none !important;
          }
          .top-opponent-panel {
            grid-template-columns: minmax(0, 1fr) auto !important;
            gap: 4px !important;
            padding: 4px !important;
          }
          .top-action-panel {
            padding: 4px !important;
            align-content: start !important;
          }
          .top-action-icons {
            grid-template-columns: 36px 36px !important;
            gap: 4px !important;
          }
          .action-icon-dock {
            display: none !important;
          }
          .top-state-pills {
            width: auto !important;
            max-width: 112px !important;
            gap: 3px !important;
          }
          .deck-slot {
            min-width: 48px !important;
            padding: 3px 4px !important;
            font-size: 9px !important;
            gap: 2px !important;
          }
          .deck-slot-card {
            width: 22px !important;
            height: 30px !important;
            font-size: 10px !important;
          }
          .deck-slot-card.status-card {
            width: 34px !important;
            font-size: 8px !important;
          }
          .deck-slot-count {
            font-size: 8px !important;
            max-width: 48px !important;
          }
          .deck-slot.compact {
            display: none !important;
          }
          .player-frame {
            padding: 5px 6px !important;
            gap: 2px !important;
          }
          .player-frame strong {
            font-size: 12px !important;
          }
          .player-frame-stats {
            font-size: 10px !important;
            gap: 3px 6px !important;
          }
          .player-frame-stats > span[title^="CCG"] {
            flex-basis: 100% !important;
          }
          .match-table-frame {
            grid-template-columns: 1fr !important;
            gap: 4px !important;
            overflow: hidden !important;
          }
          .table-side-panel {
            display: none !important;
          }
          .table-main-panel {
            grid-template-rows: auto minmax(0, 1fr) !important;
            gap: 4px !important;
            overflow: hidden !important;
          }
          .current-play-panel {
            width: 100% !important;
            max-height: 54px !important;
            padding: 3px 5px !important;
            font-size: 10px !important;
          }
          .current-play-panel > div {
            font-size: 9px !important;
            margin-top: 1px !important;
          }
          .current-play-panel [style*="grid-template-columns"] {
            grid-template-columns: 1fr !important;
          }
          .game-main {
            display: grid !important;
            grid-template-rows: minmax(104px, 0.62fr) auto minmax(262px, 1.38fr) !important;
            gap: 4px !important;
            overflow: hidden !important;
            padding-right: 0 !important;
            min-height: 0 !important;
          }
          .board-lanes {
            order: 1 !important;
            min-height: 0 !important;
            padding: 4px !important;
            overflow: hidden !important;
          }
          .power-section {
            order: 2 !important;
            max-height: 88px !important;
            min-height: 0 !important;
            padding: 3px 4px !important;
            overflow: auto !important;
            margin-bottom: 0 !important;
          }
          .power-section h3,
          .power-section button {
            font-size: 10px !important;
          }
          .power-section .section-card-shell {
            padding: 4px !important;
          }
          .power-section [style*="grid-template-columns"] {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 4px !important;
          }
          .power-section img,
          .power-section span[style*="width: 46"] {
            width: 24px !important;
            height: 24px !important;
          }
          .bottom-player-panel {
            order: 3 !important;
            grid-template-columns: 1fr !important;
            grid-template-rows: auto minmax(0, 1fr) !important;
            gap: 4px !important;
            max-height: none !important;
            min-height: 0 !important;
            padding: 4px !important;
            overflow: hidden !important;
          }
          .bottom-left-actions {
            grid-template-rows: auto !important;
            gap: 4px !important;
          }
          .bottom-left-actions .player-frame-row {
            display: none !important;
          }
          .near-hand-actions {
            display: grid !important;
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            align-items: stretch !important;
            max-height: none !important;
            min-width: 0 !important;
            padding: 4px !important;
            gap: 3px !important;
            overflow: hidden !important;
          }
          .near-hand-actions > div:first-child {
            display: none !important;
          }
          .near-hand-actions > div:not(:first-child) {
            grid-column: span 3;
            font-size: 9px !important;
            padding: 2px 4px !important;
            line-height: 1.1 !important;
          }
          .mobile-action-detail {
            display: grid !important;
            grid-column: span 3;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 3px 5px;
            max-height: 86px;
            overflow: auto;
            border: 1px solid rgba(247,217,158,0.28);
            border-radius: 6px;
            background: rgba(255,239,207,0.08);
            color: #fff4d6;
          }
          .mobile-action-detail label,
          .mobile-action-detail span,
          .mobile-action-detail strong {
            display: grid;
            gap: 2px;
            min-width: 0;
            font-size: 9px !important;
            line-height: 1.05 !important;
          }
          .mobile-action-detail select {
            min-width: 0;
            width: 100%;
            height: 22px;
            font-size: 9px !important;
            padding: 1px 2px;
          }
          .quick-action-button {
            min-height: 24px !important;
            padding: 3px 5px !important;
            font-size: 10px !important;
            border-radius: 6px !important;
            line-height: 1.05 !important;
          }
          .hand-section {
            position: static !important;
            box-shadow: none !important;
            min-height: 0 !important;
            overflow: hidden !important;
          }
          .hand-section h3 {
            font-size: 12px !important;
            margin: 0 0 2px 0 !important;
          }
          .hand-content {
            grid-template-columns: 1fr !important;
            min-height: 0 !important;
          }
          .hand-card-row {
            display: flex !important;
            align-items: stretch !important;
            gap: 3px !important;
            overflow-x: auto !important;
            overflow-y: hidden !important;
            padding: 1px 2px 6px !important;
            touch-action: pan-x !important;
            min-height: 174px !important;
            max-height: 184px !important;
            scroll-snap-type: x proximity;
            scrollbar-width: thin;
          }
          .card-box {
            flex: 0 0 88px !important;
            width: 88px !important;
            min-width: 88px !important;
            min-height: 0 !important;
            height: 172px !important;
            padding: 2px !important;
            font-size: 8px !important;
            border-radius: 5px !important;
            gap: 1px !important;
            scroll-snap-align: start;
          }
          .card-box > div:first-child div:first-child {
            font-size: 12px !important;
          }
          .card-box > div:first-child div:nth-child(2) {
            font-size: 10px !important;
          }
          .card-box > button[title] {
            height: 22px !important;
            margin: 1px 0 !important;
          }
          .card-box > button[title] + div {
            margin-bottom: 0 !important;
          }
          .card-box > button[title] + div div {
            font-size: 8px !important;
            line-height: 1.05 !important;
          }
          .card-box button:not([title]) {
            font-size: 8px !important;
            padding: 1px 2px !important;
            min-height: 16px !important;
            line-height: 1 !important;
          }
          .card-action-rail {
            top: 34px !important;
            left: 3px !important;
            right: 3px !important;
            grid-template-columns: 1fr !important;
            gap: 2px !important;
            padding: 2px !important;
          }
          .card-action-rail button {
            min-height: 18px !important;
            font-size: 9px !important;
            padding: 2px 3px !important;
          }
          .card-box [style*="bottom: 50"] {
            display: none !important;
          }
          .card-box [style*="display: grid"][style*="gap: 4"] {
            gap: 1px !important;
          }
          .lane-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 3px !important;
            overflow: hidden !important;
            min-height: 0 !important;
          }
          .lane-card {
            min-height: 0 !important;
            height: 100% !important;
            padding: 4px !important;
            font-size: 9px !important;
          }
          .lane-card > p {
            font-size: 10px !important;
            margin-bottom: 2px !important;
          }
          .lane-card-line {
            font-size: 9px !important;
            gap: 3px !important;
            padding: 2px !important;
          }
          .lane-card-line span,
          .lane-card-line strong {
            font-size: 8px !important;
            line-height: 1.1 !important;
          }
          .recent-events-section {
            display: none !important;
          }
          .recent-events-list {
            max-height: 120px !important;
          }
          .music-control { display: none !important; }
          .card-preview-panel { display: none !important; }
        }
      `}</style>
      <div className="match-top-frame">
        <div className="gauntlet-logo-panel">
          <h2>Gauntlet<br />Online</h2>
          <div style={{ color: TABLETOP_THEME.muted, fontSize: 12, marginTop: 8 }}>
            <RoomCodeDisplay code={game.roomCode} roleLabel={isSpectator ? "Spectator" : `P${player}`} onCopy={copyRoomCode} />
          </div>
        </div>
        <div className="top-opponent-panel">
          <PlayerFrameRow game={game} player={player} placement="opponents" />
          <div className="top-state-pills">
            <div className="deck-slot deck-slot-live" title={`Cards in deck: ${deckCountSummary}`}><span>Decks</span><span className="deck-slot-card">D</span><span className="deck-slot-count">{deckCountSummary}</span></div>
            <button type="button" className="deck-slot deck-slot-live" onClick={() => setShowDiscardViewer(true)} title="View discard piles"><span>Discard</span><span className="deck-slot-card empty">View</span><span className="deck-slot-count">{discardCountSummary}</span></button>
            <div className="deck-slot command-slot" title={`Turn ${game.turn}. Priority Player ${game.priority}. ${game.phase === "gameOver" ? "Game over" : "Live game"}.`}>
              <span>Command</span>
              <span className="deck-slot-card status-card">{phaseDisplayName()}</span>
              <span className="deck-slot-count">T{game.turn} / P{game.priority} / {game.phase === "gameOver" ? "Over" : "Live"}</span>
            </div>
          </div>
        </div>
        <div className="top-action-panel">
          <div className="music-control">
            <MusicControl
              trackKey={activeMusicTrack}
              enabled={musicEnabled}
              volume={musicVolume}
              onToggle={() => setMusicEnabled((value) => !value)}
              onVolumeChange={setMusicVolume}
              account={account}
              soundMuted={accountSoundMuted}
              onSoundMutedChange={setSignedInSoundMuted}
            />
          </div>
          <div className="top-action-icons">
            {actionControls}
            <ActionIconButton icon="?" label="Shortcuts" onClick={() => setShowHotkeys((value) => !value)} iconOnly />
            <ActionIconButton icon="i" label={showHelperLabels ? "Hide Hints" : "Show Hints"} onClick={() => setShowHelperLabels((value) => !value)} iconOnly />
          </div>
        </div>
      </div>
      <HotkeyWindow visible={showHotkeys} onClose={() => setShowHotkeys(false)} />

      {copyNotice && <div style={{ color: "#92400e", marginBottom: 6, fontSize: 13, fontWeight: "bold", flex: "0 0 auto" }}>{copyNotice}</div>}
      {error && <div style={{ color: "red", marginBottom: 12 }}><strong>Error:</strong> {error}</div>}
      {!isSpectator && me && (
        <div className="mobile-life-hud" aria-label="Player life summary">
          <span><strong>You</strong> {me.life} life</span>
          <span>{me.hand?.length || 0} hand</span>
          <span><strong>{opponent ? getGamePlayerName(game, opponent === game.players[1] ? 1 : 2) : "Opp"}</strong> {opponent?.life ?? "-"} life</span>
        </div>
      )}
      {incomingAttackAlert && !incomingAttackMinimized && (
        <div className="incoming-attack-banner" role="alert">
          <span>{incomingAttackAlert.text}</span>
          <button onClick={() => setIncomingAttackMinimized(true)} style={{ flex: "0 0 auto" }}>Minimize</button>
        </div>
      )}
      {incomingAttackAlert && incomingAttackMinimized && (
        <div className="incoming-attack-pill" role="status">
          <span>Incoming attack</span>
          <button onClick={() => setIncomingAttackMinimized(false)}>Show</button>
        </div>
      )}
      {factionVoice && (
        <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, border: `2px solid ${myTheme.border}`, background: myTheme.light }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 16, fontStyle: "italic", color: myTheme.primary }}>"{factionVoice.quote}"</div>
          <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>{factionVoice.detail}</div>
        </div>
      )}

      {(game.winner != null || game.phase === "gameOver") && (
        <div style={{ marginBottom: 16, padding: 16, borderRadius: 12, border: "2px solid #111", background: game.winner == null ? "#f3f4f6" : "#dcfce7", fontSize: 20, fontWeight: "bold" }}>
          {game.winner == null ? "Game Over — Draw" : `Game Over — Player ${game.winner} wins!`}
          {game.campaign?.afterBattle && (
            <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.45, fontWeight: "normal", color: "#14532d" }}>
              <strong>After Battle:</strong> {game.campaign.afterBattle}
            </div>
          )}
        </div>
      )}

      <div className="match-table-frame">
        <div className="table-main-panel">
          <div className="current-play-panel">
            <strong>{(incomingAttackAlert && !incomingAttackMinimized) ? incomingAttackAlert.text : game.campaign?.title || phaseDisplayName()}</strong>
            <div style={{ fontSize: 12, marginTop: 3, color: TABLETOP_THEME.muted }}>
              {(incomingAttackAlert && !incomingAttackMinimized) ? "Respond in the status rail before taking another action." : game.campaign ? (game.campaign.beforeBattle || game.campaign.story) : phaseHelpText()}
            </div>
            {game.campaign?.story && game.campaign?.beforeBattle && game.campaign.beforeBattle !== game.campaign.story && (
              <div style={{ fontSize: 11, marginTop: 4, color: "#c7d2fe" }}>
                {game.campaign.story}
              </div>
            )}
            {game.campaign && (
              <CampaignDialogueBlock
                title="Opening Dialogue"
                lines={game.campaign.startDialogue || game.campaign.dialogue}
                audio={game.campaign.startDialogueAudio || game.campaign.dialogueAudio}
                autoPlayKey={game.campaign.chapterId ? `${game.campaign.chapterId}-opening` : ""}
                compact
              />
            )}
            <div style={{ marginTop: 4 }}><CombatStrip game={game} /></div>
          </div>
        <div className="game-main" style={{ minHeight: 0, overflowY: "auto", paddingRight: 4 }}>
          <div style={{ display: "none" }}>
            <p><strong>Player 1:</strong> {game.players[1].faction.name} — {game.players[1].life} life — {game.players[1].connected ? "Connected" : "Disconnected"}</p>
            <p><strong>Player 2:</strong> {game.players[2].faction.name} — {game.players[2].life} life — {game.players[2].connected ? "Connected" : "Disconnected"}</p>
          </div>

          {!isSpectator && (
            <>
              {!isBasicGame && <SectionCard className="power-section" borderColor={myTheme.border} background={myTheme.light} style={{ padding: 8, marginBottom: 6 }}>
                <CollapseHeader title={`${me.faction.name} Powers`} collapsed={collapsedPanels.powers} onToggle={() => togglePanel("powers")} color={myTheme.primary} />
                {!collapsedPanels.powers && <><div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                  {powerCards.map((power) => (
                    <CompactPowerCard
                      key={power.id}
                      title={power.title}
                      feature={power.feature}
                      theme={myTheme}
                      expanded={selectedPower?.id === power.id}
                      onToggle={() => handlePowerClick(power)}
                    />
                  ))}
                </div>
                {selectedPower && (
                  <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: "#fff", border: `1px solid ${myTheme.border}`, fontSize: 12 }}>
                    <strong>{selectedPower.title}: {selectedPower.feature.name}</strong>
                    <span style={{ color: "#555" }}> - {selectedPower.feature.text}</span>
                  </div>
                )}
                <div style={{ marginTop: 8, fontSize: 12, display: "flex", flexWrap: "wrap", gap: "6px 12px" }}>
                  <span><strong>Attacks:</strong> {me.turnData.attacksDeclaredThisTurn}</span>
                  <span><strong>Blocks:</strong> {me.turnData.blocksDeclaredThisTurn}</span>
                  <span><strong>Prev suit:</strong> {me.turnData.previousAttackSuit || "None"}</span>
                  <span><strong>Prev value:</strong> {me.turnData.previousPlayedValue ?? "None"}</span>
                  <span><strong>Acceleration:</strong> {me.accelerationCounters}</span>
                </div>
                </>}
              </SectionCard>}
              {isBasicGame && <SectionCard className="power-section" borderColor={myTheme.border} background="rgba(255,255,255,0.96)" style={{ padding: 8, marginBottom: 6 }}>
                <strong>Basic Mode:</strong> Core Gauntlet rules only. No faction powers or faction bonuses.
              </SectionCard>}

              <div className="bottom-player-panel">
                <div className="bottom-left-actions">
                  {nearHandActionPad}
                  <PlayerFrameRow game={game} player={player} placement="self" />
                </div>
                <SectionCard title={`Your Hand (${me.hand.length})`} borderColor={myTheme.border} background="rgba(255,255,255,0.96)" style={{ padding: 0, marginBottom: 0 }} className="hand-section">
                <div className="hand-content">
                  <div className="hand-card-row">
                    {me.hand.map((card, i) => {
                      const isSelectedPayment = payments.includes(i);
                      const isSelectedAttack = selectedAttackCardIndex === i;
                      const isSelectedBlock = selectedBlockCardIndexes.includes(i);
                      const isSelectedPlacement = selectedPlacementCardIndex === i;
                      let bg = "white";
                      if (isSelectedAttack) bg = "#dbeafe";
                      else if (isSelectedBlock) bg = "#dcfce7";
                      else if (isSelectedPlacement) bg = "#f3e8ff";
                      else if (isSelectedPayment) bg = "#fee2e2";
                      const selected = isSelectedAttack || isSelectedBlock || isSelectedPlacement || isSelectedPayment;
                      return (
                        <CardBox key={card.id || i} card={card} bg={bg} selected={selected} accent={myTheme.primary} onInspect={setInspectedCard} onPreview={setPreviewedCard}>
                          {(attackMode?.from === "hand" || blockMode?.type === "handAttack" || placementMode || attackMode || blockMode) && (
                            <div className="card-action-rail">
                              {attackMode?.from === "hand" && <button onClick={() => selectAttackCard(i)} style={{ display: "block", width: "100%", fontSize: 10, padding: 3 }}>Attack</button>}
                              {blockMode?.type === "handAttack" && <button onClick={() => selectBlockCard(i)} style={{ display: "block", width: "100%", fontSize: 10, padding: 3 }}>{isSelectedBlock ? "Remove" : "Block"}</button>}
                              {placementMode && <button onClick={() => setSelectedPlacementCardIndex(i)} style={{ display: "block", width: "100%", fontSize: 10, padding: 3 }}>Facedown</button>}
                              {(attackMode || blockMode) && <button onClick={() => togglePayment(i)} style={{ display: "block", width: "100%", fontSize: 10, padding: 3 }}>Pay</button>}
                            </div>
                          )}
                          <div className="card-actions" style={{ display: "grid", gap: 4 }}>
                            <div style={{ fontSize: 9, color: "#666" }}>Index: {i}</div>
                            <HelperText enabled={showHelperLabels}>{attackMode || blockMode ? "Pay cards cover the cost; the attacking/blocking card cannot also pay." : "Tap the art to inspect."}</HelperText>
                          </div>
                        </CardBox>
                      );
                    })}
                  </div>
                </div>
              </SectionCard>
              </div>
            </>
          )}

          <SectionCard className="board-lanes" title="Lanes" borderColor="#111" background="rgba(255,255,255,0.92)" style={{ padding: 8, marginBottom: 6 }}>
            <div className="lane-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(130px, 1fr))", gap: 7 }}>
            {game.lanes.map((lane, i) => {
              const attacker = lane.attack?.player ?? null;
              const defender = attacker ? (attacker === 1 ? 2 : 1) : null;
              const iAmDefender = !isSpectator && defender === player;
              const myLaneDone = !isSpectator ? game.endPlaced?.[player]?.[i] : false;
              return (
                <div key={i} className="lane-card" style={{ border: `2px solid ${lane.attack ? oppTheme.border : "#111"}`, borderRadius: 8, padding: 7, minHeight: lane.attack || lane.block.length > 0 ? 170 : 132, background: lane.attack ? "#fff7f7" : "#fafafa", display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "0 2px 8px rgba(0,0,0,0.12)", fontSize: 12 }}>
                  <p style={{ fontSize: 14, margin: "0 0 5px 0" }}><strong>Lane {i + 1}</strong></p>
                  {!isSpectator ? (
                    <div style={{ display: "grid", gap: 5 }}>
                      <LaneCardLabel label="Your lane card" card={lane.facedown[player]} />
                      <LaneCardLabel label="Opponent lane card" card={lane.facedown[player === 1 ? 2 : 1]} hidden={!!lane.facedown[player === 1 ? 2 : 1]} />
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 5 }}>
                      <LaneCardLabel label="Player 1 lane card" card={lane.facedown[1]} hidden={!!lane.facedown[1]} />
                      <LaneCardLabel label="Player 2 lane card" card={lane.facedown[2]} hidden={!!lane.facedown[2]} />
                    </div>
                  )}
                  {(lane.attack || lane.block.length > 0) && (
                    <div style={{ marginTop: 6, display: "grid", gap: 4 }}>
                      {lane.attack && <div><strong>Attack:</strong> P{lane.attack.player} {getCardShortLabel(lane.attack.card)} ({lane.attack.effectiveValue})</div>}
                      {lane.attack?.notes?.length > 0 && <div><strong>Bonuses:</strong> {lane.attack.notes.join(", ")}</div>}
                      {lane.block.length > 0 && <div><strong>Blocks:</strong> {lane.block.map((entry, idx) => <span key={idx} style={{ marginRight: 8 }}>P{entry.player}:{getCardShortLabel(entry.card)} ({entry.effectiveValue || 0})</span>)}</div>}
                    </div>
                  )}
                  {!isSpectator && canDeclareAttack && !lane.attack && lane.facedown[player] && <div style={{ marginTop: 10 }}><button onClick={() => startAttackFromLane(i)}>Attack from Lane</button></div>}
                  {defenderMayBlock && lane.attack && iAmDefender && lane.block.length === 0 && <div style={{ marginTop: 10 }}><button onClick={() => startBlockLaneAttack(i)}>Block This Lane Attack</button></div>}
                  {!isSpectator && game.phase === "end" && i === currentEndLane && isMyEndPlacementTurn && !myLaneDone && !lane.facedown[player] && <div style={{ marginTop: 10 }}><button onClick={() => startPlacement(i)} style={{ marginRight: 8 }}>Place Facedown Here</button><button onClick={() => skipPlacement(i)}>Skip This Lane</button></div>}
                  {!isSpectator && game.phase === "end" && i === currentEndLane && isMyEndPlacementTurn && !myLaneDone && lane.facedown[player] && <div style={{ marginTop: 10 }}><button onClick={() => skipPlacement(i)}>Lane Already Filled - Mark Done</button></div>}
                </div>
              );
            })}
            </div>
          </SectionCard>

          {!isSpectator && hasIncomingAttack && (
            <SectionCard className="response-strip" borderColor="#991b1b" background="#fff1f2" style={{ padding: 10, marginBottom: 6 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: "bold", color: "#7f1d1d", fontSize: 16 }}>
                    Incoming Attack: {incomingHandAttack
                      ? `${getCardShortLabel(incomingHandAttack.card)} from hand (effective ${incomingHandAttack.effectiveValue})`
                      : incomingLaneAttack
                        ? `${getCardShortLabel(incomingLaneAttack.lane.attack.card)} from lane ${incomingLaneAttack.laneIndex + 1} (effective ${incomingLaneAttack.lane.attack.effectiveValue})`
                        : "Resolve combat"}
                  </div>
                  <div style={{ color: "#7f1d1d", fontSize: 12, marginTop: 2 }}>Respond here before taking another action.</div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {incomingHandAttack && defenderMayBlock && <button onClick={() => setBlockMode({ type: "handAttack", handAttackId: incomingHandAttack.id })}>Block with Cards</button>}
                  {incomingHandAttack && defenderMayBlock && <button onClick={() => passHandAttack(incomingHandAttack.id)} style={{ color: "#991b1b" }}>Take {incomingHandAttack.effectiveValue} Damage</button>}
                  {incomingLaneAttack && defenderMayBlock && <button onClick={() => startBlockLaneAttack(incomingLaneAttack.laneIndex)}>Block Lane</button>}
                  {incomingLaneAttack && defenderMayBlock && <button onClick={() => passLaneAttack(incomingLaneAttack.laneIndex)} style={{ color: "#991b1b" }}>Take Damage</button>}
                  {!defenderMayBlock && <button onClick={passPriority} disabled={!isMyPriority}>Pass / Continue</button>}
                </div>
              </div>
            </SectionCard>
          )}
        </div>
        </div>

        <div className="game-side table-side-panel" style={{ minHeight: 0 }}>
          <SectionCard borderColor={myTheme.border} background="rgba(250,250,250,0.96)" style={{ padding: 8, marginBottom: 6 }}>
            <CollapseHeader title="Status" collapsed={collapsedPanels.actions} onToggle={() => togglePanel("actions")} color={myTheme.primary} />
            {!collapsedPanels.actions && <>
              <div style={{ display: "grid", gap: 6, marginBottom: 10, fontSize: 13 }}>
                <div><strong>Mode:</strong> {phaseDisplayName()}</div>
                <div><strong>Turn:</strong> {game.turn}</div>
                <div><strong>Priority:</strong> Player {game.priority}</div>
                <div style={{ color: TABLETOP_THEME.muted }}>{phaseHelpText()}</div>
              </div>
              {undoRequest && (
                <div style={{ marginBottom: 10, padding: 10, borderRadius: 8, background: "#fef3c7", border: "1px solid #f59e0b" }}>
                  <strong>Undo requested:</strong> Player {undoRequest.requester} wants to undo {undoRequest.label}.
                  {undoNeedsMyApproval && <div style={{ display: "flex", gap: 8, marginTop: 8 }}><button onClick={() => respondUndo(true)}>Approve Undo</button><button onClick={() => respondUndo(false)}>Decline</button></div>}
                </div>
              )}
              {game.drawOfferBy && game.phase !== "gameOver" && (
                <div style={{ marginBottom: 10, padding: 10, borderRadius: 8, background: myTheme.light, border: `1px solid ${myTheme.border}` }}>
                  {game.drawOfferBy === player ? "You offered an intentional draw." : `Player ${game.drawOfferBy} offered an intentional draw.`}
                </div>
              )}
              {hasAnyUnresolvedAttack && game.phase === "priority" && <p style={{ marginTop: 0, color: "#b91c1c" }}>Resolve current combat before declaring another attack.</p>}
              <div className="passive-status-actions">{rightPanel}</div>
              {!isSpectator && (
                <OpponentIntelPanel
                  game={game}
                  player={player}
                  showAbilities={showOpponentAbilities}
                  onToggleAbilities={() => setShowOpponentAbilities((value) => !value)}
                />
              )}
              <PaymentLogPanel game={game} /></>}
          </SectionCard>
          <SectionCard className="recent-events-section" borderColor="#444" background="rgba(255,255,255,0.96)" style={{ padding: 8 }}>
            <CollapseHeader title="Recent Events" collapsed={collapsedPanels.events} onToggle={() => togglePanel("events")} />
            {!collapsedPanels.events && (
              normalizedEvents.length === 0 ? (
                <p>No events yet.</p>
              ) : (
                <div className="recent-events-list">
                  {currentTurnEvents.map((entry, idx) => renderEventEntry(entry, idx))}
                  {olderEvents.length > 0 && (
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: "bold", color: "#555", marginBottom: 6 }}>Older Turns</div>
                      {olderEvents.map((entry, idx) => renderEventEntry(entry, idx, true))}
                    </div>
                  )}
                </div>
              )
            )}
          </SectionCard>
          <div className="card-preview-panel">
            <h3>Card Preview</h3>
            {sidePreviewCard ? (
              <CardBox card={sidePreviewCard} onInspect={setInspectedCard} />
            ) : (
              <div style={{ color: TABLETOP_THEME.muted, fontSize: 13, textAlign: "center", padding: "18px 8px" }}>Select card art to preview.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
