# NRIGhar icon

White home glyph on emerald `#059669` (the accent color used across the NRIGhar web UI).

Product-level brand assets live here with the product (the org-level
`3pandalabs/brand` repo holds company identity only). When the web and app
repos merge into a single product repo, this folder moves with it.

Source of truth for the mark used by:

- `nrighar-web/src/app/icon.png` (website favicon)
- `nrighar-app/assets/` — `icon.png`, `android-icon-foreground.png`, `android-icon-background.png`, `android-icon-monochrome.png`, `splash-icon.png`, `favicon.png` (plus `adaptiveIcon.backgroundColor` in `app.json`)

## Files

- `nrighar-icon.svg` — full-bleed square icon (glyph at 72% on emerald)
- `nrighar-icon-foreground.svg` — glyph only, transparent, scaled to 50% for the Android adaptive-icon safe zone
- `nrighar-icon-1024.png` — rendered reference

## Changing the icon

Edit the SVGs here, then re-render the PNG set into both app repos (any SVG-to-PNG tool works; sizes: 1024 for all app assets, 48 for `favicon.png`, 512 for the web `icon.png`) and rebuild the Android app with EAS — app icons are baked in at build time.
