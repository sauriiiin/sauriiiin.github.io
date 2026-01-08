// ---- Global config ----
const TICK_WRAP_WIDTH = 30;

const HEAT_SOURCES = [
  "State and local government",
  "Institution funds",
  "Business",
  "Nonprofit organizations",
  "All other sources"
];

const PALETTE = [
  "#1f77b4","#ff7f0e","#2ca02c","#d62728","#9467bd",
  "#8c564b","#e377c2","#7f7f7f","#bcbd22","#17becf",
  "#aec7e8","#ffbb78","#98df8a","#ff9896","#c5b0d5"
];

const SOURCE_COLORS = {
  "Federal Government": "#1f77b4",
  "State and local government": "#ff7f0e",
  "Institution funds": "#2ca02c",
  "Business": "#d62728",
  "Nonprofit organizations": "#9467bd",
  "All other sources": "#8c564b"
};

// ---- Helpers ----
function formatShortUSD(v) {
  if (v == null || !isFinite(v)) return "";
  const av = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (av >= 1e12) return `${sign}$${(av/1e12).toFixed(av >= 1e13 ? 0 : 1)}T`;
  if (av >= 1e9)  return `${sign}$${(av/1e9).toFixed(av >= 1e10 ? 0 : 1)}B`;
  if (av >= 1e6)  return `${sign}$${(av/1e6).toFixed(av >= 1e7 ? 0 : 1)}M`;
  if (av >= 1e3)  return `${sign}$${(av/1e3).toFixed(av >= 1e4 ? 0 : 1)}K`;
  return `${sign}$${Math.round(av).toLocaleString()}`;
}

function applyDollarTicks(axis, maxVal) {
  const m = Math.max(0, maxVal || 0);
  if (!isFinite(m) || m === 0) return axis;

  const steps = 5;
  const rawStep = m / steps;

  // round step to 1/2/5 * 10^n
  const pow = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / pow;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  const step = nice * pow;

  const tickvals = [];
  for (let t = 0; t <= m + 1e-9; t += step) tickvals.push(t);

  const ticktext = tickvals.map(formatShortUSD);
  return { ...axis, tickmode: "array", tickvals, ticktext };
}

function wrapTick(s, width = TICK_WRAP_WIDTH) {
  const str = String(s ?? "");
  if (str.length <= width) return str;
  const words = str.split(/\s+/);
  let lines = [];
  let line = "";
  for (const w of words) {
    const next = line ? (line + " " + w) : w;
    if (next.length > width && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.join("<br>");
}

function uniq(arr) { return Array.from(new Set(arr)); }

function fmtDollar(x) {
  if (x == null || isNaN(x)) return "";
  return x.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function parseNumber(x) {
  if (x == null) return NaN;
  const v = String(x).replace(/,/g, "").trim();
  if (v === "") return NaN;
  return Number(v);
}

async function loadCSV(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  const text = await res.text();
  return d3.csvParse(text);
}

function colorMap(instList) {
  const m = new Map();
  instList.forEach((inst, i) => m.set(inst, PALETTE[i % PALETTE.length]));
  return m;
}

function denseRankDesc(values) {
  const sortedUniq = Array.from(new Set(values.slice().sort((a,b)=>b-a)));
  const map = new Map(sortedUniq.map((v,i)=>[v,i+1]));
  return values.map(v => map.get(v));
}

function windowAroundRank(sortedRows, selectedInst, n) {
  const idx = sortedRows.findIndex(r => r.institution === selectedInst);
  if (idx < 0) return sortedRows.slice(0, n);
  const half = Math.floor(n/2);
  const lo = Math.max(0, idx - half);
  const hi = Math.min(sortedRows.length, lo + n);
  return sortedRows.slice(lo, hi);
}

function normalizeSourceLabel(src) {
  const key = String(src).trim().toLowerCase().replace(/\s+/g," ");
  const map = new Map([
    ["all r d expenditures","All R&D Expenditures"],
    ["federal government","Federal Government"],
    ["state and local government","State and local government"],
    ["institution funds","Institution funds"],
    ["business","Business"],
    ["nonprofit organizations","Nonprofit organizations"],
    ["all other sources","All other sources"]
  ]);
  return map.get(key) || src;
}

function cleanFieldLabel(field) {
  const key = String(field).trim().toLowerCase().replace(/\s+/g," ");
  if (/^all\s/.test(key)) return null;
  let lab = key.replace(/\br\s*d\b/g, "R&D");
  lab = lab.replace(/\bnec\b/g, "NEC");
  lab = lab.split(" ").map(w => w ? (w[0].toUpperCase()+w.slice(1)) : w).join(" ");
  lab = lab.replace(/R&d/g, "R&D");
  return lab;
}

function baseLayout(overrides = {}) {
  return {
    margin: { l: 60, r: 10, t: 10, b: 60 },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    ...overrides
  };
}

const PLOT_CONFIG = { displayModeBar: true, responsive: true };

function renderTicks(containerElOrId, tickValues) {
  const elTicks =
    typeof containerElOrId === "string" ? document.getElementById(containerElOrId) : containerElOrId;
  if (!elTicks) return;

  elTicks.innerHTML = "";
  tickValues.forEach(v => {
    const s = document.createElement("span");
    s.textContent = String(v);
    elTicks.appendChild(s);
  });
}

function yearTickValues(yearMin, yearMax) {
  if (yearMin == null || yearMax == null) return [];
  if (yearMin === yearMax) return [yearMin];

  const span = yearMax - yearMin;
  const step = Math.max(1, Math.round(span / 4));

  const ticks = [
    yearMin,
    yearMin + step,
    yearMin + 2 * step,
    yearMin + 3 * step,
    yearMax
  ].map(x => Math.min(yearMax, Math.max(yearMin, x)));

  return Array.from(new Set(ticks));
}

// Track plot divs for resize
const plotDivs = new Set();
function registerPlotDiv(divEl) {
  if (!divEl) return;
  plotDivs.add(divEl);
}

function resizeAllPlots() {
  for (const div of plotDivs) {
    if (div && div.data && div.layout) {
      try { Plotly.Plots.resize(div); } catch (_) {}
    }
  }
}

function attachResizeObserver() {
  if (!("ResizeObserver" in window)) {
    window.addEventListener("resize", () => resizeAllPlots());
    return;
  }
  const ro = new ResizeObserver(() => resizeAllPlots());
  document.querySelectorAll(".plot-body, #heatGrid").forEach(n => ro.observe(n));
  document.querySelectorAll('button[data-bs-toggle="tab"]').forEach(btn => {
    btn.addEventListener("shown.bs.tab", () => setTimeout(resizeAllPlots, 50));
  });
}

function autosizeAllPlots() {
  for (const div of plotDivs) {
    if (!div) continue;
    try {
      Plotly.relayout(div, { autosize: true, height: null, width: null });
      Plotly.Plots.resize(div);
    } catch (_) {}
  }
}

// Fullscreen handler: fullscreen the parent card
function attachFullscreenHandlers() {
  let activeBtn = null;

  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".plot-fs");
    if (!btn) return;

    const card = btn.closest(".card");
    if (!card) return;

    try {
      if (!document.fullscreenElement) {
        activeBtn = btn;
        await card.requestFullscreen();
        btn.textContent = "Exit fullscreen";
        setTimeout(() => { resizeAllPlots(); autosizeAllPlots(); }, 150);
      } else {
        await document.exitFullscreen();
      }
    } catch (_) {}
  });

  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement && activeBtn) {
      activeBtn.textContent = "Fullscreen";
      activeBtn = null;
    }
    setTimeout(() => { resizeAllPlots(); autosizeAllPlots(); }, 150);
  });
}

// ---- Data ----
const DATA = {
  time: [],
  src2023: [],
  field2023: [],
  agency2023: [],
  sourcefield2023: []
};

// ---- App state ----
const state = {
  institutions: [],
  selected: [],
  metricTs: "Total",
  yearTs: 2023,
  topN: 25,
  includeAll: false,

  topNMix: 25,
  mixMode: "Percent",
  sourceRank: "Business",
  heatMode: "single",
  heatInst: null,

  fieldMetric: "All",
  fieldMode: "Dollars",

  searchRank: "",
  searchMix: "",
  searchPort: ""
};

// ---- DOM ----
const el = {};
function bindDom() {
  [
    "yearTs","yearTsLabel","topN","topNLabel","includeAllInst",
    "topNMix","topNMixLabel","sourceRank",
    "heatSingle","heatAll","heatInst","heatInstWrapper",
    "rankBar","rankWindow","bumpRank","trendLines",
    "sourceMix","topBySource","heatGrid",
    "fieldBar","agencyBar","scatterSizeShare",
    "loadStatus",
    "instSearchRank","instListRank",
    "instSearchMix","instListMix",
    "instSearchPort","instListPort",
    // tick-strip containers (must exist in index.html)
    "yearTsTicks","topNTicks","topNMixTicks"
  ].forEach(id => el[id] = document.getElementById(id));

  document.querySelectorAll('input[name="metricTs"]').forEach(r => {
    r.addEventListener("change", () => { state.metricTs = r.value; renderAll(); });
  });

  document.querySelectorAll('input[name="mixMode"]').forEach(r => {
    r.addEventListener("change", () => { state.mixMode = r.value; renderFunding(); });
  });

  document.querySelectorAll('input[name="heatMode"]').forEach(r => {
    r.addEventListener("change", () => {
      state.heatMode = r.value;
      renderHeatmapControls();
      renderHeatmaps();
    });
  });

  document.querySelectorAll('input[name="fieldMetric"]').forEach(r => {
    r.addEventListener("change", () => { state.fieldMetric = r.value; renderPortfolio(); });
  });

  document.querySelectorAll('input[name="fieldMode"]').forEach(r => {
    r.addEventListener("change", () => { state.fieldMode = r.value; renderPortfolio(); });
  });

  el.yearTs.addEventListener("input", () => {
    state.yearTs = Number(el.yearTs.value);
    el.yearTsLabel.textContent = state.yearTs;
    renderRankings();
  });

  el.topN.addEventListener("input", () => {
    state.topN = Number(el.topN.value);
    el.topNLabel.textContent = state.topN;
    renderRankings();
  });

  el.includeAllInst.addEventListener("change", () => {
    state.includeAll = el.includeAllInst.checked;
    renderAll();
  });

  el.topNMix.addEventListener("input", () => {
    state.topNMix = Number(el.topNMix.value);
    el.topNMixLabel.textContent = state.topNMix;
    renderFunding();
  });

  el.sourceRank.addEventListener("change", () => {
    state.sourceRank = el.sourceRank.value;
    renderFunding();
  });

  el.heatInst.addEventListener("change", () => {
    state.heatInst = el.heatInst.value;
    renderHeatmaps();
  });

  el.instSearchRank.addEventListener("input", () => {
    state.searchRank = el.instSearchRank.value || "";
    renderInstitutionLists();
  });
  el.instSearchMix.addEventListener("input", () => {
    state.searchMix = el.instSearchMix.value || "";
    renderInstitutionLists();
  });
  el.instSearchPort.addEventListener("input", () => {
    state.searchPort = el.instSearchPort.value || "";
    renderInstitutionLists();
  });
}

// ---- Institution selection UI ----
function toggleInstitution(inst) {
  const idx = state.selected.indexOf(inst);
  if (idx >= 0) state.selected.splice(idx, 1);
  else state.selected.push(inst);

  renderInstitutionLists();
  renderAll();
}

function renderInstitutionList(listEl, query) {
  const q = (query || "").trim().toLowerCase();
  const selectedSet = new Set(state.selected);

  let selected = state.selected.slice();
  let remaining = state.institutions.filter(i => !selectedSet.has(i)).sort((a,b)=>a.localeCompare(b));

  const filterFn = (inst) => q === "" || inst.toLowerCase().includes(q);

  selected = selected.filter(filterFn);
  remaining = remaining.filter(filterFn);

  const items = [...selected, ...remaining];

  listEl.innerHTML = "";
  items.forEach(inst => {
    const row = document.createElement("div");
    row.className = "inst-item" + (selectedSet.has(inst) ? " selected" : "");
    row.setAttribute("role", "option");
    row.setAttribute("aria-selected", selectedSet.has(inst) ? "true" : "false");

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = selectedSet.has(inst);

    const label = document.createElement("div");
    label.textContent = inst;

    row.appendChild(cb);
    row.appendChild(label);

    row.addEventListener("click", () => toggleInstitution(inst));
    listEl.appendChild(row);
  });
}

function renderInstitutionLists() {
  renderInstitutionList(el.instListRank, state.searchRank);
  renderInstitutionList(el.instListMix, state.searchMix);
  renderInstitutionList(el.instListPort, state.searchPort);
  renderHeatmapControls();
}

// ---- Heatmap controls ----
function renderHeatmapControls() {
  const sel = state.selected.length ? state.selected : [state.institutions[0]];
  el.heatInstWrapper.style.display = (state.heatMode === "single") ? "" : "none";

  el.heatInst.innerHTML = "";
  sel.forEach(inst => {
    const opt = document.createElement("option");
    opt.value = inst;
    opt.textContent = inst;
    el.heatInst.appendChild(opt);
  });

  if (!state.heatInst || !sel.includes(state.heatInst)) state.heatInst = sel[0];
  el.heatInst.value = state.heatInst;
}

// ---- Derived data ----
function filteredTimeSeries() {
  let rows = DATA.time.filter(r => r.measure_type === state.metricTs);
  if (!state.includeAll) rows = rows.filter(r => r.institution !== "All institutions");
  return rows;
}

function timeSeriesYearRows(year) {
  const rows = filteredTimeSeries().filter(r => r.year === year);
  const dollars = rows.map(r => r.dollars);
  const ranks = denseRankDesc(dollars);
  return rows.map((r, i) => ({ ...r, rank: ranks[i] }));
}

// ---- Rendering ----
function renderAll() {
  renderHeatmapControls();
  renderRankings();
  renderFunding();
  renderPortfolio();
  setTimeout(resizeAllPlots, 0);
}

function renderRankings() {
  renderRankBar();
  renderRankWindow();
  renderBumpRank();
  renderTrendLines();
}

function renderFunding() {
  renderSourceMix();
  renderTopBySource();
  renderHeatmaps();
}

function renderPortfolio() {
  renderFieldBar();
  renderAgencyBar();
  renderScatterSizeShare();
}

// ---- Rankings plots ----
function renderRankBar() {
  const selPrimary = state.selected[0] || state.institutions[0];
  const yearRows = timeSeriesYearRows(state.yearTs)
    .sort((a,b) => a.rank - b.rank || b.dollars - a.dollars || a.institution.localeCompare(b.institution))
    .slice(0, state.topN);

  const y = yearRows.map(r => r.institution).reverse();
  const x = yearRows.map(r => r.dollars).reverse();
  const custom = yearRows.map(r => r.institution).reverse();
  const alpha = yearRows.map(r => (r.institution === selPrimary ? 1.0 : 0.35)).reverse();

  const trace = {
    type: "bar",
    orientation: "h",
    x, y,
    customdata: custom,
    marker: { opacity: alpha },
    hovertemplate: `<b>%{customdata}</b><br>FY ${state.yearTs}: %{x:$,.0f}<extra></extra>`
  };

  const maxX = Math.max(0, ...x.filter(v => isFinite(v)));
  const layout = baseLayout({
    margin: { l: 220, r: 10, t: 10, b: 50 },
    xaxis: applyDollarTicks({ title: "Expenditures", automargin: true }, maxX),
    yaxis: {
      title: "",
      tickmode: "array",
      tickvals: y,
      ticktext: y.map(v => wrapTick(v)),
      automargin: true
    }
  });

  Plotly.react(el.rankBar, [trace], layout, PLOT_CONFIG);
  registerPlotDiv(el.rankBar);

  el.rankBar.on("plotly_click", (ev) => {
    const inst = ev?.points?.[0]?.customdata;
    if (!inst) return;
    state.selected = [inst];
    renderInstitutionLists();
    renderAll();
  });
}

function renderRankWindow() {
  const sel = state.selected;
  if (!sel.length) { Plotly.purge(el.rankWindow); return; }

  const base = timeSeriesYearRows(state.yearTs)
    .sort((a,b) => a.rank - b.rank || b.dollars - a.dollars || a.institution.localeCompare(b.institution));

  let rows;
  if (sel.length > 1) {
    const set = new Set(sel);
    rows = base.filter(r => set.has(r.institution));
  } else {
    rows = windowAroundRank(base, sel[0], state.topN);
  }

  const y = rows.map(r => r.institution).reverse();
  const x = rows.map(r => r.dollars).reverse();

  const op = sel.length > 1 ? 1.0 : y.map(v => (v === sel[0] ? 1.0 : 0.35));

  const trace = {
    type: "bar",
    orientation: "h",
    x, y,
    marker: { opacity: op },
    hovertemplate: `<b>%{y}</b><br>FY ${state.yearTs}: %{x:$,.0f}<extra></extra>`
  };

  const maxX = Math.max(0, ...x.filter(v => isFinite(v)));
  const layout = baseLayout({
    margin: { l: 220, r: 10, t: 10, b: 50 },
    xaxis: applyDollarTicks({ title: "Expenditures", automargin: true }, maxX),
    yaxis: {
      title: "",
      tickmode: "array",
      tickvals: y,
      ticktext: y.map(v => wrapTick(v)),
      automargin: true
    }
  });

  Plotly.react(el.rankWindow, [trace], layout, PLOT_CONFIG);
  registerPlotDiv(el.rankWindow);
}

function renderBumpRank() {
  const sel = state.selected;
  if (!sel.length) { Plotly.purge(el.bumpRank); return; }

  const cmap = colorMap(sel);
  const rows = filteredTimeSeries();

  const byYear = new Map();
  for (const r of rows) {
    const k = r.year;
    if (!byYear.has(k)) byYear.set(k, []);
    byYear.get(k).push(r);
  }

  const rankMap = new Map();
  for (const [year, arr] of byYear.entries()) {
    const dollars = arr.map(d => d.dollars);
    const ranks = denseRankDesc(dollars);
    const m = new Map();
    arr.forEach((d,i) => m.set(d.institution, ranks[i]));
    rankMap.set(year, m);
  }

  const institutions = uniq(rows.map(r => r.institution));
  const years = Array.from(rankMap.keys()).sort((a,b)=>a-b);

  const xGrey = [];
  const yGrey = [];
  institutions.forEach(inst => {
    years.forEach(y => {
      const rm = rankMap.get(y);
      if (!rm || !rm.has(inst)) return;
      xGrey.push(y);
      yGrey.push(rm.get(inst));
    });
    xGrey.push(null);
    yGrey.push(null);
  });

  const traces = [{
    type: "scattergl",
    mode: "lines",
    x: xGrey,
    y: yGrey,
    line: { color: "rgba(140,140,140,0.20)", width: 1 },
    hoverinfo: "skip",
    showlegend: false
  }];

  sel.forEach(inst => {
    const xs = [];
    const ys = [];
    years.forEach(y => {
      const rm = rankMap.get(y);
      if (!rm || !rm.has(inst)) return;
      xs.push(y);
      ys.push(rm.get(inst));
    });
    traces.push({
      type: "scatter",
      mode: "lines+markers",
      name: inst,
      x: xs,
      y: ys,
      line: { color: cmap.get(inst), width: 4 },
      marker: { color: cmap.get(inst), size: 7 },
      hovertemplate: `<b>${inst}</b><br>Year: %{x}<br>Rank: %{y}<extra></extra>`
    });
  });

  const layout = baseLayout({
    margin: { l: 60, r: 10, t: 10, b: 60 },
    xaxis: { title: "Fiscal year", automargin: true },
    yaxis: { title: "Rank (lower is better)", autorange: "reversed", automargin: true },
    legend: { orientation: "h" }
  });

  Plotly.react(el.bumpRank, traces, layout, PLOT_CONFIG);
  registerPlotDiv(el.bumpRank);
}

function renderTrendLines() {
  const sel = state.selected;
  if (!sel.length) { Plotly.purge(el.trendLines); return; }

  const cmap = colorMap(sel);
  const rows = filteredTimeSeries().filter(r => sel.includes(r.institution));

  const traces = sel.map(inst => {
    const instRows = rows.filter(r => r.institution === inst).sort((a,b)=>a.year-b.year);
    return {
      type: "scatter",
      mode: "lines+markers",
      name: inst,
      x: instRows.map(r => r.year),
      y: instRows.map(r => r.dollars),
      line: { color: cmap.get(inst) },
      marker: { color: cmap.get(inst) },
      hovertemplate: `<b>${inst}</b><br>Year: %{x}<br>Expenditures: %{y:$,.0f}<extra></extra>`
    };
  });

  const maxY = Math.max(0, ...rows.map(r => r.dollars).filter(v => isFinite(v)));
  const layout = baseLayout({
    margin: { l: 60, r: 10, t: 10, b: 60 },
    xaxis: { title: "Fiscal year", automargin: true },
    yaxis: applyDollarTicks({ title: "Expenditures", automargin: true }, maxY)
  });

  Plotly.react(el.trendLines, traces, layout, PLOT_CONFIG);
  registerPlotDiv(el.trendLines);
}

// ---- Funding plots ----
function renderSourceMix() {
  const sel = state.selected;
  if (!sel.length) { Plotly.purge(el.sourceMix); return; }

  const selPrimary = sel[0];

  const rows = DATA.src2023
    .filter(r => r.institution !== "All institutions")
    .map(r => ({ ...r, source_label: normalizeSourceLabel(r.source) }));

  const totalsAll = rows
    .filter(r => r.source_label === "All R&D Expenditures")
    .map(r => ({ institution: r.institution, total: r.dollars }))
    .sort((a, b) => b.total - a.total);

  const totalMap = new Map(totalsAll.map(r => [r.institution, r.total]));

  let showInst;
  if (sel.length > 1) {
    const set = new Set(sel);
    showInst = totalsAll.filter(r => set.has(r.institution));
  } else {
    const win = windowAroundRank(totalsAll, selPrimary, state.topNMix);
    showInst = win.slice().sort((a, b) => (b.total - a.total) || a.institution.localeCompare(b.institution));
  }

  if (!showInst.length) { Plotly.purge(el.sourceMix); return; }

  const showOrder = showInst
    .slice()
    .sort((a, b) => (b.total - a.total) || a.institution.localeCompare(b.institution))
    .map(r => r.institution);

  const showSet = new Set(showOrder);
  const selSet = new Set(sel);

  const sourceInstDollar = new Map();
  for (const r of rows) {
    if (!showSet.has(r.institution)) continue;
    if (r.source_label === "All R&D Expenditures") continue;
    if (!sourceInstDollar.has(r.source_label)) sourceInstDollar.set(r.source_label, new Map());
    sourceInstDollar.get(r.source_label).set(r.institution, r.dollars);
  }

  const SOURCE_ORDER = [
    "Federal Government",
    "State and local government",
    "Institution funds",
    "Business",
    "Nonprofit organizations",
    "All other sources"
  ].filter(s => sourceInstDollar.has(s));

  const traces = [];

  for (const src of SOURCE_ORDER) {
    const m = sourceInstDollar.get(src);
    const color = SOURCE_COLORS[src] || "#999999";
  
    const yGrey = [];
    const ySel  = [];
  
    for (const inst of showOrder) {
      const dollars = m.get(inst) ?? 0;
      const tot = totalMap.get(inst) ?? 0;
      const val = state.mixMode === "Percent" ? (tot > 0 ? dollars / tot : null) : dollars;
  
      if (selSet.has(inst)) {
        yGrey.push(null);
        ySel.push(val);
      } else {
        yGrey.push(val);
        ySel.push(null);
      }
    }
  
    traces.push({
      type: "bar",
      name: src,
      legendgroup: src,
      showlegend: false,
      opacity: 0.35,
      x: showOrder,
      y: yGrey,
      marker: { color },
      hovertemplate: state.mixMode === "Percent"
        ? `<b>%{x}</b><br>%{fullData.name}: %{y:.1%}<extra></extra>`
        : `<b>%{x}</b><br>%{fullData.name}: %{y:$,.0f}<extra></extra>`
    });
  
    traces.push({
      type: "bar",
      name: src,
      legendgroup: src,
      showlegend: true,
      opacity: 1.0,
      x: showOrder,
      y: ySel,
      marker: { color },
      hovertemplate: state.mixMode === "Percent"
        ? `<b>%{x}</b><br>%{fullData.name}: %{y:.1%}<extra></extra>`
        : `<b>%{x}</b><br>%{fullData.name}: %{y:$,.0f}<extra></extra>`
    });
  }

  const xText = showOrder.map(v => wrapTick(v));

  let yaxis;
  if (state.mixMode === "Percent") {
    yaxis = { title: "Share", tickformat: ".0%", automargin: true };
  } else {
    const totalsShown = showOrder.map(inst => totalMap.get(inst) ?? 0);
    const maxVal = Math.max(0, ...totalsShown.filter(v => isFinite(v)));
    yaxis = applyDollarTicks({ title: "Dollars", automargin: true }, maxVal);
  }

  const layout = baseLayout({
    barmode: "stack",
    margin: { l: 60, r: 220, t: 10, b: 110 },

    xaxis: {
      tickmode: "array",
      tickvals: showOrder,
      ticktext: xText,
      automargin: true,
      categoryorder: "array",
      categoryarray: showOrder
    },

    yaxis,

    legend: {
      orientation: "v",
      x: 1.02,
      xanchor: "left",
      y: 1,
      yanchor: "top",
      traceorder: "normal"
    }
  });

  Plotly.react(el.sourceMix, traces, layout, PLOT_CONFIG);
  registerPlotDiv(el.sourceMix);
}

function renderTopBySource() {
  const sel = state.selected;
  if (!sel.length) { Plotly.purge(el.topBySource); return; }
  const selPrimary = sel[0];

  const srcLabel = state.sourceRank;
  const srcKey = srcLabel.trim().toLowerCase();

  const rows = DATA.src2023
    .filter(r => r.institution !== "All institutions")
    .map(r => ({
      institution: r.institution,
      source_label: normalizeSourceLabel(r.source),
      dollars: r.dollars
    }))
    .filter(r => r.source_label.trim().toLowerCase() === srcKey);

  if (!rows.length) {
    Plotly.react(el.topBySource, [], baseLayout({
      annotations: [{text:`No rows found for source: ${srcLabel}`, showarrow:false}]
    }), PLOT_CONFIG);
    registerPlotDiv(el.topBySource);
    return;
  }

  rows.sort((a,b)=>b.dollars-a.dollars);
  rows.forEach((r,i)=>r.rank=i+1);

  let view;
  if (sel.length > 1) {
    const set = new Set(sel);
    view = rows.filter(r => set.has(r.institution)).sort((a,b)=>a.rank-b.rank);
  } else {
    view = windowAroundRank(rows.sort((a,b)=>a.rank-b.rank), selPrimary, state.topNMix);
  }

  if (!view.length) { Plotly.purge(el.topBySource); return; }

    // Use the same source color scheme as the funding-mix chart
  const sourceColor = SOURCE_COLORS[srcLabel] || "#999999";

  const y = view.map(r => r.institution).reverse();
  const x = view.map(r => r.dollars).reverse();

  // Highlight selected institutions via opacity, NOT color
  const selSet = new Set(sel);
  const opacities = y.map(inst => (selSet.has(inst) ? 1.0 : 0.35));

  const trace = {
    type: "bar",
    orientation: "h",
    x, y,
    marker: { color: sourceColor, opacity: opacities },
    hovertemplate: `<b>%{y}</b><br>FY 2023 (${srcLabel}): %{x:$,.0f}<extra></extra>`
  };

  const maxX = Math.max(0, ...x.filter(v => isFinite(v)));
  const layout = baseLayout({
    margin: { l: 220, r: 10, t: 10, b: 50 },
    xaxis: applyDollarTicks({ title:"Dollars", automargin:true }, maxX),
    yaxis: { tickmode:"array", tickvals:y, ticktext:y.map(v=>wrapTick(v)), automargin:true }
  });

  Plotly.react(el.topBySource, [trace], layout, PLOT_CONFIG);
  registerPlotDiv(el.topBySource);
}

function makeHeatmapDiv(id) {
  const d = document.createElement("div");
  d.id = id;
  d.className = "plot";
  return d;
}

function renderHeatmaps() {
  const sel = state.selected;
  if (!sel.length) { el.heatGrid.innerHTML=""; return; }

  el.heatGrid.innerHTML = "";

  if (state.heatMode === "single") {
    const inst = state.heatInst || sel[0];
    const div = makeHeatmapDiv("heatSinglePlot");
    el.heatGrid.appendChild(div);
    renderHeatmapForInstitution(div, inst);
  } else {
    sel.forEach((inst, i) => {
      const div = makeHeatmapDiv(`heat_${i}`);
      el.heatGrid.appendChild(div);
      renderHeatmapForInstitution(div, inst);
    });
  }
}

function renderHeatmapForInstitution(divEl, inst) {
  const rows = DATA.sourcefield2023
    .filter(r => r.institution === inst && HEAT_SOURCES.includes(r.source))
    .map(r => ({ source: r.source, field: String(r.field).trim(), dollars: r.dollars }))
    .filter(r => !/^all\s/i.test(r.field));

  if (!rows.length) {
    Plotly.react(divEl, [], baseLayout({ annotations:[{text:"No data", showarrow:false}] }), PLOT_CONFIG);
    registerPlotDiv(divEl);
    return;
  }

  const fields = uniq(rows.map(r=>r.field));
  const sources = HEAT_SOURCES;

  const zRaw = sources.map(src =>
    fields.map(f => {
      const r = rows.find(rr => rr.source===src && rr.field===f);
      return r ? r.dollars : 0;
    })
  );

  const z = zRaw.map(row => row.map(v => Math.log10(v + 1)));
  const hovertext = zRaw.map(row => row.map(v => fmtDollar(v)));

  const trace = {
    type: "heatmap",
    x: fields,
    y: sources,
    z,
    colorscale: [
      [0.00, "#f7fbff"],
      [0.25, "#c6dbef"],
      [0.50, "#6baed6"],
      [0.75, "#2171b5"],
      [1.00, "#08306b"]
    ],
    zmin: 0,
    hovertext,
    hovertemplate: "<b>%{y}</b><br>%{x}<br>Dollars: %{hovertext}<extra></extra>",
    colorbar: { title: "log10($+1)" }
  };

  const layout = baseLayout({
    title: { text: inst, x: 0, xanchor: "left" },
    margin: { l: 140, r: 10, t: 40, b: 110 },
    xaxis: { tickmode: "array", tickvals: fields, ticktext: fields.map(f => wrapTick(f)), automargin: true },
    yaxis: { automargin: true }
  });

  Plotly.react(divEl, [trace], layout, PLOT_CONFIG);
  registerPlotDiv(divEl);
}

// ---- Portfolio plots ----
function renderFieldBar() {
  const sel = state.selected;
  if (!sel.length) { Plotly.purge(el.fieldBar); return; }

  const cmap = colorMap(sel);

  let rows = DATA.field2023
    .filter(r => sel.includes(r.institution) && r.measure_type === state.fieldMetric)
    .map(r => ({...r, field_label: cleanFieldLabel(r.field)}))
    .filter(r => r.field_label);

  if (!rows.length) { Plotly.purge(el.fieldBar); return; }

  if (state.fieldMode === "Percent") {
    const byInst = new Map();
    rows.forEach(r => byInst.set(r.institution, (byInst.get(r.institution)||0) + r.dollars));
    rows = rows.map(r => ({...r, value: (byInst.get(r.institution) > 0) ? (r.dollars / byInst.get(r.institution)) : null}));
  } else {
    rows = rows.map(r => ({...r, value: r.dollars}));
  }

  const totals = new Map();
  rows.forEach(r => totals.set(r.field_label, (totals.get(r.field_label)||0) + r.dollars));
  const fieldOrder = Array.from(totals.entries()).sort((a,b)=>b[1]-a[1]).map(d=>d[0]);

  const traces = sel.map(inst => {
    const instRows = rows.filter(r=>r.institution===inst);
    const y = fieldOrder.slice().reverse();
    const mapVal = new Map(instRows.map(r=>[r.field_label, r.value]));
    return {
      type: "bar",
      orientation: "h",
      name: inst,
      x: y.map(f => mapVal.get(f) ?? 0),
      y,
      marker: { color: cmap.get(inst) },
      hovertemplate: state.fieldMode==="Percent"
        ? "<b>%{y}</b><br>%{fullData.name}<br>%{x:.1%}<extra></extra>"
        : "<b>%{y}</b><br>%{fullData.name}<br>%{x:$,.0f}<extra></extra>"
    };
  });

  const maxVal = state.fieldMode === "Percent"
    ? 1
    : Math.max(0, ...rows.map(r => r.value).filter(v => isFinite(v)));

  const layout = baseLayout({
    barmode: "group",
    margin: { l: 260, r: 10, t: 10, b: 120 },
    xaxis: state.fieldMode==="Percent"
      ? { title:"Share", tickformat:".0%", automargin:true }
      : applyDollarTicks({ title:"Dollars", automargin:true }, maxVal),
    yaxis: { title: "Field", tickmode: "array", tickvals: fieldOrder.slice().reverse(), ticktext: fieldOrder.slice().reverse().map(v=>wrapTick(v)), automargin: true },
    legend: { orientation:"h", x:0, xanchor:"left", y:-0.25, yanchor:"top" }
  });

  Plotly.react(el.fieldBar, traces, layout, PLOT_CONFIG);
  registerPlotDiv(el.fieldBar);
}

function renderAgencyBar() {
  const sel = state.selected;
  if (!sel.length) { Plotly.purge(el.agencyBar); return; }

  const cmap = colorMap(sel);

  let rows = DATA.agency2023
    .filter(r => sel.includes(r.institution))
    .map(r => ({...r, agency_label: String(r.agency).trim().toUpperCase()}))
    .filter(r => r.agency_label !== "ALL FEDERAL R&D EXPENDITURES");

  if (!rows.length) { Plotly.purge(el.agencyBar); return; }

  const totals = new Map();
  rows.forEach(r => totals.set(r.agency_label, (totals.get(r.agency_label)||0) + r.dollars));
  const agencyOrder = Array.from(totals.entries()).sort((a,b)=>b[1]-a[1]).map(d=>d[0]);

  const traces = sel.map(inst => {
    const instRows = rows.filter(r=>r.institution===inst);
    const y = agencyOrder.slice().reverse();
    const mapVal = new Map(instRows.map(r=>[r.agency_label, r.dollars]));
    return {
      type: "bar",
      orientation: "h",
      name: inst,
      x: y.map(a => mapVal.get(a) ?? 0),
      y,
      marker: { color: cmap.get(inst) },
      hovertemplate: "<b>%{y}</b><br>%{fullData.name}<br>%{x:$,.0f}<extra></extra>"
    };
  });

  const maxX = Math.max(0, ...rows.map(r => r.dollars).filter(v => isFinite(v)));
  const layout = baseLayout({
    barmode: "group",
    margin: { l: 260, r: 10, t: 10, b: 120 },
    xaxis: applyDollarTicks({ title:"Dollars", automargin:true }, maxX),
    yaxis: { title: "Federal agency", tickmode: "array", tickvals: agencyOrder.slice().reverse(), ticktext: agencyOrder.slice().reverse().map(v=>wrapTick(v)), automargin: true },
    legend: { orientation:"h", x:0, xanchor:"left", y:-0.25, yanchor:"top" }
  });

  Plotly.react(el.agencyBar, traces, layout, PLOT_CONFIG);
  registerPlotDiv(el.agencyBar);
}

function renderScatterSizeShare() {
  const sel = state.selected;
  const cmap = colorMap(sel);

  const rows = DATA.src2023
    .filter(r => r.institution !== "All institutions")
    .map(r => ({...r, source_label: normalizeSourceLabel(r.source)}));

  const totals = rows.filter(r=>r.source_label==="All R&D Expenditures")
    .map(r=>({institution:r.institution, total:r.dollars}));
  const fed = rows.filter(r=>r.source_label==="Federal Government")
    .map(r=>({institution:r.institution, federal:r.dollars}));

  const fedMap = new Map(fed.map(r=>[r.institution, r.federal]));
  const pts = totals
    .filter(r=>fedMap.has(r.institution))
    .map(r => ({ institution: r.institution, total: r.total, share: fedMap.get(r.institution) / r.total }));

  const selSet = new Set(sel);
  const bg = pts.filter(p=>!selSet.has(p.institution));

  const traces = [];

  if (bg.length) {
    traces.push({
      type: "scattergl",
      mode: "markers",
      x: bg.map(p=>p.total),
      y: bg.map(p=>p.share),
      marker: { color:"rgba(140,140,140,0.25)", size:7 },
      text: bg.map(p=>p.institution),
      hovertemplate: "<b>%{text}</b><br>Total: %{x:$,.0f}<br>Federal share: %{y:.1%}<extra></extra>",
      showlegend: false
    });
  }

  sel.forEach(inst => {
    const p = pts.find(pp=>pp.institution===inst);
    if (!p) return;
    traces.push({
      type: "scatter",
      mode: "markers",
      name: inst,
      x: [p.total],
      y: [p.share],
      marker: { color:cmap.get(inst), size:12 },
      text: [inst],
      hovertemplate: "<b>%{text}</b><br>Total: %{x:$,.0f}<br>Federal share: %{y:.1%}<extra></extra>"
    });
  });

  const maxTotal = Math.max(0, ...pts.map(p => p.total).filter(v => isFinite(v)));
  const layout = baseLayout({
    margin: { l: 60, r: 10, t: 10, b: 90 },
    xaxis: applyDollarTicks({ title:"Total R&D (FY 2023)", automargin:true }, maxTotal),
    yaxis: { title:"Federal share (FY 2023)", tickformat:".0%", automargin:true },
    legend: { orientation:"h", x:0, xanchor:"left", y:-0.2, yanchor:"top" }
  });

  Plotly.react(el.scatterSizeShare, traces, layout, PLOT_CONFIG);
  registerPlotDiv(el.scatterSizeShare);
}

// ---- Init ----
async function init() {
  try {
    el.loadStatus.textContent = "Loading data…";

    const [
      timeRaw, srcRaw, fieldRaw, agencyRaw, sourcefieldRaw
    ] = await Promise.all([
      loadCSV("data_model/fact_time_series.csv"),
      loadCSV("data_model/fact_2023_source.csv"),
      loadCSV("data_model/fact_2023_field.csv"),
      loadCSV("data_model/fact_2023_agency.csv"),
      loadCSV("data_model/fact_2023_sourcefield.csv")
    ]);

    DATA.time = timeRaw.map(r => ({
      institution: r.institution,
      year: Number(r.year),
      measure_type: r.measure_type,
      dollars: parseNumber(r.dollars)
    }));

    DATA.src2023 = srcRaw.map(r => ({
      institution: r.institution,
      source: r.source,
      dollars: parseNumber(r.dollars)
    }));

    DATA.field2023 = fieldRaw.map(r => ({
      institution: r.institution,
      measure_type: r.measure_type,
      field: r.field,
      dollars: parseNumber(r.dollars)
    }));

    DATA.agency2023 = agencyRaw.map(r => ({
      institution: r.institution,
      agency: r.agency,
      dollars: parseNumber(r.dollars)
    }));

    DATA.sourcefield2023 = sourcefieldRaw.map(r => ({
      institution: r.institution,
      source: r.source,
      field: r.field,
      dollars: parseNumber(r.dollars)
    }));

    state.institutions = uniq(DATA.time.map(r=>r.institution)).sort();

    const defaultInst = state.institutions.includes("Johns Hopkins U")
      ? "Johns Hopkins U"
      : state.institutions[0];

    state.selected = [defaultInst];

    const years = uniq(DATA.time.map(r=>r.year)).sort((a,b)=>a-b);
    const yearMin = years[0], yearMax = years[years.length-1];
    state.yearTs = Math.min(2023, yearMax);

    // Configure sliders
    el.yearTs.min = yearMin;
    el.yearTs.max = yearMax;
    el.yearTs.step = 1;
    el.yearTs.value = state.yearTs;
    el.yearTsLabel.textContent = state.yearTs;

    el.topN.value = state.topN;
    el.topNLabel.textContent = state.topN;

    el.topNMix.value = state.topNMix;
    el.topNMixLabel.textContent = state.topNMix;

    renderTicks(el.topNTicks, [10, 25, 50, 75, 100]);
    renderTicks(el.topNMixTicks, [10, 25, 50, 75, 100]);
    renderTicks(el.yearTsTicks, yearTickValues(yearMin, yearMax));

    el.loadStatus.textContent = "Loaded";

    renderInstitutionLists();
    renderAll();

    attachResizeObserver();
    attachFullscreenHandlers();
    setTimeout(resizeAllPlots, 50);
  } catch (e) {
    console.error(e);
    el.loadStatus.textContent = "Load failed";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  bindDom();
  init();
});
