"""Real LoD2 roof and wall surfaces (Hamburg LoD2-DE 2023) for the web: heights relative to each building's ground.
  python pipeline/lod2_surfaces.py raw/LoD2_32_568_5937_1_HH.xml raw/LoD2_32_569_5937_1_HH.xml docs/data/web_lod2.json"""
import sys, json, itertools
from lxml import etree
from shapely.geometry import box, Polygon
from pyproj import Transformer
TF = Transformer.from_crs(25832, 4326, always_xy=True)
BB = box(569020, 5937020, 569720, 5937560)
loc = lambda e, n: [x for x in e.iter() if isinstance(x.tag, str) and x.tag.rsplit("}", 1)[-1] == n]
out = []
for ev, el in itertools.chain(*[etree.iterparse(p, events=("end",), huge_tree=True) for p in sys.argv[1:-1]]):
    if not el.tag.endswith("}Building"):
        continue
    gs = [list(map(float, pl.text.split())) for g in loc(el, "GroundSurface") for pl in loc(g, "posList")]
    if not gs:
        el.clear(); continue
    c = gs[0]; fp = Polygon(list(zip(c[0::3], c[1::3])))
    if not fp.intersects(BB):
        el.clear(); continue
    z0 = min(min(g[2::3]) for g in gs)
    rec = {"id": el.get("{http://www.opengis.net/gml}id"), "r": [], "w": []}
    for kind, key in (("RoofSurface", "r"), ("WallSurface", "w")):
        for s in loc(el, kind):
            for pl in loc(s, "posList"):
                v = list(map(float, pl.text.split()))
                xs, ys = TF.transform(v[0::3], v[1::3])
                rec[key].append([[round(x, 7), round(y, 7), round(z - z0, 2)] for x, y, z in zip(xs, ys, v[2::3])])
    out.append(rec); el.clear()
json.dump(out, open(sys.argv[-1], "w"), separators=(",", ":"))
print(len(out), "buildings", sum(len(b["r"]) for b in out), "roof", sum(len(b["w"]) for b in out), "wall surfaces")
