# Plan — Reproduction mobile-only de Oh-Matilda (Tauri v2 Android)

> Tracking du port du mockup React desktop (`research/oh-matilda-—-ai-agent-chat`) en app mobile-only Android.
> Cocher chaque item au fur et à mesure. Chaque phase a une **vérification** explicite.

## Décisions retenues

- [x] Workflow : boucle principale `tauri android dev` sur téléphone USB (même Wi-Fi que le PC), HMR frontend instantané. **Pas de simulation desktop** (pas de fenêtre 360×800) : l'app est développée et testée sur le device.
- [x] Pas de « coque » : on ne porte pas le phone-frame 360×800 de la référence — le webview est l'écran, l'app est nativement plein écran.
- [x] Police : `@fontsource/inter` embarquée (pas de CDN).
- [x] État : store **zustand** central (pas de prop-drilling useState).
- [x] **Safe-area via bridge bidirectionnel Kotlin↔JS** : `env(safe-area-inset-*)` renvoie **0** dans la WebView Android (vérifié par probe on-device) et Tauri 2.11.5 n'expose pas d'API safe-area. Solution : `MainActivity.kt` (a) pousse les insets au layout via `evaluateJavascript` (re-pushs différés 500/1500/3000 ms), (b) expose `SafeAreaBridge.requestInsets()` via `addJavascriptInterface` que le JS appelle à `DOMContentLoaded`/`load`/`visibilitychange` → les insets survivent aux **full reloads** HMR (cas bug : header recollé après reload). Fallback `env()` conservé en CSS pour le web.

## État de départ (audit)

**Ce qui marche :** Tauri v2 (CLI 2.11.4 / crate 2.11.5), React 19, TS 6.0.3, Vite 8, Tailwind v4, zustand, motion, lucide-react. Target Android initialisé dans `src-tauri/gen/android/` (APK debug arm64 buildé le 17/09 → toolchain OK : Java 25, Gradle 8.14.3, AGP 8.11.0). `compileSdk`/`targetSdk` = 36 → **edge-to-edge forcé** (Android 15+).

**Ce qui est cassé :**

| Fichier | Problème |
|---|---|
| `tsconfig.json:23` | `baseUrl` déprécié (TS 6.0.3) → `tsc` exit 2 → `npm run build` échoue |
| `src/components/AppHeader.tsx:9,15` | Syntaxe JSX cassée : `style={{color: "var(--text-2"}}` |
| `src/components/StatusBar.tsx:1` | Import inexistant `from 'motion/react-client'` |
| `src/lib/tauri.ts` | Dynamic imports de plugins absents de package.json (`plugin-clipboard-manager`, `plugin-haptics`) |
| `src/App.tsx` | Encore le template Tauri (bouton `greet`) |

**Réutilisable tel quel :** `src/types.ts`, `src/constants/{scenarios,images,prompts}.ts`, `src/lib/icons.ts`, `src/styles/global.css` (variables thèmes alignées ref).

**Device** : `<device-id>` connecté mais **unauthorized** → accepter le prompt « Autoriser le débogage USB » sur le téléphone à la première connexion.

## Desktop → mobile : ce qui change

**À supprimer :**
- [ ] Phone-frame 360×800 + scale `visualViewport` → layout plein écran
- [x] Fake StatusBar (composant + barre simulée) → vraie barre système Android + safe-area *(composant supprimé en phase 0 ; insets injectés par le bridge Kotlin→JS, voir Décisions)*
- [ ] Fake gesture bar (pill en bas)
- [ ] Navigation clavier `↑↓⏎ esc` (FollowUpPanel) → tap uniquement
- [ ] États hover (`whileHover`, `hover:bg-*`, reply-pill) → `active:` (état pressé)
- [ ] Fermeture par `document.addEventListener('click')` (KebabMenu) → overlay tap + bouton

**À ajouter :**
- [ ] `100dvh` + `env(safe-area-inset-*)` partout, `viewport-fit=cover` dans `index.html`
- [ ] Touch targets ≥ 44×44dp
- [ ] BottomSheet : drag-to-close réel + backdrop tap + snap
- [ ] Long-press sur les conversations (liste) pour la suppression
- [ ] Haptics : `navigator.vibrate` (fallback, sans plugins manquants)
- [ ] Ajustement composer au remontée du clavier soft (`visualViewport` / `dvh`)

## Architecture cible

```
src/
  App.tsx                    → shell mobile : ConversationList | ChatView, BottomSheet, modales, toast
  store/chatStore.ts         → zustand : conversations, activeId, messages, isStreaming, regen,
                                permissions, automations, uiState (sheet, kebab, modal, toast)
  lib/
    tauri.ts                 → corrigé (copy/vibrate sans plugins manquants)
    icons.ts                 → existant
    mockAgent.ts (nouveau)   → logique agent simulée : send, streaming, matchScenario, follow-ups, regen
  components/                → portés en version mobile (voir phase 2)
  constants/ , types.ts      → existants
  styles/global.css          → enrichi : safe-area, 100dvh, police locale, hit targets
```

---

## Phase 0 — Réparer les fondations ✅

Vérification : `tsc` exit 0 **ET** `vite build` OK.

- [x] `tsconfig.json` : retirer `baseUrl` (garder `paths` avec préfixe `./`)
- [x] `src/components/AppHeader.tsx` : corriger la syntaxe JSX (2 occurrences)
- [x] `src/components/StatusBar.tsx` : supprimer (remplacé par la safe-area)
- [x] `src/lib/tauri.ts` : retirer les imports de plugins manquants (fallback Web natif : `navigator.clipboard`, `navigator.vibrate`)
- [x] `src/App.tsx` : débrancher le template `greet` (+ suppression `App.css`, `assets/react.svg`)
- [x] Bonus : `src/constants/scenarios.ts` — retirer import `IMG_DESK` non utilisé (TS6133, masqué par l'arrêt tsc précédent)

## Phase 1 — Shell mobile + fondations ✅

Vérification : build OK + rendu plein écran sur le device, safe-area correcte sous la vraie barre système. **Fait** : HMR live confirmé sur device (titre modifié en direct), header sous la barre de statut (24 px d'inset top mesuré sur le SM-A520F).

- [x] Installer `@fontsource/inter`
- [x] `index.html` : `viewport-fit=cover`, `theme-color`, titre « Oh-Matilda »
- [x] `global.css` : `100dvh`, helpers safe-area, import police locale
- [x] `tauri android dev` sur le téléphone (après acceptation prompt USB) → premier rendu plein écran
- [x] **Bonus** : bridge safe-area `MainActivity.kt` (env() = 0 dans la WebView) + inline script `window.__setSafeArea` dans `index.html`

> Note : pas d'item `tauri.conf.json` fenêtre 360×800 — pas de simulation desktop (décision utilisateur). Sur Android la config `window` est ignorée de toute façon.
>
> Astuce dev : si une édition frontend n'apparaît pas (Fast Refresh parfois révoqué dans la WebView), relancer l'app sans redémarrer le serveur : `adb shell am force-stop com.ohmatilda.app && adb shell am start -n com.ohmatilda.app/.MainActivity`. Screenshot de vérification : `adb exec-out screencap -p > /tmp/opencode/phone.png`.

## Phase 2 — Port des composants (ordre de dépendance) ✅ TERMINÉE

Vérification : `tsc` vert + rendu de chaque composant sur device + `npm run build` vert (907 ms, JS 421 kB / gzip 130 kB).

1. [x] `Toast` — pill en haut sous safe-area
2. [x] `AppHeader` + `KebabMenu` (overlay-close) — dark theme les 2 sens
3. [x] `HomeState` — greeting horaire, prompt pool, refresh
4. [x] `Composer` — fix clavier : `windowSoftInputMode="adjustResize"` (le listener insets WebView ne reçoit pas les insets IME), `enterKeyHint="send"`, attachments (chip + ×)
5. [x] `BottomSheet` — open spring + backdrop, web toggle, tone submenu, attachments. Drag-to-close implémenté (raw pointer, hit zone 44px, seuil 120px) — **non testable via `adb input swipe`** (le swipe synthétique ne déclenche ni le drag framer ni les raw pointer events dans la WebView) ; attendu correct avec un doigt réel
6. [x] `MessageItem` + `ActionProofCard` — bold/cite, Thought, Viewed, illustration, web sources, action card (confirm → done + before/after + replay), toolbar (copy/like/dislike/regen/follow-up)
7. [x] `FollowUpPanel` (tap-only, nav clavier retirée) — sélection → envoi
8. [x] `ConversationList` (ex-Sidebar) — drawer, recherche, new chat, favoris (star), **long-press 550ms + progress bar + vibrate → dialog delete** ; navigation liste↔chat (sélection charge les messages, sync à l'envoi)
9. [x] `VoiceOverlay` — waveform canvas + dB, transcription streaming → auto-envoi
10. [x] `DeviceAccessModal` — 2 permissions, enable simulé, Continue gated

Conversions systématiques : `lucide-react`→`@/lib/icons`, `../data/mockData`→`@/constants/*`, `hover:`→`active:`, suppression `dark:` (thème via CSS vars), paddings limites→`var(--sat)`/`var(--sab)`, touch targets ≥44px, `NodeJS.Timeout`→`window.*` (number).

## Phase 3 — Store zustand + logique agent ✅ TERMINÉE

Vérification : conversation complète simulée sur device (send → streaming → réponse, follow-ups, regen, suppression). **Fait** : `adb` sur SM-A520F — envoi WhatsApp `Confirm→Done before/after`, travel `IMG_SANTORINI + Viewed`, follow-ups `Send another message`, regen, drawer `New chat` + long-press 600ms vibrate → dialog delete, `force-stop && am start` → conversations + `theme dark` persistés.

- [x] `store/chatStore.ts` : état complet + actions (sendMessage, regenerate, deleteConversation, toggleFav, togglePerm, uiState…) + `persist` `zustand/middleware` `name:"oh-matilda"` (conversations, activeConvId, theme, perms, tone, webEnabled) + hydration `onRehydrateStorage` / `App.tsx:71`
- [x] `lib/mockAgent.ts` : extraction de la logique App.tsx ref (matching SCENARIOS, streaming, typing delays)
- [x] `App.tsx` final : composition shell + store (plus de `useState` local, HMR OK)
- [x] **Bonus** : `src/constants/scenarios.ts` étendu 9→23 SCENARIOS (`travel_time, itinerary, budget, quiet, design_*, support_*, files_delete, rewrite, brainstorm`) + `SCENARIO_ORDER` complet + `INITIAL_CONVERSATIONS` c1-c6 + `getSourcesFor` élargi ; `src/types.ts` nettoyage `AutomationItem`/`DEFAULT_AUTOMATIONS` (Coming soon définitif)

## Phase 4 — Polish mobile

Vérification : parcours complet sur device, ressenti natif — 60fps, pas de jank, clavier fluide, doigt réel.

#### 4.1 Haptics `navigator.vibrate` (fallback sans plugin) ✅
- [x] `sendMessage` : `vibrate(25)` `src/store/chatStore.ts:206`
- [x] `deleteConversation` : `vibrate(40)` `src/store/chatStore.ts:386` (en plus du 40 au long-press `src/components/ConversationList.tsx:61`)
- [x] `enablePerm` : `vibrate(20)` après grant simulé `src/store/chatStore.ts:197`
- [x] `sheetClose` : `vibrate(15)` sur `closeSheet()` `src/store/chatStore.ts:176` (drag >120px `BottomSheet.tsx:49` + backdrop)
- [x] Helper central `src/lib/tauri.ts:15 vibrate()` réutilisé

#### 4.2 Audit hit targets ≥44dp + états `active:` ✅ (partiel, critiques)
- [x] `AppHeader` menu/kebab `w-10→w-11 h-11` `src/components/AppHeader.tsx:21,38`, `Composer` plus/send `w-10→w-11 h-11` `src/components/Composer.tsx:135,147`, `MessageItem` toolbar `w-[34px]→w-11 h-11` `src/components/MessageItem.tsx:312-359`, FAB `w-10→w-11 h-11` `src/App.tsx:179`
- [x] `ConversationList` star `w-9→w-11 h-11` `src/components/ConversationList.tsx:152`, clear `min-h-[40px]→44px` `src/components/ConversationList.tsx:260`, `KebabMenu` `min-h-[44px]` OK, `BottomSheet` handle `h-11` OK, `FollowUpPanel` `min-h-[48px]` OK
- [x] `active:` : `MessageItem` toolbar `active:bg-black/5 active:scale-95` déjà, `AppHeader`/`Composer` `active:scale-95` OK
- [ ] Reste mineur : audit complet `rg w-.*h-.*` pour `X` 17px photo remove (accessoire) — non bloquant phase 4

#### 4.3 Composer + clavier soft ✅
- [x] `AndroidManifest.xml:15 windowSoftInputMode="adjustResize"` confirmé — `logcat SafeArea bottom=0` mais clavier remonte bien `Composer pb-[calc(var(--sab)+2px)]` `src/components/Composer.tsx:50`
- [x] Fix scroll : `src/App.tsx:84-125` `requestAnimationFrame` + `shouldForceScroll = last.sender==="user"` + `hasOverflow` check, `ResizeObserver` + `updateFabVisibility` — corrige bug « section ne scroll pas jusqu'en bas après nouveau message » et FAB « toujours actif »
- [x] `enterKeyHint="send"` `src/components/Composer.tsx:121`, `Shift+Enter` saut de ligne `src/components/Composer.tsx:39`
- [x] `100dvh` `src/styles/global.css:74` + `h-dvh` `src/App.tsx:98` OK

#### 4.4 Transitions & navigation ✅
- [x] Drawer `380/34`, Sheet `300/28`, Panel `320/25`, Kebab `scale 0.95 y -8` — cohérents, testés `adb` ouverture/fermeture
- [x] `selectConversation` `src/store/chatStore.ts:347` + `onClose()` implicite `src/components/ConversationList.tsx:322`, `newChat` reset `src/store/chatStore.ts:364` OK
- [x] Stacking `FollowUp z-20 / Kebab z-30-40 / Sheet z-50` vérifié, pas d'overlap
- [x] FAB `src/App.tsx:164-189` `hasOverflow && distance>=80` + hide on click `setShowScrollBottom(false)` — testé `adb` send (FAB hidden) vs scroll up (FAB visible) `src/App.tsx:84`

#### 4.5 Thème & système
- [x] `toggleTheme` persisté `src/store/chatStore.ts:147` — vérifié `force-stop && am start` reste `dark` (`src/styles/global.css:21`)
- [ ] `theme-color` meta `index.html:7` sync (reporté phase 5)

#### 4.6 Vérification finale (parcours natif à la main, doigt réel)
- [x] `adb` parcours : `WhatsApp Confirm → Done`, `Travel Viewed + IMG`, `FollowUp`, `Kebab dark`, `Drawer fav/delete dialog`, `force-stop persist` OK — screenshots
- [ ] Drag-to-close `BottomSheet` **doigt réel** (non testable `adb input swipe` — `BottomSheet.tsx:33-50` raw pointer) — à tester tactile

## Phase 5 — Natif Android + livraison (EN COURS, non terminée)

Vérification : `tauri android build --debug` OK + install sur le device + boucle `tauri android dev` (HMR) confirmée en conditions réelles.

- [ ] Label app « Oh-Matilda » dans `res/values/strings.xml` — état relevé le 2026-09-27 : `app_name` + `main_activity_title` = `"oh-matilda"` minuscule (`src-tauri/gen/android/app/src/main/res/values/strings.xml:2-3`), à passer à `Oh-Matilda`
- [ ] Icône app (si pas encore customisée) — état relevé : icônes = template Tauri par défaut (`src-tauri/icons/icon.png`, `mipmap-*/ic_launcher*.png` générés), pas de custom Oh-Matilda
- [x] Build debug final — fait le 2026-09-24 : `src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk` (120M) via `npx tauri android build --debug --apk --target aarch64` (Rust `dev` + debuginfo, pas strip). Ancien `apk/arm64/debug/app-arm64-debug.apk` (131M, 23/09) remplacé
- [ ] Install sur le device — non vérifiable le 2026-09-27 : `adb devices` = `521004edeadf2499 unauthorized` (prompt USB à ré-accepter), install `adb install .../app-universal-debug.apk` à refaire une fois autorisé
- [x] Test de la boucle dev (HMR frontend) sur device — déjà confirmé phases 1-4 (`tauri android dev`, `TAURI_DEV_HOST` LAN, `vite.config.ts:8`), guide sans câble dans `docs/WIRELESS.md` (ignoré git)

> Conclusion phase 5 : reste label + icône + réinstall post-autorisation USB. Ne pas cocher ✅ tant que ce n'est pas fait.

## Phase 6 — POC Vercel AI SDK (Ollama Cloud `gpt-oss:20b-cloud`)

Décisions figées : provider Ollama Cloud, clé lue côté Rust (`std::env::var("OLLAMA_API_KEY")`, jamais `VITE_` hardcodé), 2 modes `fast` / `thinking` (remplacent `ToneType formal/friendly/concise`), ordre `6 POC Vercel → 7 Android UI-use → 8 engine Rust` (inversé le 27/09 : android-use avant le Rust maison pour prouver le différenciant plus tôt), tools = primitives génériques téléphone (tap/swipe/scroll/input/press/openApp/getUiTree/screenshot/wait) combinées par l'agent — pas de tool spécifique à une app, démo **Chrome search** composée de ces primitives, WhatsApp abandonné = trop confidentiel.

> Note : `opencode.json` est la config **OpenCode** (provider `kaggle-remote/Qwen3.8-27B`), pas Vercel AI SDK. Ne pas confondre : Vercel = packages `ai` + `ollama-ai-provider-v2` à ajouter dans `package.json:12`.

Vérification : sur device, envoi → vrais tokens streamés depuis `https://ollama.com/api/chat` (`model:"gpt-oss:20b"`, `stream:true`, `Authorization: Bearer`). **Pas de fallback** (décision 27/09) : sans clé → bulle d'erreur `LLM unavailable` + toast. `mockAgent.ts` supprimé dès la phase 6. Phase 6 = chat réel seul (pas d'exécution native).

- [x] Deps : `ai@7.0.118 + ollama-ai-provider-v2@4.0.1 + zod@4.6.5` (Vercel AI SDK v7, `streamText` + `fullStream` `text-delta`/`reasoning-delta`, `providerOptions.ollama: { think }` pour thinking). Build JS 444kB → 828kB / gzip 138kB → 239kB
- [x] Rust : `get_ollama_key()` dans `src-tauri/src/lib.rs` (runtime `std::env::var` + compile-time `option_env!` pour Android), `invoke_handler![greet, get_ollama_key]`, `src-tauri/.env.example` (vrai `.env` jamais commité)
- [x] Frontend `src/lib/ollama.ts` (nouveau) : `invoke('get_ollama_key')` → `createOllama({ baseURL: 'https://ollama.com', headers: Bearer })` → `streamText`, historique 10 derniers, `onToken/onThinking/onDone/onError`, `AbortController`
- [x] Modes : `src/types.ts` `Mode = 'fast' | 'thinking'` + prompts système draftés (`FAST_SYSTEM`/`THINKING_SYSTEM`), `ChatMessage.thinking`, store `mode`/`setMode` persisté, `BottomSheet` `Mode Fast/Thinking`, `MessageItem` Thought = `message.thinking ?? sc.thought` (`ToneType`/`Scenario.r` conservés pour les seeds)
- [x] Store : `sendMessage`/`regenerate` 100% réels (`pending.target` = buffer live, `finalizeMessage` au done, bulle d'erreur au `onError`), abort via handle (navigation/regen/delete)
- [x] `src/lib/mockAgent.ts` supprimé ; `tsc` 0 + `vite build` verts
- [x] Device (SM-A520F, `tauri android dev`) : new chat → send → bulle d'erreur `LLM unavailable: OLLAMA_API_KEY missing` (clé absente, circuit réel prouvé) ; Mode `Thinking` sélectionnable (toast) ; `INTERNET` déjà OK
- [x] Debug cause racine via `adb logcat` (console WebView → tag `Tauri/Console`) : 1) CORS bloque le fetch direct (`http://tauri.localhost` → `ollama.com`), 2) URL appelée `/chat` au lieu de `/api/chat`, 3) scope `http` refusait l'URL. Fix : `tauri-plugin-http` (`fetch` via Rust) + `baseURL https://ollama.com/api` + scope `https://ollama.com/**` (`capabilities/default.json`), alignement versions `tauri Rust 2.12.0 = @tauri-apps/api 2.12.0` (`cargo update`, le `npm i plugin-http` avait monté le JS en 2.12)
- [x] Tokens réels vérifiés avec clé (27/09) : `parts={reasoning-delta:355, text-delta:94, finish}` propre, réponse **bold** rendue, thinking 1567 chars mappé dans Thought repliable (toggle `>`/`∨` testé des 2 sens), toolbar + FAB OK

## Phase 7 — Android UI-use générique (piloté par Vercel AI SDK)

Principe validé le 27/09 : pas de tool spécifique à une app. Tools = primitives génériques téléphone combinées par l'agent (ReAct via Vercel `tool()` + `stepCountIs`). La démo **Chrome search** est une tâche composée de ces primitives, pas un tool dédié. Remplace `whatsapp_msg` (`src/constants/scenarios.ts:7`, trop confidentiel) par `chrome_search` en démo uniquement.

Vérification (`adb`, SM-A520F) : prompt `search cats in Chrome` → l'agent compose `openApp(com.android.chrome) → getUiTree (omnibox) → tap → inputText(cats) → Enter → screenshot`, résultats visibles, `before/after + Replay` affichés.

- [x] Tools Vercel (27/09, démo réelle) : `openApp/getUiTree/tap/swipe/inputText/press` (`tool()` + `zod`, `stopWhen: stepCountIs(8)`, prompts `AGENT_SYSTEM_FAST/THINKING`) — exécution **directe JS→bridge** (pas de détour Rust : prouvé, 1 hop de moins ; guardrails restés natifs)
- [x] Boucle observe-agit-vérifie + `AgentRunCard` (steps live, before/after réels, Stop kill-switch, Dismiss) + trigger `BottomSheet "Agent task"` (envoie le composer). Démo `search cats in Chrome` : `openApp chrome ok → tap ok → input ok → tap → tap → after-shot`, carte d'étapes affichée. **Partiel** : l'agent atterrit dans Google Lens au lieu des résultats (grounding à améliorer, boucle de récupération prouvée mais but non atteint) ; kill-switch non exercé (run fini avant)
- [x] Web-search simulé masqué (27/09) : `SHOW_WEBSEARCH=false` (`src/lib/flags.ts`), toggle `BottomSheet` + bloc sources `MessageItem` cachés, logique conservée pour réactivation future
- [x] Screenshot MediaProjection POC sur A520F (API 26) (27/09) : `ScreenCaptureService` (foreground) + `AgentBridge.requestScreenshot()` (`MainActivity.kt`), consentement système, `VirtualDisplay` **via `MediaProjection.createVirtualDisplay`** (le token n'est transmis que par cette voie — `DisplayManager.createVirtualDisplay` → `SecurityException`, trouvé dans AOSP), frame 540x960 JPEG ~57kB base64 → `src/lib/agentBridge.ts` → `screenshotPreview` store → miniature dans `DeviceAccessModal` + `capture: Granted`. Logs `AgentCapture` : `start foreground → consent ok sdk=26 → getMediaProjection ok → virtual display ready → frame captured`
- [x] Kotlin (27/09) : `AgentAccessibilityService.kt` (singleton, `dispatchGesture` tap/swipe + latch, `ACTION_SET_TEXT` champ focalisé, `performGlobalAction`, `getUiTree` JSON capé profondeur 8/200 nœuds, password jamais lus/remplis) + config + manifest + guardrails `AgentBridge` (allowlist `openApp={chrome}`, gestures refusés dans `com.android.settings`). Service activé manuellement, `service connected` vérifié
- [ ] Reste : `takeScreenshot` API 30+ sur devices récents (A520F reste sur MediaProjection) ; `DeviceAccessModal` a11y ouvre les vrais settings ✅ (état resynchronisé au retour focus)
- [ ] Rust (couche mince, pas encore l'engine) : commandes passthrough `agent_tap/agent_swipe/agent_input/agent_open_app/agent_ui_tree/agent_screenshot` → plugin mobile `invoke(...)`, clé toujours via `get_ollama_key` (heap JS assumé le temps du POC)
- [ ] Frontend : `DeviceAccessModal` `a11y/capture` ouvre vraiment `Settings.ACTION_ACCESSIBILITY_SETTINGS` (`src/lib/tauri.ts:5`, plus de toast simulé), `ActionProofCard Confirm` → exécution réelle de la séquence, `chrome_search` démo (`kw: ["search.*chrome","open chrome","chrome search"]`, `thought:"Reading Chrome accessibility tree — omnibox found"`), `IMG_CHROME_BEFORE/AFTER` dans `src/constants/images.ts:48` (comme `IMG_SETTINGS_*`)

## Phase 8 — Rust `agent-engine` v1 (modulaire, exportable, sans `rig`)

Objectif : porter le loop prouvé en phase 7 vers notre propre runtime `createAgent` (étudié depuis `libs/langchain/src/agents/index.ts:176` : `model + tools + systemPrompt + state + memory + streaming + fallback`, boucle ReAct `callModel → tool_calls → ToolNode → ToolMessage → re-call`, `middleware beforeModel/afterModel/wrapModelCall`, `AgentState.messages`, `checkpointer`/`store`, `streamEvents`). Pas d'écosystème LangChain repris, juste le runtime — contrôle total + réutilisable hors projet (`cargo add agent-engine`).

Vérification : parité minimale `createAgent` sur les primitives génériques phase 7, `mockAgent.ts` supprimé, `Vercel` POC remplacé, tests Rust verts.

- [ ] Crate `src-tauri/crates/agent-engine` : `trait ChatProvider { fn chat(req: ChatReq) -> ChatStream }`, `struct ProviderConfig { base_url, api_key, model, extra: HashMap<String,Value> }` (unique provider → `base_url`/`api_key` changent par provider : Ollama `https://ollama.com/v1`, OpenAI `https://api.openai.com/v1`, `extra` pour `think:true` et options spécifiques)
- [ ] `struct AgentRuntime { provider: Box<dyn ChatProvider>, tools: Vec<Box<dyn Tool>>, memory: Box<dyn Memory>, middleware: Vec<Box<dyn Middleware>> }`, boucle ReAct `max_turns=8`, `Tool` = les primitives génériques phase 7 (`schemars` JSON-schema, exécution parallèle), `Memory` `WindowBuffer(k=6)` + `Summary` (`trigger tokens 4000`), `State` (`messages + custom`), `Middleware` (`before_model/after_tool`, retry/fallback/HITL)
- [ ] Commandes `src-tauri/src/lib.rs` : `agent_chat(prompt, mode, channel: Channel<String>)` (stream NDJSON `message.content` → frontend), clé jamais exposée à JS (flux `Channel`, fini `get_key`)
- [ ] Frontend : `src/lib/ollama.ts` bascule sur `invoke('agent_chat')` + `Channel.onmessage`, `src/store/chatStore.ts` garde `pending/isStreaming/finalizeMessage`
- [ ] Supprimer `src/lib/mockAgent.ts` + `VITE_USE_MOCK` une fois la parité validée (`tsc` + `vite build` verts)

## Risques / points d'attention

- **Wi-Fi partagé obligatoire** pour le HMR (le WebView charge Vite en LAN, pas via USB).
- **Edge-to-edge** : tout composant touchant le bord haut/bas (header, composer) doit utiliser les insets `var(--sat)`/`var(--sab)` — traité en phase 1 via le bridge Kotlin→JS. ⚠️ inset **bottom = 0** sur le SM-A520F (navigation gesture) : vérifier le comportement du composer avec le clavier soft en phase 4.
- **TS 6.0.3** : d'autres déprécations de config possibles ; si `baseUrl` ne suffit pas, ajuster `tsconfig` (paths sans baseUrl).
- **Premier `tauri android dev`** : debug APK déjà buildé (17/09) → rebuild incremental raisonnable ; la 1re exécution sur device exige l'acceptation du prompt de débogage USB.
- Mockup ≈ 2 500 lignes de composants → la phase 2 est le plus gros bloc, d'où l'ordre de dépendance (chaque étape testable).

## Log d'avancement

| Date | Phase / item | Note |
|---|---|---|
| 2026-09-22 | — | Plan créé. En attente de validation pour lancer la phase 0. |
| 2026-09-22 | Phase 0 | ✅ Terminée. `tsc` exit 0 + `vite build` OK. StatusBar supprimé, pas de coque, pas de fenêtre desktop. |
| 2026-09-22 | Phase 1 | ✅ Terminée. `@fontsource/inter`, `index.html` (viewport-fit=cover), `global.css` (100dvh, vars safe-area), premier rendu plein écran sur SM-A520F, HMR live confirmé sur device. |
| 2026-09-22 | Phase 1 (safe-area) | ✅ Bridge Kotlin→JS : `env(safe-area-inset-top)` = 0 dans la WebView (probe on-device) → `MainActivity.kt` injecte les insets réels (`top=24px` sur l'A52) dans `--sat/--sar/--sab/--sal`. Header rendu sous la barre de statut. |
| 2026-09-22 | Phase 1.5 (fix) | ✅ Bug « header recollé après reload » : l'injection one-shot était perdue au full reload. Ajout `SafeAreaBridge` (addJavascriptInterface) — le JS réclame les insets à chaque (re)chargement. Testé : full reload forcé via `index.html` → 2 appels `requestInsets` dans logcat, header stable sous la barre. |
| 2026-09-24 | Phase 2 | ✅ Port complet 10 composants + `tsc` + `vite build` 907ms 421kB. |
| 2026-09-24 | Phase 3 | ✅ Store `zustand persist` (`oh-matilda`), `mockAgent` extraction, 23 SCENARIOS, `App.tsx` shell final. `adb` SM-A520F : send→streaming→ActionProofCard/Viewed/Image, follow-ups, regen, drawer long-press delete, `force-stop && am start` → persist conversations+theme OK. Nettoyage `AutomationItem`. Build 443kB gzip 138kB. |
| 2026-09-24 | Phase 4 | ✅ Partiel : scroll force-bottom `prevLenRef` + FAB `hasOverflow`, haptics `vibrate` 15/20/25/40, hit-targets 44dp (`AppHeader/Composer/MessageItem/FAB/star`), `adjustResize` confirmé. Restes : `X` 17px photo remove, `theme-color` sync, drag-to-close doigt réel. |
| 2026-09-24 | Phase 5 | ⏳ Build debug `app-universal-debug.apk` 120M OK ; reste label `oh-matilda`→`Oh-Matilda`, icône custom, réinstall (device `unauthorized` le 27/09). |
| 2026-09-27 | Décisions IA | Provider Ollama Cloud `gpt-oss:20b-cloud` (`https://ollama.com/api/chat`, `stream:true`, `Bearer`), clé Rust, modes `fast/thinking` (remplacent `formal/friendly/concise`), ordre `6 POC Vercel → 7 engine Rust → 8 Chrome`, WhatsApp abandonné (confidentiel). `opencode.json` = config OpenCode/Kaggle, pas Vercel. |
| 2026-09-27 | Inversion phases | Nouvel ordre : `6 POC Vercel → 7 Android UI-use → 8 engine Rust`. Tools = primitives génériques téléphone (tap/swipe/scroll/input/press/openApp/getUiTree/screenshot/wait), pas de tool par app ; Chrome search = tâche démo composée. Rust phase 7 = passthrough mince, engine maison porté en phase 8. |
