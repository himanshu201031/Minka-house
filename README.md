# Forma Studio

An interactive architectural study of a winter pavilion: a real-time WebGL
model, five camera views, an assembly sequence, and the studio's services,
method, recognition and enquiry sections.

The site ships with two presentations of one identity — **glacier paper**
(light, default) and **winter nocturne** (dark). The toggle in the header
swaps the page tokens and the world grade together; the choice persists in
`localStorage`.

## Stack

- Vite 5, vanilla ES modules, no framework
- three.js (WebGL, GLTF pavilion, custom water and sky shaders)
- Hand-authored CSS with a semantic token layer (`src/styles/tokens.css`)
- Self-hosted woff2: Fraunces (variable + italic), Inter, IBM Plex Mono

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
npm run preview  # serve the build
```

## Structure

```
index.html              markup, theme boot script, sections
src/main.js             boot, world wiring, theme toggle, scroll reveals
src/data/content.js     camera stages, copy, contact configuration
src/three/              world, pavilion model, water, camera rig
src/sections/           elevation drawing, plan, reveal helpers
src/styles/             tokens, fonts, base, hero, sections, footer, polish
public/models/          forma-pagoda.glb
public/fonts/           self-hosted woff2 subsets
scripts/                headless Chrome QA harnesses
```

## Content notes

- Contact details are intentionally **not invented**. Fields read
  "To be supplied" until real values are added in `src/data/content.js`;
  they then appear in the footer and enquiry sheet automatically.
- Recognition records are empty placeholders on purpose. Nothing is claimed
  until it can be evidenced.
- Ambience is synthesised at runtime with the Web Audio API; there are no
  recorded audio files.

## QA

Headless Chrome harnesses live in `scripts/`:

```bash
node scripts/console.mjs     # console/page error sweep
node scripts/stages.mjs      # five hero camera stages
node scripts/mobile.mjs      # 390×844 pass
node scripts/theme-qa.mjs    # light/dark, sections, mobile menu
```
