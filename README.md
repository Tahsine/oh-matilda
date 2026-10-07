# Oh-Matilda — on-device Android AI agent

Mobile-only Android app (Tauri v2): chat with an LLM + an agent that **operates your real phone** — opens apps, taps, types, scrolls — to accomplish tasks. No ADB, no root, no emulator.

## Demo (uncut, real device)

An agent searches "embedding gemma 2" on YouTube, opens the video, likes it (counter verified), posts a comment — one continuous run, only dead time cut:

**https://youtu.be/1frk7yUQ3sg**

Eval report (device battery, honest failures included): [`docs/agent-eval.md`](docs/agent-eval.md).

## How it works

- **Chat** (fast/thinking): Ollama Cloud (`gemma4:31b`) via Vercel AI SDK, streamed.
- **Agent** (`createAgent`, LangGraph ReAct): observes screenshot + accessibility tree, acts with `tap / open_app / type / scroll / back / swipe / long_press`, concludes with single-call `finish` + visual `verify`. Nudge-first loop reflector, honest `stuck`, user Stop.
- **Native** (Kotlin, `src-tauri/gen/android/...`): `AccessibilityService` (resolve, gestures, denylist), foreground service + watchdog, keyboard-height bridge, safe-area insets.

## API key (required)

The app needs an Ollama Cloud API key. Get one here: **https://ollama.com/settings/keys**

Enter it in-app: **Settings → Ollama API key → Save** (stored in the app-private store on your phone, never committed anywhere, compiled fallback not needed). The status line shows `Configured ••••XXXX` and the Test button verifies it with a 1-token call.

## Permissions (why)

- **Accessibility service**: the ONLY way to read the screen and perform gestures on-device. It stays on your phone — no screen data ever leaves it except the screenshots sent to the LLM for the current task.
- **Foreground service + notifications**: keeps the agent alive and cancellable (Stop button) during runs.
- **Internet**: LLM calls (`https://ollama.com/api`).

## Dev

```bash
npm install
npm run tauri -- android build --debug --split-per-abi   # per-ABI APKs (arm64 ≈ 180 MB debug)
adb push <apk> /data/local/tmp/ohm.apk && adb shell 'pm install -r /data/local/tmp/ohm.apk'
```

- `OLLAMA_API_KEY` env is optional (compile-time fallback only); the device store wins.
- Docs: [`docs/PLAN-mobile.md`](docs/PLAN-mobile.md) (port tracking), [`docs/WIRELESS.md`](docs/WIRELESS.md) (cable-free dev), [`docs/agent-eval.md`](docs/agent-eval.md) (eval v1→v3).
- Release builds: dedicated keystore (never in git, see `.gitignore`), strip + minify — see roadmap in eval v3 ("Lots actés").
