# Livewall

A wall of live YouTube streams, with sound from one at a time. Think trading
floor, newsroom, security desk, or a row of TVs in an electronics-store window.

TypeScript (strict) + Vite, no runtime dependencies. The whole app is ~9 KB gzipped.

```bash
npm install
npm run dev          # http://localhost:8080 with hot reload
npm run build        # typecheck + production build into dist/
npm run preview      # serve the production build locally
npm run deploy       # build and publish dist/ to the gh-pages branch
```

| Script | |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit` (strict, `noUncheckedIndexedAccess`) |
| `npm run lint` | ESLint + typescript-eslint |
| `npm run format` / `format:check` | Prettier |
| `npm test` / `test:watch` | Vitest: URL parsing, layout math for 1–36 tiles at several viewport sizes, state sanitising, preset integrity |
| `npm run check` | Reports which built-in feeds are live right now (needs internet) |

CI (`.github/workflows/ci.yml`) runs typecheck, lint, format check, tests and build.
The build uses relative asset paths, so it works under any sub-path
(e.g. `https://example.com/livewall/`).

> YouTube refuses to embed from `file://`; use `npm run dev` or `npm run preview`
> rather than opening `index.html` directly.

## Sound

Every tile starts muted; exactly one is ever audible.

| Control | What it does |
| --- | --- |
| **Hover** (default) | Sound follows the mouse, with a short crossfade. Click a tile to *pin* it; the pin is what you hear when the mouse isn't on anything. |
| **Click** | Sound changes only when you click. Used automatically on touch screens. |
| `1`–`9`, `←` `→` | Pin a specific tile / step through tiles |
| `M` | Mute everything |
| **Tour** (`T`) | Pins the next feed every 15 s, like channel surfing |

Browsers block audio until you've interacted with the page, so the first click
or key press turns sound on.

## Modes

| Key | Mode | |
| --- | --- | --- |
| `W` | **Wall** | Auto-fitted grid that maximises tile size for the window. |
| `S` | **Spotlight** | One big feed plus a rail of the rest. Click a rail tile to promote it. Sound defaults to the big one. |
| `C` | **CRT** | A stack of old TVs in a shop window: pyramid layout, scanlines, glass glare, a green LED on the set that's playing, and a tuning glitch when you switch. |
| `V` | **CCTV** | Security desk: desaturated feeds, `CAM 03` labels, live timestamps, blinking REC. |
| `Z` | **Minimal** | Edge-to-edge video, no gaps, no labels, hidden cursor. Move to the top edge for controls. |

`F` fullscreen · `E` edit feeds · `H` hide the toolbar · `?` help.
The toolbar fades out after a couple of seconds without mouse movement.

## Feed sets

| Set | Contents |
| --- | --- |
| Newsroom · World | Sky, Al Jazeera, France 24, DW, Euronews, ABC Australia, CNA, WION, TRT World |
| Newsroom · US | ABC, NBC, CBS, LiveNOW from FOX, PBS NewsHour, Bloomberg, Yahoo Finance, Reuters |
| Trading Floor | Bloomberg, CNBC, Yahoo Finance, Reuters + CNA, Sky, Al Jazeera, DW, France 24 |
| Mission Control | NASA, SpaceX, NASASpaceflight, ESA, ISS Earth view |
| Webcams · Cities & Wild | Shibuya, Abbey Road, Times Square, Jackson Hole, Venice, Dublin, Namib waterhole, ISS |
| Electronics Store | 12 mixed: news, markets, space, webcams, lofi |

Sets live in [`src/presets.ts`](src/presets.ts). Feeds are either a
**channel ID** (`UC…`), which always embeds whatever that channel is live on
*right now* and so survives the stream restarting, or a fixed **video ID**.

### Keeping feeds alive

Live streams come and go, and webcam video IDs go stale whenever the owner
starts a new broadcast. Nothing here is guaranteed to be live forever, so:

- A tile that never starts playing shows **NO SIGNAL** and retries every 3 min.
- `npm run check` tests every built-in feed and tells you which are dead.
- The **Feeds** panel (`E`) edits any tile in place: paste a watch / youtu.be /
  `/live/` URL, a `/channel/UC…` URL, or a bare video or channel ID.
  `@handle` URLs can't be embedded; use the channel ID (About → Share → Copy channel ID).
- **Copy share link** encodes your current set and mode in the URL hash.

## Notes and limits

- Twenty HD streams is a lot for any machine. Around 9–12 is comfortable; the
  hard cap is 36. YouTube's player ignores quality hints, so there's no "eco" mode.
- Some channels disable embedding; those show NO SIGNAL.
- YouTube may show a cookie/consent or age prompt inside a tile in some regions.

## Layout of the repo

```
index.html             page shell
src/app.ts             boot, audio manager, modes, editor
src/tile.ts            one feed's DOM + player
src/yt.ts              YouTube IFrame API wrapper (fades, watchdog, retry)
src/layout.ts          pure layout math (grid, spotlight, CRT pyramid)
src/presets.ts         built-in feed sets
src/feeds.ts           URL parsing / embed URLs
src/store.ts           localStorage + share links, input sanitising
src/types.ts           shared types
src/styles/style.css   all five skins
tests/                 Vitest suites
scripts/check-feeds.ts feed-liveness checker
```
