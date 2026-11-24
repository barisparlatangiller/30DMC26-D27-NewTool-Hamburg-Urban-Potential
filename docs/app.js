// Day 27 · Urban Potential Explorer · Barmbek-Süd 42
const C = { theo: "#e07a5f", feas: "#2a9d8f", feasNew: "#7cc6b8", ex: "#ece8e1", exIn: "#d9cdbb", wa: "#e9a1a0", ge: "#a59d95" };
const fmt = n => Math.round(n).toLocaleString("en-US");
let mode = "theo", D, sel = null, spinning = false;
const NOTE = {
  theo: "<b>On paper.</b> What the plan's numbers allow minus what stands today. Coral boxes: the full building envelope (building limits × storey limit).",
  feas: "<b>In practice.</b> Today's buildings stay. New building only on free ground inside the limits, rooftop extensions of up to +2 storeys, the listed building untouched."
};
const map = new maplibregl.Map({
  container: "map", style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  center: [10.0468, 53.5794], zoom: 16.95, pitch: 55, bearing: 10, antialias: true, attributionControl: { compact: true }
});
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-left");
Promise.all(["potential.json", "web_buildings.geojson", "web_new.geojson", "web_env.geojson", "web_zones.geojson", "web_context.geojson", "web_auf.geojson"].map(f => fetch("data/" + f).then(r => r.json())))
  .then(([P, B, N, E, Z, X, AU]) => { D = { P, B, N, E, Z, X, AU }; map.loaded() ? init() : map.on("load", init); });

function init() {
  const parcels = { type: "FeatureCollection", features: D.P.parcels.map((p, i) => ({ type: "Feature", id: i, properties: { i, label: p.label, use: p.use, theo: p.theo / p.area, feas: p.feas / p.area }, geometry: p.geom })) };
  map.addSource("ctx", { type: "geojson", data: D.X });
  map.addSource("zones", { type: "geojson", data: D.Z });
  map.addSource("parcels", { type: "geojson", data: parcels });
  map.addSource("bld", { type: "geojson", data: D.B });
  map.addSource("env", { type: "geojson", data: D.E });
  map.addSource("new", { type: "geojson", data: D.N });
  map.addSource("auf", { type: "geojson", data: D.AU });
  const lbl = map.getStyle().layers.find(l => l.type === "symbol")?.id;
  map.addLayer({ id: "ctx", type: "line", source: "ctx", paint: { "line-color": "#c9c1b5", "line-width": 0.6 } }, lbl);
  map.addLayer({ id: "zones", type: "fill", source: "zones", paint: { "fill-color": ["match", ["get", "use"], "WA", C.wa, C.ge], "fill-opacity": 0.22 } }, lbl);
  map.addLayer({ id: "pfill", type: "fill", source: "parcels", paint: { "fill-color": C.theo, "fill-opacity": 0 } }, lbl);
  map.addLayer({ id: "pline", type: "line", source: "parcels", paint: { "line-color": "#7d756b", "line-width": 0.8, "line-opacity": 0.7 } }, lbl);
  map.addLayer({ id: "psel", type: "line", source: "parcels", filter: ["==", ["get", "i"], -1], paint: { "line-color": "#1f2328", "line-width": 3 } });
  map.addLayer({ id: "bld", type: "fill-extrusion", source: "bld", paint: {
    "fill-extrusion-color": ["case", ["==", ["get", "in"], 1], C.exIn, C.ex], "fill-extrusion-height": ["get", "h"], "fill-extrusion-opacity": 0.82, "fill-extrusion-vertical-gradient": true } });
  map.addLayer({ id: "env", type: "fill-extrusion", source: "env", paint: { "fill-extrusion-color": C.theo, "fill-extrusion-height": ["get", "h"], "fill-extrusion-opacity": 0.38 } });
  map.addLayer({ id: "new", type: "fill-extrusion", source: "new", paint: { "fill-extrusion-color": C.feasNew, "fill-extrusion-height": ["get", "h"], "fill-extrusion-opacity": 0.8 } });
  map.addLayer({ id: "auf", type: "fill-extrusion", source: "auf", paint: { "fill-extrusion-color": C.feas, "fill-extrusion-base": ["get", "base"], "fill-extrusion-height": ["get", "top"], "fill-extrusion-opacity": 0.85 } });
  const tip = document.getElementById("tip");
  map.on("mousemove", "pfill", e => {
    const p = D.P.parcels[e.features[0].properties.i]; map.getCanvas().style.cursor = "pointer";
    tip.style.display = "block"; tip.style.left = e.point.x + 14 + "px"; tip.style.top = e.point.y + 10 + "px";
    tip.innerHTML = `<b>Parcel ${p.label}</b> · ${p.use}<br>+${fmt(mode === "theo" ? p.theo : p.feas)} m² ${mode === "theo" ? "on paper" : "feasible"}`;
  });
  map.on("mouseleave", "pfill", () => { tip.style.display = "none"; map.getCanvas().style.cursor = ""; });
  map.on("click", e => {
    const f = map.queryRenderedFeatures(e.point, { layers: ["pfill"] })[0];
    pick(f ? f.properties.i : null);
  });
  document.querySelectorAll("#modes button").forEach(b => b.onclick = () => setMode(b.dataset.m));
  document.querySelectorAll("#views button[data-v]").forEach(b => b.onclick = () => view(b.dataset.v));
  document.getElementById("spin").onclick = () => { spinning = !spinning; document.getElementById("spin").classList.toggle("on", spinning); if (spinning) orbit(); };
  kpi(); setMode("theo");
  window.__ready = true;
}
function setMode(m) {
  mode = m;
  document.querySelectorAll("#modes button").forEach(b => b.classList.toggle("on", b.dataset.m === m));
  document.getElementById("modenote").innerHTML = NOTE[m];
  map.setLayoutProperty("env", "visibility", m === "theo" ? "visible" : "none");
  ["new", "auf"].forEach(l => map.setLayoutProperty(l, "visibility", m === "feas" ? "visible" : "none"));
  const key = m === "theo" ? "theo" : "feas", col = m === "theo" ? C.theo : C.feas;
  map.setPaintProperty("pfill", "fill-color", col);
  map.setPaintProperty("pfill", "fill-opacity", ["interpolate", ["linear"], ["get", key], 0, 0.02, 0.5, 0.25, 1.5, 0.5]);
  legend(); if (sel != null) pick(sel);
}
function kpi() {
  const T = D.P.totals, ps = D.P.parcels;
  const homes = k => ps.filter(p => p.use === "WA").reduce((s, p) => s + p[k], 0) / 90;
  document.getElementById("kpi").innerHTML =
    `<div><b>${fmt(T.gf_ex)}</b><span>m² floor area today</span></div>
     <div class="t"><b>+${fmt(T.theo)}</b><span>m² on paper${homes("theo") >= 1 ? ` · ≈ ${fmt(homes("theo"))} homes` : ""}</span></div>
     <div class="f"><b>+${fmt(T.feas)}</b><span>m² feasible · ${Math.round(100 * T.feas / Math.max(1, T.theo))}% of paper</span></div>`;
}
function legend() {
  const it = [["Existing (LoD2)", C.exIn], ...(mode === "theo" ? [["Allowed envelope", C.theo]] : [["New building", C.feasNew], ["Rooftop extension", C.feas]]), ["Residential (WA)", C.wa], ["Commercial (GE)", C.ge]];
  document.getElementById("legend").innerHTML = it.map(([t, c]) => `<span><i style="background:${c}"></i>${t}</span>`).join("");
}
function bar(label, v, max, col) {
  return `<div class="bar"><div class="l"><span>${label}</span><b>${fmt(v)} m²</b></div><div class="t"><i style="width:${Math.min(100, 100 * v / Math.max(1, max))}%;background:${col}"></i></div></div>`;
}
const ROM = ["", "I", "II", "III", "IV", "V", "VI"];
function pick(i) {
  sel = i; map.setFilter("psel", ["==", ["get", "i"], i == null ? -1 : i]);
  const el = document.getElementById("card");
  if (i == null) { el.innerHTML = `<p class="hint">Click a parcel to see its numbers.</p>`; return; }
  const p = D.P.parcels[i], max = Math.max(p.gf_allow, p.gf_ex);
  const homes = p.use === "WA" ? ` · ≈ ${fmt(p.feas / 90)} homes` : "";
  el.innerHTML = `<h2>Parcel ${p.label}</h2>
    <div class="tags">${p.use === "WA" ? "Residential WA" : "Commercial GE"} · GRZ ${p.grz}${p.gfz ? " · GFZ " + p.gfz : ""} · max ${ROM[p.st_max] || "–"} · ${fmt(p.area)} m²${p.denkmal ? " · listed" : ""}</div>
    ${bar("Allowed floor area", p.gf_allow, max, "#8a929c")}
    ${bar("Built today", p.gf_ex, max, C.exIn.replace("e2d9cc", "c9bba6"))}
    ${bar("On paper, still free", p.theo, max, C.theo)}
    ${bar("Feasible" + homes, p.feas, max, C.feas)}
    ${p.buildings.length ? `<ul class="blist">${p.buildings.map(b => `<li><span>${b.addr || "Building"} · ${fmt(b.fp)} m²</span><b>${ROM[b.st] || b.st} → ${ROM[b.lim] || b.lim}${b.add ? ` (+${b.add})` : ""}</b></li>`).join("")}</ul>` : `<p class="fine">No building on this parcel today.</p>`}
    ${p.denkmal ? `<p class="fine">Contains the listed building (Denkmal), which stays as it is.</p>` : ""}`;
}
function view(v) {
  document.querySelectorAll("#views button[data-v]").forEach(b => b.classList.toggle("on", b.dataset.v === v));
  map.easeTo(v === "top" ? { center: [10.0468, 53.5794], pitch: 0, bearing: 10, zoom: 17.1, duration: 1200 } : { center: [10.0468, 53.5794], pitch: 55, bearing: 10, zoom: 16.95, duration: 1200 });
}
function orbit() { if (!spinning) return; map.rotateTo(map.getBearing() + 25, { duration: 4000, easing: t => t }); map.once("moveend", orbit); }
window.APP = { setMode, pick, map: () => map };
