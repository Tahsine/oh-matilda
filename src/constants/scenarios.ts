// Scénarios — copie nettoyée de oh-matilda-—-ai-agent-chat/src/data/mockData.ts:145-628
// Dépend de ./images.ts pour IMG_* et de ../lib/svg implicite (déjà inline dans images.ts)
import type { Scenario, ConversationHistoryItem } from "@/types";
import { IMG_SANTORINI, IMG_WA_BEFORE, IMG_WA_AFTER, IMG_SETTINGS_OFF, IMG_SETTINGS_ON } from "./images";

export const SCENARIOS: Record<string, Scenario> = {
  whatsapp_msg: {
    kw: ["text sam on whatsapp", "message sam on whatsapp", "send.*whatsapp", "whatsapp sam", "write on whatsapp", "whatsapp"],
    thought: "Reading WhatsApp's accessibility tree — found the conversation with Sam and the compose field.",
    r: {
      formal: "I've drafted a message to **Sam**: “Running late, sorry!”. Please confirm before I send it.",
      friendly: "Drafted a message for **Sam**: “Running late, sorry!” — confirm and I'll send it! ✅",
      concise: "Message to Sam drafted. Confirm to send."
    },
    action: { app: "WhatsApp", desc: "Send message to Sam", before: IMG_WA_BEFORE, after: IMG_WA_AFTER },
    fu: ["Send another message", "Open WhatsApp again", "What can you do?"]
  },
  phone_action: {
    kw: ["turn on wi-?fi", "enable wi-?fi", "turn wi-?fi on", "wi-?fi in settings", "open settings", "connect to wi-?fi", "wi-?fi"],
    thought: "Reading the on-screen accessibility tree in Settings — found a toggle labeled “Wi-Fi”, currently off.",
    r: {
      formal: "I located the **Wi-Fi** toggle in Settings and I'm ready to turn it on. Please confirm before I act on your phone.",
      friendly: "Found the **Wi-Fi** switch in Settings — just confirm and I'll flip it on for you! ✅",
      concise: "Wi-Fi toggle found in Settings. Confirm to proceed."
    },
    action: { app: "Settings", desc: "Tap the Wi-Fi toggle", before: IMG_SETTINGS_OFF, after: IMG_SETTINGS_ON },
    fu: ["Turn Wi-Fi back off", "Open Settings again", "What can you do?"]
  },
  santorini: {
    kw: ["what'?s this place", "where is this", "santorini", "this photo", "which place is"],
    thought: "Matching visual landmarks: caldera, white cubes, blue domes…",
    viewed: "Travel Guides 2025",
    r: {
      formal: "That is **Santorini, Greece** — the town of Oia, perched above the caldera. It is known for whitewashed houses, blue domes, and what many consider the finest sunset in the Aegean.",
      friendly: "That's **Santorini, Greece**! 🇬🇷 Specifically Oia — the cliffside town famous for whitewashed lanes, blue domes and legendary sunsets.",
      concise: "**Santorini, Greece** (Oia village), overlooking the caldera."
    },
    fu: ["When is the best time to go?", "Plan a 5-day itinerary", "Find quieter alternatives"]
  },
  travel_time: {
    kw: ["best time", "when to go", "which season", "time of year"],
    thought: "Comparing shoulder seasons across shortlisted destinations…",
    viewed: "Travel Guides 2025",
    r: {
      formal: "For Santorini and the Cyclades, **late May to June** and **September** offer warm seas, open services and thinner crowds. The Amalfi Coast peaks in May–June; Bali's dry season runs from April to October.",
      friendly: "Sweet spots: **May–June** and **September** ☀️ Warm water, open tavernas, half the crowds. Bali flips it — go **April to October** for dry season.",
      concise: "Best windows: Mediterranean **May–June & September**; Bali **April–October**."
    },
    fu: ["Plan a 5-day itinerary", "Estimate a budget for this trip", "Find quieter alternatives"]
  },
  itinerary: {
    kw: ["itinerary", "plan a \\d+-day", "plan a five", "day plan", "schedule"],
    thought: "Balancing sightseeing, sea time and slow mornings…",
    viewed: "Travel Guides 2025",
    r: {
      formal: "A balanced five-day plan: **Day 1** — arrive in Oia, caldera sunset walk. **Day 2** — catamaran cruise to the volcanic hot springs. **Day 3** — wine tasting in Pyrgos, afternoon at Red Beach. **Day 4** — ferry to Naxos for old-town streets and beaches. **Day 5** — slow morning, seaside lunch, departure.",
      friendly: "Here's a tasty 5-day mix: 1) Oia sunset stroll 🌅 2) catamaran + hot springs ⛵ 3) wine in Pyrgos + Red Beach 🍷 4) day trip to Naxos 🏖️ 5) slow brunch by the sea before flying home.",
      concise: "5 days: Oia sunset; catamaran cruise; Pyrgos wine + Red Beach; Naxos day trip; seaside brunch & departure."
    },
    fu: ["When is the best time to go?", "Estimate a budget for this trip", "Find quieter alternatives"]
  },
  budget: {
    kw: ["budget", "cost", "price", "how much"],
    thought: "Estimating mid-range daily costs per destination…",
    viewed: "Travel Guides 2025",
    r: {
      formal: "For a mid-range pace, budget roughly **€180–250 per person per day** in the Greek Islands: boutique stays, tavernas and one boat day. Amalfi runs higher (€250–350); Bali lower (€90–140) for comparable comfort.",
      friendly: "Rough math: Greek Islands ≈ **€180–250/day** per person, Amalfi **€250–350**, Bali just **€90–140** for the same comfort 💸",
      concise: "Daily budget per person: Greek Islands **€180–250**; Amalfi **€250–350**; Bali **€90–140**."
    },
    fu: ["Plan a 5-day itinerary", "When is the best time to go?", "Find quieter alternatives"]
  },
  quiet: {
    kw: ["quieter", "less crowded", "alternative", "hidden gem", "off the beaten"],
    thought: "Filtering look-alike destinations with low visitor density…",
    viewed: "Travel Guides 2025",
    r: {
      formal: "Quieter alternatives with the same spirit: **Milos or Naxos** in Greece, **Procida and the Cilento coast** in Italy, or **Amed and Sidemen** in Bali. Each keeps the scenery while avoiding peak crowds.",
      friendly: "Try the under-the-radar cousins: **Milos or Naxos** (Greece), **Procida or Cilento** (Italy), **Amed or Sidemen** (Bali). Same vibes, fraction of the crowds 🌿",
      concise: "Quieter picks: **Milos/Naxos** (GR), **Procida/Cilento** (IT), **Amed/Sidemen** (Bali)."
    },
    fu: ["When is the best time to go?", "Estimate a budget for this trip", "Plan a 5-day itinerary"]
  },
  travel: {
    kw: ["trip", "travel", "vacation", "holiday", "relax", "beach", "destination", "getaway"],
    thought: "Comparing calm, scenic destinations matched to “beautiful and relaxing”…",
    viewed: "Travel Guides 2025",
    img: IMG_SANTORINI,
    r: {
      formal: "If beauty and relaxation are the priorities, I would recommend the **Greek Islands**, the **Amalfi Coast** in Italy, or **Bali** in Indonesia. Each pairs striking scenery with a slower pace of life. May I ask whether you prefer beaches, culture, or cuisine? I will tailor a shortlist accordingly.",
      friendly: "Ooh, nice! If you're after beauty + pure relaxation, think **Greek Islands**, **Amalfi Coast** in Italy, or **Bali** in Indonesia 🌊 Do you lean more beaches, culture, or food? I'll shape the shortlist around that!",
      concise: "Top picks: **Greek Islands**, **Amalfi Coast** (Italy), **Bali** (Indonesia). Tell me your preference: beaches, culture, or food."
    },
    fu: ["What's this place?", "When is the best time to go?", "Plan a 5-day itinerary"]
  },
  design_components: {
    kw: ["essential components", "core components", "components included", "what components"],
    thought: "Listing the canonical layers of a mature design system…",
    viewed: "Design Handbook",
    r: {
      formal: "Most design systems include: a **colour and typography scale**, **spacing and grid tokens**, an **icon set**, **core components** (button, input, dialog, card), **states and interaction patterns**, and **documentation** with usage guidance and code examples.",
      friendly: "The usual suspects: colour & type scales, spacing tokens, icons, and the core kit — buttons, inputs, dialogs, cards — all documented with do/don't examples ✨",
      concise: "Core parts: **tokens** (colour/type/spacing), **icons**, **base components**, **patterns**, **docs**."
    },
    fu: ["How do you ensure consistency in components across different platforms?", "How do you handle version control and updates for components?", "What are design systems?"]
  },
  design_consistency: {
    kw: ["consistency", "consistent across", "cross-platform", "across platforms"],
    thought: "Separating platform-agnostic tokens from native implementations…",
    viewed: "Design Handbook",
    r: {
      formal: "Consistency across platforms is maintained by defining **platform-agnostic tokens** (colour, spacing, type) and expressing them through **platform-native components**, supported by shared documentation, review checkpoints and automated **visual regression tests**.",
      friendly: "One source of truth for tokens, native flavours per platform — plus visual regression tests so nothing drifts silently 🛡️",
      concise: "Shared tokens + native implementations + docs and visual regression tests."
    },
    fu: ["What are the essential components included in most design systems?", "How do you handle version control and updates for components?", "What are design systems?"]
  },
  design_versioning: {
    kw: ["version"],
    thought: "Describing release flow: semver, changelogs, migrations…",
    viewed: "Design Handbook",
    r: {
      formal: "Components are versioned as a package following **semantic versioning**: patches for fixes, minors for additive features, majors for breaking changes. Each release ships a **changelog**, **migration notes** and **deprecation windows** so product teams can upgrade safely.",
      friendly: "We treat the system like a product: **semver** releases, changelogs, migration guides, and a grace period before breaking changes land 📦",
      concise: "Semver package releases with changelogs, migration notes, deprecation windows."
    },
    fu: ["What are the essential components included in most design systems?", "How do you ensure consistency in components across different platforms?", "What are design systems?"]
  },
  design: {
    kw: ["design system", "design systems", "component library"],
    thought: "Defining design systems, then structuring components, standards and purpose…",
    viewed: "Design Handbook",
    r: {
      formal: "Design systems are essential frameworks that streamline and standardise the process of creating digital products. At their core, ==design systems consist of reusable components== [[cite:1]] and clear standards for how to use them, ensuring a consistent user experience across a product family [[cite:2]].",
      friendly: "Think of a design system as the shared toolbox + rulebook for building a product: ==reusable components== plus clear standards, so every screen feels like family 🧩",
      concise: "A design system = **reusable components** + **standards** that keep product UX consistent."
    },
    fu: ["What are the essential components included in most design systems?", "How do you ensure consistency in components across different platforms?", "How do you handle version control and updates for components?"]
  },
  support_cache: {
    kw: ["cache", "browsing data"],
    thought: "Retrieving exact cache-clearing paths per browser…",
    viewed: "System Diagnostics",
    r: {
      formal: "To clear the cache in Chrome: **Settings → Privacy and security → Delete browsing data → select “Cached images and files” → Delete data**. In Firefox: **Settings → Privacy & Security → Cookies and Site Data → Clear Data**.",
      friendly: "In Chrome: **Settings → Privacy and security → Delete browsing data** → tick “Cached images and files” → done 🧼",
      concise: "Chrome: **Settings → Privacy → Delete browsing data → Cached images and files**."
    },
    fu: ["It's still slow after cleanup", "Which files are safe to delete?", "Disable unnecessary extensions"]
  },
  support_disk: {
    kw: ["disk", "space", "ssd", "storage", "\\d+gb", "full"],
    thought: "Checking free-space thresholds against SSD health guidance…",
    viewed: "System Diagnostics",
    r: {
      formal: "Twelve gigabytes on a 256 GB drive is below the healthy threshold. I recommend **clearing large unused files**, **moving media to cloud storage** and **emptying caches**. Maintaining at least **15–20% free space** restores virtual-memory headroom.",
      friendly: "Yep — your laptop's gasping for space 😮‍💨 Try cleaning up large files or offloading them to the cloud. Aim to keep **15–20%** of the drive free.",
      concise: "12 GB free is too low. Delete/offload large files; keep **15–20%** of disk free."
    },
    fu: ["Which files are safe to delete?", "How do I clear browser cache?", "It's still slow after cleanup"]
  },
  support_still: {
    kw: ["still slow", "still sluggish", "after cleanup", "didn'?t help", "no difference"],
    thought: "Escalating to startup load, power mode, RAM and thermals…",
    viewed: "System Diagnostics",
    r: {
      formal: "If the slowdown persists after cleanup, the next checks are: **startup programs** (disable non-essential), **battery-saver mode**, and **available RAM** in Task Manager. Should these look normal, I would review thermal behaviour and consider a hardware diagnostic.",
      friendly: "Still sluggish? Check **startup programs**, **battery-saver mode**, and **RAM** in Task Manager. If all look fine, it may be heat throttling — time for a fan clean 🌀",
      concise: "Next: trim startup apps, check battery saver & RAM; else check thermals."
    },
    fu: ["How do I clear browser cache?", "Which files are safe to delete?", "Thank you!"]
  },
  support_ext: {
    kw: ["extension", "zoom", "installed", "updated", "install"],
    thought: "Prioritising recent changes as the likely trigger…",
    viewed: "System Diagnostics",
    r: {
      formal: "Chrome extensions are frequent suspects. Please try the following: **1.** Disable unnecessary extensions. **2.** Clear the browser cache. **3.** Restart the laptop. Additionally, may I ask how your disk space is looking?",
      friendly: "Chrome extensions… the usual suspects 🕵️ Let's try this:\n**1.** Disable unnecessary extensions\n**2.** Clear browser cache\n**3.** Restart your laptop\nAlso, how's your disk space looking?",
      concise: "Steps: disable extra extensions, clear cache, restart. Then check free disk space."
    },
    fu: ["Pretty full — 12GB left on a 256GB SSD", "How do I clear browser cache?", "Which files are safe to delete?"]
  },
  support_slow: {
    kw: ["slow", "laptop", "computer", "freez", "performance", "slug"],
    thought: "Narrowing likely causes: recent changes, storage pressure, startup load…",
    viewed: "System Diagnostics",
    r: {
      formal: "Let us troubleshoot methodically. First question: have you **installed or updated any software recently**? Recent changes are the most common cause of a sudden slowdown.",
      friendly: "Let's troubleshoot like tech ninjas 🥷 First question: did you **install or update anything recently**?",
      concise: "Likely causes: recent installs/updates, low disk space, startup load. Did you install or update anything recently?"
    },
    fu: ["I installed Chrome extensions and updated Zoom", "How do I clear browser cache?", "Which files are safe to delete?"]
  },
  files_delete: {
    kw: ["delete", "clean", "files", "free up"],
    thought: "Ranking safe cleanup targets by size and risk…",
    viewed: "System Diagnostics",
    r: {
      formal: "Safe first targets: **Downloads folder**, **old installers**, **duplicate media**, **application caches**, and the **recycle bin**. I advise keeping system folders and anything under your Documents unless you recognise it.",
      friendly: "Start with **Downloads**, old installers, duplicate photos and app caches — and empty the trash last 🗑️ Keep system folders untouched.",
      concise: "Delete: Downloads, installers, duplicates, caches, trash. Keep system folders."
    },
    fu: ["It's still slow after cleanup", "How do I clear browser cache?", "Thank you!"]
  },
  rewrite: {
    kw: ["rewrite", "rephrase", "more formal", "make it formal", "polish"],
    thought: "Re-registering the message one tone higher…",
    r: {
      formal: "Certainly. A more formal rendering: *“I would appreciate your consideration of the matter at hand; I remain available to discuss it at your convenience.”* Shall I prepare additional variants?",
      friendly: "Sure! Formal mode ON: *“I would appreciate your consideration of the matter at hand — happy to discuss at your convenience.”* Want more variants? ✍️",
      concise: "Formal rewrite: *“I would appreciate your consideration of the matter at hand; available at your convenience.”*"
    },
    fu: ["Now make it friendly", "Give me a concrete example", "Thank you!"]
  },
  brainstorm: {
    kw: ["brainstorm", "ideas", "creative"],
    thought: "Diverging: four distinct creative directions…",
    viewed: "Design Handbook",
    r: {
      formal: "Four directions to explore: **1)** a weekly “curiosity digest” assembled from your notes; **2)** a reverse brainstorm — list ways to guarantee failure, then invert them; **3)** constraint remixes (half the budget, double the audience); **4)** analogies from unrelated industries. I can develop any of these.",
      friendly: "Idea splash! 🎨 **1)** curiosity digest from your notes **2)** reverse brainstorm (how to fail, then flip it) **3)** constraint remixes **4)** steal analogies from other industries. Pick one and I'll run with it!",
      concise: "Ideas: curiosity digest; reverse brainstorm; constraint remixes; cross-industry analogies."
    },
    fu: ["Give me a concrete example", "Rewrite this more formally", "Thank you!"]
  },
  capabilities: {
    kw: ["what can you do", "capabilities", "who are you", "your name", "help me with"],
    thought: "Summarising agent scope and strengths…",
    r: {
      formal: "I am **Oh-Matilda**, your AI agent. I can research and summarise topics, draft and rewrite text, brainstorm ideas, plan trips and schedules, and troubleshoot common technical problems. Tell me the outcome you want and I will take it from there.",
      friendly: "Hey, I'm **Oh-Matilda**! Lots: research & summaries, writing & rewrites, brainstorming, trip planning, even tech first-aid 🩺 Point me at a goal and I'll go.",
      concise: "I'm **Oh-Matilda**. I research, write, brainstorm, plan trips, and troubleshoot tech issues."
    },
    fu: ["Plan a relaxing trip somewhere beautiful", "Explain what a design system is", "My laptop is slow since yesterday"]
  },
  greeting: {
    kw: ["^hi$", "^hello$", "^hey+$", "good morning", "good evening", "good afternoon", "bonjour", "salut"],
    thought: "A warm, brief acknowledgement…",
    r: {
      formal: "Good evening. I am **Oh-Matilda**, your AI agent. How may I assist you today?",
      friendly: "Hey hey 👋 I'm **Oh-Matilda**. What are we getting into today?",
      concise: "Hello. How can I help?"
    },
    fu: ["What can you do?", "Plan a relaxing trip somewhere beautiful", "Explain what a design system is"]
  },
  thanks: {
    kw: ["thank", "thx", "appreciate", "merci"],
    thought: "Closing the loop graciously…",
    r: {
      formal: "You are most welcome. Should you need anything further, I remain at your disposal.",
      friendly: "Anytime! 💚 Come back whenever you need me.",
      concise: "You're welcome."
    },
    fu: ["What can you do?", "Plan a relaxing trip somewhere beautiful", "Explain what a design system is"]
  }
};





export const INITIAL_CONVERSATIONS: ConversationHistoryItem[] = [
  {
    id: "c1", fav: true, time: "09:49", title: "Santorini trip planning",
    messages: [
      { id: "m-c1-1", sender: 'user', text: "Plan a relaxing trip somewhere beautiful", timestamp: "09:48" },
      { id: "m-c1-2", sender: 'ai', scId: "travel", rawText: SCENARIOS.travel.r.formal, timestamp: "09:48" },
      { id: "m-c1-3", sender: 'user', text: "What's this place?", timestamp: "09:49" },
      { id: "m-c1-4", sender: 'ai', scId: "santorini", rawText: SCENARIOS.santorini.r.formal, timestamp: "09:49" }
    ]
  },
  {
    id: "c2", fav: true, time: "Tue", title: "Design system Q&A",
    messages: [
      { id: "m-c2-1", sender: 'user', text: "What are design systems?", timestamp: "Tue" },
      { id: "m-c2-2", sender: 'ai', scId: "design", rawText: SCENARIOS.design.r.formal, timestamp: "Tue" }
    ]
  },
  {
    id: "c3", fav: false, time: "Mon", title: "Laptop slowdown fix",
    messages: [
      { id: "m-c3-1", sender: 'user', text: "My laptop is slow since yesterday", timestamp: "Mon" },
      { id: "m-c3-2", sender: 'ai', scId: "support_slow", rawText: SCENARIOS.support_slow.r.formal, timestamp: "Mon" },
      { id: "m-c3-3", sender: 'user', text: "I installed Chrome extensions and updated Zoom", timestamp: "Mon" },
      { id: "m-c3-4", sender: 'ai', scId: "support_ext", rawText: SCENARIOS.support_ext.r.formal, timestamp: "Mon" }
    ]
  },
  {
    id: "c4", fav: false, time: "Sun", title: "Brainstorm session",
    messages: [
      { id: "m-c4-1", sender: 'user', text: "Brainstorm creative ideas", timestamp: "Sun" },
      { id: "m-c4-2", sender: 'ai', scId: "brainstorm", rawText: SCENARIOS.brainstorm.r.formal, timestamp: "Sun" }
    ]
  },
  {
    id: "c5", fav: false, time: "Sat", title: "Rewrite slack message",
    messages: [
      { id: "m-c5-1", sender: 'user', text: "Rewrite message for maximum impact", timestamp: "Sat" },
      { id: "m-c5-2", sender: 'ai', scId: "rewrite", rawText: SCENARIOS.rewrite.r.formal, timestamp: "Sat" }
    ]
  },
  {
    id: "c6", fav: false, time: "12/02", title: "Budget estimate",
    messages: [
      { id: "m-c6-1", sender: 'user', text: "Estimate a budget for this trip", timestamp: "12/02" },
      { id: "m-c6-2", sender: 'ai', scId: "budget", rawText: SCENARIOS.budget.r.formal, timestamp: "12/02" }
    ]
  }
];

