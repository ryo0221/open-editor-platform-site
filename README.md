# open-editor-platform-site

The landing page for [Open Editor Platform](https://github.com/ryo0221/open-editor-platform), in Japanese (`/`) and English (`/en/`).
A static Astro page served by Cloudflare Workers static assets.

## Run it locally

```sh
nvm use            # Node 22 (.nvmrc)
npm ci
npm run build      # content check → astro build → dist/_headers
npm run preview    # http://localhost:4321
```

## Change what the page says

- Provision states, links, videos and the PaoBub URL: `src/config/site.json` only.
- Words: `src/i18n/ja.json` and `src/i18n/en.json` (same keys in both).
- Videos, captions and posters: `public/videos/`, `public/posters/`. Every `.mp4` has a `.webm` copy.

## Checks

```sh
npm run check      # types (astro check) + content check
npm test           # browser tests at PC and phone width, against dist/ and a post-release build
npm run links      # every external link returns 200
```

Set `CHROMIUM_PATH` to use a specific Chromium build for the tests.
