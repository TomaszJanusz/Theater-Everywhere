# Chrome Web Store promo screenshots

This folder contains the source assets and deterministic generator for the
localized Chrome Web Store comparison screenshots.

## Layout

- `template.svg` is the Affinity Designer layout source.
- `template-full.svg` is the normalized single-image Affinity layout source.
- `source/` contains the raw before/after screenshots with no promotional overlay.
- `fonts/` contains vendored OFL font files and their licenses.
- `pairs.json` maps each comparison to its source rasters.
- `screenshots-1280x800/` contains the regenerated Chrome Web Store PNG outputs.

## Generate

```sh
pnpm store:cws:screenshots
```

The generator keeps the Affinity layouts, replaces outlined label glyphs with
editable SVG text in temporary render files, embeds local `@font-face`
declarations, captures the keyboard-shortcuts source frame, and writes only
`1280x800` PNG files as durable outputs.
