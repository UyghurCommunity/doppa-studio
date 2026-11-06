# دوپپا ستۇدىيەسى · Doppa Studio

A browser-local 2D ornament studio in Uyghur. Start with an original almond, rosette, or atlas-inspired motif, explore colors and symmetry, and take the result into another design as SVG, PNG, or an editable JSON scene.

**[Open the studio](https://uyghurcommunity.github.io/doppa-studio/) · [Source](https://github.com/UyghurCommunity/doppa-studio)**

No framework, install step, account, external JavaScript, or backend. The application is static HTML, CSS, and ES modules. Interface text uses ALKATIP Basma with RTL layout.

## Run locally

From this directory:

```sh
python3 -m http.server 4173
```

Open <http://localhost:4173/>. ES modules require an HTTP server; opening `index.html` directly with `file://` does not work reliably.

## Design a pattern

- **Repeat mode:** choose a motif, palette, spacing, size, rotation, and symmetry. Seeded jitter gives each layout a small, reproducible variation. The same settings and seed produce the same SVG.
- **Custom mode:** switching from repeat mode converts up to 200 source motifs into editable placements. Click a blank area to add a motif. Select, drag, resize, rotate, or delete it. Mirrored copies track their source, including when dragged from the reflected side. Use the clear-scene action to start empty.
- **Symmetry:** no reflection, horizontal mirror, or four-way reflection. Reflections share one editable source motif. Overlapping reflections at the center are allowed.
- **Presets:** midnight, garden, pomegranate atlas, and porcelain palettes provide four starting scenes.
- **Undo/redo:** the latest 60 scene states include palette changes, placement drags, presets, resets, imports, and clearing. A drag or slider change becomes one history entry. Loading the page starts a fresh history.
- **Canvas tools:** inspect at 50–200% zoom, fit to the workspace, or display a guide grid. Selection boxes and guide dots never enter exported artwork.

The current scene is saved to browser-local storage when available. JSON downloads provide a portable copy; no scene is uploaded to a server.

### Keyboard and mobile use

Tab to a custom motif and press Enter or Space to select it. Arrow keys move the selected source by one canvas unit; Shift + Arrow moves it by ten. Delete or Backspace removes it. Escape clears the selection. Ctrl/Command + Z undoes; Ctrl/Command + Shift + Z or Ctrl/Command + Y redoes. Text inputs keep their normal editing shortcuts.

On small screens the canvas appears above the inspector. Custom-mode pointer dragging works with touch and a mouse. Use the page outside the artwork to scroll while in custom mode; the artwork reserves touch input for placing and moving motifs.

## Exports

| Format | Output |
| --- | --- |
| SVG | Standalone vector paths, original colors, and canvas dimensions. No images, scripts, CSS, external fonts, or editor controls. |
| PNG | The standalone SVG rasterized in the browser at 1× or 2× resolution. The default scene exports at 1920 × 1440 pixels at 2×. |
| JSON | Versioned settings and source placements, validated again on import. |
| Clipboard SVG | The same clean SVG markup, ready to paste into an HTML document. If clipboard access is blocked, download the SVG instead. |

The SVG's accessible title is metadata; there are no rendered text elements or font dependencies in the artwork. PNG generation requires browser SVG image decoding and Canvas 2D support. Scene dimensions are 240–2048 units per side, and imported scenes are limited to 250,000 characters and 200 source placements. Symmetry can create up to four rendered copies of each source placement.

The pattern artwork is an original digital interpretation inspired by textile ornament. It is not a historical catalog, a regional authenticity claim, or a physical doppa cutting/sewing template.

## Pure engine

`engine.js` has no DOM dependency and can be imported directly in Node or another browser application:

```js
import { createSVG, preset, serializeConfig, parseConfig } from './engine.js';

const scene = preset('garden');
scene.spacing = 128;
const svg = createSVG(scene);
const reusable = serializeConfig(scene);
const restored = parseConfig(reusable);
```

The engine validates dimensions, palette hex values, modes, motif names, placement IDs and coordinates, seed, size, rotation, symmetry, and supported scene version. Unknown properties and duplicate IDs are rejected. It never interpolates user-supplied markup into exports.

## Checks

Node 22 or newer is sufficient. There are no packages to install.

```sh
npm run check
npm test
```

Tests cover deterministic seeds, mirror coordinates, pure export contents, malicious configuration rejection, bounds and placement IDs, cloning, history branching, history limits, and JSON/preset round trips. CI uses official checkout and setup-node actions pinned to commit SHAs, and runs syntax checks and tests without an install step.

## Publish to GitHub Pages

Serve this directory's root from the `main` branch. All application paths are relative, so the same files work at `/doppa-studio/` without a bundler or a base-path rewrite. `.nojekyll` prevents Jekyll processing.

## Typography and motion

The `.alkatip-basma` helper sets `font-family: "ALKATIP Basma"`, `direction: rtl`, `unicode-bidi: embed`, and `line-height: 2.2`. Technical values are isolated or explicitly LTR. `style.css` loads the requested remote ALKATIP Basma font with `font-display: swap`, normal weight/style, and WOFF2/WOFF/TTF fallback URLs. Font binaries are not included or relicensed. If the external font host is unavailable, the interface uses local Arabic-capable fallback fonts. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Decorative motion starts paused until initialized, honors `prefers-reduced-motion`, pauses while the page is hidden, and has a visible pause/resume control. The design itself remains stationary while editing and exporting.

## License

Source code and original vector artwork: [MIT](LICENSE), © 2026 UyghurCommunity. Remote font rights remain with their respective owners.
