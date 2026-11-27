(() => {
  document.body.classList.add("film");
  const map = APP.map(); map.resize();
  APP.show.photo = false; APP.setSc("s2");
  const D = APP.data(), PS = D.P.parcels;
  const byL = l => PS.find(p => p.label === l);
  const fmt = n => Math.round(n).toLocaleString("en-US");
  const cl = (x, a, b) => Math.max(0, Math.min(1, (x - a) / (b - a)));
  const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const flats = gf => { const l = gf * 0.78; return l < 40 ? 0 : Math.max(1, Math.floor(l / 60)); };
  const tot = (mu) => PS.reduce((a, p) => { const h = p.use === "WA" || mu; if (h) { a.f += flats(p.s2); a.r += flats(p.s2) * 1.6; } else a.j += p.s2 / 32; return a; }, { f: 0, r: 0, j: 0 });
  const A = tot(false), M = tot(true);
  const fo = document.createElement("div"); fo.id = "fo"; document.body.appendChild(fo);
  fo.innerHTML = `<div class="top"><div class="eb">#30DayMapChallenge · Day 27 · New Tool · Hamburg</div>
    <h1><span class="h">Homes</span> or <span class="j">workshops?</span></h1>
    <div class="sub">One Hamburg block, 26 parcels: how much more could be built, and for whom?</div></div>
    <div class="zl" id="zl"></div>
    <div class="kp" id="kp"><div class="h"><b>≈ ${fmt(A.f)}</b><span>new flats with today's plan</span></div><div class="j"><b>≈ ${fmt(A.j)}</b><span>new workplaces in the commercial zone</span></div></div>
    <div id="pc"></div><div id="oc"></div>
    <div class="ft">Data: FHH · LGV (ALKIS, LoD2) · Bezirksamt Hamburg-Nord (B-Plan Barmbek-Süd 42, 2019) · dl-de/by-2-0 · © OSM · Scenario "roofs + fill the gaps", not a planning assessment · Barış Parlatangiller</div>`;
  const BB = PS.reduce((b, p) => [[Math.min(b[0][0], p.bb[0][0]), Math.min(b[0][1], p.bb[0][1])], [Math.max(b[1][0], p.bb[1][0]), Math.max(b[1][1], p.bb[1][1])]], [[180, 90], [-180, -90]]);
  const camFor = (bb, pad, pitch, bearing, dz = 0, maxZ = 30) => { const c = map.cameraForBounds(bb, { padding: pad, bearing }); return { lng: c.center.lng, lat: c.center.lat, zoom: Math.min(maxZ, c.zoom + dz), pitch, bearing }; };
  const HOMEC = camFor(BB, { top: 330, bottom: 300, left: 10, right: 10 }, 48, 10);
  const OUTC = camFor(BB, { top: 760, bottom: 120, left: 60, right: 60 }, 40, 26);
  const PAD = { top: 380, bottom: 560, left: 150, right: 150 };
  const ST = [{ l: "562", t0: 3.6, t1: 8.4, b: -14, dz: -0.2 }, { l: "5961", t0: 10.0, t1: 14.4, b: 34, dz: 0.55 }];
  ST.forEach(s => { s.p = byL(s.l); const pts = D.surf.filter(q => s.p.ids.has(q.id)).flatMap(q => q.p); const bc = s.l === "562" && pts.length ? [[Math.min(...pts.map(c => c[0])), Math.min(...pts.map(c => c[1]))], [Math.max(...pts.map(c => c[0])), Math.max(...pts.map(c => c[1]))]] : s.p.bb; s.cam = camFor(bc, PAD, 58, s.b, s.dz, 18.7); });
  const lerp = (a, b, k) => ({ lng: a.lng + (b.lng - a.lng) * k, lat: a.lat + (b.lat - a.lat) * k, zoom: a.zoom + (b.zoom - a.zoom) * k, pitch: a.pitch + (b.pitch - a.pitch) * k, bearing: a.bearing + (b.bearing - a.bearing) * k });
  const R = (c, d) => ({ ...c, bearing: c.bearing + d });
  const keys = [[0, R(HOMEC, -6)], [3.6, R(HOMEC, 0)], [4.9, ST[0].cam], [8.3, R(ST[0].cam, 8)], [9.4, R(HOMEC, 6)], [10.0, R(HOMEC, 8)], [11.2, ST[1].cam], [14.3, R(ST[1].cam, 8)], [15.5, OUTC], [18, R(OUTC, 6)]];
  const camAt = t => { for (let k = 0; k < keys.length - 1; k++) { const [ta, a] = keys[k], [tb, b] = keys[k + 1]; if (t <= tb) return lerp(a, b, ease(cl(t, ta, tb))); } return keys[keys.length - 1][1]; };
  const LG = `<div class="lg"><span><i style="background:#3d7fc1"></i>new floor on a roof</span><span><i style="background:#2a9d8f"></i>new building</span><span><i style="border:2px dashed #d9603e;background:#fbe9e3"></i>what the plan allows</span></div>`;
  const card = s => { const p = s.p;
    if (p.use === "WA") { const b = p.buildings[0], f = flats(p.s2);
      return `<div class="ph">Parcel ${p.label} · ${b.addr} · residential</div><h2>One more floor fits on top</h2>
        <div class="st"><div><b>${b.st} → ${b.lim}</b><span>floors today → plan limit</span></div><div><b>+${fmt(p.s2)} m²</b><span>new floor area</span></div><div><b style="color:#2a9d8f">≈ ${f} flats</b><span>≈ ${fmt(f * 1.6)} people</span></div></div>${LG}`; }
    const j = p.s2 / 32, fm = flats(p.s2);
    return `<div class="ph">Parcel ${p.label} · ${p.buildings.length} buildings · commercial zone (GE)</div><h2>Lots of room, but no homes allowed</h2>
      <div class="st"><div><b>+${fmt(p.s2)} m²</b><span>roofs + a gap along the street</span></div><div><b style="color:#c27c22">≈ ${fmt(j)}</b><span>workplaces, if offices</span></div><div><b style="color:#1f7a6f">≈ ${fm}</b><span>flats, if homes were allowed</span></div></div>${LG}`; };
  let lastSel = -2, lastMu = null, lastG = -1, lastGe = -1;
  window.FILM = t => {
    window.__idle = false;
    const st = ST.find(s => t >= s.t0 && t < s.t1), i = st ? st.p.i : null;
    if (i !== lastSel) { APP.select(i); lastSel = i; lastG = lastGe = -1; }
    const ge = st ? ease(cl(t, st.t0 + 1.3, st.t0 + 2.1)) : 0, g = st ? ease(cl(t, st.t0 + 2.1, st.t0 + 3.1)) : 0;
    if (st && (Math.abs(g - lastG) > 1e-3 || Math.abs(ge - lastGe) > 1e-3)) { APP.grow(Math.max(0.001, g), Math.max(0.001, ge)); lastG = g; lastGe = ge; }
    const mu = t >= 15.0; if (mu !== lastMu) { APP.setMu(mu); lastMu = mu; }
    const c = camAt(t); map.jumpTo({ center: [c.lng, c.lat], zoom: c.zoom, pitch: c.pitch, bearing: c.bearing });
    const fade = (a, b, c2, d) => cl(t, a, b) * (1 - cl(t, c2, d));
    const kp = document.getElementById("kp"); kp.style.opacity = Math.max(fade(0.5, 1.1, 3.5, 3.9), fade(9.3, 9.8, 10.0, 10.4));
    const zl = document.getElementById("zl"), zk = Math.max(fade(0.3, 0.8, 3.4, 3.8), fade(8.8, 9.3, 9.9, 10.3), fade(3.9, 4.4, 7.9, 8.3), fade(10.3, 10.8, 13.9, 14.3));
    zl.textContent = t < 3.8 ? "The block · 26 parcels" : t < 8.6 ? "Zoom in · one building" : t < 10.2 ? "Zoom out · the block" : "Zoom in · the commercial strip";
    zl.style.opacity = zk;
    const pc = document.getElementById("pc");
    if (st) { const k = cl(t, st.t0 + 0.8, st.t0 + 1.4) * (1 - cl(t, st.t1 - 0.5, st.t1)); if (pc.dataset.l !== st.l) { pc.innerHTML = card(st); pc.dataset.l = st.l; }
      pc.style.opacity = k; pc.style.transform = `translateY(${(1 - k) * 18}px)`; } else pc.style.opacity = 0;
    const oc = document.getElementById("oc"), k = cl(t, 15.5, 16.2);
    if (!oc.innerHTML) oc.innerHTML = `<h2>If homes were allowed here too?</h2>
      <div class="cmp"><div><b style="color:#2a9d8f">≈ ${fmt(A.f)}</b><span>new flats with today's plan</span></div><div><b style="color:#1f7a6f">≈ ${fmt(M.f)}</b><span>if the commercial zone allowed homes</span></div></div>
      <p>Today the plan keeps most of this block for business: room for <b>≈ ${fmt(A.j)} workplaces</b>. Open any of the 26 parcels yourself: link in the post.</p>`;
    oc.style.opacity = k; oc.style.transform = `translateY(${(1 - k) * 30}px)`;
    map.once("idle", () => { window.__idle = true; }); map.triggerRepaint();
  };
  window.__fdone = true;
})();
