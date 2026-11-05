# Livewall

A wall of live YouTube streams, with sound from one at a time. Think trading
floor, newsroom, security desk, or a row of TVs in an electronics-store window.

No build step and no dependencies: plain HTML, CSS and ES modules in `site/`.

```bash
npm start          # serves site/ at http://localhost:8080
npm run check      # reports which built-in feeds are live right now (needs internet)
npm run deploy     # publishes site/ to the gh-pages branch
```

> YouTube refuses to embed from `file://`, so serve the page over http(s)
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

Sets live in [`site/js/presets.js`](site/js/presets.js). Feeds are either a
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
site/index.html        page shell
site/css/style.css     all five skins
site/js/app.js         tiles, audio manager, modes, editor
site/js/yt.js          YouTube IFrame API wrapper (fades, watchdog, retry)
site/js/layout.js      pure layout math
site/js/presets.js     built-in feed sets
site/js/feeds.js       URL parsing / embed URLs
site/js/store.js       localStorage + share links
scripts/check-feeds.mjs
```
