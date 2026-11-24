"""Fit an affine transform from the B-Plan raster (pdftoppm 220 dpi, page 1) to EPSG:25832 using parcel numbers
printed on the plan matched to ALKIS parcel centroids. Writes build/georef.json and an overlay check image."""
import json, sys, numpy as np
from shapely.geometry import shape
S = 2670 / 2000; OX, OY = 513, 1098
L = {"5763": (948, 500), "5399": (925, 698), "1043": (1150, 532), "5342": (1458, 648), "1040": (1572, 676), "1036": (1765, 832),
     "5401": (1621, 828), "5409": (1525, 840), "5410": (1433, 808), "5411": (1347, 797), "5412": (1257, 784), "561": (518, 652),
     "562": (490, 368), "563": (543, 268), "1585": (334, 458), "1584": (290, 555), "5961": (170, 525), "5740": (713, 736),
     "5735": (735, 370), "1469": (1297, 570), "565": (1802, 211), "2204": (1418, 242), "1208": (1852, 395), "4813": (1079, 232)}
P = json.load(open("build/parcels.geojson"))["features"]
byl = {}
for f in P:
    byl.setdefault(f["properties"]["label"], []).append(shape(f["geometry"]))
src, dst, keys = [], [], []
cx, cy = np.mean([v[0] for v in L.values()]), np.mean([v[1] for v in L.values()])
for k, (u, v) in L.items():
    if k not in byl:
        print("missing", k); continue
    g = min(byl[k], key=lambda g: g.area)          # labels are unique in this flur area normally
    src.append((OX + u * S, OY + v * S)); c = g.centroid; dst.append((c.x, c.y)); keys.append(k)
src, dst = np.array(src), np.array(dst)
use = np.ones(len(src), bool)
for it in range(3):
    A = np.c_[src[use], np.ones(use.sum())]
    M, *_ = np.linalg.lstsq(A, dst[use], rcond=None)
    r = np.hypot(*(np.c_[src, np.ones(len(src))] @ M - dst).T)
    use = r < max(6, np.median(r) * 2.5)
for k, rr in zip(keys, r):
    print(k, round(rr, 1))
print("scale m/px", np.hypot(*M[0]), np.hypot(*M[1]))
json.dump({"M": M.tolist()}, open("build/georef.json", "w"))
# overlay check: draw parcels back on the plan
from PIL import Image, ImageDraw
im = Image.open(sys.argv[1]).convert("RGB"); d = ImageDraw.Draw(im)
Mi = np.linalg.inv(np.r_[M.T, [[0, 0, 1]]])
for f in P:
    g = shape(f["geometry"])
    for p in getattr(g, "geoms", [g]):
        xy = np.c_[np.array(p.exterior.coords), np.ones(len(p.exterior.coords))] @ Mi.T
        d.line([tuple(q[:2]) for q in xy], fill=(0, 160, 255), width=3)
im.crop((OX, OY, OX + 2670, OY + 1317)).save("build/georef_check.jpg", quality=80)
