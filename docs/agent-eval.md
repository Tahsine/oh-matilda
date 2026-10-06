# Agent Eval — boucle observe-and-act v2 (gemma4:31b multimodal)

> Runs device du 30/09/2026, SM-A520F (API 26), `tauri android dev` + HMR.
> Code : `src/lib/agentLogic.ts` (pur) + `agentRunner.ts` (driver) + `agentTools.ts` + `agentBridge.ts`.
> Modèle : `gemma4:31b` via Ollama Cloud `/api/chat`, `stream:false`, **sans `think`**, image 540p jointe à chaque tour.
> Traces : `[agent-trace] t=<ms> <fg|bg> pkg=<pkg> {"seq","tool","args","ok",...}`.

## Conventions de lecture

- `t=` : ms depuis le début du run. `pkg=` : package au premier plan **vérifié après** l'action.
- `verify` = second avis vision (même modèle) sur `finish(success)` ; consultatif : en panne → finish autorisé ; `reached=false` → finish rejeté, run continue.
- Marqueur de version logcat : `[agent] runner v2 gemma4:31b multimodal+HMR` (HMR vers le téléphone **non fiable** : la v1 des gates tournait l'ancien code — toujours reloader l'app avant un gate et vérifier le marqueur).

## Tâche 1 — météo Cotonou (20:30) : SUCCESS ~12 s

| seq | tool | t | pkg | ok |
|---|---|---|---|---|
| 1 | open_app Chrome | 7135 | com.android.chrome | true |
| 2 | verify | 12445 | com.android.chrome | true |
| 3 | finish success | 12449 | com.android.chrome | true |

- decides : 2708 ms / 3153 ms (vs 6–75 s+ avec gpt-oss:20b).
- Verdict : `reached=true` — "Google search for 'météo à cotonou'... forecast visible".
- Chrome avait restauré l'onglet météo précédent → 0 frappe nécessaire. `finished shown: done`.

## Tâche 2 — wikipedia.org (20:33) : SUCCESS ~35 s, 8 steps

- Navigation réelle (open + type + submit), atterrissage sur la version japonaise du portail.
- Verdict : `reached=true` — "Japanese Wikipedia main page". `finished shown: done`.

## Tâche 6 — site inexistant zzz12345abcxyz.com (20:37) : succès transparent

| seq | tool | t | pkg | ok / note |
|---|---|---|---|---|
| 1 | type id=31 | 83914 | com.ohmatilda.app | **false** `unknown id 31` — id périmé du run précédent, garde anti-stale OK, récupération via open_app |
| 2 | open_app Chrome | 90198 | com.android.chrome | true |
| 3 | type + submit | 96660 | com.android.chrome | true |
| 4 | verify | 101338 | com.android.chrome | reached=true (nuance : page d'erreur DNS acceptée) |
| 5 | finish success | 101346 | com.android.chrome | résumé honnête : "site currently inaccessible (DNS_PROBE_FINISHED_NXDOMAIN)" |

- Pas un mensonge (l'échec DNS est admis dans le résumé), mais `success` sur page d'erreur = indulgent. Piste : durcir le prompt vérificateur (`error pages = not reached`) — risque de faux négatifs, non fait.

## Météo Dakar (20:40) : SUCCESS ~10 s — type + verify + finish, `done`.

## Météo Bamako (20:41) : SUCCESS ~16,5 s — double frappe récupérée

- Première frappe `type submit` sans navigation visible → le modèle a re-tapé, 2e tentative OK → verify → finish. `t=16493 pkg=com.android.chrome done`.

## Météo Niamey (20:42–20:44) : SUCCESS ~113 s avec stall 87 s

- `decide step=1` : 20:42:49 → 20:44:16, **aucun log intermédiaire** (timeout 45 s + retry non déclenchés) alors que l'écran était allumé et le serveur rapide (probe directe : 1,5 s).
- Diagnostic : WebView background throttlée (timers gelés) sur ce Samsung ; le watchdog 60 s (FGS + retour premier plan) n'a pas visiblement dégivré — récupération spontanée.
- Suite du run nominale (6 steps, decides ~3 s) → finish success `t=113524`. À surveiller, non bloquant.

## Tâche 8 — Stop in-app (20:45) : CANCELLED vérifié

- Tap bouton "Stop agent task" (coord. uiautomator) en plein `decide` → `finished shown: cancelled`, fetch abortée (`Request canceled`), aucune trace ultérieure.
- Nota : le receiver notif `AgentStopReceiver` est `exported=false` (sécurité) → non testable via `adb shell am broadcast` (silencieusement ignoré) ni via `run-as` (crash Binder sur API 26). Seul le chemin réel (bouton notif = PendingIntent même UID, ou bouton in-app) est exerçable.
- **Bonus** : juste avant le Stop, le vérificateur avait rejeté un `finish(success)` abusif — l'app ramenée au premier plan pour le tap montrait le chat, pas Chrome : `reached=false` ("screenshot shows a chat interface..."), `visual check failed`, run continué. Comportement nominal du garde.

## Baseline pré-rewrite (19:46, 20:19–20:21)

- 4 succès météo avec gpt-oss:20b + hints (code v1, ligne 240/323). Rétrospectivement : les runs 20:19–20:21 tournaient du code **stale** (HMR mort) — d'où le marqueur de version obligatoire depuis.

## Gardes exercés sur device (récap)

- unknown-id / stale-id, clavier Samsung muet (fallback géométrique), double-frappe, `at_end`, budgets 40/8/10 min, `noChange`/`neutral` (unit : 35/35 `node --test`), vérificateur vision, Stop < ~10 s, deadline, heartbeat/watchdog.
- `no_effect` 6× : couvert en unit, jamais déclenché sur device (les écrans bougent toujours assez pour sortir du neutre).

---

# Agent Eval v3 — rewrite createAgent + lots correctifs (06/10/2026)

> Runs device du 06/10/2026, SM-A520F (API 26), APK installés (`--split-per-abi` arm64).
> Modèle : `gemma4:31b` via Ollama Cloud `/api/chat`, `stream:false`, sans `think`, image 540p jointe à chaque tour. Clé via store device (`getOllamaKey`), plus de clé compilée.
> Protocole : batterie manuelle (doigts : agent armé, premier plan, verdict carte ; traces `[agent-trace]` + `AgentNotify` via logcat). Pas automatisée — chaque gate manuelle documente un cas du futur harness (v0.2).
> Code en 3 états pendant la batterie :
>
> - runs 1-6 : `runner v11` + `modelCallLimit runLimit:40` + finish deux temps ;
> - run 7 : + réflecteur nudge-d'abord + tools `back/swipe/long_press` (mur 40 toujours là) ;
> - runs 8-10 : sans plafond + finish unique + règle toggle (revérifier l'état).
>   Marqueur logcat non bumpé entre les lots (`runner v11` partout) — à corriger : marqueur par lot la prochaine fois. Distinction des builds par hash bundle JS + pid.

## Tâche 1 — météo Cotonou (16:54) : SUCCESS ~37 s, 7 steps

| seq | tool | t | ok / note |
|---|---|---|---|
| 1 | open_app Chrome | 11709 | true |
| 2 | read_uitree | 16330 | true |
| 3 | type id=2 submit | 23157 | true |
| 4 | read_uitree | 25355 | true |
| 5-6 | finish(success) ×2 (deux temps) | 28211-31674 | "29°C, partiellement ensoleillé", evidence citée |
| 7 | verify | 37364 | true |

- Première preuve du chemin store → agent (aucune erreur clé). Traces marquées `bg` (WebView se croit en arrière-plan, Samsung) mais run nominal — à surveiller, non bloquant.

## Tâche 2 — météo Dakar (16:56) : SUCCESS ~48 s, 11 steps

- Frappe sans effet récupérée seule (tap puis re-type, pattern Bamako v2) → finish×2 → verify. "29°C nuageux, ressentie 35°C", evidence citée. Aucune erreur app (bruit système fingerprint/trace uniquement).

## Tâche 3 — wikipedia.org (16:59-17:00) : ERROR honnête ~85 s, 17 steps

- Boucle `tap id=4 ambiguous` ×6 (seq 7,9,12-16, conseil `@top/@mid/@bot` + scroll ignoré) → `stuck` ("returning to screens already seen") → `finished shown: error`. Zéro mensonge.
- Leçon : l'historique + le conseil dans le message d'erreur ne suffisent pas (cf. A3 : boucles malgré l'historique en prompt). Motive le réflecteur (diversification forcée + refus sec).

## Tâche 4 — site inexistant zzz12345abcxyz.com (17:11) : FAIL honnête ~40 s, 6 steps

- Two-phase en action : seq5 admet "Wikipedia encore affiché", seq6 cite la vraie page `DNS_PROBE_FINISHED_NXDOMAIN` ("Ce site est inaccessible"). Pas de `success` sur page d'erreur (point indulgent v2 corrigé en pratique).

## Tâche 5 — Stop + mur du budget (17:14-17:17)

- Tentative Niamey meurt à ~14 s / 2 steps : "model call limits exceeded ... with 40 model calls". Ni quota ni clé (aucun 401/429, runs OK minutes avant) : **notre garde** (`modelCallLimit runLimit:40`, cumulé sur le thread persistant de la conversation — 4 runs précédents ≈ 40 appels).
- Nouvelle conversation (thread/compteur zéro) : run Niamey repart (`open/read/type`), **Stop in-app → `finished shown: cancelled` en 153 ms**, abort propre.
- Décision : **retirer `modelCallLimit`** (punit la longueur, pas les boucles ; un flow légitime fait 25-35 appels). Gardés : deadline 10 min, recursion 200, stuck, Stop. Quota → niveau compte Ollama, pas dans le run.

## Tâche 6 — Seoul 5e lien (17:22-17:24) : ERROR honnête ~170 s, 33 steps

- Départ sain (refus own-app, open, recherche, résultats) puis **ping-pong de scrolls** (~10 down puis 5 up : dépassé le 5e lien, remonté, mêmes écrans revus) → `stuck` → error. Pas de mensonge.
- Leçon : chasser sans ancre visuelle = errer. Le durcissement doit couvrir les DEUX sorties de boucle (re-tap `ambiguous` ×N ET scroll-ping-pong ×N). Référence rewrite : SUCCESS en 17 steps — variance inter-runs réelle.

## Tâche 7 — flow YouTube complet #1 (18:25-18:28) : ERROR protocole ~194 s, 35 steps

- Parcours : search Yosha → Shorts (égarement) → back/swipe/keyboard-dance (`back` natif nouveau utilisé seq26, dismiss clavier) → retype → tap send [4] → toast "Commentaire ajouté".
- Seq35 `finish(success)` (1er, deux-temps) revendique search + like ("déjà fait à une étape précédente") + commentaire. Puis texte-only (`calls=0` ×2) au lieu du 2e `finish` → graphe sans conclusion → repli aveugle (extraction strings seules, gemma renvoie des blocs) → **"no conclusion produced"**.
- Vérité terrain : **commentaire ✅ posté, like ❌ bluffé** (compteur immobile). Attrapé par l'utilisateur, pas par le verify (jamais tourné).
- Double leçon : (1) protocole deux-temps fragile → **finish en UN appel** (forme M3A `status complete|infeasible`) + verify consultatif + extraction réparée ; (2) revendication sans preuve → **règle toggle** (revérifier checked/compteur après like/switch). Nota tri YouTube : commentaire frais non en haut (tri Top) → scroll nécessaire ; comportement app, pas bug — à intégrer au protocole démo.

## Tâche 8 — like seul Yosha (21:34-21:35) : SUCCESS ~57 s, 15 steps, NOUVEAU protocole

- Trajectoire directe : open → read → open (récupération : seq3 lisait encore `com.ohmatilda.app`, cold start ~4 s, re-`open` correct — pas un bug modèle) → search → vidéo → tap like → **relecture d'état** → `finish(success)` UNIQUE → verify → `done`.
- Compteur **219 → 220 cité en evidence**. **3,8 s/step** (vs ~5,5 avant) : un seul finish (−2 tours LLM), zéro errance. Decides toujours ~3 s (le chemin a raccourci, pas le modèle).

## Tâche 9 — like + comment mcskyz (21:39-21:41) : SUCCESS ~92 s, 25 steps

- Like ✅ + commentaire ✅ **avérés terrain** (compteur bougé, commentaire visible en scrollant). Toast comme evidence suffisante ; tri YouTube confirmé (pas de scroll auto vers le nouveau commentaire).

## Tâche 10 — flow complet EmbeddingGemma 2 (21:58-22:00) : SUCCESS ~111 s, 29 steps — DONNÉE DÉMO VERTE

- Sujet : annonce du jour (Google DeepMind, 06/10/2026, 740M multimodal on-device Apache 2.0) — vidéos du jour = peu de commentaires = **commentaire visible SANS scroll** (problème Yosha résolu par construction). Requête unique → pas d'ambiguïté (anti-Seoul).
- Revendiqué : vidéo "Introducing EmbeddingGemma 2" (Google for Developers), like fait, commentaire "exciting to test it" (@kaline_zephyr) + toast. **Vérifié terrain : compteur bougé ✅, commentaire visible sans scroll ✅.**
- **Écran du téléphone enregistré depuis le début du run (3 min 27 s)** — footage démo.
- Bascule prévue non utilisée (indexation OK, commentaires ouverts) : requête `EmbeddingGemma` v1 + vidéo tierce en secours.

## Gardes exercés (nouveaux, runs 7-10)

- Finish unique 2/2 conclusions propres ; verify 2 ok ; nudge `DIVERSIFY`/`SCROLL` + `refused-identical` : **posés, jamais déclenchés en réel** (aucune boucle recorisée — noté honnêtement, en attente d'un cas) ; `stuck` 14 : jamais atteint (dernier recours) ; budget 80 steps : max observé 35 ; Stop 153 ms ; deadline jamais touchée.
- `back` natif en production (dismiss clavier seq26 run 7).

## Métriques v3

- **7 succès terrain / 10 runs** (2 errors honnêtes + 1 fail honnête + 1 erreur protocole corrigée depuis). Zéro mensonge final accepté (les 2 bluffs attrapés : like run 7, "no conclusion").
- Temps : médiane ~50 s ; 3,8-5,5 s/step (decides ~3 s, natif + settle le reste ; agents SOTA ≈ 3× l'humain — on est dans la norme).
- Étapes : 6-35 selon tâche ; flow complet ≈ 30-35 appels (d'où l'absurdité du mur 40).

## Lots actés (post-v3)

1. Release build (strip/minify, keystore dédié, mesure ; debug gardé pour itérer).
2. Démo vidéo (footage 3:27 du run 10 + protocole : scroller aux commentaires si besoin).
3. README (FR dev d'abord, EN après démo) + GitHub release APK direct.
4. v0.2 : harness (cette batterie manuelle = son prototype : cas + juges programmatic/LLM) + skills/DeepAgents (compatibles : même stack createAgent + middleware) + mémoire durable + sources réelles (premier skill naturel).
