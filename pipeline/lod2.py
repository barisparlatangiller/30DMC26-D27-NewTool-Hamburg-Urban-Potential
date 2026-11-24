"""Read Hamburg LoD2 CityGML buildings near the plan: footprint (GroundSurface), heights, roof type, address.
  python pipeline/lod2.py <citygml> [<citygml> …] build/buildings.geojson"""
import sys, json, re
from lxml import etree
from shapely.geometry import Polygon, mapping, box
from shapely.ops import unary_union
BB = box(569000, 5937100, 569700, 5937500)
B = "{http://www.opengis.net/citygml/building/2.0}"; G = "{http://www.opengis.net/gml}"
def ns_fix(tag, root):
    return tag
out = []
import itertools
ctx = itertools.chain(*[etree.iterparse(p, events=("end",), huge_tree=True) for p in sys.argv[1:-1]])
for ev, el in ctx:
    if not el.tag.endswith("}Building"):
        continue
    # citygml version agnostic: search by local-name
    def loc(e, name):
        return [x for x in e.iter() if isinstance(x.tag, str) and x.tag.rsplit("}", 1)[-1] == name]
    grounds = []
    for gs in loc(el, "GroundSurface"):
        for pl in loc(gs, "posList"):
            c = list(map(float, pl.text.split())); d = 3
            pts = list(zip(c[0::d], c[1::d]))
            if len(pts) >= 4:
                grounds.append((Polygon(pts).buffer(0), min(c[2::d])))
    allz = []
    for pl in loc(el, "posList"):
        c = list(map(float, pl.text.split())); allz += c[2::3]
    if not grounds or not allz:
        el.clear(); continue
    fp = unary_union([g for g, _ in grounds])
    if not fp.intersects(BB):
        el.clear(); continue
    z0 = min(z for _, z in grounds); zt = max(allz)
    # eave: lowest z of roof surfaces
    rz = []
    for rs in loc(el, "RoofSurface"):
        for pl in loc(rs, "posList"):
            rz += list(map(float, pl.text.split()))[2::3]
    mh = loc(el, "measuredHeight"); rt = loc(el, "roofType"); fn = loc(el, "function")
    st = loc(el, "storeysAboveGround")
    street = loc(el, "ThoroughfareName"); num = loc(el, "ThoroughfareNumber")
    out.append({"type": "Feature", "properties": {
        "id": el.get("{http://www.opengis.net/gml}id"),
        "z0": round(z0, 2), "h": round(float(mh[0].text) if mh else zt - z0, 2),
        "eave": round((min(rz) if rz else zt) - z0, 2), "ridge": round(zt - z0, 2),
        "roof": rt[0].text if rt else None, "fn": fn[0].text if fn else None,
        "storeys": int(st[0].text) if st and st[0].text else None,
        "addr": ((street[0].text or "") + " " + ((num[0].text or "") if num else "")).strip() or None if street else None},
        "geometry": mapping(fp)})
    el.clear()
json.dump({"type": "FeatureCollection", "features": out}, open(sys.argv[-1], "w"))
print(len(out), "buildings")
