# Urban Potential Explorer · Barmbek-Süd 42

**#30DayMapChallenge 2026 · Day 27 · New Tool · Hamburg**

Live: https://barisparlatangiller.github.io/30DMC26-D27-NewTool-Hamburg-Urban-Potential/

An interactive 3D tool for one Hamburg block (Bebauungsplan Barmbek-Süd 42, 2019). It shows four things for each of the block's 26 parcels:
- what the plan allows;
- what stands today (LoD2);
- how much is still free **on paper** (theoretical);
- how much could **realistically** be added while today's buildings stay (feasible).

| Block total | m² gross floor area |
|---|---|
| Allowed by the plan | 34,199 |
| Built today (LoD2) | 24,116 (71%) |
| Still free on paper | +11,525 |
| Scenario 1 · one more storey | +3,424 (30% of paper) |
| Scenario 2 · roofs + street gaps, yards stay free | +7,289 (63%) |
| Scenario 3 · maximum, yards built too | +10,792 (94%) |

On the residential parcels (WA) this is about 6, 15 or 20 homes, at 90 m² gross each. Six parcels are already built beyond what the plan allows.

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
- **Parcels:** ALKIS parcels with at least half of their area inside the plan (26). Streets and slivers along the boundary are left out.
- **Theoretical:** GFZ × parcel area. Where the plan sets no GFZ: GRZ × parcel area × storey limit. Minus existing.
- **Scenarios:** today's buildings stay, and the result is capped by the floor area still free on paper.
  1. **One more storey:** +1 storey on every building below its limit.
  2. **Roofs + street gaps:**
     - rooftops up to the limit, at most +2 storeys, one fewer on pitched roofs;
     - new buildings only in gaps within 16 m of the street, so the yards stay free.
  3. **Maximum:** as scenario 2, plus new buildings in the yards.
- **Common rules:**
  - new ground: inside the Baugrenzen, at least 8 m wide and 120 m², 3 m from existing buildings, within the GRZ still free;
  - no rooftop storeys on buildings under 60 m² or on the listed building.
- **Not checked:** Abstandsflächen (HBauO), roof structure, yard use (delivery, parking), private trees, ownership, economics.
- **3D:** today's buildings use their real LoD2 roof and wall surfaces (`pipeline/lod2_surfaces.py`), lit by a sun fixed in the world, over the Hamburg aerial photo; additions are drawn unlit (deck.gl, material off) with dark edges, and the plan envelope as a dashed wire frame, so colours stay the same from every angle.

⚠️ A scenario on the published plan, not a planning or legal assessment.

## Data
Freie und Hansestadt Hamburg: LGV (ALKIS INSPIRE parcels 2020-04-20, LoD2-DE 2023-04-01) and Bezirksamt Hamburg-Nord (Bebauungsplan Barmbek-Süd 42, HmbGVBl. 2019 S. 191). Licence: Datenlizenz Deutschland – Namensnennung 2.0. Base map © OpenStreetMap contributors, © CARTO.

Barış Parlatangiller
