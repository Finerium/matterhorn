# Third-party asset licenses

Every file under `public/assets/land/` has a row here; the CI license gate (AC-SEC-5,
AC-LAND-11) fails the build if a file lacks one. Author strings for Wikimedia Commons
files are copied verbatim from each file page. All files were downloaded 2026-07-28,
converted to JPEG, and resized/compressed for the web (noted per license where the
license requires change notes).

## Landing photography and textures (`public/assets/land/`)

| File | Source page | Author (verbatim) | License | Attribution required | Notes |
|---|---|---|---|---|---|
| hero-ridgeline.jpg | https://commons.wikimedia.org/wiki/File:Matterhorn_south_and_east_face.jpg | Giustino | CC BY 2.0 (https://creativecommons.org/licenses/by/2.0) | Yes | Resized and recompressed from the 2848x2136 original; duotone grading applied at render via CSS. The only plain CC BY photo in the set: safe for composites. |
| portrait-walliser.jpg | https://commons.wikimedia.org/wiki/File:0_106_Walliser_Alpen_-_Matterhorn.jpg | W. Bulach | CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0) | Yes (share-alike) | Resized/recompressed (change note per license). Share-alike scope: this processed file is distributed under CC BY-SA 4.0. Used standalone only, never composited into branded lockups. |
| dawn-zermatt.jpg | https://commons.wikimedia.org/wiki/File:Matterhorn_Zermatt.JPG | Pearlnight | CC BY-SA 3.0 Unported (https://creativecommons.org/licenses/by-sa/3.0) | Yes (share-alike) | Multi-licensed on Commons (GFDL 1.2+/CC BY-SA 3.0/2.5/2.0/1.0); we comply with CC BY-SA 3.0 Unported only. Resized/recompressed (change note). Standalone use only. |
| fog-fernando.jpg | https://unsplash.com/photos/matterhorn-with-clouds-around-it-XyhZuGUln5A | Fidel Fernando | Unsplash License | No (credited anyway) | Downloaded from the Unsplash CDN, recompressed. |
| night-demakov.jpg | https://unsplash.com/photos/milky-way-over-a-snow-capped-mountain-peak-0hU6r-vMtao | Oleg Demakov | Unsplash License | No (credited anyway) | Milky Way over the Matterhorn. Recompressed. |
| spindrift-piwnicki.jpg | https://unsplash.com/photos/a-mountain-covered-in-snow-and-clouds-under-a-cloudy-sky-7ZU6qA9UhFc | Marek Piwnicki | Unsplash License | No (credited anyway) | "Matterhorn's Wind" spindrift frame. Recompressed. |
| dawn-ridet.jpg | https://www.pexels.com/photo/stunning-sunrise-over-the-matterhorn-in-switzerland-34606014/ | Manon Ridet | Pexels License | No (credited anyway) | Sunrise over the Matterhorn. Recompressed. |
| snow-cederqvist.jpg | https://www.pexels.com/photo/snow-surface-formed-by-the-wind-19759010/ | Martina Cederqvist | Pexels License | No (credited anyway) | Wind-carved snow texture. Recompressed. |
| map-sierre-1886.jpg | https://commons.wikimedia.org/wiki/File:Sierre_LOC_2007632857.jpg | Switzerland. Eidg. Landestopographie; Leuzinger, R. | Public domain (PD-old-100-expired; PD-Art) | No (sourced anyway) | Siegfried Atlas Section XVII Blatt 482, Sierre, 1886, via Library of Congress (loc.gov/item/2007632857). Valais sheet used as engraved texture, not as a labeled map of the peak. |
| map-siegfried-ta531.jpg | https://commons.wikimedia.org/wiki/File:Siegfried_Matterhorn.jpg | Bundesamt für Landestopografie | Public domain (PD-old; Swiss official works excluded from protection, URG Art. 5) | No (sourced anyway) | Siegfried sheet TA 531 (1934), Matterhorn region, via Universitätsbibliothek Bern. 863x657 original: used only as a low-opacity wash or small inset. |
| paper-grain.jpg | https://commons.wikimedia.org/wiki/File:Old_paper2.jpg | Unknown author | Public domain (released by The Digital Yard Sale) | No (sourced anyway) | Real scan of aged paper. Resized/recompressed. |

## Outlet og:images (`public/assets/og/`)

Outlet og:images are not licensed decorative assets: they render exclusively as
attributed link previews with the outlet's name and an outbound link (blueprint C7,
7.3, standard link-preview practice). The complete per-narrative record, including
original URLs, fetch dates, and fallbacks, lives in `content/og_attribution.json`.

## App icons (`app/public/icons/`)

First-party. Generated from the Matterhorn mark by `scripts/gen-icons.mjs` (sharp), committed so
the build has no image step. No third-party rights attach to any of them.

| File | Source page | Author (verbatim) | License | Attribution required | Notes |
|---|---|---|---|---|---|
| icon-192.png | `scripts/gen-icons.mjs` | Matterhorn (first party) | Owned, no third-party rights | No | PWA `any` purpose, 192x192. |
| icon-512.png | `scripts/gen-icons.mjs` | Matterhorn (first party) | Owned, no third-party rights | No | PWA `any` purpose, 512x512. |
| maskable-192.png | `scripts/gen-icons.mjs` | Matterhorn (first party) | Owned, no third-party rights | No | PWA `maskable` purpose, 192x192, safe-zone padded. |
| maskable-512.png | `scripts/gen-icons.mjs` | Matterhorn (first party) | Owned, no third-party rights | No | PWA `maskable` purpose, 512x512, safe-zone padded. |

## Fonts

The landing grotesque (Inter or Geist, OQ-8 decision at Gate 4) will be self-hosted
under the SIL Open Font License 1.1; the license text will be committed alongside the
font files and recorded here when the choice lands. The app uses the system font
stack (zero bundled font bytes).

## Libraries

Runtime and build dependencies are npm packages under their own licenses (MIT-class),
recorded in `package.json` and the lockfile; `pnpm licenses list` reproduces the set.

One runtime dependency is NOT MIT and is called out here rather than left inside
"MIT-class", because the sentence above would otherwise be false:

| Package | Version | License | Terms | What it is used for |
|---|---|---|---|---|
| gsap (incl. ScrollTrigger) | 3.15.0 (pinned) | GreenSock Standard "no charge" License | https://gsap.com/standard-license | The landing's scroll choreography on browsers without native scroll-driven animations, today Firefox (`app/src/landing/motion.ts`). Blueprint 7.5 lists gsap on the runtime allowlist and ADR-7 names it. |

The standard license is free of charge for this use. It permits use in websites and
applications that are not sold to multiple end users as a product where the code
itself is the thing being licensed on; Matterhorn is a freely readable site with no
paid tier and no redistribution of GSAP as a library, so no Business Green
subscription is required. ScrollTrigger has been included in the free tier since
GSAP 3.13 (April 2025), so no "club" plugin licensing applies either. The license
banner ships verbatim inside the built chunk, as GreenSock's terms ask.

## Family-member link previews (`public/assets/og/members/`)

Outlet og:images for the family-member articles of each narrative, fetched once at build per
blueprint 7.3 and rendered only as attributed link previews with the outlet name and an
outbound link. Per-file attribution (source URL, outlet, fetch date, honest fallbacks) is
recorded in `content/og_attribution.json` entries carrying an `image_path` under this
directory; the licence gate matches files to those entries. Never reused outside the owning
narrative's cards.

