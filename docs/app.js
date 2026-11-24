// Day 27 · Urban Potential Explorer · Barmbek-Süd 42
// Overview: flat parcels coloured by feasible potential, numbered. Open one parcel (map or list) to see its volumes.
const C = { theo: "#e07a5f", feas: "#2a9d8f", feasNew: "#7cc6b8", ctx: "#ebe7e0", exIn: "#d9cdbb", exSel: "#c4a27a", wa: "#e9a1a0", ge: "#a59d95" };
let HOME = { center: [10.0468, 53.5799], zoom: 17.2, pitch: 45, bearing: 10 };
const fmt = n => Math.round(n).toLocaleString("en-US");
const ROM = ["–", "I", "II", "III", "IV", "V", "VI"];
let D, sel = null, show = { env: true, feas: true }, spinning = false, markers = [];
const map = new maplibregl.Map({ container: "map", style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json", ...HOME, antialias: true, attributionControl: { compact: true } });
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-left");
Promise.all(["potential.json", "web_buildings.geojson", "web_new.geojson", "web_env.geojson", "web_zones.geojson", "web_context.geojson", "web_auf.geojson", "web_trees.geojson", "web_parks.geojson", "web_roads.geojson"].map(f => fetch("data/" + f).then(r => r.json())))
  .then(([P, B, N, E, Z, X, AU, TR, PK, RD]) => { D = { P, B, N, E, Z, X, AU, TR, PK, RD }; map.loaded() ? init() : map.on("load", init); });

function bbox(g) {
  let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
  const walk = c => typeof c[0] === "number" ? (x0 = Math.min(x0, c[0]), x1 = Math.max(x1, c[0]), y0 = Math.min(y0, c[1]), y1 = Math.max(y1, c[1])) : c.forEach(walk);
  walk(g.coordinates); return [[x0, y0], [x1, y1]];
}
function centre(g) {          // area-weighted centre of the largest ring, good enough for labels
  const rings = g.type === "Polygon" ? [g.coordinates[0]] : g.coordinates.map(p => p[0]);
  let best = null, ba = -1;
  for (const r of rings) { let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < r.length - 1; i++) { const f = r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; a += f; cx += (r[i][0] + r[i + 1][0]) * f; cy += (r[i][1] + r[i + 1][1]) * f; }
    if (Math.abs(a) > ba) { ba = Math.abs(a); best = [cx / (3 * a), cy / (3 * a)]; } }
  return best;
}
function init() {
  const ps = D.P.parcels;
  ps.forEach((p, i) => { p.i = i; p.bb = bbox(p.geom); p.c = centre(p.geom); p.ids = new Set(p.buildings.map(b => b.id)); });
  const parcels = { type: "FeatureCollection", features: ps.map((p, i) => ({ type: "Feature", id: i, properties: { i, label: p.label, use: p.use, feas: p.feas, dens: p.feas / p.area }, geometry: p.geom })) };
  const inPlan = new Set(ps.flatMap(p => p.buildings.map(b => b.id)));
  D.B.features.forEach(f => f.properties.in = inPlan.has(f.properties.id) ? 1 : 0);
  map.addSource("ctx", { type: "geojson", data: D.X });
  map.addSource("parcels", { type: "geojson", data: parcels });
  map.addSource("bld", { type: "geojson", data: D.B });
  map.addSource("env", { type: "geojson", data: D.E });
  map.addSource("new", { type: "geojson", data: D.N });
  map.addSource("auf", { type: "geojson", data: D.AU });
  const lbl = map.getStyle().layers.find(l => l.type === "symbol")?.id;
  map.addSource("trees", { type: "geojson", data: D.TR });
  map.addSource("parks", { type: "geojson", data: D.PK });
  map.addSource("roads", { type: "geojson", data: D.RD });
  map.addLayer({ id: "parks", type: "fill", source: "parks", paint: { "fill-color": "#d6e6c8", "fill-opacity": 0.9 } }, lbl);
  map.addLayer({ id: "roads", type: "line", source: "roads", layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#ffffff", "line-width": ["interpolate", ["exponential", 2], ["zoom"], 15, 4, 19, 40] } }, lbl);
  map.addLayer({ id: "ctx", type: "line", source: "ctx", paint: { "line-color": "#cfc8bd", "line-width": 0.5 } }, lbl);
  map.addLayer({ id: "pfill", type: "fill", source: "parcels", paint: {
    "fill-color": ["interpolate", ["linear"], ["get", "dens"], 0, "#f1ede6", 0.3, "#bfe0d9", 0.8, "#5fb5a7", 1.6, "#1f7a6f"],
    "fill-opacity": ["case", ["boolean", ["feature-state", "dim"], false], 0.35, 0.92] } }, lbl);
  map.addLayer({ id: "pline", type: "line", source: "parcels", paint: { "line-color": "#ffffff", "line-width": 1.4 } }, lbl);
  map.addLayer({ id: "phover", type: "line", source: "parcels", filter: ["==", ["get", "i"], -1], paint: { "line-color": "#1f2328", "line-width": 1.6, "line-dasharray": [2, 1] } });
  map.addLayer({ id: "psel", type: "line", source: "parcels", filter: ["==", ["get", "i"], -1], paint: { "line-color": "#1f2328", "line-width": 3.2 } });
  // surroundings: low-key; the block's own buildings slightly warmer; the open parcel's buildings warm
  map.addLayer({ id: "bld", type: "fill-extrusion", source: "bld", paint: {
    "fill-extrusion-color": ["case", ["==", ["get", "in"], 1], C.exIn, C.ctx], "fill-extrusion-height": ["get", "h"],
    "fill-extrusion-opacity": 0.42, "fill-extrusion-vertical-gradient": true } });
  map.addLayer({ id: "bsel", type: "fill-extrusion", source: "bld", filter: ["in", ["get", "id"], ["literal", []]], paint: {
    "fill-extrusion-color": C.exSel, "fill-extrusion-height": ["get", "h"], "fill-extrusion-opacity": 0.95 } });
  map.addLayer({ id: "trees", type: "fill-extrusion", source: "trees", paint: {
    "fill-extrusion-color": ["case", ["==", ["get", "k"], "t"], "#8a6f55", ["interpolate", ["linear"], ["get", "s"], 0, "#9cc489", 0.5, "#79ad6b", 1, "#5e9658"]],
    "fill-extrusion-base": ["get", "b"], "fill-extrusion-height": ["get", "h"], "fill-extrusion-opacity": 0.92 } });
  const none = ["==", ["get", "parcel"], "__"];
  map.addLayer({ id: "env", type: "fill-extrusion", source: "env", filter: none, paint: { "fill-extrusion-color": C.theo, "fill-extrusion-height": ["get", "h"], "fill-extrusion-opacity": 0.32 } });
  map.addLayer({ id: "new", type: "fill-extrusion", source: "new", filter: none, paint: { "fill-extrusion-color": C.feasNew, "fill-extrusion-height": ["get", "h"], "fill-extrusion-opacity": 0.9 } });
  map.addLayer({ id: "auf", type: "fill-extrusion", source: "auf", filter: none, paint: { "fill-extrusion-color": C.feas, "fill-extrusion-base": ["get", "base"], "fill-extrusion-height": ["get", "top"], "fill-extrusion-opacity": 0.95 } });
  // street names and parcel numbers as HTML labels (always readable, also without the base map's labels)
  [["Dehnhaide", [10.0462, 53.57905], 10], ["Stückenstraße", [10.0466, 53.57995], 10], ["Langenrehm", [10.04435, 53.5797], 62], ["Friedrichsberger Str.", [10.04955, 53.5794], 80]]
    .forEach(([t, ll]) => { const el = document.createElement("div"); el.className = "street"; el.textContent = t; new maplibregl.Marker({ element: el }).setLngLat(ll).addTo(map); });
  ps.forEach(p => {
    const el = document.createElement("button"); el.className = "pnum" + (p.feas > 0 ? "" : " zero"); el.textContent = p.label;
    el.onclick = e => { e.stopPropagation(); toggle(p.i); };
    markers.push(new maplibregl.Marker({ element: el }).setLngLat(p.c).addTo(map));
  });
  const tip = document.getElementById("tip"); let hov = null;
  map.on("mousemove", "pfill", e => {
    const p = ps[e.features[0].properties.i]; map.getCanvas().style.cursor = "pointer";
    if (hov !== p.i) { hov = p.i; map.setFilter("phover", ["==", ["get", "i"], p.i]); }
    tip.style.display = "block"; tip.style.left = e.point.x + 14 + "px"; tip.style.top = e.point.y + 10 + "px";
    tip.innerHTML = `<b>Parcel ${p.label}</b> · ${p.use === "WA" ? "residential" : "commercial"}<br>+${fmt(p.feas)} m² feasible · +${fmt(p.theo)} on paper<br><i>click to open</i>`;
  });
  map.on("mouseleave", "pfill", () => { tip.style.display = "none"; map.getCanvas().style.cursor = ""; hov = null; map.setFilter("phover", ["==", ["get", "i"], -1]); });
  map.on("click", e => {
    const f = map.queryRenderedFeatures(e.point, { layers: ["pfill"] })[0];
    if (f) toggle(f.properties.i); else if (sel != null) toggle(sel);
  });
  document.querySelectorAll("#views button[data-v]").forEach(b => b.onclick = () => view(b.dataset.v));
  document.getElementById("spin").onclick = () => { spinning = !spinning; document.getElementById("spin").classList.toggle("on", spinning); if (spinning) orbit(); };
  document.querySelectorAll("#show input").forEach(cb => cb.onchange = () => { show[cb.name] = cb.checked; apply(); });
  document.getElementById("sort").onchange = list;
  // frame the whole plan, whatever the screen size; this becomes the "home" view
  const all = ps.reduce((b, p) => [[Math.min(b[0][0], p.bb[0][0]), Math.min(b[0][1], p.bb[0][1])], [Math.max(b[1][0], p.bb[1][0]), Math.max(b[1][1], p.bb[1][1])]], [[180, 90], [-180, -90]]);
  const cam = map.cameraForBounds(all, { padding: { top: 70, bottom: 70, left: 50, right: 50 }, bearing: HOME.bearing });
  if (cam) { HOME.center = [cam.center.lng, cam.center.lat]; HOME.zoom = cam.zoom - 0.15; }
  map.jumpTo(HOME);
  const far = () => document.body.classList.toggle("far", map.getZoom() < 16.85); map.on("zoom", far); far();
  document.getElementById("np").textContent = ps.length + " parcels";
  kpi(); list(); apply();
  window.__ready = true;
}
function kpi() {
  const T = D.P.totals, homes = D.P.parcels.filter(p => p.use === "WA").reduce((s, p) => s + p.feas, 0) / 90;
  document.getElementById("kpi").innerHTML =
    `<div><b>${fmt(T.gf_allow)}</b><span>m² allowed by the plan</span></div>
     <div><b>${fmt(T.gf_ex)}</b><span>m² built today</span></div>
     <div class="t"><b>+${fmt(T.theo)}</b><span>m² still free on paper</span></div>
     <div class="f"><b>+${fmt(T.feas)}</b><span>m² feasible · ≈ ${fmt(homes)} homes</span></div>`;
}
function bar(label, v, max, col) {
  return `<div class="bar"><div class="l"><span>${label}</span><b>${fmt(v)} m²</b></div><div class="t"><i style="width:${Math.min(100, 100 * v / Math.max(1, max))}%;background:${col}"></i></div></div>`;
}
function detail(p) {
  const max = Math.max(p.gf_allow, p.gf_ex), homes = p.use === "WA" && p.feas > 0 ? ` (≈ ${Math.max(1, Math.round(p.feas / 90))} homes)` : "";
  let why = "";
  if (p.gf_ex >= p.gf_allow) why = "Already built beyond what the plan allows: no new rights here.";
  else if (p.feas < 1) why = "Rights are left on paper, but no free ground of a usable size and no roof that can take another storey.";
  else if (p.up > 0 && p.new_fp > 0) why = "Both a new building on free ground and rooftop extensions.";
  else if (p.up > 0) why = "Only rooftop extensions: the free ground is too small or too close to existing buildings.";
  else why = "A new building on free ground inside the building limits.";
  return `<div class="tags">${p.use === "WA" ? "Residential (WA)" : "Commercial (GE)"} · GRZ ${p.grz}${p.gfz ? " · GFZ " + p.gfz : ""} · max ${ROM[p.st_max]} storeys · ${fmt(p.area)} m²${p.denkmal ? " · listed building" : ""}</div>
    ${bar("Allowed by the plan", p.gf_allow, max, "#8a929c")}
    ${bar("Built today", p.gf_ex, max, "#c9bba6")}
    ${bar("Still free on paper", p.theo, max, C.theo)}
    ${bar("Feasible" + homes, p.feas, max, C.feas)}
    <p class="why">${why}</p>
    ${p.buildings.length ? `<ul class="blist"><li class="h"><span>Buildings today</span><b>storeys now → limit</b></li>${p.buildings.map(b => `<li><span>${b.addr || "Building"} · ${fmt(b.fp)} m²${b.listed ? " · listed" : ""}</span><b>${ROM[b.st] || b.st} → ${ROM[b.lim] || b.lim}${b.add ? ` <em>+${b.add}</em>` : ""}</b></li>`).join("")}</ul>` : `<p class="fine">No building on this parcel today.</p>`}
    <div class="nav"><button data-d="-1">← previous</button><button data-d="0">close ✕</button><button data-d="1">next →</button></div>`;
}
function order() {
  const k = document.getElementById("sort").value, ps = [...D.P.parcels];
  return k === "num" ? ps.sort((a, b) => a.label.localeCompare(b.label, "en", { numeric: true })) : ps.sort((a, b) => b[k] - a[k]);
}
function list() {
  const ps = order(), mx = Math.max(...ps.map(p => p.theo));
  document.getElementById("plist").innerHTML = ps.map(p => `<li data-i="${p.i}" class="${sel === p.i ? "open" : ""}">
    <div class="row"><b class="n">${p.label}</b><span class="u ${p.use}">${p.use}</span>
      <span class="mini"><i class="t" style="width:${100 * p.theo / mx}%"></i><i class="f" style="width:${100 * p.feas / mx}%"></i></span>
      <b class="v">+${fmt(p.feas)}</b><span class="ch">${sel === p.i ? "▾" : "▸"}</span></div>
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
  if (sel == null) { map.easeTo({ ...HOME, duration: 900 }); return; }
  const p = D.P.parcels[sel];
  map.fitBounds(p.bb, { padding: { top: 120, bottom: 120, left: 120, right: 120 }, maxZoom: 18.6, pitch: 55, bearing: map.getBearing(), duration: 1100 });
}
function apply() {
  const p = sel == null ? null : D.P.parcels[sel], f = p ? ["==", ["get", "parcel"], p.label] : ["==", ["get", "parcel"], "__"];
  map.setFilter("env", show.env ? f : ["==", ["get", "parcel"], "__"]);
  map.setFilter("new", show.feas ? f : ["==", ["get", "parcel"], "__"]);
  map.setFilter("auf", show.feas ? f : ["==", ["get", "parcel"], "__"]);
  map.setFilter("bsel", ["in", ["get", "id"], ["literal", p ? [...p.ids] : []]]);
  map.setFilter("psel", ["==", ["get", "i"], p ? p.i : -1]);
  D.P.parcels.forEach(q => map.setFeatureState({ source: "parcels", id: q.i }, { dim: !!p && q.i !== p.i }));
  map.setPaintProperty("bld", "fill-extrusion-opacity", p ? 0.3 : 0.42); map.setPaintProperty("trees", "fill-extrusion-opacity", p ? 0.5 : 0.92);
  markers.forEach((m, k) => m.getElement().classList.toggle("on", !!p && k === p.i));
  document.body.classList.toggle("open", !!p);
}
function view(v) {
  document.querySelectorAll("#views button[data-v]").forEach(b => b.classList.toggle("on", b.dataset.v === v));
  const base = sel == null ? { center: HOME.center, zoom: HOME.zoom } : { center: D.P.parcels[sel].c, zoom: map.getZoom() };
  map.easeTo({ ...base, pitch: v === "top" ? 0 : 55, bearing: HOME.bearing, duration: 1000 });
}
function orbit() { if (!spinning) return; map.rotateTo(map.getBearing() + 25, { duration: 4000, easing: t => t }); map.once("moveend", orbit); }
window.APP = { toggle, map: () => map, show, apply, data: () => D, select: i => { sel = i; apply(); list(); } };
