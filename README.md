# Urban Potential Explorer · Barmbek-Süd 42

**#30DayMapChallenge 2026 · Day 27 · New Tool · Hamburg**

Live: https://barisparlatangiller.github.io/30DMC26-D27-NewTool-Hamburg-Urban-Potential/

An interactive 3D tool for one Hamburg block (Bebauungsplan Barmbek-Süd 42, 2019). It shows four things for each of the block's 29 parcels:
- what the plan allows;
- what stands today (LoD2);
- how much is still free **on paper** (theoretical);
- how much could **realistically** be added while today's buildings stay (feasible).

| Block total | m² gross floor area |
|---|---|
| Allowed by the plan | 36,151 |
| Built today (LoD2) | 24,116 |
| Still free on paper | +13,477 |
| Feasible (new building + rooftop extensions) | +11,579 (of which rooftop +3,606) |

Residential parcels (WA): +3,125 m² on paper and +2,587 m² feasible, which is about 29 homes at 90 m² gross each. Six parcels are already built beyond what the plan allows.

## Pipeline
```
python pipeline/clip_parcels.py raw/x/result.gml build/parcels.geojson      # ALKIS INSPIRE parcels (2020), clipped
python pipeline/georef.py  plan.jpg && python pipeline/georef_refine.py plan.jpg   # plan raster → EPSG:25832 (labels, then chamfer fit)
python pipeline/zones.py   plan.jpg                                         # zones (GRZ/GFZ), Baugrenzen, storey limits
python pipeline/lod2.py    raw/LoD2_32_568_5937_1_HH.xml raw/LoD2_32_569_5937_1_HH.xml build/buildings.geojson
python pipeline/potential.py                                                # per-parcel numbers + web layers
```
`plan.jpg` is page 1 of the plan PDF rendered at 220 dpi (`pdftoppm -f 1 -l 1 -r 220`). The XPlanGML WFS returned no features for this plan, so the zones were digitised from the plan sheet.

## Rules
- **Existing:** LoD2 footprint × `storeysAboveGround` (otherwise eave ÷ 3 m).
- **Theoretical:** GFZ × parcel area. Where the plan sets no GFZ: GRZ × parcel area × storey limit. Minus existing.
- **Feasible:** today's buildings stay.
  - New building only on free ground inside the Baugrenzen: 3 m clear of existing buildings, at least 8 m wide and 120 m², and within the GRZ still free.
  - Rooftop extensions up to the storey limit, at most +2 storeys, one fewer on pitched roofs, none under 60 m².
  - The listed building stays as it is.
  - Everything is capped by the floor area still free.
- **Left out:** parking overruns (§19(4) BauNVO), noise, distances, ownership and economics.

⚠️ A scenario on the published plan, not a planning or legal assessment.

## Data
Freie und Hansestadt Hamburg: LGV (ALKIS INSPIRE parcels 2020-04-20, LoD2-DE 2023-04-01) and Bezirksamt Hamburg-Nord (Bebauungsplan Barmbek-Süd 42, HmbGVBl. 2019 S. 191). Licence: Datenlizenz Deutschland – Namensnennung 2.0. Base map © OpenStreetMap contributors, © CARTO.

Barış Parlatangiller
