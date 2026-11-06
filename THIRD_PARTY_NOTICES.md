# Attribution and asset provenance

## Original application and vector artwork

The interface, application, 2D export engine, almond/rosette/atlas-inspired SVG paths, and studio icon were written for Doppa Studio. They are available under this repository's MIT license, © 2026 UyghurCommunity.

[Doppa Kit](https://github.com/UyghurCommunity/doppa-kit), MIT, © 2026 UyghurCommunity, supplied the existing ecosystem context and motif categories. Its `src/patterns.js` was read as a reference for scope and safe SVG generation. Doppa Studio uses newly drawn paths, independent scene/history/editor logic, and no copied third-party source or binary assets. The digital motifs are textile-inspired illustrations rather than authenticated historical reproductions.

## ALKATIP Basma font

The interface references the externally hosted ALKATIP Basma face through these requested URLs:

- https://db.onlinewebfonts.com/t/3c16518f40da2fc2901f37666c0556a7.woff2
- https://db.onlinewebfonts.com/t/3c16518f40da2fc2901f37666c0556a7.woff
- https://db.onlinewebfonts.com/t/3c16518f40da2fc2901f37666c0556a7.ttf

Font rights belong to their respective owners. This repository does not include font binaries, assert ownership, or grant a font license. The application's MIT license does not apply to the remote font. Availability, access rules, and font licensing remain governed by the font owner and host. Local Arabic-capable fonts are used if these URLs cannot load.

Artwork exports contain vector paths and colors; they do not reference this font or the external font host.

## Runtime dependencies

No third-party JavaScript packages, remote scripts, stock imagery, analytics, or external account integrations are used. The browser supplies SVG, Canvas 2D, Clipboard, file download, and local storage APIs.
