"""Digitise B-Plan Barmbek-Süd 42 from the georeferenced plan raster:
  · Geltungsbereich = pink (WA) ∪ grey (GE) pixels, cleaned
  · sub-zones (GRZ/GFZ) = hand-drawn outlines along the plan's 'Abgrenzung' lines, clipped to the Geltungsbereich
  · Baufenster = regions enclosed by the blue Baugrenze lines, each tagged with the plan's storey limit (Roman numeral)
Writes build/zones.geojson and build/baufenster.geojson in EPSG:25832."""
import json, sys, numpy as np, cv2
from PIL import Image
from rasterio import features
from shapely.geometry import shape, Polygon, Point, mapping
from shapely.ops import unary_union
from shapely import affinity
S = 2670 / 2000; OX, OY = 513, 1098
im = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(int)
H, W = im.shape[:2]
r, g, b = im[..., 0], im[..., 1], im[..., 2]
Ai = np.array(json.load(open("build/georef.json"))["Ainv"]); A = np.linalg.inv(Ai)
def to_world(geom):
    return affinity.affine_transform(geom, [A[0, 0], A[0, 1], A[1, 0], A[1, 1], A[0, 2], A[1, 2]])
def disp(pts):                         # display coords (2000-wide crop) -> full raster px
    return [(OX + u * S, OY + v * S) for u, v in pts]
# --- Geltungsbereich
pink = (r > 170) & (r - g > 50) & (r - b > 50) & (g < 200)
grey = (abs(r - g) < 22) & (abs(g - b) < 22) & (r > 115) & (r < 205)
x0, y0, x1, y1 = OX, OY + 100, OX + 2670, OY + 1200
m = np.zeros((H, W), np.uint8); m[y0:y1, x0:x1] = ((pink | grey)[y0:y1, x0:x1]).astype(np.uint8)
m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((25, 25), np.uint8))
m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((15, 15), np.uint8))
polys = [shape(s) for s, v in features.shapes(m, mask=m > 0) if v == 1]
gb = max(polys, key=lambda p: p.area).buffer(6).buffer(-6)
gb = Polygon(gb.exterior)                     # fill holes (Denkmal etc.)
# --- sub-zones (display coordinates read off the plan)
Z = {
 "WA1": dict(use="WA", grz=0.5, gfz=None, pts=[(380, 60), (640, 160), (575, 215), (548, 330), (520, 356), (455, 320), (395, 290), (320, 258), (250, 200)]),
 "WA2": dict(use="WA", grz=0.4, gfz=None, pts=[(320, 258), (395, 290), (455, 320), (520, 356), (495, 440), (390, 425), (355, 612), (240, 560), (120, 490)]),
 "GE1": dict(use="GE", grz=0.7, gfz=None, pts=[(120, 490), (240, 560), (355, 612), (340, 690), (30, 700), (10, 600)]),
 "GE2": dict(use="GE", grz=0.4, gfz=None, pts=[(390, 425), (495, 440), (520, 462), (600, 488), (590, 590), (575, 690), (340, 690), (355, 612)]),
 "GE3": dict(use="GE", grz=0.7, gfz=1.4, pts=[(575, 215), (640, 160), (870, 250), (850, 300), (825, 420), (800, 700), (675, 690), (670, 600), (590, 590), (600, 488), (520, 462), (548, 330)]),
 "GE4": dict(use="GE", grz=0.7, gfz=1.7, pts=[(590, 590), (670, 600), (675, 690), (575, 690)]),
 "GE5": dict(use="GE", grz=0.7, gfz=None, pts=[(30, 700), (340, 690), (575, 690), (675, 690), (800, 700), (805, 900), (20, 900)]),
 "GE6": dict(use="GE", grz=0.7, gfz=1.7, pts=[(870, 250), (1780, 560), (1745, 680), (1700, 900), (805, 900), (800, 700), (825, 420), (850, 300)]),
 "WA3": dict(use="WA", grz=0.5, gfz=None, pts=[(1780, 560), (2000, 640), (2000, 1000), (1690, 1000), (1700, 900), (1745, 680)]),
}
zf = []
for k, z in Z.items():
    p = Polygon(disp(z["pts"])).buffer(0).intersection(gb)
    zf.append({"type": "Feature", "properties": {"id": k, "use": z["use"], "grz": z["grz"], "gfz": z["gfz"]}, "geometry": mapping(to_world(p))})
# --- Baufenster from blue lines
blue = (b > 140) & (r < 90) & (g > 80) & (g < 190) & (b - r > 90)
bl = np.zeros((H, W), np.uint8); bl[y0:y1, x0:x1] = blue[y0:y1, x0:x1].astype(np.uint8)
bl = cv2.dilate(bl, np.ones((13, 13), np.uint8))
free = ((bl == 0) & (m > 0)).astype(np.uint8)
n, lab = cv2.connectedComponents(free, connectivity=4)
# storey labels (display coords) — Roman numerals on the plan
ST = [((460, 175), 4, "WA"), ((310, 350), 4, "WA"), ((1865, 790), 6, "WA"), ((712, 392), 2, "GE"), ((982, 410), 3, "GE"),
      ((1352, 612), 2, "GE"), ((210, 690), 3, "GE"), ((520, 740), 3, "GE"), ((590, 745), 3, "GE"), ((730, 770), 3, "GE"),
      ((630, 605), 2, "GE"), ((925, 800), 3, "GE"), ((470, 530), 3, "D")]
bf = []; seen = {}
for (u, v), st, kind in ST:
    x, y = disp([(u, v)])[0]; L = lab[int(y), int(x)]
    if L == 0:
        print("label on a line", u, v, st); continue
    if L in seen:
        seen[L]["st"] = max(seen[L]["st"], st); continue
    mk = (lab == L).astype(np.uint8)
    mk = cv2.dilate(mk, np.ones((13, 13), np.uint8))        # give back the line width
    geo = [shape(s) for s, vv in features.shapes(mk, mask=mk > 0) if vv == 1]
    p = max(geo, key=lambda p: p.area).simplify(2)
    seen[L] = {"geom": p, "st": st, "kind": kind}
for i, v in enumerate(seen.values()):
    w = to_world(v["geom"])
    bf.append({"type": "Feature", "properties": {"id": f"B{i+1}", "storeys": v["st"], "kind": v["kind"], "area": round(w.area)}, "geometry": mapping(w)})
    print(f"B{i+1}", v["kind"], v["st"], round(w.area), "m²")
# storey limits inside the big GE Baufenster, which the plan splits with thin 'Abgrenzung' lines rather than blue ones
SP = {3: [(10, 600), (120, 490), (240, 560), (355, 612), (340, 690), (575, 690), (800, 705), (805, 745), (1240, 800), (1700, 825), (1700, 1000), (10, 1000)]}
stp = to_world(Polygon(disp(SP[3])).buffer(0))
json.dump({"type": "Feature", "geometry": mapping(stp)}, open("build/storey3.geojson", "w"))
json.dump({"type": "FeatureCollection", "features": zf}, open("build/zones.geojson", "w"))
json.dump({"type": "FeatureCollection", "features": bf}, open("build/baufenster.geojson", "w"))
gw = to_world(gb); print("Geltungsbereich", round(gw.area), "m²")
# check image
chk = Image.open(sys.argv[1]).convert("RGB").crop((OX, OY, OX + 2670, OY + 1317)); ov = np.asarray(chk).copy()
col = np.random.RandomState(1).randint(0, 255, (n + 1, 3))
for L in seen:
    mm = (lab == L)[OY:OY + 1317, OX:OX + 2670]; ov[mm] = (ov[mm] * 0.4 + col[L] * 0.6).astype(np.uint8)
Image.fromarray(ov).save("build/zones_check.jpg", quality=75)
