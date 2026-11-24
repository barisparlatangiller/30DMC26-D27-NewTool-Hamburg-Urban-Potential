"""Refine the affine fit by chamfer matching: ALKIS parcel edges should sit on the dark lines of the plan raster."""
import json, sys, numpy as np
from PIL import Image
from scipy import ndimage, optimize
from shapely.geometry import shape, box
im = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(int)
dark = (im.max(axis=2) < 90)
dt = ndimage.distance_transform_edt(~dark)
M = np.array(json.load(open("build/georef.json"))["M"])     # [u v 1] @ M = [x y]
A = np.r_[M.T, [[0, 0, 1]]]; Ai = np.linalg.inv(A)
P = json.load(open("build/parcels.geojson"))["features"]
# sample edge points (world) of parcels near the block
c = np.array([0, 0, 1.0]); bx = None
pts = []
for f in P:
    g = shape(f["geometry"])
    for p in getattr(g, "geoms", [g]):
        ln = p.exterior; n = max(2, int(ln.length / 1.0))
        for t in np.linspace(0, ln.length, n, endpoint=False):
            q = ln.interpolate(t); pts.append((q.x, q.y))
pts = np.array(pts)
uv0 = np.c_[pts, np.ones(len(pts))] @ Ai.T
H, W = dt.shape
keep = (uv0[:, 0] > 513) & (uv0[:, 0] < 513 + 2670) & (uv0[:, 1] > 1098 + 150) & (uv0[:, 1] < 1098 + 1200)
pts = pts[keep]; print("edge samples", len(pts))
def cost(p):
    a, b, c_, d, e, f_ = p
    T = np.array([[1 + a, b, c_], [d, 1 + e, f_], [0, 0, 1]])
    uv = np.c_[pts, np.ones(len(pts))] @ (T @ Ai).T
    u = np.clip(uv[:, 0], 0, W - 1).astype(int); v = np.clip(uv[:, 1], 0, H - 1).astype(int)
    return np.mean(np.minimum(dt[v, u], 15))
best = None
for dx in range(-60, 61, 12):
    for dy in range(-60, 61, 12):
        r = cost([0, 0, dx, 0, 0, dy])
        if best is None or r < best[0]: best = (r, dx, dy)
print("grid", best)
res = optimize.minimize(cost, [0, 0, best[1], 0, 0, best[2]], method="Powell", options={"xtol": 1e-4, "ftol": 1e-4, "maxiter": 4000})
print(res.fun, res.x)
a, b, c_, d, e, f_ = res.x
T = np.array([[1 + a, b, c_], [d, 1 + e, f_], [0, 0, 1]])
Ai2 = T @ Ai; A2 = np.linalg.inv(Ai2)
json.dump({"M": A2[:2].T.tolist(), "Ainv": Ai2.tolist()}, open("build/georef.json", "w"))
from PIL import ImageDraw
img = Image.open(sys.argv[1]).convert("RGB"); dr = ImageDraw.Draw(img)
for f in P:
    g = shape(f["geometry"])
    for p in getattr(g, "geoms", [g]):
        xy = np.c_[np.array(p.exterior.coords), np.ones(len(p.exterior.coords))] @ Ai2.T
        dr.line([tuple(q[:2]) for q in xy], fill=(0, 160, 255), width=3)
img.crop((513, 1098, 513 + 2670, 1098 + 1317)).save("build/georef_check.jpg", quality=80)
