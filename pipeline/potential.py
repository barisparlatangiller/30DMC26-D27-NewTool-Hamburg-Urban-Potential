"""Theoretical vs feasible building potential per parcel, B-Plan Barmbek-Süd 42 (Hamburg-Nord, 2019).
Inputs (EPSG:25832): build/parcels.geojson (ALKIS), build/zones.geojson, build/baufenster.geojson, build/storey3.geojson,
build/buildings.geojson (LoD2). Output: build/potential.json (+ WGS84 geometries for the web).

Per parcel piece inside the plan (area A):
  existing GF   = Σ building footprint × storeys      storeys = LoD2 storeysAboveGround, else round(eave height / 3.0)
  THEORETICAL   = what the numbers allow:   footprint GRZ·A,   GF = GFZ·A   (no GFZ: GRZ·A × max storeys of the parcel's Baufenster)
  FEASIBLE      = what could plausibly be built while the existing buildings stay:
     · listed building (Denkmal): 0
     · new building only on unbuilt Baufenster ground, 3 m clear of existing buildings, at least 8 m wide and 120 m²,
       and only up to the GRZ footprint still free
     · rooftop extension (Aufstockung) on existing buildings: up to the plan's storey limit, at most +2 storeys (structure),
       pitched roofs lose one of these to the existing attic; buildings smaller than 60 m² are skipped
     · both capped by the GF allowance still free
  potential = allowed − existing (≥ 0). Homes ≈ GF / 90 m² gross per flat (WA only); GE: m² of commercial floor space.
A scenario on the published plan, not a planning assessment."""
import json, math
from shapely.geometry import shape, mapping
import warnings; warnings.filterwarnings('ignore')
from shapely.ops import unary_union, transform
from pyproj import Transformer
TF = Transformer.from_crs(25832, 4326, always_xy=True).transform
FC = lambda p: json.load(open(p))["features"]
Z = [(f["properties"], shape(f["geometry"])) for f in FC("build/zones.geojson")]
BF = [(f["properties"], shape(f["geometry"])) for f in FC("build/baufenster.geojson")]
S3 = shape(json.load(open("build/storey3.geojson"))["geometry"])
DENK = unary_union([g for p, g in BF if p["kind"] == "D"]).buffer(1.5)
PLAN = unary_union([g for _, g in Z])
BLD = [(f["properties"], shape(f["geometry"])) for f in FC("build/buildings.geojson")]
BG = {p["id"]: g for p, g in BLD}
STOREY_H, MAX_ADD, FLAT = 3.0, 2, 90.0

def bf_storeys(p, g):
    if p["kind"] == "GE" and p["storeys"] == 3 and p["area"] > 5000:      # the big GE window: II inside, III along Dehnhaide/west
        return None
    return p["storeys"]

def storeys_at(geom):
    """max storey limit for a piece of ground, from the Baufenster it lies in"""
    best = 0
    for p, g in BF:
        if not g.intersects(geom) or g.intersection(geom).area < 1:
            continue
        s = bf_storeys(p, g)
        if s is None:
            s = 3 if S3.intersection(geom).area > 0.5 * geom.area else 2
        best = max(best, s)
    return best

def bld_storeys(p):
    if p.get("storeys"):
        return p["storeys"]
    e = p.get("eave") or p.get("h") or 3
    return max(1, round(e / STOREY_H))

parcels = []; NEW = []; ENV = []; AUF = []
for f in FC("build/parcels.geojson"):
    g = shape(f["geometry"]).buffer(0)
    piece = g.intersection(PLAN)
    if piece.area < 25:
        continue
    A = piece.area
    # zone = largest overlap; parcels across zones are split by area share
    zs = [(zp, piece.intersection(zg).area) for zp, zg in Z if piece.intersection(zg).area > 1]
    zs.sort(key=lambda x: -x[1])
    zp = zs[0][0]
    bfp = unary_union([bg for _, bg in BF]).intersection(piece)
    denk = DENK.intersection(piece).area > 20
    st_max = storeys_at(piece) or 0
    # theoretical allowance (sum over zone shares)
    fp_allow = sum(z["grz"] * a for z, a in zs)
    gf_allow = sum((z["gfz"] * a if z["gfz"] else z["grz"] * a * st_max) for z, a in zs)
    # existing
    blds = []
    for bp, bg in BLD:
        part = bg.intersection(piece)
        if part.area < 8:
            continue
        s_ = bld_storeys(bp)
        blds.append({"id": bp["id"], "fp": round(part.area, 1), "st": s_, "h": bp["h"], "eave": bp.get("eave"), "roof": bp.get("roof"),
                     "addr": bp.get("addr"), "lim": storeys_at(part.buffer(-0.5)) or st_max, "_g": part})
    fp_ex = sum(b["fp"] for b in blds); gf_ex = sum(b["fp"] * b["st"] for b in blds)
    theo = max(0.0, gf_allow - gf_ex)
    # feasible
    if True:
        built = unary_union([b["_g"] for b in blds]) if blds else None
        free_bf = (bfp.difference(built.buffer(3)) if built else bfp).difference(DENK.buffer(3))
        free_bf = free_bf.buffer(-4, join_style=2).buffer(4, join_style=2)                      # a building needs ≥ 8 m width
        free_bf = unary_union([q for q in getattr(free_bf, "geoms", [free_bf]) if q.area >= 120])
        if free_bf.is_empty: free_bf = piece.difference(piece)
        new_fp = max(0.0, min(free_bf.area, fp_allow - fp_ex))
        new_gf = new_fp * st_max
        up = 0.0
        for b in blds:
            add = min(MAX_ADD, max(0, b["lim"] - b["st"]))
            if b["roof"] and b["roof"] not in ("1000",) and add > 0:     # 1000 = flat roof (AdV code); pitched: one level is the existing attic
                add -= 1
            b["listed"] = int(b["_g"].intersection(DENK).area > 0.5 * b["fp"])
            if b["fp"] >= 60 and not b["listed"]:
                b["add"] = add; up += b["fp"] * add
                if add > 0:
                    AUF.append({"type": "Feature", "properties": {"parcel": f["properties"]["label"], "base": b["h"], "top": round(b["h"] + add * STOREY_H, 1)},
                                "geometry": mapping(transform(TF, b["_g"]))})
            else:
                b["add"] = 0
        feas = max(0.0, min(theo, new_gf + up))
        if free_bf.area > 1 and new_fp > 1:
            NEW.append({"type": "Feature", "properties": {"parcel": f["properties"]["label"], "h": round(st_max * STOREY_H * min(1, new_fp / free_bf.area), 1)},
                        "geometry": mapping(transform(TF, free_bf))})
    env = bfp.difference(DENK)
    if env.area > 1:
        ENV.append({"type": "Feature", "properties": {"parcel": f["properties"]["label"], "h": st_max * STOREY_H}, "geometry": mapping(transform(TF, env))})
    homes = lambda gf: gf / FLAT if zp["use"] == "WA" else 0
    parcels.append({"label": f["properties"]["label"], "area": round(A), "zone": zp["id"], "use": zp["use"], "grz": zp["grz"], "gfz": zp["gfz"],
                    "st_max": st_max, "denkmal": denk, "fp_allow": round(fp_allow), "gf_allow": round(gf_allow), "fp_ex": round(fp_ex),
                    "gf_ex": round(gf_ex), "theo": round(theo), "feas": round(feas), "new_fp": round(new_fp), "up": round(up),
                    "buildings": blds, "geom": mapping(transform(TF, piece))})
T = {k: sum(p[k] for p in parcels) for k in ("area", "gf_allow", "gf_ex", "theo", "feas", "up")}
T["new_gf"] = T["feas"] - 0
T["n"] = len(parcels)
print(json.dumps(T))
for p in sorted(parcels, key=lambda p: -p["theo"])[:12]:
    print(p["label"], p["zone"], p["area"], "allow", p["gf_allow"], "ex", p["gf_ex"], "theo", p["theo"], "feas", p["feas"], "st", p["st_max"], [ (b["st"], b["lim"], b.get("add")) for b in p["buildings"]])
BOUT = []
for bp, bg in BLD:
    inside = bg.intersection(PLAN).area > 0.5 * bg.area
    add = 0
    for p in parcels:
        for b in p["buildings"]:
            if b["id"] == bp["id"]:
                add = b.get("add", 0)
    BOUT.append({"type": "Feature", "properties": {"id": bp["id"], "h": bp["h"], "eave": bp.get("eave"), "st": bld_storeys(bp), "in": int(inside), "add": add},
                 "geometry": mapping(transform(TF, bg))})
json.dump({"type": "FeatureCollection", "features": BOUT}, open("build/web_buildings.geojson", "w"))
json.dump({"type": "FeatureCollection", "features": AUF}, open("build/web_auf.geojson", "w"))
json.dump({"type": "FeatureCollection", "features": NEW}, open("build/web_new.geojson", "w"))
json.dump({"type": "FeatureCollection", "features": ENV}, open("build/web_env.geojson", "w"))
json.dump({"type": "FeatureCollection", "features": [{"type": "Feature", "properties": z, "geometry": mapping(transform(TF, g))} for z, g in Z]}, open("build/web_zones.geojson", "w"))
for p in parcels:
    for b in p["buildings"]:
        b.pop("_g", None)
json.dump({"totals": T, "parcels": parcels}, open("build/potential.json", "w"), ensure_ascii=False)
