// Day 27 · Urban Potential Explorer · Barmbek-Süd 42
// Overview: flat parcels coloured by the chosen scenario. Open one parcel (map or list) to see its volumes:
// today's buildings grey, the plan's envelope as a dashed wire frame, additions as solid flat-coloured volumes with dark edges.
// Volumes are drawn unlit (deck.gl, material off), so their colours stay the same from every side and angle.
const C = { paper: "#e07a5f", s: "#2a9d8f", roof: "#3d7fc1", ex: "#b9bec4", exEdge: "#5f6670", envEdge: "#d9603e", ctx: "#ebe7e0", exIn: "#ddd5c8" };
const SC = {
  s1: { name: "One more storey", short: "+1 storey", note: "Only rooftops: every building below its storey limit gets one more storey (not the listed one, none under 60 m²). Nothing new on the ground." },
  s2: { name: "Roofs + street gaps", short: "Roofs + gaps", note: "Rooftops up to the limit (max +2, one fewer on pitched roofs) and new buildings only in gaps along the street front (16 m deep). Yards stay free for access, delivery and trees." },
  s3: { name: "Maximum", short: "Maximum", note: "As before, plus new buildings in the yards wherever the building limits allow (≥ 8 m wide, 3 m from other buildings). The upper end, not a recommendation." }
};
let HOME = { center: [10.0468, 53.5799], zoom: 17.2, pitch: 50, bearing: 10 };
const fmt = n => Math.round(n).toLocaleString("en-US");
// people: 78% of gross floor area is living space, 60 m² per flat, 1.6 people per flat; offices ≈ 32 m² gross per workplace
const NET = 0.78, FLAT = 60, PPF = 1.6, JOB = 32;
let mu = false;                                   // what if the commercial zone (GE) were an urban mixed zone (MU), where homes are allowed
const flats = gf => { const l = gf * NET; return l < 40 ? 0 : Math.max(1, Math.floor(l / FLAT)); };
const housing = p => p.use === "WA" || mu;
function people(p, v) { return housing(p) ? { f: flats(v), r: flats(v) * PPF, j: 0 } : { f: 0, r: 0, j: v / JOB }; }
const ROM = ["–", "I", "II", "III", "IV", "V", "VI"];
let lighting, D, sel = null, sc = "s2", show = { env: true, add: true, photo: true }, spinning = false, markers = [], overlay;
const map = new maplibregl.Map({ container: "map", style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json", ...HOME, antialias: true, attributionControl: { compact: true } });
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-left");
const FILES = ["potential.json", "web_buildings.geojson", "web_env.geojson", "web_context.geojson", "web_trees.geojson", "web_parks.geojson", "web_roads.geojson",
  "web_auf1.geojson", "web_auf2.geojson", "web_new2.geojson", "web_new3.geojson", "web_lod2.json"];
Promise.all(FILES.map(f => fetch("data/" + f).then(r => r.json())))
  .then(([P, B, E, X, TR, PK, RD, A1, A2, N2, N3, L2]) => { D = { P, B, E, X, TR, PK, RD, A1, A2, N2, N3, L2 }; map.loaded() ? init() : map.on("load", init); });

function bbox(g) {
  let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
  const walk = c => typeof c[0] === "number" ? (x0 = Math.min(x0, c[0]), x1 = Math.max(x1, c[0]), y0 = Math.min(y0, c[1]), y1 = Math.max(y1, c[1])) : c.forEach(walk);
  walk(g.coordinates); return [[x0, y0], [x1, y1]];
}
function centre(g) {
  const rings = g.type === "Polygon" ? [g.coordinates[0]] : g.coordinates.map(p => p[0]);
  let best = null, ba = -1;
  for (const r of rings) { let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < r.length - 1; i++) { const f = r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; a += f; cx += (r[i][0] + r[i + 1][0]) * f; cy += (r[i][1] + r[i + 1][1]) * f; }
    if (Math.abs(a) > ba) { ba = Math.abs(a); best = [cx / (3 * a), cy / (3 * a)]; } }
  return best;
}
const polys = g => g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
// box volumes: one record per polygon with base and top (metres)
function vols(features, base, top) {
  const out = [];
  for (const f of features) for (const rings of polys(f.geometry)) out.push({ rings, b: base(f.properties), t: top(f.properties) });
  return out;
}
// edges of a box volume: bottom and top rings plus the vertical edges at real corners
function edges(v) {
  const out = [];
  for (const r of v.rings) {
    out.push(r.map(c => [c[0], c[1], v.b + 0.05]), r.map(c => [c[0], c[1], v.t]));
    const n = r.length - 1;
    for (let i = 0; i < n; i++) {
      const p = r[(i - 1 + n) % n], c = r[i], q = r[(i + 1) % n];
      const a1 = Math.atan2(c[1] - p[1], (c[0] - p[0]) * 0.594), a2 = Math.atan2(q[1] - c[1], (q[0] - c[0]) * 0.594);
      let d = Math.abs(a2 - a1); if (d > Math.PI) d = 2 * Math.PI - d;
      if (d > 0.35) out.push([[c[0], c[1], v.b], [c[0], c[1], v.t]]);
    }
  }
  return out;
}
const rgb = (h, a = 255) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), a];

function init() {
  const ps = D.P.parcels;
  ps.forEach((p, i) => { p.i = i; p.bb = bbox(p.geom); p.c = centre(p.geom); p.ids = new Set(p.buildings.map(b => b.id)); });
  const parcels = { type: "FeatureCollection", features: ps.map((p, i) => ({ type: "Feature", id: i, properties: { i, label: p.label, s1: p.s1 / p.area, s2: p.s2 / p.area, s3: p.s3 / p.area }, geometry: p.geom })) };
  const inPlan = new Set(ps.flatMap(p => p.buildings.map(b => b.id)));
  D.B.features.forEach(f => f.properties.in = inPlan.has(f.properties.id) ? 1 : 0);
  // constant, soft light fixed to the map: the context buildings and trees no longer change tone when the map turns
  map.setLight({ anchor: "map", color: "#ffffff", intensity: 0.22, position: [1.2, 210, 35] });
  ["ctx", "parcels", "bld", "trees", "parks", "roads"].forEach((id, k) => map.addSource(id, { type: "geojson", data: [D.X, parcels, D.B, D.TR, D.PK, D.RD][k] }));
  const lbl = map.getStyle().layers.find(l => l.type === "symbol")?.id;
  const DOP = "https://geodienste.hamburg.de/HH_WMS_DOP?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&FORMAT=image/jpeg&LAYERS=DOP&STYLES=&CRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}";
  const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
  const under = map.getStyle().layers.find(l => l.type !== "background")?.id;      // photo + mask sit right above the base map's background
  map.addSource("photo", { type: "raster", tiles: [DOP], tileSize: 256, maxzoom: 20, attribution: "Orthophoto © FHH, LGV (dl-de/by-2-0)" });
  map.addLayer({ id: "photo", type: "raster", source: "photo", layout: { visibility: show.photo ? "visible" : "none" }, paint: { "raster-opacity": 0.92, "raster-saturation": -0.25, "raster-contrast": -0.05 } }, under);
  let fellBack = false;
  map.on("error", e => {
    if (fellBack || e.sourceId !== "photo") return; fellBack = true;
    map.removeLayer("photo"); map.removeSource("photo");
    map.addSource("photo", { type: "raster", tiles: [ESRI], tileSize: 256, maxzoom: 19, attribution: "Imagery © Esri, Maxar, Earthstar Geographics" });
    map.addLayer({ id: "photo", type: "raster", source: "photo", layout: { visibility: show.photo ? "visible" : "none" }, paint: { "raster-opacity": 0.92, "raster-saturation": -0.25 } }, "mask");
  });
  map.addSource("mask", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  const bgc = map.getStyle().layers.find(l => l.type === "background")?.paint?.["background-color"] || "#f3f0ea";
  map.addLayer({ id: "mask", type: "fill", source: "mask", paint: { "fill-color": bgc, "fill-opacity": 1 } }, under);
  map.addLayer({ id: "parks", type: "fill", source: "parks", paint: { "fill-color": "#d6e6c8", "fill-opacity": 0.9 } }, lbl);
  map.addLayer({ id: "roads", type: "line", source: "roads", layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#ffffff", "line-width": ["interpolate", ["exponential", 2], ["zoom"], 15, 4, 19, 40] } }, lbl);
  map.addLayer({ id: "ctx", type: "line", source: "ctx", paint: { "line-color": "#cfc8bd", "line-width": 0.5 } }, lbl);
  map.addLayer({ id: "pfill", type: "fill", source: "parcels", paint: { "fill-color": "#f1ede6", "fill-opacity": ["case", ["boolean", ["feature-state", "dim"], false], 0.3, 0.92] } }, lbl);
  map.addLayer({ id: "pline", type: "line", source: "parcels", paint: { "line-color": "#ffffff", "line-width": 1.4 } }, lbl);
  map.addLayer({ id: "phover", type: "line", source: "parcels", filter: ["==", ["get", "i"], -1], paint: { "line-color": "#1f2328", "line-width": 1.6, "line-dasharray": [2, 1] } });
  map.addLayer({ id: "psel", type: "line", source: "parcels", filter: ["==", ["get", "i"], -1], paint: { "line-color": "#1f2328", "line-width": 3.2 } });
  map.addLayer({ id: "bld", type: "fill-extrusion", source: "bld", paint: {
    "fill-extrusion-color": ["case", ["==", ["get", "in"], 1], C.exIn, C.ctx], "fill-extrusion-height": ["get", "h"], "fill-extrusion-opacity": 0.5 } });
  map.addLayer({ id: "trees", type: "fill-extrusion", source: "trees", paint: {
    "fill-extrusion-color": ["case", ["==", ["get", "k"], "t"], "#8a6f55", ["interpolate", ["linear"], ["get", "s"], 0, "#a3c890", 0.5, "#86b676", 1, "#6ca263"]],
    "fill-extrusion-base": ["get", "b"], "fill-extrusion-height": ["get", "h"], "fill-extrusion-opacity": 0.9 } });
  D.l2ids = new Set(D.L2.filter(b => inPlan.has(b.id)).map(b => b.id));
  D.surf = [];
  for (const b of D.L2.filter(b => inPlan.has(b.id))) {
    for (const r of b.r) { const zs = r.map(c => c[2]); D.surf.push({ id: b.id, k: Math.max(...zs) - Math.min(...zs) > 0.6 ? "rp" : "rf", p: r }); }
    for (const w of b.w) D.surf.push({ id: b.id, k: "w", p: w });
  }
  lighting = new deck.LightingEffect({ amb: new deck.AmbientLight({ color: [255, 255, 255], intensity: 1.35 }),
    sun: new deck.DirectionalLight({ color: [255, 250, 240], intensity: 1.1, direction: [-0.55, -0.8, -1.4] }) });   // fixed in the world, not to the camera
  overlay = new deck.MapboxOverlay({ interleaved: true, layers: [], effects: [lighting] }); map.addControl(overlay);
  [["Dehnhaide", [10.0462, 53.57905]], ["Stückenstraße", [10.0466, 53.57995]], ["Langenrehm", [10.04435, 53.5797]], ["Friedrichsberger Str.", [10.04955, 53.5794]]]
    .forEach(([t, ll]) => { const el = document.createElement("div"); el.className = "street"; el.textContent = t; new maplibregl.Marker({ element: el }).setLngLat(ll).addTo(map); });
  ps.forEach(p => {
    const el = document.createElement("button"); el.className = "pnum"; el.textContent = p.label;
    el.onclick = e => { e.stopPropagation(); toggle(p.i); };
    markers.push(new maplibregl.Marker({ element: el }).setLngLat(p.c).addTo(map));
  });
  const tip = document.getElementById("tip"); let hov = null;
  map.on("mousemove", "pfill", e => {
    const p = ps[e.features[0].properties.i]; map.getCanvas().style.cursor = "pointer";
    if (hov !== p.i) { hov = p.i; map.setFilter("phover", ["==", ["get", "i"], p.i]); }
    tip.style.display = "block"; tip.style.left = e.point.x + 14 + "px"; tip.style.top = e.point.y + 10 + "px";
    tip.innerHTML = `<b>Parcel ${p.label}</b> · ${p.use === "WA" ? "residential" : "commercial"}<br>${SC[sc].short}: +${fmt(p[sc])} m² · on paper +${fmt(p.theo)}<br><i>click to open</i>`;
  });
  map.on("mouseleave", "pfill", () => { tip.style.display = "none"; map.getCanvas().style.cursor = ""; hov = null; map.setFilter("phover", ["==", ["get", "i"], -1]); });
  map.on("click", e => {
    const f = map.queryRenderedFeatures(e.point, { layers: ["pfill"] })[0];
    if (f) toggle(f.properties.i); else if (sel != null) toggle(sel);
  });
  document.querySelectorAll("#views button[data-v]").forEach(b => b.onclick = () => view(b.dataset.v));
  document.getElementById("spin").onclick = () => { spinning = !spinning; document.getElementById("spin").classList.toggle("on", spinning); if (spinning) orbit(); };
  document.querySelectorAll("#show input").forEach(cb => cb.onchange = () => { show[cb.name] = cb.checked; apply(); });
  document.querySelectorAll("#scen button").forEach(b => b.onclick = () => setSc(b.dataset.s));
  document.getElementById("sort").onchange = list;
  document.getElementById("mu").onchange = e => { mu = e.target.checked; document.body.classList.toggle("mu", mu); kpi(); list(); };
  const all = ps.reduce((b, p) => [[Math.min(b[0][0], p.bb[0][0]), Math.min(b[0][1], p.bb[0][1])], [Math.max(b[1][0], p.bb[1][0]), Math.max(b[1][1], p.bb[1][1])]], [[180, 90], [-180, -90]]);
  const cam = map.cameraForBounds(all, { padding: { top: 70, bottom: 70, left: 50, right: 50 }, bearing: HOME.bearing });
  if (cam) { HOME.center = [cam.center.lng, cam.center.lat]; HOME.zoom = cam.zoom - 0.15; }
  map.jumpTo(HOME);
  const far = () => document.body.classList.toggle("far", map.getZoom() < 16.85); map.on("zoom", far); far();
  document.getElementById("np").textContent = ps.length + " parcels";
  scen(); setSc(sc);
  window.__ready = true;
}
function scen() {          // the three scenario cards, with block totals
  const T = D.P.totals;
  document.getElementById("scen").innerHTML = ["s1", "s2", "s3"].map(k => `<button data-s="${k}" class="${k === sc ? "on" : ""}">
    <span class="nm">${SC[k].name}</span><b>+${fmt(T[k])}</b><span class="pc">${Math.round(100 * T[k] / T.theo)}% of paper</span></button>`).join("");
  document.querySelectorAll("#scen button").forEach(b => b.onclick = () => setSc(b.dataset.s));
}
function setSc(k) {
  sc = k; scen();
  document.getElementById("scnote").innerHTML = SC[k].note;
  map.setPaintProperty("pfill", "fill-color", ["interpolate", ["linear"], ["get", k], 0, "#f1ede6", 0.15, "#cfe8e2", 0.6, "#6fbdaf", 1.4, "#1f7a6f"]);
  kpi(); list(); apply();
}
function kpi() {
  const T = D.P.totals, tot = D.P.parcels.reduce((a, p) => { const q = people(p, p[sc]); a.f += q.f; a.r += q.r; a.j += q.j; return a; }, { f: 0, r: 0, j: 0 });
  document.getElementById("kpi").innerHTML =
    `<div><b>${fmt(T.gf_allow)}</b><span>m² allowed by the plan</span></div>
     <div><b>${fmt(T.gf_ex)}</b><span>m² built today (${Math.round(100 * T.gf_ex / T.gf_allow)}%)</span></div>
     <div class="t"><b>+${fmt(T.theo)}</b><span>m² still free on paper</span></div>
     <div class="f"><b>+${fmt(T[sc])}</b><span>m² in "${SC[sc].short}"</span></div>
     <div class="pp"><b>≈ ${fmt(tot.f)} flats · ${fmt(tot.r)} residents</b><span>${mu ? "if the commercial zone allowed homes (MU)" : "residential parcels only: homes are not allowed in the commercial zone (GE)"}</span></div>
     ${mu ? "" : `<div class="jj"><b>≈ ${fmt(tot.j)} workplaces</b><span>in the commercial zone, if the new space were offices</span></div>`}`;
}
function bar(label, v, max, col) {
  return `<div class="bar"><div class="l"><span>${label}</span><b>${fmt(v)} m²</b></div><div class="t"><i style="width:${Math.min(100, 100 * v / Math.max(1, max))}%;background:${col}"></i></div></div>`;
}
function why(p) {
  if (p.gf_ex >= p.gf_allow) return "Already built beyond what the plan allows: no new rights here.";
  if (p.theo < 1) return "The plan's rights are used up.";
  const v = p[sc];
  if (v < 1) return sc === "s1" ? "No roof here that can take another storey within the limit." : sc === "s2" ? "Nothing on the roofs, and no usable gap along the street." : "Rights left on paper, but no usable free ground and no roof that can take another storey.";
  const roof = sc === "s1" ? p.up1 : p.up, ground = sc === "s2" ? p.new2 : sc === "s3" ? p.new3 : 0;
  if (roof > 0 && ground > 0) return sc === "s3" ? "Rooftops plus a new building on free ground, including the yard." : "Rooftops plus a new building in a street gap.";
  if (roof > 0) return "Only on the roofs.";
  return sc === "s3" ? "A new building on free ground (the yard)." : "A new building in a gap along the street.";
}
function detail(p) {
  const max = Math.max(p.gf_allow, p.gf_ex), addKey = sc === "s1" ? "add1" : "add";
  return `<div class="tags">${p.use === "WA" ? "Residential (WA)" : "Commercial (GE)"} · GRZ ${p.grz}${p.gfz ? " · GFZ " + p.gfz : ""} · max ${ROM[p.st_max]} storeys · ${fmt(p.area)} m²${p.denkmal ? " · listed building" : ""}</div>
    ${bar("Allowed by the plan", p.gf_allow, max, "#8a929c")}
    ${bar("Built today", p.gf_ex, max, C.ex)}
    ${bar("Still free on paper", p.theo, max, C.paper)}
    <div class="sct">${["s1", "s2", "s3"].map(k => `<span class="${k === sc ? "on" : ""}"><em>${SC[k].short}</em><b>+${fmt(p[k])}</b></span>`).join("")}</div>
    <p class="why">${why(p)}${(() => { const q = people(p, p[sc]); if (p[sc] < 1) return "";
      return housing(p) ? ` <b>≈ ${q.f} flat${q.f === 1 ? "" : "s"} · ≈ ${fmt(q.r)} residents</b>${p.use === "GE" ? " (only if this were MU)" : ""}.` : ` <b>Commercial space, no homes allowed (GE):</b> ≈ ${fmt(q.j)} workplaces if offices.`; })()}</p>
    ${p.buildings.length ? `<ul class="blist"><li class="h"><span>Buildings today</span><b>storeys now → limit</b></li>${p.buildings.map(b => `<li><span>${b.addr || "Building"} · ${fmt(b.fp)} m²${b.listed ? " · listed" : ""}</span><b>${ROM[b.st] || b.st} → ${ROM[b.lim] || b.lim}${b[addKey] ? ` <em>+${b[addKey]}${housing(p) && flats(b.fp * b[addKey]) ? ` · ${flats(b.fp * b[addKey])} flat${flats(b.fp * b[addKey]) > 1 ? "s" : ""}` : ""}</em>` : ""}</b></li>`).join("")}</ul>` : `<p class="fine">No building on this parcel today.</p>`}
    <div class="nav"><button data-d="-1">← previous</button><button data-d="0">close ✕</button><button data-d="1">next →</button></div>`;
}
function order() {
  const k = document.getElementById("sort").value, ps = [...D.P.parcels];
  return k === "num" ? ps.sort((a, b) => a.label.localeCompare(b.label, "en", { numeric: true })) : ps.sort((a, b) => (b[k === "sc" ? sc : k] - a[k === "sc" ? sc : k]));
}
function list() {
  const ps = order(), mx = Math.max(...ps.map(p => p.theo));
  document.getElementById("plist").innerHTML = ps.map(p => `<li data-i="${p.i}" class="${sel === p.i ? "open" : ""}">
    <div class="row"><b class="n">${p.label}</b><span class="u ${p.use}">${p.use}</span>
      <span class="mini"><i class="t" style="width:${100 * p.theo / mx}%"></i><i class="f" style="width:${100 * p[sc] / mx}%"></i></span>
      <b class="v">+${fmt(p[sc])}</b><span class="ch">${sel === p.i ? "▾" : "▸"}</span></div>
    ${sel === p.i ? `<div class="det">${detail(p)}</div>` : ""}</li>`).join("");
  document.querySelectorAll("#plist li .row").forEach(r => r.onclick = () => toggle(+r.parentNode.dataset.i));
  document.querySelectorAll("#plist .nav button").forEach(b => b.onclick = e => {
    e.stopPropagation(); const d = +b.dataset.d; if (!d) return toggle(sel);
    const o = order(), k = o.findIndex(p => p.i === sel); toggle(o[(k + d + o.length) % o.length].i, true);
  });
  const open = document.querySelector("#plist li.open"); if (open) open.scrollIntoView({ block: "nearest", behavior: "smooth" });
}
function toggle(i, force) {
  sel = (sel === i && !force) ? null : i;
  apply(); list();
  if (sel == null) { map.easeTo({ ...HOME, bearing: map.getBearing(), duration: 900 }); return; }
  const p = D.P.parcels[sel];
  map.fitBounds(p.bb, { padding: { top: 120, bottom: 120, left: 120, right: 120 }, maxZoom: 18.6, pitch: 55, bearing: map.getBearing(), duration: 1100 });
}
// deck.gl volumes for the open parcel; g = growth 0..1 (used by the film)
const COL = { w: [214, 206, 196], rp: [178, 138, 122], rf: [160, 164, 168], sw: [176, 186, 198], srp: [120, 128, 138], srf: [140, 146, 152] };
function deckLayers(p, g = 1, ge = 1) {
  const L = p && p.label, of = fc => fc.features.filter(f => f.properties.parcel === L);
  const auf = p && show.add ? vols(of(sc === "s1" ? D.A1 : D.A2), q => q.base, q => q.base + (q.top - q.base) * g) : [];
  const lifted = new Set(p && show.add ? of(sc === "s1" ? D.A1 : D.A2).map(f => f.properties.id) : []);
  const nb = p && show.add && sc !== "s1" ? vols(of(sc === "s2" ? D.N2 : D.N3), () => 0, q => q.h * g) : [];
  const env = p && show.env ? vols(of(D.E), () => 0, q => q.h * ge) : [];
  const dim = !!p;
  const surfaces = new deck.SolidPolygonLayer({ id: "lod2", data: D.surf, _full3d: true, extruded: false, getPolygon: d => d.p,
    getFillColor: d => { const s = p && p.ids.has(d.id); const c = COL[(s ? "s" : "") + d.k] || COL[d.k];
      const a = s ? (d.k !== "w" && lifted.has(d.id) ? 70 : 255) : (dim ? 150 : 255); return [...c, a]; },
    material: { ambient: 0.55, diffuse: 0.5, shininess: 8, specularColor: [30, 30, 30] },
    updateTriggers: { getFillColor: [L, sc, show.add, g > 0.01] }, parameters: { depthTest: true } });
  const solid = (id, data, col, a) => new deck.SolidPolygonLayer({ id, data, extruded: true, material: false, _full3d: true,
    getPolygon: v => v.rings.map(r => r.map(c => [c[0], c[1], v.b])), getElevation: v => Math.max(0.01, v.t - v.b), getFillColor: rgb(col, a), parameters: { depthTest: true } });
  const lines = (id, data, col, w, dash) => new deck.PathLayer({ id, data: data.flatMap(edges), getPath: d => d, getColor: rgb(col), getWidth: w, widthUnits: "pixels",
    capRounded: true, jointRounded: true, ...(dash ? { getDashArray: [5, 4], dashJustified: true, extensions: [new deck.PathStyleExtension({ dash: true })] } : {}), parameters: { depthTest: true } });
  return [surfaces,
    solid("nb", nb, C.s, 235), lines("nbE", nb, "#155e55", 1.6),
    solid("auf", auf, C.roof, 235), lines("aufE", auf, "#1e4f7f", 1.6),
    solid("env", env, C.paper, 22), lines("envE", env, C.envEdge, 1.8, true)];
}
function apply(g, ge) {
  const p = sel == null ? null : D.P.parcels[sel];
  overlay.setProps({ layers: deckLayers(p, g, ge) });
  map.setFilter("bld", ["!", ["in", ["get", "id"], ["literal", [...D.l2ids]]]]);
  map.setFilter("psel", ["==", ["get", "i"], p ? p.i : -1]);
  D.P.parcels.forEach(q => map.setFeatureState({ source: "parcels", id: q.i }, { dim: !!p && q.i !== p.i }));
  map.setPaintProperty("bld", "fill-extrusion-opacity", p ? 0.32 : 0.5);
  map.setPaintProperty("pfill", "fill-opacity", ["case", ["boolean", ["feature-state", "dim"], false], show.photo ? 0.1 : 0.3, show.photo ? 0.72 : 0.92]);
  if (map.getLayer("photo")) map.setLayoutProperty("photo", "visibility", show.photo ? "visible" : "none");
  const hole = p ? polys(p.geom) : D.P.parcels.flatMap(q => polys(q.geom));
  map.getSource("mask").setData({ type: "Feature", geometry: { type: "Polygon", coordinates: [[[9.9, 53.5], [10.2, 53.5], [10.2, 53.65], [9.9, 53.65], [9.9, 53.5]], ...hole.map(r => r[0])] } }); map.setPaintProperty("trees", "fill-extrusion-opacity", p ? 0.45 : 0.9);
  markers.forEach((m, k) => m.getElement().classList.toggle("on", !!p && k === p.i));
  document.body.classList.toggle("open", !!p);
}
function view(v) {
  document.querySelectorAll("#views button[data-v]").forEach(b => b.classList.toggle("on", b.dataset.v === v));
  const base = sel == null ? { center: HOME.center, zoom: HOME.zoom } : { center: D.P.parcels[sel].c, zoom: map.getZoom() };
  map.easeTo({ ...base, pitch: v === "top" ? 0 : 55, bearing: HOME.bearing, duration: 1000 });
}
function orbit() { if (!spinning) return; map.rotateTo(map.getBearing() + 25, { duration: 4000, easing: t => t }); map.once("moveend", orbit); }
window.APP = { toggle, map: () => map, show, apply, data: () => D, setSc, select: i => { sel = i; apply(); list(); }, grow: (g, ge) => apply(g, ge) };
