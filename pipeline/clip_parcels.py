"""Clip Hamburg INSPIRE cadastral parcels (ALKIS, 2020-04-20 snapshot, 1.8 GB GML) to a bbox around Barmbek-Süd 42.
  python pipeline/clip_parcels.py raw/x/result.gml build/parcels.geojson"""
import sys, re, json
from lxml import etree
from shapely.geometry import Polygon, mapping
from shapely.ops import polygonize, unary_union
from shapely.geometry import LineString
X0, Y0, X1, Y1 = 568850, 5936620, 570050, 5937770
NS = "{http://inspire.ec.europa.eu/schemas/cp/4.0}"; G = "{http://www.opengis.net/gml/3.2}"
out = []
for ev, el in etree.iterparse(sys.argv[1], tag=NS + "CadastralParcel", huge_tree=True):
    pl = el.find(".//" + G + "posList")
    if pl is not None:
        v = pl.text.split(); x, y = float(v[0]), float(v[1])
        if X0 <= x <= X1 and Y0 <= y <= Y1:
            lines = []
            for p in el.iter(G + "posList"):
                c = list(map(float, p.text.split())); lines.append(LineString(list(zip(c[0::2], c[1::2]))))
            polys = list(polygonize(unary_union(lines)))
            if polys:
                geom = unary_union(polys)
                lab = el.findtext(NS + "label"); ref = el.findtext(NS + "nationalCadastralReference")
                out.append({"type": "Feature", "properties": {"label": lab, "ref": ref, "area": float(el.findtext(NS + "areaValue") or 0)}, "geometry": mapping(geom)})
    el.clear()
    while el.getprevious() is not None:
        del el.getparent()[0]
json.dump({"type": "FeatureCollection", "crs": "EPSG:25832", "features": out}, open(sys.argv[2], "w"))
print(len(out))
