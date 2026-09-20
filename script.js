/* =========================================================
   SKYWATCH — script.js
   1 Config  2 Utils  3 Settings  4 Formatting  5 Weather codes
   6 Weather icons  7 Live scene  8 Sounds  9 Voice  10 API
   11 Home  12 Forecast page  13 News  14 Radar & Maps
   15 Settings UI  16 Search & location  17 Router & init
========================================================= */
"use strict";

/* ---------- 1. CONFIG ---------- */
const API = {
  geo: "https://geocoding-api.open-meteo.com/v1/search",
  forecast: "https://api.open-meteo.com/v1/forecast",
  air: "https://air-quality-api.open-meteo.com/v1/air-quality",
  reverse: "https://nominatim.openstreetmap.org/reverse",
  radar: "https://api.rainviewer.com/public/weather-maps.json"
};

const DEFAULT_CITY = { name: "Bahawalpur", admin1: "Punjab", country: "Pakistan", latitude: 29.3956, longitude: 71.6836, timezone: "Asia/Karachi" };

const DEFAULTS = {
  tempUnit: "c", windUnit: "kmh", pressureUnit: "hpa", clock: "12",
  voiceOn: true, voiceLang: "en", voiceName: "", voiceRate: 1, voicePitch: 1, autoSpeak: false,
  soundOn: false, soundVol: 0.5,
  sceneStyle: "golden", motion: "auto", quality: "balanced", autoRefresh: "15"
};

const PK_CITIES = [
  ["Karachi", 24.8607, 67.0011], ["Lahore", 31.5204, 74.3587], ["Islamabad", 33.6844, 73.0479], ["Rawalpindi", 33.5651, 73.0169],
  ["Faisalabad", 31.4504, 73.135], ["Multan", 30.1575, 71.5249], ["Bahawalpur", 29.3956, 71.6836], ["Rahim Yar Khan", 28.4202, 70.2952],
  ["Peshawar", 34.0151, 71.5249], ["Quetta", 30.1798, 66.975], ["Hyderabad", 25.396, 68.3578], ["Sukkur", 27.7052, 68.8574],
  ["Sialkot", 32.4945, 74.5229], ["Gujranwala", 32.1877, 74.1945], ["Sargodha", 32.0836, 72.6711], ["Gilgit", 35.9208, 74.308],
  ["Skardu", 35.2971, 75.6333], ["Murree", 33.907, 73.3943], ["Jacobabad", 28.2769, 68.4514], ["Dera Ghazi Khan", 30.0489, 70.6455],
  ["Gwadar", 25.1216, 62.3254], ["Abbottabad", 34.1688, 73.2215]
];
const WORLD_CITIES = [
  ["London", 51.5074, -0.1278], ["New York", 40.7128, -74.006], ["Dubai", 25.2048, 55.2708], ["Riyadh", 24.7136, 46.6753],
  ["Istanbul", 41.0082, 28.9784], ["Delhi", 28.6139, 77.209], ["Beijing", 39.9042, 116.4074], ["Tokyo", 35.6762, 139.6503],
  ["Sydney", -33.8688, 151.2093], ["Paris", 48.8566, 2.3522], ["Cairo", 30.0444, 31.2357], ["Moscow", 55.7558, 37.6173],
  ["Toronto", 43.6532, -79.3832], ["Singapore", 1.3521, 103.8198], ["Kuala Lumpur", 3.139, 101.6869], ["Los Angeles", 34.0522, -118.2437],
  ["São Paulo", -23.5505, -46.6333], ["Johannesburg", -26.2041, 28.0473], ["Nairobi", -1.2921, 36.8219], ["Doha", 25.2854, 51.531],
  ["Jeddah", 21.4858, 39.1925], ["Dhaka", 23.8103, 90.4125], ["Kabul", 34.5553, 69.2075], ["Tehran", 35.6892, 51.389]
];

/* ---------- 2. UTILS ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const pad = n => String(n).padStart(2, "0");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const icon = (name, cls = "") => `<svg class="i ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

async function getJSON(url, { timeout = 12000, retries = 1 } = {}) {
  for (let a = 0; a <= retries; a++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeout);
    try {
      const r = await fetch(url, { signal: ctl.signal });
      clearTimeout(timer);
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } catch (e) {
      clearTimeout(timer);
      if (a === retries) throw e;
      await sleep(700);
    }
  }
}

/* ---------- 3. SETTINGS & STATE ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem("skywatch:" + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("skywatch:" + k, JSON.stringify(v)); } catch { /* storage blocked */ } },
  del(k) { try { localStorage.removeItem("skywatch:" + k); } catch { /* ignore */ } }
};
let settings = Object.assign({}, DEFAULTS, store.get("settings", {}));
settings.autoRefresh = String(settings.autoRefresh);

const state = {
  city: null, weather: null, air: null, page: "home", rid: 0,
  selectedDay: 0, offset: 18000, lastUpdated: null,
  favorites: store.get("favorites", []), recents: store.get("recents", []),
  news: [], newsCat: "all", fcMetric: "temp", cityUr: null, radarFrames: []
};
const locKey = l => `${(+l.latitude).toFixed(2)},${(+l.longitude).toFixed(2)}`;

/* ---------- 4. FORMATTING ---------- */
const toF = c => c * 9 / 5 + 32;
const fmt = {
  t: c => (c == null || isNaN(c)) ? "--" : Math.round(settings.tempUnit === "f" ? toF(c) : c),
  tu: c => fmt.t(c) + "°",
  wind(kmh) {
    if (kmh == null) return "--";
    if (settings.windUnit === "mph") return Math.round(kmh * 0.621371) + " mph";
    if (settings.windUnit === "ms") return (kmh / 3.6).toFixed(1) + " m/s";
    return Math.round(kmh) + " km/h";
  },
  pressure(h) {
    if (h == null) return "--";
    if (settings.pressureUnit === "inhg") return (h * 0.02953).toFixed(2) + " inHg";
    if (settings.pressureUnit === "mmhg") return Math.round(h * 0.750062) + " mmHg";
    return Math.round(h) + " hPa";
  },
  vis(m) {
    if (m == null) return "N/A";
    const km = m / 1000;
    if (settings.windUnit === "mph") { const mi = km * 0.621371; return (mi >= 10 ? Math.round(mi) : mi.toFixed(1)) + " mi"; }
    return (km >= 10 ? Math.round(km) : km.toFixed(1)) + " km";
  },
  mm: v => (v == null ? "--" : (v < 10 ? v.toFixed(1) : Math.round(v)) + " mm")
};
function hm(h, m) {
  if (settings.clock === "24") return pad(h) + ":" + pad(m);
  return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? "PM" : "AM"}`;
}
const hourLabel = h => settings.clock === "24" ? pad(h) + ":00" : `${h % 12 || 12} ${h >= 12 ? "PM" : "AM"}`;
const isoHM = iso => { if (!iso) return "--"; const t = iso.split("T")[1] || "0:0"; const [h, m] = t.split(":").map(Number); return hm(h, m); };
const cityNow = () => new Date(Date.now() + state.offset * 1000);
const isoDate = iso => new Date(iso.split("T")[0] + "T12:00:00Z");
const dayShort = d => DAYS[d.getUTCDay()];
const dateShort = d => `${pad(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]}`;
const windDir = deg => deg == null ? "" : ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(deg / 45) % 8];
const uvLevel = u => u <= 2 ? "Low" : u <= 5 ? "Moderate" : u <= 7 ? "High" : u <= 10 ? "Very High" : "Extreme";
const aqiLevel = a => a <= 50 ? "Good" : a <= 100 ? "Moderate" : a <= 150 ? "Unhealthy for Sensitive Groups" : a <= 200 ? "Unhealthy" : a <= 300 ? "Very Unhealthy" : "Hazardous";
const aqiShort = a => a <= 50 ? "Good" : a <= 100 ? "Moderate" : a <= 150 ? "Sensitive" : a <= 200 ? "Unhealthy" : a <= 300 ? "Very Unhealthy" : "Hazardous";
const aqiColor = a => a <= 50 ? "#37d48a" : a <= 100 ? "#e6d53c" : a <= 150 ? "#ffab3c" : a <= 200 ? "#ff6a4d" : a <= 300 ? "#d9508f" : "#a5305c";
const aqiText = a => a <= 50 ? "Air quality is satisfactory." : a <= 100 ? "Air quality is acceptable for most people." : a <= 150 ? "Sensitive people should limit long outdoor activity." : a <= 200 ? "Everyone may begin to feel health effects." : a <= 300 ? "Health alert: avoid outdoor exertion." : "Emergency conditions. Stay indoors.";

/* ---------- 5. WEATHER CODES ---------- */
const WX = {
  0: ["clear", "Sunny", "صاف اور دھوپ والا", "saaf aur dhoop wala"],
  1: ["mostly", "Mostly Sunny", "زیادہ تر صاف", "zyada tar saaf"],
  2: ["partly", "Partly Cloudy", "جزوی طور پر ابر آلود", "juzwi taur par abr aalood"],
  3: ["cloudy", "Cloudy", "ابر آلود", "abr aalood"],
  45: ["fog", "Foggy", "دھند", "dhund"], 48: ["fog", "Freezing Fog", "یخ بستہ دھند", "yakh basta dhund"],
  51: ["drizzle", "Light Drizzle", "ہلکی پھوار", "halki phuwar"], 53: ["drizzle", "Drizzle", "پھوار", "phuwar"], 55: ["drizzle", "Heavy Drizzle", "تیز پھوار", "tez phuwar"],
  56: ["drizzle", "Freezing Drizzle", "یخ بستہ پھوار", "yakh basta phuwar"], 57: ["drizzle", "Freezing Drizzle", "یخ بستہ پھوار", "yakh basta phuwar"],
  61: ["rain", "Light Rain", "ہلکی بارش", "halki barish"], 63: ["rain", "Rain", "بارش", "barish"], 65: ["heavyrain", "Heavy Rain", "تیز بارش", "tez barish"],
  66: ["rain", "Freezing Rain", "یخ بستہ بارش", "yakh basta barish"], 67: ["heavyrain", "Heavy Freezing Rain", "شدید یخ بستہ بارش", "shadeed yakh basta barish"],
  71: ["snow", "Light Snow", "ہلکی برف باری", "halki barf bari"], 73: ["snow", "Snow", "برف باری", "barf bari"], 75: ["snow", "Heavy Snow", "شدید برف باری", "shadeed barf bari"], 77: ["snow", "Snow Grains", "برف کے دانے", "barf ke daane"],
  80: ["showers", "Light Showers", "ہلکی بوچھاڑ", "halki bochhaar"], 81: ["showers", "Rain Showers", "بوچھاڑ", "bochhaar"], 82: ["heavyrain", "Violent Showers", "تیز بوچھاڑ", "tez bochhaar"],
  85: ["snow", "Snow Showers", "برفانی بوچھاڑ", "barfani bochhaar"], 86: ["snow", "Heavy Snow Showers", "شدید برفانی بوچھاڑ", "shadeed barfani bochhaar"],
  95: ["storm", "Thunderstorms", "گرج چمک کے ساتھ بارش", "garaj chamak ke saath barish"],
  96: ["storm", "Thunderstorm with Hail", "اولوں کے ساتھ طوفان", "olon ke saath toofan"],
  99: ["storm", "Severe Thunderstorm", "اولوں کے ساتھ شدید طوفان", "olon ke saath shadeed toofan"]
};
function wxInfo(code, isDay = true) {
  const r = WX[code] || WX[0];
  let [kind, en, ur, ro] = r;
  if (!isDay && code === 0) { en = "Clear Night"; ur = "صاف رات"; ro = "saaf raat"; }
  if (!isDay && code === 1) { en = "Mostly Clear"; }
  return { code, kind, en, ur, ro, day: !!isDay };
}

/* ---------- 6. WEATHER ICONS (animated inline SVG) ---------- */
const CLOUD = "M18 50C10 50 5 44.5 6.5 38.5 8 33 13 31 18 31.5 19.5 23 27 17 36 19c6 1.3 10.5 6 10.8 12 6-.2 11.2 4 11.2 9.5C58 46.5 53.5 50 48 50z";
const cloudP = (tr, fill = "url(#gCloud)") => `<path d="${CLOUD}" fill="${fill}" transform="${tr}"/>`;
const sunG = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><circle r="20" fill="#ffb300" opacity=".22" class="wi-pulse"/><g class="wi-rays" stroke="#ffc94d" stroke-width="3.4" stroke-linecap="round">${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<line x1="0" y1="-19" x2="0" y2="-26" transform="rotate(${a})"/>`).join("")}</g><circle r="13.5" fill="url(#gSun)"/></g>`;
const moonG = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M8-20A21 21 0 1 0 21 8 16 16 0 0 1 8-20z" fill="url(#gMoon)"/><circle class="wi-twinkle" cx="14" cy="-14" r="1.7" fill="#fff"/><circle class="wi-twinkle" cx="21" cy="-4" r="1.2" fill="#fff" style="animation-delay:1s"/></g>`;
const drops = (xs, y0, col = "#4da3ff") => `<g>${xs.map(x => `<line class="wi-drop" x1="${x}" y1="${y0}" x2="${x - 2.6}" y2="${y0 + 7}" stroke="${col}" stroke-width="3.2" stroke-linecap="round"/>`).join("")}</g>`;
const ICONS = {
  clear: d => d ? sunG(32, 32, 1.05) : moonG(32, 32, 1.1),
  mostly: d => (d ? sunG(26, 26, .85) : moonG(26, 26, .8)) + `<g class="wi-float2">${cloudP("translate(26 22) scale(.62)")}</g>`,
  partly: d => (d ? sunG(24, 24, .8) : moonG(23, 23, .72)) + `<g class="wi-float">${cloudP("translate(6 10) scale(.85)")}</g>`,
  cloudy: () => `<g class="wi-float2">${cloudP("translate(12 -6) scale(.7)", "url(#gCloudDark)")}</g><g class="wi-float">${cloudP("translate(0 4)")}</g>`,
  fog: () => `<g class="wi-float">${cloudP("translate(0 -6)")}</g><g><line class="wi-fog" x1="12" y1="48" x2="50" y2="48" stroke="#cfe0ff" stroke-width="3.2" stroke-linecap="round"/><line class="wi-fog" x1="18" y1="54" x2="56" y2="54" stroke="#b8cdf5" stroke-width="3.2" stroke-linecap="round"/><line class="wi-fog" x1="10" y1="60" x2="46" y2="60" stroke="#cfe0ff" stroke-width="3.2" stroke-linecap="round"/></g>`,
  drizzle: () => `<g class="wi-float">${cloudP("translate(0 -6)")}</g>${drops([22, 34, 46], 47, "#7cc4ff")}`,
  rain: () => `<g class="wi-float">${cloudP("translate(0 -6)", "url(#gCloudDark)")}</g>${drops([20, 30, 40, 50], 47)}`,
  heavyrain: () => `<g class="wi-float">${cloudP("translate(0 -8)", "url(#gCloudDark)")}</g>${drops([18, 26, 34, 42, 50], 45)}`,
  showers: d => (d ? sunG(23, 22, .7) : moonG(22, 21, .62)) + `<g class="wi-float">${cloudP("translate(6 6) scale(.85)")}</g>${drops([22, 33, 44], 50)}`,
  storm: () => `<g class="wi-float">${cloudP("translate(0 -8)", "url(#gCloudDark)")}</g><polygon class="wi-bolt" points="35,36 27,49 33,49 30,61 43,43 36,43 41,36" fill="url(#gBolt)"/>`,
  snow: () => `<g class="wi-float">${cloudP("translate(0 -6)")}</g><g>${[[22, 50], [32, 53], [42, 50]].map(([x, y]) => `<g class="wi-flake"><circle cx="${x}" cy="${y}" r="2.6" fill="#fff"/><circle cx="${x}" cy="${y}" r="4.6" fill="none" stroke="#dbe9ff" stroke-width="1" opacity=".7"/></g>`).join("")}</g>`
};
function wxIcon(kind, isDay = true) {
  const fn = ICONS[kind] || ICONS.partly;
  return `<span class="wi-wrap"><svg class="wi" viewBox="0 0 64 64" aria-hidden="true">${fn(!!isDay)}</svg></span>`;
}

/* ---------- 7. LIVE WEATHER SCENE ---------- */
const Scene = (() => {
  const cv = $("#sceneCanvas");
  const main = cv.getContext("2d", { alpha: false });
  let g = main;
  const fgCv = document.createElement("canvas"), fgG = fgCv.getContext("2d");
  let fgKey = "";
  const cc = document.createElement("canvas");
  const cg = cc.getContext("2d");

  let W = 0, H = 0, DPR = 1, hy = 0, ox = 0, RW = 0;
  let raf = 0, lastT = 0, time = 0, running = false, slow = 0;
  let quality = 1, motion = 1;
  const P = { night: 0, dusk: 0, ov: .2, cloud: .4, rain: 0, snow: 0, storm: 0, fog: 0, haze: 0, wind: 10, sunH: .35, sunX: .58, moonX: .5, moonH: .6, moonPhase: .3 };
  const T = Object.assign({}, P);
  const api = { onThunder: null };

  /* --- random + noise --- */
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function noise1(seed) {
    const r = rng(seed), a = []; for (let i = 0; i < 256; i++) a.push(r());
    return x => { const i = Math.floor(x), f = x - i, s = f * f * (3 - 2 * f); return a[i & 255] * (1 - s) + a[(i + 1) & 255] * s; };
  }

  /* --- colour helpers --- */
  const mixC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const mixP = (a, b, t) => ({ top: mixC(a.top, b.top, t), mid: mixC(a.mid, b.mid, t), hor: mixC(a.hor, b.hor, t) });
  const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const dark = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
  const PAL = {
    day: { top: [20, 72, 170], mid: [56, 120, 204], hor: [150, 196, 240] },
    dusk: { top: [34, 26, 92], mid: [124, 56, 132], hor: [255, 150, 84] },
    night: { top: [3, 7, 24], mid: [9, 20, 52], hor: [26, 42, 92] },
    gDay: { top: [70, 82, 100], mid: [104, 118, 136], hor: [150, 164, 180] },
    gDusk: { top: [52, 44, 78], mid: [96, 72, 100], hor: [176, 124, 110] },
    gNight: { top: [6, 9, 20], mid: [14, 20, 36], hor: [28, 36, 56] },
    storm: { top: [20, 25, 36], mid: [38, 46, 60], hor: [64, 74, 90] },
    haze: { top: [150, 128, 98], mid: [190, 160, 120], hor: [224, 190, 140] },
    fog: { top: [116, 128, 146], mid: [146, 158, 174], hor: [180, 190, 202] }
  };
  function sky() {
    const n = P.night, d = P.dusk;
    let c = mixP(mixP(PAL.day, PAL.dusk, d), PAL.night, n);
    c = mixP(c, mixP(mixP(PAL.gDay, PAL.gDusk, d), PAL.gNight, n), P.ov * .88);
    c = mixP(c, PAL.storm, P.storm * .6 * (1 - n * .5));
    c = mixP(c, mixP(PAL.haze, PAL.gNight, n), P.haze * .5);
    if (P.fog > 0) c = mixP(c, mixP(PAL.fog, PAL.gNight, n * .85), P.fog * .7);
    return c;
  }

  /* --- geometry, built on resize --- */
  let mtn = [], trees = null, stars = [], clouds = [], sprites = [], fogSprite = null;

  function ridge(seed, base, amp, freq, bias) {
    const n = noise1(seed), pts = [], step = Math.max(4, W / 260);
    for (let x = -20; x <= W + 20; x += step) {
      let v = .55 * n(x * freq * .006) + .3 * n(x * freq * .016 + 40) + .15 * n(x * freq * .045 + 90);
      v = Math.pow(v, 1.25);
      pts.push([x, base - amp * v * (bias ? bias(x / W) : 1)]);
    }
    const p = new Path2D(); p.moveTo(-20, hy + 2);
    pts.forEach(([x, y]) => p.lineTo(x, y));
    p.lineTo(W + 20, hy + 2); p.closePath();
    return { pts, path: p };
  }
  function buildMountains() {
    const A = H * .36;
    mtn = [
      ridge(11, hy - 2, A * .38, 1.2, u => .8 + .4 * Math.sin(u * 5)),
      ridge(23, hy, A * .55, 1.0, u => 1.05 - .35 * smooth(.3, 1, u)),
      ridge(37, hy, A * .78, .8, u => 1.25 - 1.1 * smooth(.05, .7, u))
    ];
    const r = rng(5), tp = new Path2D();
    mtn[2].pts.forEach(([x, y]) => {
      if (x > W * .52 || y > hy - 6 || r() > .55) return;
      const h = 12 + r() * 26 * (1 - x / (W * .62)), w = h * .36;
      tp.moveTo(x - w, y + 2); tp.lineTo(x, y - h * .62); tp.lineTo(x + w, y + 2); tp.closePath();
      tp.moveTo(x - w * .72, y - h * .3); tp.lineTo(x, y - h); tp.lineTo(x + w * .72, y - h * .3); tp.closePath();
    });
    trees = tp;
  }
  function makeSprite(seed) {
    const r = rng(seed), w = 520, h = 220, c = document.createElement("canvas");
    c.width = w; c.height = h; const x = c.getContext("2d");
    const n = 16;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1), bump = Math.sin(u * Math.PI);
      const cx = 70 + u * (w - 140) + (r() - .5) * 30, rad = 34 + r() * 34 + bump * 30;
      const cy = h - 70 - bump * (40 + r() * 30) + (r() - .5) * 16;
      const gr = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
      gr.addColorStop(0, "rgba(255,255,255,.95)"); gr.addColorStop(.55, "rgba(250,252,255,.7)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      x.fillStyle = gr; x.beginPath(); x.arc(cx, cy, rad, 0, 6.283); x.fill();
    }
    x.globalCompositeOperation = "destination-in";
    const m = x.createLinearGradient(0, 0, 0, h);
    m.addColorStop(0, "#000"); m.addColorStop(.62, "#000"); m.addColorStop(.86, "rgba(0,0,0,.35)"); m.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = m; x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = "source-atop";
    const s = x.createLinearGradient(0, h * .25, 0, h * .85);
    s.addColorStop(0, "rgba(255,255,255,0)"); s.addColorStop(1, "rgba(120,140,180,.55)");
    x.fillStyle = s; x.fillRect(0, 0, w, h);
    return c;
  }
  function buildStaticOnce() {
    const r = rng(9);
    stars = Array.from({ length: 150 }, () => ({ x: r(), y: r() * .92, r: r() * 1.3 + .3, p: r() * 6.28, s: .5 + r() * 1.5 }));
    sprites = [1, 2, 3, 4, 5].map(makeSprite);
    const rc = rng(77);
    clouds = Array.from({ length: 12 }, (_, i) => ({ sp: sprites[i % 5], x: rc() * 1.3 - .15, y: .05 + rc() * .7, s: .45 + rc() * .85, v: .5 + rc(), thr: i / 12 * .95 }));
    clouds.sort((a, b) => a.s - b.s);
    fogSprite = document.createElement("canvas"); fogSprite.width = 600; fogSprite.height = 200;
    const f = fogSprite.getContext("2d"), gr = f.createRadialGradient(300, 100, 0, 300, 100, 300);
    gr.addColorStop(0, "rgba(220,228,240,.55)"); gr.addColorStop(1, "rgba(220,228,240,0)");
    f.setTransform(1, 0, 0, .34, 0, 66); f.fillStyle = gr; f.fillRect(0, -100, 600, 600);
  }
  function layout() {
    DPR = Math.min(window.devicePixelRatio || 1, quality >= 1 ? 1.5 : 1);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    main.setTransform(DPR, 0, 0, DPR, 0, 0);
    fgCv.width = cv.width; fgCv.height = cv.height; fgKey = "";
    cc.width = Math.max(2, Math.round(W / 2)); cc.height = Math.max(2, Math.round(H / 2));
    const desk = W > 1000; ox = desk ? 216 : 0; RW = W - ox;
    hy = Math.round(H * (desk ? .5 : .42));
    buildMountains();
    if (!running) draw(0);
  }

  /* --- particles --- */
  const drops = [], flakes = [], ripples = [], dust = [];
  let bolt = null, flash = 0, nextBolt = 5, shoot = null, nextShoot = 6;
  const newDrop = init => { const z = Math.random() < .35 ? 1 : 0; return { x: Math.random() * (W + 240) - 120, y: init ? Math.random() * H : -20 - Math.random() * 80, z, len: z ? 16 + Math.random() * 10 : 9 + Math.random() * 7, v: (z ? 1250 : 850) * (.85 + Math.random() * .3), land: hy + 10 + Math.random() * Math.max(10, (H - hy - 10) * .85) }; };
  const newFlake = init => ({ x: Math.random() * W, y: init ? Math.random() * H : -10, r: 1 + Math.random() * 2.6, v: 30 + Math.random() * 60, ph: Math.random() * 6.28, sw: 10 + Math.random() * 30 });
  function tune() {
    const area = Math.max(.4, W * H / (1280 * 720));
    const wantR = Math.round(P.rain * Math.min(900, 600 * area) * quality * motion);
    while (drops.length < wantR) drops.push(newDrop(true));
    if (drops.length > wantR + 20) drops.length = wantR;
    const wantS = Math.round(P.snow * Math.min(320, 220 * area) * quality * motion);
    while (flakes.length < wantS) flakes.push(newFlake(true));
    if (flakes.length > wantS + 10) flakes.length = wantS;
    const wantD = Math.round(P.haze * 70 * quality * motion);
    while (dust.length < wantD) dust.push({ x: Math.random() * W, y: Math.random() * hy * 1.1, r: .8 + Math.random() * 1.8, v: 14 + Math.random() * 30 });
    if (dust.length > wantD + 5) dust.length = wantD;
  }
  function strike() {
    const x = ox + RW * (.15 + Math.random() * .75), pts = [[x, -10]];
    let y = -10, cx = x; const endY = hy + Math.random() * 30;
    while (y < endY) { y += 18 + Math.random() * 34; cx += (Math.random() - .5) * 46; pts.push([cx, y]); }
    const br = [];
    for (let k = 0; k < 2; k++) {
      const s = pts[2 + Math.floor(Math.random() * Math.max(1, pts.length - 4))]; if (!s) continue;
      const b = [s]; let bx = s[0], by = s[1];
      for (let j = 0; j < 4; j++) { bx += (Math.random() - .4) * 40 * (k ? 1 : -1); by += 16 + Math.random() * 24; b.push([bx, by]); }
      br.push(b);
    }
    bolt = { pts, br, age: 0, second: false };
    flash = 1;
    if (api.onThunder) api.onThunder(x / W);
  }

  /* --- drawing --- */
  function sunPos() { const topY = Math.max(90, H * .17); return { x: ox + RW * P.sunX, y: hy - (hy - topY) * P.sunH }; }
  function drawStars() {
    const vis = P.night * (1 - P.ov * .95) * (1 - P.fog) * (1 - P.haze * .7);
    if (vis < .03) return;
    g.fillStyle = "#fff";
    for (const s of stars) {
      const tw = .55 + .45 * Math.sin(time * s.s + s.p);
      g.globalAlpha = vis * tw * .9;
      g.beginPath(); g.arc(s.x * W, s.y * hy, s.r, 0, 6.283); g.fill();
    }
    g.globalAlpha = 1;
    if (shoot) {
      const a = clamp(shoot.life / .9, 0, 1), tx = shoot.x - shoot.vx * .12, ty = shoot.y - shoot.vy * .12;
      const gr = g.createLinearGradient(shoot.x, shoot.y, tx, ty);
      gr.addColorStop(0, `rgba(255,255,255,${a * vis})`); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.strokeStyle = gr; g.lineWidth = 1.6; g.beginPath(); g.moveTo(shoot.x, shoot.y); g.lineTo(tx, ty); g.stroke();
    }
  }
  function drawSun(c) {
    const vis = (1 - P.night) * (1 - P.ov * .92) * (1 - P.storm * .6) * (1 - P.fog * .88) * (1 - P.haze * .35);
    if (vis < .02) return;
    const { x, y } = sunPos(), h = clamp(P.sunH, 0, 1), unit = Math.min(RW, H);
    const core = mixC([255, 132, 52], [255, 232, 160], smooth(0, .6, h));
    const R = unit * lerp(.62, .42, h), r = clamp(unit * .06, 34, 60) * lerp(1.15, .9, h);
    g.save(); g.globalCompositeOperation = "lighter";
    let gr = g.createRadialGradient(x, y, 0, x, y, R);
    gr.addColorStop(0, rgb(core, .42 * vis)); gr.addColorStop(.35, rgb(core, .13 * vis)); gr.addColorStop(1, rgb(core, 0));
    g.fillStyle = gr; g.fillRect(x - R, y - R, R * 2, R * 2);
    if (quality > .5 && P.ov < .4 && P.storm < .2) {
      g.translate(x, y); g.rotate(time * .03);
      const n = 12, L = R * 1.15;
      for (let i = 0; i < n; i++) {
        g.rotate(6.283 / n);
        const rg = g.createLinearGradient(0, 0, L, 0);
        rg.addColorStop(0, rgb(core, .026 * vis)); rg.addColorStop(1, rgb(core, 0));
        g.fillStyle = rg; g.beginPath(); g.moveTo(0, -r * .35); g.lineTo(L, -L * .05); g.lineTo(L, L * .05); g.lineTo(0, r * .35); g.closePath(); g.fill();
      }
    }
    g.restore();
    gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rgb([255, 250, 225], vis)); gr.addColorStop(.55, rgb(mixC(core, [255, 245, 210], .45), vis)); gr.addColorStop(1, rgb(core, vis * .9));
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
  }
  function drawMoon() {
    const vis = P.night * (1 - P.ov * .8) * (1 - P.fog * .7) * (1 - P.haze * .4);
    if (vis < .03) return;
    const topY = Math.max(90, H * .17);
    const x = ox + RW * P.moonX, y = hy - (hy - topY) * P.moonH, r = clamp(Math.min(RW, H) * .038, 20, 34);
    g.save();
    g.globalCompositeOperation = "lighter";
    let gr = g.createRadialGradient(x, y, r * .6, x, y, r * 7);
    gr.addColorStop(0, `rgba(170,200,255,${.28 * vis})`); gr.addColorStop(1, "rgba(170,200,255,0)");
    g.fillStyle = gr; g.fillRect(x - r * 7, y - r * 7, r * 14, r * 14);
    g.restore();
    g.globalAlpha = vis;
    g.fillStyle = "rgba(190,205,240,.13)"; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
    const f = P.moonPhase, k = Math.cos(f * 6.283), rx = Math.abs(k) * r;
    g.save(); g.translate(x, y); if (f > .5) g.scale(-1, 1);
    g.beginPath(); g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
    g.ellipse(0, 0, Math.max(.01, rx), r, 0, Math.PI / 2, -Math.PI / 2, k > 0);
    g.closePath();
    gr = g.createRadialGradient(-r * .25, -r * .25, 0, 0, 0, r * 1.1);
    gr.addColorStop(0, "#fffdf2"); gr.addColorStop(1, "#cfd8f2");
    g.fillStyle = gr; g.fill();
    g.restore(); g.globalAlpha = 1;
  }
  function drawClouds(dt) {
    cg.setTransform(.5, 0, 0, .5, 0, 0); cg.globalCompositeOperation = "source-over"; cg.globalAlpha = 1;
    cg.clearRect(0, 0, W, H);
    const sp = (4 + P.wind * .55) * motion * (1 + P.storm * .6);
    for (const cl of clouds) {
      const vis = smooth(0, .22, P.cloud - cl.thr);
      cl.x += sp * cl.v * dt / W;
      const sc = cl.s * (1 + P.ov * .35), w = 520 * sc;
      if (cl.x * W > W + 40) cl.x = -w / W - .03;
      if (vis < .01) continue;
      cg.globalAlpha = clamp(vis * (.6 + .4 * P.ov), 0, 1);
      cg.drawImage(cl.sp, cl.x * W, cl.y * hy - 220 * sc * .7, w, 220 * sc);
    }
    cg.globalAlpha = 1; cg.globalCompositeOperation = "source-atop";
    let lit = mixC(mixC([255, 255, 255], [255, 176, 120], P.dusk), [60, 78, 126], P.night);
    let sh = mixC(mixC([170, 190, 222], [120, 70, 110], P.dusk), [14, 22, 48], P.night);
    lit = mixC(lit, mixC([118, 130, 148], [40, 48, 70], P.night), P.ov * .85); sh = mixC(sh, mixC([52, 60, 74], [10, 14, 26], P.night), P.ov * .85);
    lit = mixC(lit, [70, 78, 92], P.storm * .8); sh = mixC(sh, [24, 28, 38], P.storm * .8);
    const a = clamp(Math.max(P.night * .85, P.dusk * .5 * (1 - P.night), P.ov * .75, P.storm * .85), 0, .92);
    if (a > .02) {
      const tg = cg.createLinearGradient(0, 0, 0, hy);
      tg.addColorStop(0, rgb(lit, a)); tg.addColorStop(1, rgb(sh, a));
      cg.fillStyle = tg; cg.fillRect(0, 0, W, H);
    }
    const sv = (1 - P.night) * (1 - P.ov * .6);
    if (P.dusk > .05 && sv > .05) {
      const { x, y } = sunPos(), R = Math.min(RW, H) * .55;
      const rg = cg.createRadialGradient(x, y, 0, x, y, R);
      rg.addColorStop(0, `rgba(255,170,90,${.62 * P.dusk * sv})`); rg.addColorStop(1, "rgba(255,170,90,0)");
      cg.fillStyle = rg; cg.fillRect(0, 0, W, H);
    }
    if (P.night > .3) {
      const x = ox + RW * P.moonX, y = hy - (hy - Math.max(90, H * .17)) * P.moonH, R = Math.min(RW, H) * .4;
      const rg = cg.createRadialGradient(x, y, 0, x, y, R);
      rg.addColorStop(0, `rgba(170,195,255,${.4 * P.night})`); rg.addColorStop(1, "rgba(170,195,255,0)");
      cg.fillStyle = rg; cg.fillRect(0, 0, W, H);
    }
    cg.globalCompositeOperation = "source-over";
    g.drawImage(cc, 0, 0, W, H);
  }
  function layerColors(c) {
    const d = P.dusk, n = P.night;
    const sh = mixC(mixC([40, 60, 110], [70, 50, 140], d), [14, 22, 56], n);
    const cols = [mixC(c.hor, sh, .58), mixC(c.hor, dark(sh, .55), .78), mixC(c.hor, dark(sh, .22), .93)];
    const fog = [.7, .45, .2].map(v => v * P.fog);
    return cols.map((col, i) => mixC(mixC(col, [205, 214, 228], P.snow * (.26 - i * .06)), c.hor, fog[i]));
  }
  function drawMountains(c, cols) {
    for (let i = 0; i < 3; i++) {
      const top = hy - H * .3, gr = g.createLinearGradient(0, top, 0, hy);
      gr.addColorStop(0, rgb(cols[i])); gr.addColorStop(1, rgb(mixC(cols[i], c.hor, .38 - i * .08)));
      g.fillStyle = gr; g.fill(mtn[i].path);
    }
  }
  function drawTrees(cols) {
    if (!trees) return;
    const sway = Math.sin(time * .9) * .3 * motion;
    g.save(); g.translate(sway, 0); g.fillStyle = rgb(mixC(cols[2], [0, 0, 0], .35)); g.fill(trees); g.restore();
  }
  function drawLakeBase(c, cols) {
    const top = mixC(c.hor, [8, 16, 40], .4), bot = mixC(c.top, [3, 7, 20], .8), lh = H - hy;
    let gr = g.createLinearGradient(0, hy, 0, H);
    gr.addColorStop(0, rgb(top)); gr.addColorStop(1, rgb(bot));
    g.fillStyle = gr; g.fillRect(0, hy, W, lh + 2);
    if (quality > .5) {
      g.save(); g.beginPath(); g.rect(0, hy, W, lh); g.clip();
      g.translate(0, 2 * hy); g.scale(1, -1); g.globalAlpha = .34;
      for (let i = 0; i < 3; i++) { g.fillStyle = rgb(cols[i]); g.fill(mtn[i].path); }
      g.restore(); g.globalAlpha = 1;
      const ov = g.createLinearGradient(0, hy, 0, hy + lh * .7);
      ov.addColorStop(0, rgb(top, 0)); ov.addColorStop(1, rgb(bot, .88));
      g.fillStyle = ov; g.fillRect(0, hy, W, lh);
    }
  }
  function drawWaterFx() {
    const lh = H - hy;
    // sun / moon shimmer
    const sunV = (1 - P.night) * (1 - P.ov * .85) * (1 - P.fog * .8) * clamp(P.sunH + .25, 0, 1) * (1 - clamp(P.sunH, 0, 1) * .55);
    const moonV = P.night * (1 - P.ov * .8) * (1 - P.fog * .7);
    const shimmer = (x, col, v) => {
      if (v < .04) return;
      g.save(); g.globalCompositeOperation = "lighter";
      for (let i = 0; i < 22; i++) {
        const y = hy + 6 + i * (lh * .03) * (1 + i * .06), w = (12 + i * 7) * v;
        g.fillStyle = rgb(col, .5 * (1 - i / 22) * v);
        g.fillRect(x - w / 2 + Math.sin(time * 1.6 + i * 1.7) * (4 + i * .6), y, w, 1.6 + i * .05);
      }
      g.restore();
    };
    shimmer(sunPos().x, mixC([255, 150, 70], [255, 240, 200], smooth(0, .5, P.sunH)), sunV);
    shimmer(ox + RW * P.moonX, [190, 210, 255], moonV * .7);
    // ripple lines
    g.strokeStyle = `rgba(200,220,255,${.05 + P.storm * .05 + P.rain * .04})`; g.lineWidth = 1;
    const lines = quality > .5 ? 10 : 5;
    for (let i = 0; i < lines; i++) {
      const y = hy + 14 + i * lh * .07, off = (time * (6 + i * 2)) % 120;
      g.beginPath();
      for (let x = -120 + off; x < W; x += 120) { g.moveTo(x, y); g.lineTo(x + 46 + i * 3, y); }
      g.stroke();
    }
  }
  function drawRain(dt) {
    const vx = clamp(P.wind, 0, 70) * 5 * (1 + P.storm * .5);
    for (const d of drops) {
      d.y += d.v * dt; d.x += vx * dt * (d.z ? 1 : .8);
      if (d.y >= d.land) {
        if (ripples.length < 90 && Math.random() < .4 * quality) ripples.push({ x: d.x, y: d.land, r: 1, a: .5 });
        Object.assign(d, newDrop(false));
      }
    }
    g.lineCap = "round";
    for (let z = 0; z < 2; z++) {
      g.beginPath();
      for (const d of drops) { if (d.z !== z) continue; g.moveTo(d.x, d.y); g.lineTo(d.x - vx / d.v * d.len, d.y - d.len); }
      g.strokeStyle = z ? "rgba(214,230,255,.5)" : "rgba(180,205,240,.3)"; g.lineWidth = z ? 1.5 : 1; g.stroke();
    }
    g.lineWidth = 1;
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i]; r.r += 38 * dt; r.a -= .9 * dt;
      if (r.a <= 0) { ripples.splice(i, 1); continue; }
      g.strokeStyle = `rgba(200,225,255,${r.a})`; g.beginPath(); g.ellipse(r.x, r.y, r.r, r.r * .28, 0, 0, 6.283); g.stroke();
    }
  }
  function drawSnow(dt) {
    g.fillStyle = "rgba(255,255,255,.85)"; g.beginPath();
    for (const f of flakes) {
      f.y += f.v * dt; f.x += (P.wind * 2 + Math.sin(time * .8 + f.ph) * f.sw) * dt;
      if (f.y > H + 10) Object.assign(f, newFlake(false));
      if (f.x > W + 10) f.x = -10; if (f.x < -10) f.x = W + 10;
      g.moveTo(f.x + f.r, f.y); g.arc(f.x, f.y, f.r, 0, 6.283);
    }
    g.fill();
  }
  function drawFog() {
    const a = P.fog * .38 * (1 - P.night * .55);
    if (a < .01) return;
    g.globalAlpha = a;
    for (let i = 0; i < 6; i++) {
      const w = W * 1.4, x = ((time * (5 + i * 3) * (i % 2 ? 1 : -1) + i * 300) % (W + w)) - w * .5, y = hy - H * .3 + i * H * .06;
      g.drawImage(fogSprite, x, y, w, H * .26);
    }
    g.globalAlpha = 1;
  }
  function drawDust(dt) {
    g.fillStyle = `rgba(230,200,150,${.22 * P.haze * (1 - P.night)})`; g.beginPath();
    for (const p of dust) {
      p.x += (p.v + P.wind) * dt; if (p.x > W + 5) { p.x = -5; p.y = Math.random() * hy * 1.1; }
      g.moveTo(p.x + p.r, p.y); g.arc(p.x, p.y, p.r, 0, 6.283);
    }
    g.fill();
  }
  function drawLightning(dt) {
    if (bolt) {
      bolt.age += dt;
      if (!bolt.second && bolt.age > .14) { bolt.second = true; flash = Math.max(flash, .8); }
      if (bolt.age > .32) bolt = null;
    }
    if (bolt) {
      const a = 1 - bolt.age / .32;
      g.save(); g.shadowColor = "#9cc8ff"; g.shadowBlur = 18; g.lineJoin = "round";
      g.strokeStyle = `rgba(235,244,255,${a})`; g.lineWidth = 2.6;
      g.beginPath(); bolt.pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
      g.lineWidth = 1.4;
      bolt.br.forEach(b => { g.beginPath(); b.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); });
      g.restore();
    }
    if (flash > .01) { g.fillStyle = `rgba(200,222,255,${flash * .36})`; g.fillRect(0, 0, W, H); flash *= Math.exp(-dt * 7); }
  }

  function step(dt) {
    const k = 1 - Math.exp(-dt * 1.8);
    for (const key in T) P[key] = lerp(P[key], T[key], k);
    if (P.storm > .3 && motion > 0) { nextBolt -= dt; if (nextBolt <= 0) { strike(); nextBolt = (3 + Math.random() * 8) / (.5 + P.storm * .7); } }
    if (P.night > .7 && P.ov < .3 && motion > 0) {
      if (!shoot) { nextShoot -= dt; if (nextShoot <= 0) { shoot = { x: ox + Math.random() * RW, y: Math.random() * hy * .4, vx: 500 + Math.random() * 300, vy: 220 + Math.random() * 120, life: .9 }; nextShoot = 10 + Math.random() * 14; } }
    }
    if (shoot) { shoot.x += shoot.vx * dt; shoot.y += shoot.vy * dt; shoot.life -= dt; if (shoot.life <= 0) shoot = null; }
    tune();
  }
  function draw(dt) {
    if (!W) return;
    const c = sky(), cols = layerColors(c);
    const gr = g.createLinearGradient(0, 0, 0, hy);
    gr.addColorStop(0, rgb(c.top)); gr.addColorStop(.55, rgb(c.mid)); gr.addColorStop(1, rgb(c.hor));
    g.fillStyle = gr; g.fillRect(0, 0, W, hy + 2);
    drawStars(); drawSun(c); drawMoon(); drawClouds(dt);
    const key = [P.night, P.dusk, P.ov, P.storm, P.haze, P.fog, P.snow].map(v => Math.round(v * 400)).join(",");
    if (key !== fgKey) {
      fgKey = key; g = fgG; fgG.setTransform(DPR, 0, 0, DPR, 0, 0); fgG.clearRect(0, 0, W, H);
      drawMountains(c, cols); drawLakeBase(c, cols); g = main;
    }
    g.drawImage(fgCv, 0, 0, W, H);
    drawTrees(cols); drawWaterFx(); drawFog();
    if (drops.length) drawRain(dt);
    if (flakes.length) drawSnow(dt);
    if (dust.length) drawDust(dt);
    drawLightning(dt);
  }
  function frame(t) {
    raf = requestAnimationFrame(frame);
    const gap = quality >= 1 ? 0 : quality >= .8 ? 28 : 40;
    if (t - lastT < gap) return;
    const dt = Math.min(.05, (t - lastT) / 1000 || .016); lastT = t;
    if (dt > Math.max(.034, (gap + 20) / 1000)) slow++; else slow = Math.max(0, slow - 1);
    if (slow > 80 && quality > .5) { quality *= .75; slow = 0; document.body.classList.toggle("lite", quality < .6); layout(); }
    time += dt * Math.max(motion, .3);
    step(dt); draw(dt * motion);
  }

  /* --- public --- */
  api.init = function () { buildStaticOnce(); layout(); window.addEventListener("resize", debounce(layout, 150)); api.start(); };
  api.start = function () { if (running || motion === 0) return; running = true; lastT = performance.now(); raf = requestAnimationFrame(frame); };
  api.stop = function () { running = false; cancelAnimationFrame(raf); };
  api.set = function (o, instant) { Object.assign(T, o); if (instant) Object.assign(P, o); if (!running) { Object.assign(P, T); tune(); draw(0); } };
  api.setMotion = function (m) { motion = m; if (m === 0) { api.stop(); Object.assign(P, T); drops.length = flakes.length = dust.length = 0; draw(0); } else api.start(); };
  api.setQuality = function (q) { quality = q; document.body.classList.toggle("lite", q < .6); layout(); };
  api.state = () => ({ P: Object.assign({}, P), T: Object.assign({}, T), drops: drops.length, flakes: flakes.length, W, H, hy, bolt: !!bolt, flash });
  api.forceStrike = strike;
  return api;
})();

const SCENE_PRESET = {
  clear: { cloud: .1, ov: 0 }, mostly: { cloud: .28, ov: .03 }, partly: { cloud: .55, ov: .12 }, cloudy: { cloud: .92, ov: .55 },
  fog: { cloud: .5, ov: .35, fog: 1 }, drizzle: { cloud: .85, ov: .55, rain: .22 }, rain: { cloud: .95, ov: .7, rain: .6 },
  heavyrain: { cloud: 1, ov: .85, rain: 1 }, showers: { cloud: .8, ov: .45, rain: .5 }, storm: { cloud: 1, ov: .9, rain: .85, storm: 1 }, snow: { cloud: .9, ov: .6, snow: .85 }
};
function moonPhase(now = new Date()) {
  const syn = 29.530588853 * 864e5, ref = 947182440000;
  return (((now.getTime() - ref) % syn) + syn) % syn / syn;
}
function sceneTargets() {
  const w = state.weather; if (!w) return null;
  const cur = w.current, d = w.daily, info = wxInfo(cur.weather_code, !!cur.is_day);
  const pre = SCENE_PRESET[info.kind] || SCENE_PRESET.clear;
  const nowMs = cityNow().getTime();
  let rise = Date.parse((d.sunrise?.[0] || "") + "Z"), set = Date.parse((d.sunset?.[0] || "") + "Z");
  if (!isFinite(rise) || !isFinite(set)) { rise = nowMs - 6 * 36e5; set = nowMs + 6 * 36e5; }
  let dm, sunH, sunX, moonX = .5, moonH = .6;
  const day = nowMs >= rise && nowMs <= set;
  if (day) { dm = Math.min(nowMs - rise, set - nowMs) / 6e4; const p = (nowMs - rise) / (set - rise); sunH = Math.sin(p * Math.PI); sunX = lerp(.16, .86, p); }
  else { dm = -Math.min(Math.abs(nowMs - rise), Math.abs(nowMs - set)) / 6e4; sunH = -.2; sunX = nowMs > set ? .86 : .16; }
  if (!day) {
    const t = nowMs > set ? (nowMs - set) / ((rise + 864e5) - set) : (nowMs - (set - 864e5)) / (rise - (set - 864e5));
    moonX = lerp(.15, .85, clamp(t, 0, 1)); moonH = Math.sin(clamp(t, 0, 1) * Math.PI) * .8 + .1;
  }
  let night = clamp((-dm + 5) / 40, 0, 1), dusk = clamp(1 - Math.abs(dm - 10) / 60, 0, 1);
  if (settings.sceneStyle === "golden") { night = 0; dusk = 1; sunH = .3; sunX = .58; }
  const cover = (cur.cloud_cover ?? 50) / 100;
  let ov = pre.ov; if (cover > .6 && !["rain", "heavyrain", "storm", "snow"].includes(info.kind)) ov = Math.max(ov, clamp((cover - .6) * 1.2, 0, .7));
  let rain = pre.rain || 0; if ((cur.precipitation || 0) > 0 && ["rain", "heavyrain", "showers", "drizzle", "storm"].includes(info.kind)) rain = Math.max(rain, clamp(.3 + cur.precipitation * .25, 0, 1));
  const vis = cur.visibility ?? 20000;
  let haze = ["clear", "mostly", "partly", "cloudy"].includes(info.kind) ? clamp((8000 - vis) / 7000, 0, .8) : 0;
  const aqi = state.air?.current?.us_aqi; if (aqi > 150 && haze < .6) haze = Math.min(.8, haze + .25);
  return { night, dusk, ov, cloud: lerp(pre.cloud, cover, .45), rain, snow: pre.snow || 0, storm: pre.storm || 0, fog: pre.fog || 0, haze, wind: cur.wind_speed_10m || 0, sunH, sunX, moonX, moonH, moonPhase: moonPhase() };
}
function updateScene(instant) {
  const t = sceneTargets(); if (!t) return;
  Scene.set(t, instant);
  Ambience.setWeather({ rain: t.rain, wind: t.wind, snow: t.snow });
}

/* ---------- UI HELPERS ---------- */
let toastTimer;
function toast(msg, ms = 3400) {
  const t = $("#toast"); $("#toastMessage").textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}
function showError(msg) {
  const e = $("#errorMessage"); e.textContent = msg; e.hidden = false;
  clearTimeout(showError.t); showError.t = setTimeout(() => { e.hidden = true; }, 7000);
}
const clearError = () => { $("#errorMessage").hidden = true; };

/* ---------- 8. WEATHER SOUNDS (WebAudio, no files needed) ---------- */
const Ambience = (() => {
  let ctx = null, master, rainG, windG, whiteBuf, target = { rain: 0, wind: 0, snow: 0 };
  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    const len = ctx.sampleRate * 3;
    whiteBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const dw = whiteBuf.getChannelData(0); for (let i = 0; i < len; i++) dw[i] = Math.random() * 2 - 1;
    const brown = ctx.createBuffer(1, len, ctx.sampleRate), db = brown.getChannelData(0);
    let last = 0; for (let i = 0; i < len; i++) { last = (last + .02 * (Math.random() * 2 - 1)) / 1.02; db[i] = last * 3.5; }
    const rs = ctx.createBufferSource(); rs.buffer = whiteBuf; rs.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 900;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 9000;
    rainG = ctx.createGain(); rainG.gain.value = 0; rs.connect(hp).connect(lp).connect(rainG).connect(master); rs.start();
    const ws = ctx.createBufferSource(); ws.buffer = brown; ws.loop = true;
    const wl = ctx.createBiquadFilter(); wl.type = "lowpass"; wl.frequency.value = 500; wl.Q.value = .8;
    windG = ctx.createGain(); windG.gain.value = 0; ws.connect(wl).connect(windG).connect(master); ws.start();
    const lfo = ctx.createOscillator(); lfo.frequency.value = .12;
    const lg = ctx.createGain(); lg.gain.value = 220; lfo.connect(lg).connect(wl.frequency); lfo.start();
    return true;
  }
  function update() {
    if (!ctx) return;
    const t = ctx.currentTime, v = settings.soundOn ? settings.soundVol : 0;
    master.gain.setTargetAtTime(v * .9, t, .4);
    rainG.gain.setTargetAtTime(clamp(target.rain, 0, 1) * .5, t, .8);
    windG.gain.setTargetAtTime(clamp(target.wind / 45, 0, 1) * .32 + target.snow * .05 + .02, t, .8);
  }
  return {
    async enable() { if (!init()) return false; if (ctx.state === "suspended") { try { await ctx.resume(); } catch { return false; } } update(); return true; },
    resume() { if (ctx && ctx.state === "suspended" && settings.soundOn) ctx.resume().catch(() => { }); },
    update,
    setWeather(o) { target = Object.assign({ rain: 0, wind: 0, snow: 0 }, o); update(); },
    thunder(delay = .6, power = 1) {
      if (!ctx || !settings.soundOn || ctx.state !== "running") return;
      const t = ctx.currentTime + delay, src = ctx.createBufferSource(); src.buffer = whiteBuf;
      const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.setValueAtTime(420, t); f.frequency.exponentialRampToValueAtTime(70, t + 2.6);
      const gn = ctx.createGain(); gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(power * .95, t + .08); gn.gain.exponentialRampToValueAtTime(.001, t + 3.3);
      src.connect(f).connect(gn).connect(master); src.start(t); src.stop(t + 3.6);
    }
  };
})();
Scene.onThunder = () => Ambience.thunder(.4 + Math.random() * 1.6, .7 + Math.random() * .3);

/* ---------- 9. VOICE ---------- */
const Voice = (() => {
  const ok = "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
  let voices = [], token = 0, cur = null;
  const api = { ok, speaking: false };
  const norm = l => (l || "").toLowerCase().replace("_", "-");
  const PREF = { en: ["en-us", "en-gb", "en-in", "en"], ur: ["ur-pk", "ur-in", "ur"], ro: ["en-in", "en-gb", "en-us", "en", "hi-in"] };
  function load() { if (!ok) return; voices = speechSynthesis.getVoices() || []; setTimeout(() => { if (typeof fillVoiceSelect === "function") fillVoiceSelect(); }, 0); }
  api.voicesFor = lang => { const pre = lang === "ur" ? ["ur"] : lang === "ro" ? ["en", "hi"] : ["en"]; return voices.filter(v => pre.some(p => norm(v.lang).startsWith(p))); };
  api.effectiveLang = () => (settings.voiceLang === "ur" && !api.voicesFor("ur").length) ? "ro" : settings.voiceLang;
  function pick(lang) {
    const list = api.voicesFor(lang); if (!list.length) return null;
    if (settings.voiceName) { const m = list.find(v => v.name === settings.voiceName); if (m) return m; }
    for (const p of PREF[lang]) {
      const m = list.find(v => norm(v.lang).startsWith(p) && /natural|online|google|premium|enhanced/i.test(v.name)) || list.find(v => norm(v.lang).startsWith(p));
      if (m) return m;
    }
    return list[0];
  }
  function ui(on, caption) {
    api.speaking = on;
    document.body.classList.toggle("is-speaking", on);
    $("#voicePill").hidden = !on;
    if (caption) $("#voiceCaption").textContent = caption;
    const b = $("#speakBtn"); if (b) { $("span", b).textContent = on ? "Stop" : "Listen"; $("use", b).setAttribute("href", on ? "#i-stop" : "#i-speaker"); }
  }
  api.speak = (text, { lang = api.effectiveLang(), caption } = {}) => {
    if (!ok) { toast("Voice is not supported in this browser."); return false; }
    const parts = Array.isArray(text) ? text : (String(text).match(/[^.!?۔]+[.!?۔]?/g) || [String(text)]).map(s => s.trim()).filter(Boolean);
    if (!parts.length) return false;
    const my = ++token; let i = 0;
    speechSynthesis.cancel(); ui(true, caption || parts[0]);
    const next = () => {
      if (my !== token) return;
      if (i >= parts.length) { ui(false); return; }
      const u = new SpeechSynthesisUtterance(parts[i++]), v = pick(lang);
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = lang === "ur" ? "ur-PK" : "en-US";
      u.rate = settings.voiceRate; u.pitch = settings.voicePitch;
      u.onend = next;
      u.onerror = e => { if (my === token && e.error !== "interrupted" && e.error !== "canceled") { ui(false); if (e.error === "not-allowed") toast("Tap the Listen button to allow voice in this browser."); } };
      cur = u; speechSynthesis.speak(u);
    };
    setTimeout(next, 80);
    return true;
  };
  api.stop = () => { token++; if (ok) speechSynthesis.cancel(); ui(false); };
  if (ok) { load(); speechSynthesis.onvoiceschanged = load; }
  return api;
})();

const ADVICE = {
  nice: { en: "Perfect weather for outdoor activities!", ur: "باہر کی سرگرمیوں کے لیے بہترین موسم ہے۔", ro: "Bahar ki sargarmiyon ke liye behtareen mausam hai." },
  storm: { en: "Stay indoors and keep away from open areas.", ur: "گھر کے اندر رہیں اور کھلی جگہوں سے دور رہیں۔", ro: "Ghar ke andar rahein aur khuli jagahon se door rahein." },
  rain: { en: "Carry an umbrella if you head out.", ur: "باہر جاتے وقت چھتری ساتھ رکھیں۔", ro: "Bahar jate waqt chhatri saath rakhein." },
  drizzle: { en: "A light jacket or umbrella will help.", ur: "ہلکی جیکٹ یا چھتری کام آئے گی۔", ro: "Halki jacket ya chhatri kaam aaye gi." },
  snow: { en: "Dress in warm layers and drive carefully.", ur: "گرم کپڑے پہنیں اور احتیاط سے گاڑی چلائیں۔", ro: "Garam kapray pehnein aur ehtiyaat se gaari chalayein." },
  fog: { en: "Drive slowly and use low-beam lights.", ur: "آہستہ گاڑی چلائیں اور لو بیم لائٹس استعمال کریں۔", ro: "Aahista gaari chalayein aur low beam lights istemal karein." },
  extreme_heat: { en: "Extreme heat. Stay hydrated and avoid the midday sun.", ur: "شدید گرمی ہے، پانی زیادہ پئیں اور دوپہر کی دھوپ سے بچیں۔", ro: "Shadeed garmi hai, pani zyada piyein aur dopehar ki dhoop se bachein." },
  hot: { en: "Very hot outside, so drink plenty of water.", ur: "باہر بہت گرمی ہے، خوب پانی پئیں۔", ro: "Bahar bohat garmi hai, khoob pani piyein." },
  uv: { en: "UV is very high, so wear sunscreen and a hat.", ur: "الٹرا وائلٹ شعاعیں تیز ہیں، سن اسکرین اور ٹوپی استعمال کریں۔", ro: "Ultraviolet shuaaein tez hain, sunscreen aur topi istemal karein." },
  cold: { en: "Bundle up before heading out.", ur: "باہر جانے سے پہلے گرم کپڑے پہنیں۔", ro: "Bahar jane se pehle garam kapray pehnein." },
  aqi: { en: "Air quality is poor, so limit time outdoors.", ur: "ہوا کا معیار خراب ہے، باہر کم وقت گزاریں۔", ro: "Hawa ka miyaar kharab hai, bahar kam waqt guzarein." }
};
function describe() {
  const w = state.weather, c = w.current, d = w.daily, info = wxInfo(c.weather_code, !!c.is_day), t = c.temperature_2m, kind = info.kind;
  const feel = t >= 40 ? "Scorching hot" : t >= 35 ? "Hot" : t >= 30 ? "Warm" : t >= 24 ? "Warm and pleasant" : t >= 17 ? "Mild" : t >= 8 ? "Cool" : t >= 0 ? "Cold" : "Freezing";
  let sky = { clear: "with clear skies", mostly: "with mostly clear skies", partly: "with scattered clouds", cloudy: "under a cloudy sky", fog: "with fog reducing visibility", drizzle: "with light drizzle", rain: "with rain", heavyrain: "with heavy rain", showers: "with rain showers", storm: "with thunderstorms nearby", snow: "with snowfall" }[kind];
  if (!c.is_day && kind === "clear") sky = "under a clear night sky";
  const uv = d.uv_index_max?.[0] || 0, aqi = state.air?.current?.us_aqi;
  let key = "nice";
  if (kind === "storm") key = "storm";
  else if (kind === "rain" || kind === "heavyrain" || kind === "showers") key = "rain";
  else if (kind === "drizzle") key = "drizzle";
  else if (kind === "snow") key = "snow";
  else if (kind === "fog") key = "fog";
  else if (t >= 40) key = "extreme_heat";
  else if (t >= 36) key = "hot";
  else if (uv >= 8 && c.is_day) key = "uv";
  else if (t <= 5) key = "cold";
  else if (aqi > 150) key = "aqi";
  return { l1: `${feel} ${sky}.`, l2: ADVICE[key].en, key };
}

const SPOKEN = {
  en: { dirs: ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"], wu: { kmh: "kilometres per hour", mph: "miles per hour", ms: "metres per second" } },
  ur: { dirs: ["شمال", "شمال مشرق", "مشرق", "جنوب مشرق", "جنوب", "جنوب مغرب", "مغرب", "شمال مغرب"], wu: { kmh: "کلومیٹر فی گھنٹہ", mph: "میل فی گھنٹہ", ms: "میٹر فی سیکنڈ" }, uv: ["کم", "درمیانی", "زیادہ", "بہت زیادہ", "انتہائی"], aqi: ["اچھا", "درمیانہ", "حساس افراد کے لیے نقصان دہ", "نقصان دہ", "بہت نقصان دہ", "انتہائی خطرناک"], days: ["اتوار", "پیر", "منگل", "بدھ", "جمعرات", "جمعہ", "ہفتہ"] },
  ro: { dirs: ["shumaal", "shumaal mashriq", "mashriq", "junoob mashriq", "junoob", "junoob maghrib", "maghrib", "shumaal maghrib"], wu: { kmh: "kilometre fi ghanta", mph: "meel fi ghanta", ms: "meter fi second" }, uv: ["kam", "darmiyana", "zyada", "bohat zyada", "intehai zyada"], aqi: ["acha", "darmiyana", "hassas afraad ke liye nuqsan deh", "nuqsan deh", "bohat nuqsan deh", "intehai khatarnaak"], days: ["Itwaar", "Peer", "Mangal", "Budh", "Jumeraat", "Jumma", "Hafta"] }
};
const uvIdx = u => u <= 2 ? 0 : u <= 5 ? 1 : u <= 7 ? 2 : u <= 10 ? 3 : 4;
const aqiIdx = a => a <= 50 ? 0 : a <= 100 ? 1 : a <= 150 ? 2 : a <= 200 ? 3 : a <= 300 ? 4 : 5;
function windNum(kmh) { return settings.windUnit === "mph" ? Math.round(kmh * .621371) : settings.windUnit === "ms" ? (kmh / 3.6).toFixed(1) : Math.round(kmh); }

function reportSentences(lang) {
  const w = state.weather; if (!w) return [];
  const c = w.current, d = w.daily, info = wxInfo(c.weather_code, !!c.is_day), S = SPOKEN[lang];
  const city = lang === "ur" ? (state.cityUr || state.city.name) : state.city.name;
  const T = v => fmt.t(v), F = settings.tempUnit === "f", di = Math.round((c.wind_direction_10m || 0) / 45) % 8;
  const rc = d.precipitation_probability_max?.[0] ?? 0, uv = Math.round(d.uv_index_max?.[0] || 0), aqi = state.air?.current?.us_aqi;
  const tm = d.weather_code?.[1] != null ? wxInfo(d.weather_code[1], true) : null;
  const hum = Math.round(c.relative_humidity_2m), wn = windNum(c.wind_speed_10m), wu = S.wu[settings.windUnit];
  const hi = T(d.temperature_2m_max[0]), lo = T(d.temperature_2m_min[0]), fl = T(c.apparent_temperature);
  const hi2 = tm ? T(d.temperature_2m_max[1]) : "", lo2 = tm ? T(d.temperature_2m_min[1]) : "";
  const key = describe().key, s = [];
  if (lang === "ur") {
    s.push(`${city} کے موسم کی تازہ ترین رپورٹ۔`);
    s.push(`اس وقت درجہ حرارت ${T(c.temperature_2m)} ڈگری ${F ? "فارن ہائیٹ" : "سینٹی گریڈ"} ہے، موسم ${info.ur} ہے، اور محسوس ہونے والا درجہ حرارت ${fl} ڈگری ہے۔`);
    s.push(`نمی ${hum} فیصد ہے اور ${S.dirs[di]} کی طرف سے ہوا ${wn} ${wu} کی رفتار سے چل رہی ہے۔`);
    s.push(`آج کا زیادہ سے زیادہ درجہ حرارت ${hi} اور کم سے کم ${lo} ڈگری رہے گا۔`);
    s.push(rc >= 30 ? `بارش کا امکان ${rc} فیصد ہے۔` : "آج بارش کا امکان کم ہے۔");
    s.push(`الٹرا وائلٹ انڈیکس ${uv} ہے، جو ${S.uv[uvIdx(uv)]} ہے۔`);
    if (aqi != null) s.push(`ہوا کا معیار ${S.aqi[aqiIdx(aqi)]} ہے۔`);
    if (tm) s.push(`کل کا موسم ${tm.ur} رہے گا، زیادہ سے زیادہ ${hi2} اور کم سے کم ${lo2} ڈگری۔`);
    s.push(ADVICE[key].ur);
  } else if (lang === "ro") {
    s.push(`${city} ke mausam ki taaza tareen report.`);
    s.push(`Is waqt darja hararat ${T(c.temperature_2m)} degree ${F ? "Fahrenheit" : "centigrade"} hai, mausam ${info.ro} hai, aur mehsoos hone wala darja hararat ${fl} degree hai.`);
    s.push(`Nami ${hum} feesad hai aur ${S.dirs[di]} ki taraf se hawa ${wn} ${wu} ki raftaar se chal rahi hai.`);
    s.push(`Aaj ka zyada se zyada darja hararat ${hi} aur kam se kam ${lo} degree rahe ga.`);
    s.push(rc >= 30 ? `Barish ka imkaan ${rc} feesad hai.` : "Aaj barish ka imkaan kam hai.");
    s.push(`Ultraviolet index ${uv} hai, jo ${S.uv[uvIdx(uv)]} hai.`);
    if (aqi != null) s.push(`Hawa ka miyaar ${S.aqi[aqiIdx(aqi)]} hai.`);
    if (tm) s.push(`Kal ka mausam ${tm.ro} rahe ga, zyada se zyada ${hi2} aur kam se kam ${lo2} degree.`);
    s.push(ADVICE[key].ro);
  } else {
    s.push(`Weather update for ${city}${state.city.country ? ", " + state.city.country : ""}.`);
    s.push(`Right now it is ${T(c.temperature_2m)} degrees ${F ? "Fahrenheit" : "Celsius"} and ${info.en.toLowerCase()}, feeling like ${fl}.`);
    s.push(`Humidity is ${hum} percent, and the wind is ${wn} ${wu} from the ${S.dirs[di]}.`);
    s.push(`Today's high is ${hi} and the low is ${lo}.`);
    s.push(rc >= 30 ? `There is a ${rc} percent chance of rain today.` : "Rain is unlikely today.");
    s.push(`The UV index is ${uv}, which is ${uvLevel(uv).toLowerCase()}.`);
    if (aqi != null) s.push(`Air quality is ${aqiLevel(aqi).toLowerCase()}.`);
    if (tm) s.push(`Tomorrow: ${tm.en.toLowerCase()}, with a high of ${hi2} and a low of ${lo2}.`);
    s.push(ADVICE[key].en);
  }
  return s;
}
function forecastSentences(lang) {
  const w = state.weather; if (!w) return [];
  const d = w.daily, city = lang === "ur" ? (state.cityUr || state.city.name) : state.city.name, s = [];
  const nm = i => { const dt = isoDate(d.time[i]); return i === 0 ? (lang === "ur" ? "آج" : lang === "ro" ? "Aaj" : "Today") : i === 1 ? (lang === "ur" ? "کل" : lang === "ro" ? "Kal" : "Tomorrow") : lang === "en" ? DAYS_LONG[dt.getUTCDay()] : SPOKEN[lang].days[dt.getUTCDay()]; };
  s.push(lang === "ur" ? `${city} کا سات روزہ موسم۔` : lang === "ro" ? `${city} ka saat roza mausam.` : `Here is the seven day forecast for ${city}.`);
  for (let i = 0; i < d.time.length; i++) {
    const info = wxInfo(d.weather_code[i], true), hi = fmt.t(d.temperature_2m_max[i]), lo = fmt.t(d.temperature_2m_min[i]), rc = d.precipitation_probability_max?.[i] ?? 0;
    if (lang === "ur") s.push(`${nm(i)}: ${info.ur}، زیادہ سے زیادہ ${hi} اور کم سے کم ${lo} ڈگری${rc >= 40 ? `، بارش کا امکان ${rc} فیصد` : ""}۔`);
    else if (lang === "ro") s.push(`${nm(i)}: ${info.ro}, zyada se zyada ${hi} aur kam se kam ${lo} degree${rc >= 40 ? `, barish ka imkaan ${rc} feesad` : ""}.`);
    else s.push(`${nm(i)}: ${info.en.toLowerCase()}, high ${hi}, low ${lo}${rc >= 40 ? `, ${rc} percent chance of rain` : ""}.`);
  }
  return s;
}
async function ensureUrName() {
  if (state.cityUr || !state.city) return;
  try {
    const list = await geocode(state.city.name, 6, "ur");
    const c = state.city;
    const m = list.find(x => c.id && x.id === c.id) || list.map(x => ({ x, d: Math.abs(x.latitude - c.latitude) + Math.abs(x.longitude - c.longitude) })).sort((a, b) => a.d - b.d)[0]?.x;
    if (m && Math.abs(m.latitude - c.latitude) + Math.abs(m.longitude - c.longitude) < 1) state.cityUr = m.name;
  } catch { /* fall back to the Latin name */ }
}
let warnedUr = false;
async function speakSentences(build, caption) {
  if (!settings.voiceOn) { toast("Weather voice is turned off in Settings."); return; }
  if (!state.weather) return;
  if (Voice.speaking) { Voice.stop(); return; }
  const lang = Voice.effectiveLang();
  if (settings.voiceLang === "ur" && lang === "ro" && !warnedUr) { warnedUr = true; toast("No Urdu voice found on this device, so Roman Urdu is being used."); }
  if (lang === "ur") await ensureUrName();
  Voice.speak(build(lang), { lang, caption });
}
const speakReport = () => speakSentences(reportSentences, `Weather report for ${state.city?.name || ""}`);

/* Voice search: say a city name */
function startVoiceSearch() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const btn = $("#micBtn");
  if (!SR) { toast("Voice search needs Chrome or Edge."); return; }
  if (btn.classList.contains("listening")) { startVoiceSearch.rec?.stop(); return; }
  const rec = new SR(); startVoiceSearch.rec = rec;
  rec.lang = settings.voiceLang === "ur" ? "ur-PK" : "en-US"; rec.interimResults = false; rec.maxAlternatives = 1;
  rec.onstart = () => { btn.classList.add("listening"); $("#cityInput").placeholder = "Listening… say a city name"; };
  rec.onend = () => { btn.classList.remove("listening"); $("#cityInput").placeholder = "Search city..."; };
  rec.onerror = e => toast(e.error === "not-allowed" || e.error === "service-not-allowed" ? "Microphone is blocked. Open the app through http://localhost or https to use voice search." : "Could not hear you, please try again.");
  rec.onresult = e => {
    let text = e.results[0][0].transcript.trim().replace(/[.,!?]+$/g, "");
    text = text.replace(/^(what'?s |what is )?(the )?(weather|mausam|موسم)( in| of| ka| ki| کا| کی)?\s+/i, "").replace(/\s+(ka mausam|ka weather|کا موسم)$/i, "");
    $("#cityInput").value = text; $("#weatherForm").requestSubmit();
  };
  try { rec.start(); } catch { /* already started */ }
}

/* ---------- 10. API ---------- */
const normLoc = r => ({ id: r.id, name: r.name, admin1: r.admin1 || "", country: r.country || "", latitude: r.latitude, longitude: r.longitude, timezone: r.timezone || "" });
async function geocode(q, count = 5, lang = "en") {
  const j = await getJSON(`${API.geo}?name=${encodeURIComponent(q)}&count=${count}&language=${lang}&format=json`);
  return (j.results || []).map(normLoc);
}
async function reverseGeo(lat, lon) {
  const j = await getJSON(`${API.reverse}?format=jsonv2&lat=${lat}&lon=${lon}&zoom=10&accept-language=en`, { retries: 0, timeout: 8000 });
  const a = j.address || {};
  return { name: a.city || a.town || a.village || a.county || a.state_district || j.name || "Selected place", admin1: a.state || "", country: a.country || "" };
}
function fetchWeather(lat, lon) {
  const cur = "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility";
  const hr = "temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,is_day";
  const dy = "weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,daylight_duration,uv_index_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,et0_fao_evapotranspiration";
  return getJSON(`${API.forecast}?latitude=${lat}&longitude=${lon}&current=${cur}&hourly=${hr}&daily=${dy}&timezone=auto&forecast_days=7`);
}
const fetchAir = (lat, lon) => getJSON(`${API.air}?latitude=${lat}&longitude=${lon}&current=us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,dust&timezone=auto`, { retries: 1 });
function errText(e) {
  if (!navigator.onLine) return "You appear to be offline. Please check your internet connection.";
  if (e && e.name === "AbortError") return "The weather service is taking too long to respond. Please try again.";
  return "Could not load the weather right now. Please try again in a moment.";
}
const setLoading = on => $("#loadingOverlay").classList.toggle("active", on);

/* saved & recent cities */
function pushRecent(loc) {
  state.recents = [loc, ...state.recents.filter(r => locKey(r) !== locKey(loc))].slice(0, 6);
  store.set("recents", state.recents);
}
const isFav = () => state.city && state.favorites.some(f => locKey(f) === locKey(state.city));
function toggleFav(loc = state.city) {
  if (!loc) return;
  const k = locKey(loc), had = state.favorites.some(f => locKey(f) === k);
  state.favorites = had ? state.favorites.filter(f => locKey(f) !== k) : [...state.favorites, loc];
  store.set("favorites", state.favorites);
  toast(had ? `${loc.name} removed from saved cities` : `${loc.name} saved`);
  renderFav(); renderSaved(); renderLocMenu();
}

/* ---------- 11. HOME ---------- */
async function loadCity(loc, { silent = false, speak = false } = {}) {
  const rid = ++state.rid;
  if (!silent) setLoading(true);
  clearError();
  try {
    const w = await fetchWeather(loc.latitude, loc.longitude);
    if (rid !== state.rid) return;
    const first = !state.weather, same = state.city && locKey(state.city) === locKey(loc);
    state.city = Object.assign({}, loc, { timezone: loc.timezone || w.timezone });
    state.weather = w; state.offset = w.utc_offset_seconds || 0; state.lastUpdated = Date.now();
    if (!same) { state.air = null; state.cityUr = null; state.selectedDay = 0; }
    pushRecent(state.city); store.set("city", state.city);
    renderAll(first);
    fetchAir(loc.latitude, loc.longitude)
      .then(a => { if (rid !== state.rid) return; state.air = a; renderAir(); renderSummary(); rebuildNews(); updateScene(); })
      .catch(() => { if (rid === state.rid) renderAir(true); });
    RadarMini.onCity(); RadarView.onCity(); MapsView.onCity(); renderRainOutlook();
    if (speak) setTimeout(speakReport, 600);
  } catch (e) {
    if (rid === state.rid) showError(errText(e));
  } finally {
    if (rid === state.rid) setLoading(false);
  }
}
function renderAll(first) {
  renderHero(); renderHighlights(); renderForecastStrip(); renderAir(); renderForecastPage(); rebuildNews(); renderUpdated();
  updateScene(first);
}
function countTo(el, to, dur = 700) {
  const from = Number(el.dataset.v); el.dataset.v = to;
  if (isNaN(from) || isNaN(to) || matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = isNaN(to) ? "--" : to; return; }
  const t0 = performance.now();
  const tick = t => { const p = clamp((t - t0) / dur, 0, 1), e = 1 - Math.pow(1 - p, 3); el.textContent = Math.round(lerp(from, to, e)); if (p < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
function renderFav() {
  const b = $("#favBtn"), on = isFav();
  b.setAttribute("aria-pressed", on); b.title = on ? "Remove from saved cities" : "Save city";
}
function renderHero() {
  const w = state.weather, c = w.current, d = w.daily, info = wxInfo(c.weather_code, !!c.is_day), city = state.city;
  $("#cityName").textContent = city.name;
  $("#countryName").textContent = [city.admin1, city.country].filter(Boolean).join(", ");
  $("#topbarCity").textContent = city.name; $("#radarCity").textContent = city.name;
  $("#mainWeatherIcon").innerHTML = wxIcon(info.kind, !!c.is_day);
  countTo($("#temperature"), Number(fmt.t(c.temperature_2m)));
  $("#tempScale").textContent = settings.tempUnit === "f" ? "F" : "C";
  $("#weatherDescription").textContent = info.en;
  $("#feelsLike").textContent = fmt.tu(c.apparent_temperature);
  renderSummary();
  $("#humidity").textContent = Math.round(c.relative_humidity_2m) + "%";
  $("#windSpeed").textContent = fmt.wind(c.wind_speed_10m); $("#windDirection").textContent = windDir(c.wind_direction_10m);
  $("#pressure").textContent = fmt.pressure(c.pressure_msl); $("#visibility").textContent = fmt.vis(c.visibility);
  document.title = `${fmt.tu(c.temperature_2m)} ${city.name} — SkyWatch`;
  renderFav();
}
function renderHighlights() {
  const d = state.weather.daily;
  $("#highLow").textContent = `${fmt.tu(d.temperature_2m_max[0])} / ${fmt.tu(d.temperature_2m_min[0])}`;
  $("#sunrise").textContent = isoHM(d.sunrise[0]); $("#sunset").textContent = isoHM(d.sunset[0]);
  const uv = Math.round(d.uv_index_max[0] ?? 0); $("#uvIndex").textContent = `${uv} (${uvLevel(uv)})`;
  $("#rainChance").textContent = (d.precipitation_probability_max?.[0] ?? 0) + "%";
}
function renderForecastStrip() {
  const d = state.weather.daily;
  $("#forecastList").innerHTML = d.time.map((t, i) => {
    const dt = isoDate(t), info = wxInfo(d.weather_code[i], true);
    return `<button type="button" class="forecast-card${i === state.selectedDay ? " active" : ""}" data-i="${i}" aria-label="${DAYS_LONG[dt.getUTCDay()]}, ${info.en}">
      <span class="forecast-day">${dayShort(dt)}</span><span class="forecast-date">${dateShort(dt)}</span>
      <span class="forecast-icon">${wxIcon(info.kind, true)}</span>
      <span class="forecast-temperature"><strong>${fmt.tu(d.temperature_2m_max[i])}</strong> <span>/ ${fmt.tu(d.temperature_2m_min[i])}</span></span>
      <p>${info.en}</p></button>`;
  }).join("");
}
const AQI_STOPS = [[0, 0], [50, 20], [100, 40], [150, 60], [200, 78], [300, 94], [500, 100]];
function aqiPos(a) {
  for (let i = 1; i < AQI_STOPS.length; i++) if (a <= AQI_STOPS[i][0]) { const [a0, p0] = AQI_STOPS[i - 1], [a1, p1] = AQI_STOPS[i]; return lerp(p0, p1, (a - a0) / (a1 - a0)); }
  return 100;
}
function renderAir(failed = false) {
  const a = state.air?.current, aqi = a?.us_aqi;
  if (aqi == null || isNaN(aqi)) {
    $("#airQualityStatus").textContent = "--"; $("#aqiValue").textContent = "--"; $("#aqiMarker").style.left = "0%";
    $("#airQualityDescription").textContent = failed ? "Air quality data is not available for this location." : "Loading air quality…";
    $("#aqiBadge").style.setProperty("--aqi", "#6b7ea6"); return;
  }
  const v = Math.round(aqi);
  $("#airQualityStatus").textContent = aqiShort(v); $("#aqiValue").textContent = v;
  $("#aqiMarker").style.left = clamp(aqiPos(v), 3, 97) + "%";
  $("#airQualityDescription").textContent = aqiText(v);
  $("#aqiBadge").style.setProperty("--aqi", aqiColor(v));
}
function renderUpdated() {
  const el = $("#updatedAt"); if (!el || !state.lastUpdated) return;
  const d = new Date(state.lastUpdated); el.textContent = `Last updated at ${hm(d.getHours(), d.getMinutes())}.`;
}
function tickClock() {
  const n = cityNow();
  $("#currentDate").textContent = `${DAYS[n.getUTCDay()]}, ${pad(n.getUTCDate())} ${MONTHS[n.getUTCMonth()]} ${n.getUTCFullYear()}`;
  $("#currentTime").textContent = hm(n.getUTCHours(), n.getUTCMinutes());
  tickClock.n = (tickClock.n || 0) + 1;
  if (tickClock.n % 30 === 0 && state.weather) updateScene();
}
let refreshTimer;
function scheduleRefresh() {
  clearInterval(refreshTimer);
  const mins = Number(settings.autoRefresh);
  if (!mins) return;
  refreshTimer = setInterval(() => { if (state.city && !document.hidden && Date.now() - state.lastUpdated > mins * 6e4) loadCity(state.city, { silent: true }); }, 60000);
}

/* ---------- 12. FORECAST PAGE ---------- */
const tempVal = c => settings.tempUnit === "f" ? toF(c) : c;
const windVal = k => settings.windUnit === "mph" ? k * .621371 : settings.windUnit === "ms" ? k / 3.6 : k;
const windSuffix = () => ({ kmh: "km/h", mph: "mph", ms: "m/s" }[settings.windUnit]);

function selectDay(i) {
  state.selectedDay = clamp(i, 0, 6);
  renderForecastStrip(); renderForecastPage();
}
function sunArc(i) {
  const d = state.weather.daily, P0 = [30, 84], C = [300, -52], P2 = [570, 84];
  const pt = t => [(1 - t) ** 2 * P0[0] + 2 * (1 - t) * t * C[0] + t * t * P2[0], (1 - t) ** 2 * P0[1] + 2 * (1 - t) * t * C[1] + t * t * P2[1]];
  let marker = "";
  if (i === 0) {
    const now = cityNow().getTime(), r = Date.parse(d.sunrise[0] + "Z"), s = Date.parse(d.sunset[0] + "Z");
    if (now >= r && now <= s) { const p = pt((now - r) / (s - r)); marker = `<circle cx="${p[0]}" cy="${p[1]}" r="18" fill="#ffb300" opacity=".25"/><circle cx="${p[0]}" cy="${p[1]}" r="9" fill="url(#gSun)"/>`; }
  }
  const len = d.daylight_duration?.[i], txt = len ? `${Math.floor(len / 3600)}h ${Math.round(len % 3600 / 60)}m of daylight` : "";
  return `<svg viewBox="0 0 600 106" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Sun path"><defs><linearGradient id="arcG" x1="0" x2="1"><stop offset="0" stop-color="#ff9a55"/><stop offset=".5" stop-color="#ffd86b"/><stop offset="1" stop-color="#ff7a5c"/></linearGradient></defs>
    <line x1="10" y1="84" x2="590" y2="84" stroke="rgba(255,255,255,.18)"/>
    <path d="M30 84 Q300 -52 570 84" fill="none" stroke="url(#arcG)" stroke-width="3" stroke-dasharray="2 8" stroke-linecap="round"/>${marker}
    <text x="30" y="102" fill="#8fa6cc" font-size="13" text-anchor="middle">${isoHM(d.sunrise[i])}</text>
    <text x="570" y="102" fill="#8fa6cc" font-size="13" text-anchor="middle">${isoHM(d.sunset[i])}</text>
    <text x="300" y="62" fill="#c6d5ee" font-size="14" text-anchor="middle">${txt}</text></svg>`;
}
function renderForecastPage() {
  const w = state.weather; if (!w) return;
  const d = w.daily, i = clamp(state.selectedDay, 0, d.time.length - 1), dt = isoDate(d.time[i]), info = wxInfo(d.weather_code[i], true);
  $("#fcSub").textContent = `${state.city.name} · tap a day to see the hour-by-hour breakdown`;
  const rc = d.precipitation_probability_max?.[i] ?? 0, uv = Math.round(d.uv_index_max?.[i] ?? 0);
  const stat = (ic, label, val) => `<div class="stat"><span>${icon(ic)}${label}</span><strong>${val}</strong></div>`;
  $("#fcSelected").innerHTML = `
    <div class="fcs-left"><div class="fcs-icon">${wxIcon(info.kind, true)}</div>
      <div><div class="fcs-day">${DAYS_LONG[dt.getUTCDay()]}, ${dateShort(dt)}</div>
      <div class="fcs-temp">${fmt.tu(d.temperature_2m_max[i])} <small>/ ${fmt.tu(d.temperature_2m_min[i])}</small></div>
      <div class="fcs-cond">${info.en}</div></div></div>
    <div class="fcs-stats">
      ${stat("rain", "Rain chance", rc + "%")}${stat("drop", "Rainfall", fmt.mm(d.precipitation_sum[i]))}${stat("sun", "UV index", `${uv} · ${uvLevel(uv)}`)}
      ${stat("wind", "Max wind", fmt.wind(d.wind_speed_10m_max[i]))}${stat("sunrise", "Sunrise", isoHM(d.sunrise[i]))}${stat("sunset", "Sunset", isoHM(d.sunset[i]))}
    </div>
    <div class="sunarc">${sunArc(i)}</div>`;
  renderChart(); renderHourly(); renderDays();
}
const CH = { W: 760, H: 230, L: 42, R: 14, T: 20, B: 30 };
function smoothPath(p) {
  let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}
function renderChart() {
  const w = state.weather, h = w.hourly, m = state.fcMetric, base = state.selectedDay * 24;
  const idx = [...Array(24).keys()].map(k => base + k).filter(k => h.time[k]);
  if (!idx.length) return;
  const vals = idx.map(k => m === "temp" ? tempVal(h.temperature_2m[k]) : m === "rain" ? (h.precipitation_probability[k] ?? 0) : windVal(h.wind_speed_10m[k] ?? 0));
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (m === "rain") { lo = 0; hi = 100; } else if (m === "wind") { lo = 0; hi = Math.max(10, Math.ceil(hi * 1.2)); } else { lo = Math.floor(lo - 1); hi = Math.ceil(hi + 1); }
  const { W, H, L, R, T, B } = CH, step = (W - L - R) / Math.max(1, idx.length - 1);
  const X = i => L + i * step, Y = v => T + (1 - (v - lo) / (hi - lo || 1)) * (H - T - B);
  const suffix = m === "temp" ? "°" : m === "rain" ? "%" : "";
  let grid = "";
  for (let g = 0; g <= 4; g++) { const v = lo + (hi - lo) * g / 4, y = Y(v); grid += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="rgba(255,255,255,.08)"/><text x="${L - 8}" y="${y + 4}" fill="#8fa6cc" font-size="11" text-anchor="end">${Math.round(v)}${suffix}</text>`; }
  let xl = ""; idx.forEach((k, i) => { if (i % 3 === 0) { const hr = Number(h.time[k].slice(11, 13)); xl += `<text x="${X(i)}" y="${H - 8}" fill="#8fa6cc" font-size="11" text-anchor="middle">${settings.clock === "24" ? pad(hr) : (hr % 12 || 12) + (hr < 12 ? "a" : "p")}</text>`; } });
  const pts = vals.map((v, i) => [X(i), Y(v)]);
  let shape = "";
  if (m === "rain") shape = pts.map(([x, y]) => `<rect x="${x - step * .32}" y="${y}" width="${step * .64}" height="${Math.max(1, H - B - y)}" rx="3" fill="url(#chG)" stroke="#56c8ff" stroke-opacity=".6"/>`).join("");
  else { const line = smoothPath(pts); shape = `<path d="${line}L${X(vals.length - 1)},${H - B}L${L},${H - B}Z" fill="url(#chG)"/><path d="${line}" fill="none" stroke="${m === "temp" ? "#ffb35c" : "#56c8ff"}" stroke-width="3" stroke-linecap="round"/>`; }
  let nowMark = "";
  if (state.selectedDay === 0) { const nh = cityNow().getUTCHours(); if (nh < idx.length) nowMark = `<line x1="${X(nh)}" x2="${X(nh)}" y1="${T}" y2="${H - B}" stroke="#fff" stroke-opacity=".35" stroke-dasharray="4 5"/><text x="${X(nh)}" y="${T - 6}" fill="#fff" font-size="11" text-anchor="middle" opacity=".8">Now</text>`; }
  const col = m === "temp" ? "#ffb35c" : "#56c8ff";
  $("#fcChart").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Hourly ${m} chart"><defs><linearGradient id="chG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".5"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
    ${grid}${shape}${nowMark}${xl}<line id="chLine" y1="${T}" y2="${H - B}" stroke="#fff" stroke-opacity=".5" opacity="0"/><circle id="chDot" r="5.5" fill="#fff" stroke="${col}" stroke-width="3" opacity="0"/>
    <rect id="chHit" x="${L}" y="0" width="${W - L - R}" height="${H}" fill="transparent"/></svg><div class="chart-tip" id="chTip"></div>`;
  const svg = $("#fcChart svg"), tip = $("#chTip"), line = $("#chLine"), dot = $("#chDot");
  const move = e => {
    const r = svg.getBoundingClientRect(), vx = (e.clientX - r.left) / r.width * W, i = clamp(Math.round((vx - L) / step), 0, idx.length - 1), k = idx[i];
    const x = X(i), y = pts[i][1], hr = Number(h.time[k].slice(11, 13)), info = wxInfo(h.weather_code[k], !!h.is_day[k]);
    line.setAttribute("x1", x); line.setAttribute("x2", x); line.setAttribute("opacity", 1);
    dot.setAttribute("cx", x); dot.setAttribute("cy", y); dot.setAttribute("opacity", 1);
    tip.innerHTML = `<b>${hourLabel(hr)}</b> · ${info.en}<br>${fmt.tu(h.temperature_2m[k])} · ${h.precipitation_probability[k] ?? 0}% rain · ${fmt.wind(h.wind_speed_10m[k])}`;
    tip.style.left = clamp(x / W * r.width, 90, r.width - 90) + "px"; tip.style.top = (y / H * r.height) + "px"; tip.classList.add("on");
  };
  const leave = () => { line.setAttribute("opacity", 0); dot.setAttribute("opacity", 0); tip.classList.remove("on"); };
  const hit = $("#chHit"); hit.addEventListener("pointermove", move); hit.addEventListener("pointerdown", move); hit.addEventListener("pointerleave", leave);
}
function renderHourly() {
  const h = state.weather.hourly, base = state.selectedDay * 24, nh = cityNow().getUTCHours(), out = [];
  for (let k = base; k < base + 24 && h.time[k]; k++) {
    const hr = Number(h.time[k].slice(11, 13)), info = wxInfo(h.weather_code[k], !!h.is_day[k]), rp = h.precipitation_probability[k] ?? 0;
    out.push(`<div class="hour${state.selectedDay === 0 && hr === nh ? " now" : ""}"><span>${state.selectedDay === 0 && hr === nh ? "Now" : hourLabel(hr)}</span><div class="wi-wrap">${wxIcon(info.kind, !!h.is_day[k])}</div><strong>${fmt.tu(h.temperature_2m[k])}</strong><em>${rp >= 10 ? rp + "%" : "&nbsp;"}</em></div>`);
  }
  const strip = $("#fcHourly"); strip.innerHTML = out.join("");
  const now = $(".hour.now", strip); strip.scrollLeft = now ? Math.max(0, now.offsetLeft - strip.clientWidth / 2 + 34) : 0;
}
function renderDays() {
  const d = state.weather.daily, mn = Math.min(...d.temperature_2m_min), mx = Math.max(...d.temperature_2m_max), span = mx - mn || 1;
  $("#fcDays").innerHTML = d.time.map((t, i) => {
    const dt = isoDate(t), info = wxInfo(d.weather_code[i], true), rc = d.precipitation_probability_max?.[i] ?? 0;
    const l = (d.temperature_2m_min[i] - mn) / span * 100, wd = Math.max(10, (d.temperature_2m_max[i] - d.temperature_2m_min[i]) / span * 100);
    return `<button type="button" class="day-row${i === state.selectedDay ? " on" : ""}" data-i="${i}" aria-label="${DAYS_LONG[dt.getUTCDay()]}">
      <div><b>${i === 0 ? "Today" : dayShort(dt)}</b><small>${dateShort(dt)}</small></div><div class="wi-wrap">${wxIcon(info.kind, true)}</div>
      <div><div class="range-bar"><i style="left:${l}%;width:${Math.min(wd, 100 - l)}%"></i></div>${rc >= 20 ? `<div class="rain-pct">${rc}% rain</div>` : `<div class="rain-pct">&nbsp;</div>`}</div>
      <div class="day-temps"><b>${fmt.tu(d.temperature_2m_max[i])}</b><span>${fmt.tu(d.temperature_2m_min[i])}</span></div></button>`;
  }).join("");
}

/* ---------- 13. NEWS (smart alerts from live data) ---------- */
const CAT_LABEL = { alert: "Alert", health: "Health", travel: "Travel", farm: "Farming", outlook: "Outlook" };
function buildNews() {
  const w = state.weather; if (!w) return [];
  const c = w.current, d = w.daily, h = w.hourly, air = state.air?.current, out = [];
  const dn = i => i === 0 ? "today" : i === 1 ? "tomorrow" : "on " + DAYS_LONG[isoDate(d.time[i]).getUTCDay()];
  const tag = i => i === 0 ? "Today" : i === 1 ? "Tomorrow" : `${dayShort(isoDate(d.time[i]))} ${dateShort(isoDate(d.time[i]))}`;
  const add = o => out.push(Object.assign({ tone: "info", pri: 1 }, o));
  const argMax = a => a.indexOf(Math.max(...a)), argMin = a => a.indexOf(Math.min(...a));
  const info = wxInfo(c.weather_code, !!c.is_day), n = d.time.length;

  const hotI = argMax(d.temperature_2m_max), maxT = d.temperature_2m_max[hotI];
  if (maxT >= 40) add({ cat: "alert", tone: "alert", ic: "thermo", pri: 9, tag: tag(hotI), title: `Extreme heat expected ${dn(hotI)}`, body: `Temperatures may reach ${fmt.tu(maxT)}. Avoid the midday sun, drink water regularly and check on children and elderly relatives.` });
  else if (maxT >= 35) add({ cat: "health", tone: "warn", ic: "thermo", pri: 6, tag: tag(hotI), title: `Hot spell: up to ${fmt.tu(maxT)} ${dn(hotI)}`, body: "Plan outdoor work for the early morning or evening and keep a water bottle with you." });
  const coldI = argMin(d.temperature_2m_min), minT = d.temperature_2m_min[coldI];
  if (minT <= 3) add({ cat: "alert", tone: "alert", ic: "thermo", pri: 8, tag: tag(coldI), title: `Frost risk ${dn(coldI)}`, body: `Lows could drop to ${fmt.tu(minT)}. Protect plants, pipes and pets, and dress warmly.` });
  else if (minT <= 10) add({ cat: "health", tone: "info", ic: "thermo", pri: 3, tag: tag(coldI), title: `Chilly ${dn(coldI) === "today" ? "night" : "night " + dn(coldI)}`, body: `Lows near ${fmt.tu(minT)}. A warm layer is a good idea in the morning and after dark.` });

  const wetI = d.time.findIndex((_, i) => (d.precipitation_probability_max?.[i] ?? 0) >= 60 || (d.precipitation_sum?.[i] ?? 0) >= 2);
  const heavyI = d.precipitation_sum.findIndex(v => v >= 25);
  if (heavyI >= 0) add({ cat: "alert", tone: "alert", ic: "rain", pri: 9, tag: tag(heavyI), title: `Heavy rainfall possible ${dn(heavyI)}`, body: `About ${fmt.mm(d.precipitation_sum[heavyI])} of rain is forecast. Expect waterlogging in low-lying areas and avoid flooded roads.` });
  else if (wetI >= 0) add({ cat: "outlook", tone: "info", ic: "rain", pri: 5, tag: tag(wetI), title: `Rain likely ${dn(wetI)}`, body: `${d.precipitation_probability_max?.[wetI] ?? 0}% chance of rain with around ${fmt.mm(d.precipitation_sum[wetI])} expected. Keep an umbrella handy.` });
  else add({ cat: "outlook", tone: "good", ic: "sun", pri: 2, tag: "This week", title: "Dry week ahead", body: "No significant rain is forecast over the next seven days." });
  const stormI = d.weather_code.findIndex(v => v >= 95);
  if (stormI >= 0) add({ cat: "alert", tone: "alert", ic: "zap", pri: 9, tag: tag(stormI), title: `Thunderstorm risk ${dn(stormI)}`, body: "Storms can bring lightning, sudden gusts and heavy downpours. Stay away from open fields, trees and power lines." });
  const gustI = argMax(d.wind_gusts_10m_max), gust = d.wind_gusts_10m_max[gustI];
  if (gust >= 60) add({ cat: "alert", tone: "alert", ic: "wind", pri: 8, tag: tag(gustI), title: `Damaging gusts up to ${fmt.wind(gust)}`, body: `Strong gusts are expected ${dn(gustI)}. Secure loose objects and avoid driving high-sided vehicles.` });
  else if (gust >= 40) add({ cat: "travel", tone: "warn", ic: "wind", pri: 5, tag: tag(gustI), title: `Strong winds ${dn(gustI)}`, body: `Gusts may reach ${fmt.wind(gust)}. Expect dust and a bumpy ride on open roads.` });

  const uv = Math.round(d.uv_index_max?.[0] ?? 0);
  if (uv >= 8) add({ cat: "health", tone: "warn", ic: "sun", pri: 6, tag: "Today", title: `Very high UV (${uv}) today`, body: "Limit direct sun between 11 AM and 4 PM. Use SPF 30+, sunglasses and a hat." });
  else if (uv >= 6) add({ cat: "health", tone: "info", ic: "sun", pri: 3, tag: "Today", title: `High UV index (${uv})`, body: "Sunscreen is recommended if you will be outside for more than 30 minutes." });
  if (air && air.us_aqi != null) {
    const a = Math.round(air.us_aqi);
    if (a > 150) add({ cat: "health", tone: "alert", ic: "leaf", pri: 8, tag: "Now", title: `Unhealthy air quality (AQI ${a})`, body: "Everyone may feel effects. Limit outdoor exercise, keep windows closed and wear an N95 mask if you must go out." });
    else if (a > 100) add({ cat: "health", tone: "warn", ic: "leaf", pri: 6, tag: "Now", title: `Air quality is poor for sensitive groups (AQI ${a})`, body: "People with asthma, children and older adults should reduce time outdoors." });
    else if (a <= 50) add({ cat: "health", tone: "good", ic: "leaf", pri: 2, tag: "Now", title: `Fresh air today (AQI ${a})`, body: "Air quality is good, so it's a nice day for a walk or a run." });
    if ((air.dust ?? 0) > 100) add({ cat: "health", tone: "warn", ic: "eye", pri: 5, tag: "Now", title: "Dust in the air", body: "Airborne dust is elevated. Wear a mask outdoors and protect your eyes." });
  }
  if ((c.visibility != null && c.visibility < 2000) || info.kind === "fog") add({ cat: "travel", tone: "warn", ic: "eye", pri: 7, tag: "Now", title: `Low visibility (${fmt.vis(c.visibility)})`, body: "Drive slowly, use low-beam headlights and keep a safe distance." });
  if (["rain", "heavyrain", "storm", "showers"].includes(info.kind)) add({ cat: "travel", tone: "warn", ic: "car", pri: 6, tag: "Now", title: "Wet and slippery roads", body: "Allow extra braking distance and avoid sudden turns while the rain lasts." });

  // best time outdoors today
  const nh = cityNow().getUTCHours(); let best = null, cur = null;
  for (let k = Math.max(0, nh); k < 24 && h.time[k]; k++) {
    const ok = h.apparent_temperature[k] >= 16 && h.apparent_temperature[k] <= 33 && (h.precipitation_probability[k] ?? 0) < 30 && h.is_day[k];
    if (ok) { cur = cur ? { s: cur.s, e: k } : { s: k, e: k }; if (!best || cur.e - cur.s > best.e - best.s) best = Object.assign({}, cur); } else cur = null;
  }
  if (best) add({ cat: "outlook", tone: "good", ic: "clock", pri: 4, tag: "Today", title: `Best time outdoors: ${hourLabel(best.s)} – ${hourLabel(best.e + 1)}`, body: "Comfortable temperatures and a low chance of rain make this the best window for exercise or errands." });
  else add({ cat: "outlook", tone: "warn", ic: "clock", pri: 3, tag: "Today", title: "No comfortable outdoor window left today", body: "Heat, cold or rain make the rest of today less pleasant. Plan outdoor tasks for tomorrow." });
  if (n > 1) {
    const diff = d.temperature_2m_max[1] - d.temperature_2m_max[0];
    if (Math.abs(diff) >= 4) add({ cat: "outlook", tone: "info", ic: "thermo", pri: 3, tag: "Tomorrow", title: `Tomorrow will be ${fmt.t(Math.abs(settings.tempUnit === "f" ? diff * 1.8 : diff))}° ${diff > 0 ? "warmer" : "cooler"}`, body: `High of ${fmt.tu(d.temperature_2m_max[1])} compared with ${fmt.tu(d.temperature_2m_max[0])} today.` });
  }
  add({ cat: "outlook", tone: "info", ic: "sunset", pri: 2, tag: "Today", title: `Sunset at ${isoHM(d.sunset[0])}`, body: `Golden hour begins around ${isoHM(new Date(Date.parse(d.sunset[0] + "Z") - 60 * 6e4).toISOString().slice(0, 16))}, which is a lovely time for photos.` });
  add({ cat: "outlook", tone: "info", ic: "calendar", pri: 2, tag: "This week", title: `Highs from ${fmt.tu(Math.min(...d.temperature_2m_max))} to ${fmt.tu(maxT)}`, body: `The warmest day is ${dn(hotI).replace("on ", "")}, and the coolest night is ${fmt.tu(minT)} ${dn(coldI)}.` });

  // farming
  const et0 = d.et0_fao_evapotranspiration?.[0], soonRain = [0, 1].some(i => (d.precipitation_probability_max?.[i] ?? 0) >= 60);
  if (soonRain) add({ cat: "farm", tone: "info", ic: "sprout", pri: 4, tag: "Next 2 days", title: "Hold irrigation and spraying", body: "Rain is likely soon, so delay irrigation, fertiliser and pesticide spraying to avoid wastage." });
  else if (et0 >= 6) add({ cat: "farm", tone: "warn", ic: "sprout", pri: 4, tag: "Today", title: "High crop water demand", body: `Evaporation is about ${et0.toFixed(1)} mm/day with no rain expected. Irrigate in the early morning or evening to reduce losses.` });
  else if (c.wind_speed_10m < 15 && (d.precipitation_probability_max?.[0] ?? 0) < 20) add({ cat: "farm", tone: "good", ic: "sprout", pri: 3, tag: "Today", title: "Good spraying conditions", body: "Light winds and dry weather suit spraying and field work today." });
  else add({ cat: "farm", tone: "info", ic: "sprout", pri: 2, tag: "Today", title: "Field conditions are average", body: "Check wind and rain before spraying, and irrigate according to soil moisture." });

  out.sort((a, b) => b.pri - a.pri);
  out.forEach(o => { o.spoken = `${o.title}. ${o.body}`; });
  return out;
}
function rebuildNews() {
  state.news = buildNews(); renderNews(); startTicker();
  $("#newsDot").hidden = state.page === "news" || !state.news.some(n => n.tone === "alert" || n.tone === "warn");
}
function renderNews() {
  if (!state.weather) return;
  const c = state.weather.current, d = state.weather.daily, info = wxInfo(c.weather_code, !!c.is_day), s = describe();
  const alerts = state.news.filter(n => n.tone === "alert").length;
  $("#newsBrief").innerHTML = `<div class="wi-wrap">${wxIcon(info.kind, !!c.is_day)}</div><div><h3>${esc(state.city.name)}: ${info.en}, ${fmt.tu(c.temperature_2m)}</h3>
    <p>${esc(s.l1)} ${esc(s.l2)} Today's high is ${fmt.tu(d.temperature_2m_max[0])} and the low is ${fmt.tu(d.temperature_2m_min[0])}. ${alerts ? `There ${alerts === 1 ? "is 1 active alert" : `are ${alerts} active alerts`} for your area.` : "No severe weather alerts right now."}</p></div>
    <button class="pill-btn" id="briefPlay" type="button">${icon("speaker")}<span>Listen to briefing</span></button>`;
  const list = state.news.filter(n => state.newsCat === "all" || n.cat === state.newsCat);
  $("#newsGrid").innerHTML = list.length ? list.map((n, i) => `<article class="news-card" data-tone="${n.tone}" style="animation-delay:${Math.min(i, 10) * .04}s">
    <header><span class="news-ic">${icon(n.ic)}</span><div class="news-tag">${CAT_LABEL[n.cat]} · ${esc(n.tag)}</div></header>
    <h4>${esc(n.title)}</h4><p>${esc(n.body)}</p>
    <footer><span>${n.tone === "alert" ? "High priority" : n.tone === "warn" ? "Heads up" : n.tone === "good" ? "Good news" : "For your info"}</span><button type="button" data-n="${state.news.indexOf(n)}">${icon("speaker")}Listen</button></footer></article>`).join("")
    : `<p class="muted">Nothing to report in this category right now.</p>`;
  $$("#newsFilters .chip").forEach(b => b.classList.toggle("on", b.dataset.cat === state.newsCat));
}
let tickerTimer, tickerI = 0;
function tickerItems() { return state.news.filter(n => n.pri >= 3).slice(0, 5); }
function showTicker() {
  const el = $("#weatherNews"), items = tickerItems();
  if (!items.length) { el.textContent = "No weather alerts right now. Enjoy your day!"; return; }
  const n = items[tickerI % items.length]; el.textContent = `${n.title}. ${n.body}`; el.title = el.textContent; el.dataset.n = state.news.indexOf(n);
}
function startTicker() {
  clearInterval(tickerTimer); tickerI = 0; showTicker();
  tickerTimer = setInterval(() => {
    if (state.page !== "home" || tickerItems().length < 2) return;
    const el = $("#weatherNews"); el.classList.add("swap");
    setTimeout(() => { tickerI++; showTicker(); el.classList.remove("swap"); }, 380);
  }, 7000);
}

/* ---------- 14. RADAR & MAPS ---------- */
function loadLeaflet() {
  if (window.L && L.map) return Promise.resolve(true);
  if (loadLeaflet.p) return loadLeaflet.p;
  const css = href => new Promise((res, rej) => { const l = document.createElement("link"), t = setTimeout(() => { l.remove(); rej(new Error("css timeout")); }, 7000); l.rel = "stylesheet"; l.href = href; l.onload = () => { clearTimeout(t); res(); }; l.onerror = () => { clearTimeout(t); l.remove(); rej(new Error("css failed")); }; document.head.appendChild(l); });
  const js = src => new Promise((res, rej) => { const s = document.createElement("script"), t = setTimeout(() => { s.remove(); rej(new Error("timeout")); }, 9000); s.src = src; s.onload = () => { clearTimeout(t); res(); }; s.onerror = () => { clearTimeout(t); s.remove(); rej(new Error("js failed")); }; document.head.appendChild(s); });
  const SRC = [
    ["lib/leaflet.css", "lib/leaflet.js"],
    ["https://unpkg.com/leaflet@1.9.4/dist/leaflet.css", "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"],
    ["https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css", "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"],
    ["https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css", "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js"],
    ["https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css", "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"]
  ];
  loadLeaflet.p = (async () => {
    for (const [c, j] of SRC) { try { await css(c); await js(j); if (window.L && L.map) return true; } catch { /* try the next CDN */ } }
    loadLeaflet.p = null; return false;
  })();
  return loadLeaflet.p;
}
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/";
const BASES = {
  dark: { url: ESRI + "Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", labels: ESRI + "Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}", opt: { maxNativeZoom: 16, maxZoom: 19, attribution: "Tiles © Esri — Esri, HERE, Garmin, © OpenStreetMap contributors" } },
  sat: { url: ESRI + "World_Imagery/MapServer/tile/{z}/{y}/{x}", labels: ESRI + "Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", opt: { maxNativeZoom: 17, maxZoom: 19, attribution: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics" } },
  terrain: { url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", opt: { subdomains: "abc", maxNativeZoom: 17, maxZoom: 19, attribution: "© OpenStreetMap contributors, SRTM | © OpenTopoMap" } }
};
const baseLayer = key => { const b = BASES[key] || BASES.dark; return L.tileLayer(b.url, b.opt); };
/* Base map (no API key needed) with an automatic OpenStreetMap fallback if tiles fail to load */
function swapBase(map, key) {
  ["_base", "_alt", "_lbl"].forEach(k => { if (map[k]) { map.removeLayer(map[k]); map[k] = null; } });
  const b = BASES[key] || BASES.dark, layer = baseLayer(key); let ok = 0, bad = 0;
  layer.on("tileload", () => { ok++; });
  layer.on("tileerror", () => {
    bad++;
    if (!ok && bad >= 4 && !map._alt) {
      map._alt = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, className: key === "dark" ? "osm-dark" : "", attribution: "© OpenStreetMap contributors" }).addTo(map);
      map._alt.bringToBack();
      if (map._lbl) { map.removeLayer(map._lbl); map._lbl = null; }
    }
  });
  layer.addTo(map); layer.bringToBack(); map._base = layer;
  if (b.labels) map._lbl = L.tileLayer(b.labels, { maxNativeZoom: 16, maxZoom: 19, zIndex: 5 }).addTo(map);
}
const radarLayer = (f, opacity = 0) => {
  const l = L.tileLayer(Radar.url(f), { opacity, tileSize: 256, maxNativeZoom: 7, maxZoom: 12, zIndex: 400, className: "radar-tiles" });
  l.on("tileload", () => { Radar.ok++; });
  l.on("tileerror", () => { Radar.bad++; if (Radar.bad >= 8 && !Radar.ok && !Radar.warned) { Radar.warned = true; if (Radar.onFail) Radar.onFail(); } });
  return l;
};
const cityDot = (ll) => L.circleMarker(ll, { radius: 7, color: "#fff", weight: 2, fillColor: "#ff6a3d", fillOpacity: 1 });
const setLive = (sel, ok, label) => { const el = $(sel); if (el) { el.classList.toggle("stale", !ok); el.innerHTML = `<span></span>${ok ? "Live" : (label || "Offline")}`; } };

const Radar = {
  data: null, ok: 0, bad: 0, warned: false, onFail: null,
  resetStats() { this.ok = 0; this.bad = 0; this.warned = false; },
  async load(force = false) {
    if (!force && this.data && Date.now() - this.data.at < 5 * 6e4) return this.data;
    const j = await getJSON(API.radar, { retries: 1 });
    const past = j.radar?.past || [], frames = past.concat(j.radar?.nowcast || []);
    if (!frames.length) throw new Error("no radar frames");
    this.data = { host: j.host || "https://tilecache.rainviewer.com", frames, past: past.length, at: Date.now() };
    return this.data;
  },
  url(f) { return `${this.data.host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`; }
};

/* Small radar on the home screen */
const RadarMini = (() => {
  let map, layers = [], i = 0, timer, marker, ready = false, starting = false;
  const noMap = msg => { $("#radarFallback").classList.toggle("on", !!msg); const m = $("#radarFallbackMsg"); if (m) m.textContent = msg || ""; };
  async function refresh() {
    try {
      const data = await Radar.load(true);
      layers.forEach(l => map.removeLayer(l));
      Radar.resetStats();
      layers = data.frames.slice(-6).map(f => radarLayer(f, 0).addTo(map));
      i = layers.length - 1; layers[i].setOpacity(.85);
      noMap(""); setLive("#radarLive", true);
      clearInterval(timer);
      timer = setInterval(() => { if (state.page !== "home" || document.hidden || layers.length < 2) return; layers[i].setOpacity(0); i = (i + 1) % layers.length; layers[i].setOpacity(.85); }, 900);
    } catch { setLive("#radarLive", false, "No radar"); }
  }
  async function init() {
    if (ready || starting) return; starting = true;
    if (!(await loadLeaflet())) { noMap("Map could not load. Check your internet connection and refresh."); setLive("#radarLive", false); starting = false; return; }
    const c = state.city || DEFAULT_CITY;
    map = L.map("miniRadar", { zoomControl: false, scrollWheelZoom: false, minZoom: 3, maxZoom: 10 }).setView([c.latitude, c.longitude], 6);
    if (map.attributionControl) map.attributionControl.setPrefix(false);
    swapBase(map, "dark");
    Radar.onFail = () => { setLive("#radarLive", false, "No radar"); setLive("#radarLive2", false, "No radar"); const m = $("#radarMsg"); if (m) { m.hidden = false; m.textContent = "Radar tiles are unavailable right now, but the base map still works."; } };
    marker = cityDot([c.latitude, c.longitude]).addTo(map);
    ready = true; starting = false;
    $("#zoomIn").onclick = () => map.zoomIn(); $("#zoomOut").onclick = () => map.zoomOut();
    await refresh();
    setInterval(() => { if (!document.hidden) refresh(); }, 5 * 6e4);
  }
  return {
    init,
    onCity() { if (!ready) return; const c = state.city; map.setView([c.latitude, c.longitude], map.getZoom()); marker.setLatLng([c.latitude, c.longitude]); },
    invalidate() { if (ready) setTimeout(() => map.invalidateSize(), 60); }
  };
})();

/* Full radar page */
const RadarView = (() => {
  let map, baseL, layers = [], frames = [], idx = 0, timer, marker, ready = false, busy = false, opacity = .8, playing = false;
  const msg = t => { const m = $("#radarMsg"); m.hidden = !t; if (t) m.textContent = t; };
  function label(f) {
    const dt = new Date(f.time * 1000 + state.offset * 1000), mins = Math.round((Date.now() / 1000 - f.time) / 60), clock = hm(dt.getUTCHours(), dt.getUTCMinutes());
    return mins > 4 ? `${clock} · ${mins} min ago` : mins < -4 ? `${clock} · forecast` : `${clock} · Latest`;
  }
  function show(i) {
    if (!layers.length) return;
    layers[idx]?.setOpacity(0); idx = clamp(i, 0, layers.length - 1); layers[idx].setOpacity(opacity);
    $("#radarSlider").value = idx; $("#radarTime").textContent = label(frames[idx]);
  }
  function play(on) {
    playing = on; clearInterval(timer);
    $("#radarPlay use").setAttribute("href", on ? "#i-pause" : "#i-play");
    if (on) timer = setInterval(() => show(idx + 1 >= layers.length ? 0 : idx + 1), 650);
  }
  async function load(force) {
    try {
      const data = await Radar.load(force);
      layers.forEach(l => map.removeLayer(l));
      Radar.resetStats();
      frames = data.frames; layers = frames.map(f => radarLayer(f, 0).addTo(map));
      $("#radarSlider").max = frames.length - 1; idx = 0; show(Math.max(0, data.past - 1));
      msg(""); setLive("#radarLive2", true);
    } catch { msg("Live radar is unavailable right now. Please try again in a few minutes."); setLive("#radarLive2", false); }
  }
  async function ensure() {
    if (ready) { map.invalidateSize(); return; }
    if (busy) return; busy = true;
    if (!(await loadLeaflet())) { msg("The map library could not be loaded. Please check your internet connection and reload the page."); busy = false; return; }
    const c = state.city || DEFAULT_CITY;
    map = L.map("radarMap", { minZoom: 3, maxZoom: 10 }).setView([c.latitude, c.longitude], 6);
    swapBase(map, "dark");
    marker = cityDot([c.latitude, c.longitude]).addTo(map).bindTooltip(c.name);
    ready = true; busy = false;
    setTimeout(() => map.invalidateSize(), 450);
    $("#radarPlay").onclick = () => play(!playing);
    $("#radarSlider").oninput = e => { play(false); show(Number(e.target.value)); };
    $("#radarOpacity").oninput = e => { opacity = e.target.value / 100; layers[idx]?.setOpacity(opacity); };
    $("#radarCenter").onclick = () => { const s = state.city; map.flyTo([s.latitude, s.longitude], 6); };
    $("#radarBase").onclick = e => {
      const b = e.target.closest("button"); if (!b) return;
      $$("#radarBase button").forEach(x => x.classList.toggle("on", x === b));
      swapBase(map, b.dataset.base);
    };
    await load(false);
    setInterval(() => { if (state.page === "radar" && !document.hidden) load(true); }, 5 * 6e4);
  }
  return {
    ensure, stop() { play(false); }, invalidate() { if (ready) setTimeout(() => map.invalidateSize(), 60); },
    onCity() { if (!ready) return; const c = state.city; marker.setLatLng([c.latitude, c.longitude]).setTooltipContent(c.name); map.flyTo([c.latitude, c.longitude], map.getZoom()); }
  };
})();

function renderRainOutlook() {
  const w = state.weather; if (!w) return;
  const h = w.hourly, nh = cityNow().getUTCHours(), ks = [];
  for (let k = nh; k < nh + 24 && h.time[k]; k++) ks.push(k);
  if (!ks.length) return;
  const vals = ks.map(k => h.precipitation_probability[k] ?? 0), Wd = 300, Hd = 100, bw = Wd / ks.length;
  const raining = (w.current.precipitation || 0) > 0, nextI = vals.findIndex(v => v >= 40);
  $("#rainOutlookText").textContent = raining ? "It is raining at your location right now." : nextI >= 0 ? `Rain may start around ${hourLabel(Number(h.time[ks[nextI]].slice(11, 13)))} (${vals[nextI]}% chance).` : "No rain expected in the next 24 hours.";
  $("#rainOutlook").innerHTML = `<svg viewBox="0 0 ${Wd} ${Hd + 16}" role="img" aria-label="Rain chance for the next 24 hours">
    ${vals.map((v, i) => `<rect x="${i * bw + 1}" y="${Hd - Math.max(2, v)}" width="${bw - 2}" height="${Math.max(2, v)}" rx="2" fill="${v >= 40 ? "#56c8ff" : "rgba(120,160,255,.35)"}"/>`).join("")}
    <text x="0" y="${Hd + 13}" fill="#8fa6cc" font-size="9">Now</text><text x="${Wd}" y="${Hd + 13}" fill="#8fa6cc" font-size="9" text-anchor="end">+24h</text></svg>`;
}

/* Maps page: temperatures across cities + click anywhere */
const MapsView = (() => {
  let map, baseL, radarL, markers = [], rows = [], ready = false, busy = false, set = "pk", cache = {};
  const msg = t => { const m = $("#mapsMsg"); m.hidden = !t; if (t) m.textContent = t; };
  function cities() {
    if (set === "pk") return PK_CITIES.map(([name, latitude, longitude]) => ({ name, latitude, longitude, country: "Pakistan" }));
    if (set === "world") return WORLD_CITIES.map(([name, latitude, longitude]) => ({ name, latitude, longitude }));
    const seen = new Set();
    return state.favorites.concat(state.recents).filter(c => !seen.has(locKey(c)) && seen.add(locKey(c)));
  }
  const near = (a, b) => Math.abs(a.latitude - b.latitude) < .15 && Math.abs(a.longitude - b.longitude) < .15;
  function popupEl(name, cur, loc) {
    const info = wxInfo(cur.weather_code, !!cur.is_day), el = document.createElement("div");
    el.className = "map-pop";
    el.innerHTML = `<h4>${esc(name)}</h4><div class="row">${wxIcon(info.kind, !!cur.is_day)}<strong>${fmt.tu(cur.temperature_2m)}</strong></div><p>${info.en} · ${fmt.wind(cur.wind_speed_10m)} wind · ${Math.round(cur.relative_humidity_2m)}% humidity</p><button type="button">Open dashboard</button>`;
    $("button", el).addEventListener("click", () => { map.closePopup(); loadCity(loc); location.hash = "#/home"; });
    return el;
  }
  async function pointWeather(ll) {
    const pop = L.popup().setLatLng(ll).setContent('<div class="map-pop"><p>Loading weather…</p></div>').openOn(map);
    try {
      const [w, rev] = await Promise.all([
        getJSON(`${API.forecast}?latitude=${ll.lat.toFixed(3)}&longitude=${ll.lng.toFixed(3)}&current=temperature_2m,weather_code,is_day,wind_speed_10m,relative_humidity_2m&timezone=auto`),
        reverseGeo(ll.lat, ll.lng).catch(() => null)
      ]);
      const name = rev?.name || `${ll.lat.toFixed(2)}, ${ll.lng.toFixed(2)}`;
      pop.setContent(popupEl(name, w.current, { name, admin1: rev?.admin1 || "", country: rev?.country || "", latitude: ll.lat, longitude: ll.lng, timezone: w.timezone }));
    } catch { pop.setContent('<div class="map-pop"><p>Could not load weather for this point.</p></div>'); }
  }
  function fit(list) {
    if (set === "pk") map.fitBounds([[23.6, 60.8], [37, 77.2]], { padding: [10, 10] });
    else if (set === "world") map.setView([28, 45], 2);
    else if (list.length === 1) map.setView([list[0].latitude, list[0].longitude], 8);
    else if (list.length) map.fitBounds(L.latLngBounds(list.map(c => [c.latitude, c.longitude])), { padding: [40, 40], maxZoom: 8 });
  }
  function render(list, arr) {
    markers.forEach(m => map.removeLayer(m)); markers = [];
    rows = list.map((c, i) => ({ c, cur: arr[i]?.current })).filter(r => r.cur);
    rows.forEach(r => {
      const info = wxInfo(r.cur.weather_code, !!r.cur.is_day), on = state.city && near(r.c, state.city);
      r.info = info;
      r.marker = L.marker([r.c.latitude, r.c.longitude], { icon: L.divIcon({ className: "wx-marker", iconSize: [0, 0], html: `<div class="wx-pin${on ? " on" : ""}">${wxIcon(info.kind, !!r.cur.is_day)}<span>${fmt.tu(r.cur.temperature_2m)}</span></div>` }) }).addTo(map);
      r.marker.on("click", e => { L.DomEvent.stopPropagation(e); L.popup().setLatLng([r.c.latitude, r.c.longitude]).setContent(popupEl(r.c.name, r.cur, Object.assign({ timezone: "" }, r.c))).openOn(map); });
      markers.push(r.marker);
    });
    const sorted = rows.slice().sort((a, b) => b.cur.temperature_2m - a.cur.temperature_2m);
    if (sorted.length > 1) {
      const hot = sorted[0], cold = sorted[sorted.length - 1];
      $("#mapExtremes").innerHTML = `<div class="extreme">Hottest<strong>${esc(hot.c.name)} · ${fmt.tu(hot.cur.temperature_2m)}</strong></div><div class="extreme">Coolest<strong>${esc(cold.c.name)} · ${fmt.tu(cold.cur.temperature_2m)}</strong></div>`;
    } else $("#mapExtremes").innerHTML = "";
    $("#mapCityList").innerHTML = sorted.map(r => `<li><button type="button" data-i="${rows.indexOf(r)}" class="${state.city && near(r.c, state.city) ? "on" : ""}">${wxIcon(r.info.kind, !!r.cur.is_day)}<span><b>${esc(r.c.name)}</b><small>${r.info.en} · ${fmt.wind(r.cur.wind_speed_10m)}</small></span><b>${fmt.tu(r.cur.temperature_2m)}</b></button></li>`).join("");
  }
  async function setCities(key) {
    set = key; $$("#mapSet button").forEach(b => b.classList.toggle("on", b.dataset.set === key));
    const list = cities();
    if (!list.length) { markers.forEach(m => map.removeLayer(m)); markers = []; rows = []; $("#mapExtremes").innerHTML = ""; $("#mapCityList").innerHTML = '<li class="muted" style="padding:10px 6px">Tap the star on the home screen to save cities. Your saved and recent cities will appear here.</li>'; return; }
    const ck = key + ":" + list.map(locKey).join("|");
    let d = cache[ck];
    try {
      if (!d || Date.now() - d.at > 10 * 6e4) {
        const j = await getJSON(`${API.forecast}?latitude=${list.map(c => (+c.latitude).toFixed(3)).join(",")}&longitude=${list.map(c => (+c.longitude).toFixed(3)).join(",")}&current=temperature_2m,weather_code,is_day,wind_speed_10m,relative_humidity_2m&timezone=auto`);
        d = cache[ck] = { at: Date.now(), arr: Array.isArray(j) ? j : [j] };
      }
      msg(""); render(list, d.arr); fit(list);
    } catch { msg("Could not load city temperatures. Please check your connection and try again."); }
  }
  async function ensure() {
    if (ready) { map.invalidateSize(); return; }
    if (busy) return; busy = true;
    if (!(await loadLeaflet())) { msg("The map library could not be loaded. Please check your internet connection and reload the page."); busy = false; return; }
    map = L.map("worldMap", { minZoom: 2, maxZoom: 12, worldCopyJump: true }).setView([30, 70], 5);
    swapBase(map, "dark");
    map.on("click", e => pointWeather(e.latlng));
    ready = true; busy = false;
    setTimeout(() => map.invalidateSize(), 450);
    $("#mapSet").onclick = e => { const b = e.target.closest("button"); if (b) setCities(b.dataset.set); };
    $("#mapBase").onclick = e => {
      const b = e.target.closest("button"); if (!b) return;
      $$("#mapBase button").forEach(x => x.classList.toggle("on", x === b));
      swapBase(map, b.dataset.base);
    };
    $("#mapRadar").onchange = async e => {
      if (radarL) { map.removeLayer(radarL); radarL = null; }
      if (e.target.checked) { try { const d = await Radar.load(); radarL = radarLayer(d.frames[Math.max(0, d.past - 1)], .7).addTo(map); } catch { toast("Live radar is unavailable right now."); e.target.checked = false; } }
    };
    $("#mapCityList").onclick = e => {
      const b = e.target.closest("button[data-i]"); if (!b) return;
      const r = rows[Number(b.dataset.i)]; if (!r) return;
      map.flyTo([r.c.latitude, r.c.longitude], Math.max(map.getZoom(), 7));
      setTimeout(() => r.marker.fire("click"), 700);
    };
    const compact = () => $("#worldMap").classList.toggle("map-compact", map.getZoom() <= 5);
    map.on("zoomend", compact);
    await setCities(set); compact();
  }
  return { ensure, invalidate() { if (ready) setTimeout(() => map.invalidateSize(), 60); }, onCity() { if (ready) setCities(set); } };
})();

/* ---------- 15. SETTINGS UI ---------- */
function renderSummary() {
  if (!state.weather) return;
  const s = describe(); $("#summaryLine1").textContent = s.l1; $("#summaryLine2").textContent = s.l2;
}
function motionFactor() {
  const m = settings.motion;
  if (m === "off") return 0; if (m === "reduced") return .4; if (m === "full") return 1;
  return matchMedia("(prefers-reduced-motion: reduce)").matches ? .4 : 1;
}
const qualityFactor = () => ({ high: 1, balanced: .85, low: .55 }[settings.quality] || .85);
function setSetting(k, v) { settings[k] = v; store.set("settings", settings); applySetting(k); }
function applySetting(k) {
  switch (k) {
    case "tempUnit": case "windUnit": case "pressureUnit": case "clock":
      tickClock();
      if (state.weather) { renderHero(); renderHighlights(); renderForecastStrip(); renderForecastPage(); rebuildNews(); renderRainOutlook(); MapsView.onCity(); }
      break;
    case "voiceLang": fillVoiceSelect(); break;
    case "soundOn": case "soundVol": Ambience.update(); updateSoundBtn(); break;
    case "sceneStyle": updateScene(); break;
    case "motion": Scene.setMotion(motionFactor()); break;
    case "quality": Scene.setQuality(qualityFactor()); break;
    case "autoRefresh": scheduleRefresh(); break;
  }
}
function updateSoundBtn() {
  const b = $("#soundBtn"); b.setAttribute("aria-pressed", !!settings.soundOn);
  $("use", b).setAttribute("href", settings.soundOn ? "#i-speaker" : "#i-mute");
}
async function toggleSound() {
  const on = !settings.soundOn;
  if (on && !(await Ambience.enable())) { toast("Sound is not supported in this browser."); return; }
  setSetting("soundOn", on);
  const sw = $('[data-switch="soundOn"]'); if (sw) sw.checked = on;
  toast(on ? "Weather sounds on" : "Weather sounds off");
}
function fillVoiceSelect() {
  const sel = $("#voiceSelect"); if (!sel) return;
  const lang = Voice.effectiveLang(), list = Voice.ok ? Voice.voicesFor(lang) : [];
  sel.innerHTML = `<option value="">Auto (best match)</option>` + list.map(v => `<option value="${esc(v.name)}"${v.name === settings.voiceName ? " selected" : ""}>${esc(v.name)} (${esc(v.lang)})</option>`).join("");
  sel.disabled = !list.length;
  $("#voiceHint").textContent = !Voice.ok ? "This browser does not support speech."
    : settings.voiceLang === "ur" && lang === "ro" ? "No Urdu voice is installed on this device, so Roman Urdu is spoken instead. On Windows you can add one in Settings → Time & language → Speech."
      : !list.length ? "No voices found yet." : "";
}
function renderSaved() {
  $("#savedList").innerHTML = state.favorites.map((f, i) => `<li><button type="button" class="name" data-i="${i}">${esc(f.name)}<small>${esc([f.admin1, f.country].filter(Boolean).join(", "))}</small></button><button type="button" class="icon-btn" data-rm="${i}" aria-label="Remove ${esc(f.name)}">${icon("trash")}</button></li>`).join("");
  $("#savedEmpty").hidden = state.favorites.length > 0;
}
function bindSettings() {
  $$("[data-seg]").forEach(seg => {
    const k = seg.dataset.seg, sync = () => $$("button", seg).forEach(b => b.classList.toggle("on", String(settings[k]) === b.dataset.value));
    sync();
    seg.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; setSetting(k, b.dataset.value); sync(); });
  });
  $$("[data-switch]").forEach(inp => {
    const k = inp.dataset.switch; inp.checked = !!settings[k];
    inp.addEventListener("change", async () => {
      if (k === "soundOn" && inp.checked && !(await Ambience.enable())) { toast("Sound is not supported in this browser."); inp.checked = false; return; }
      setSetting(k, inp.checked); if (k === "voiceOn" && !inp.checked) Voice.stop();
    });
  });
  $$("[data-range]").forEach(r => { const k = r.dataset.range; r.value = settings[k]; r.addEventListener("input", () => setSetting(k, Number(r.value))); });
  $("#voiceSelect").addEventListener("change", e => setSetting("voiceName", e.target.value));
  $("#voiceTest").addEventListener("click", async () => {
    if (!settings.voiceOn) { toast("Turn on the weather voice first."); return; }
    if (Voice.speaking) { Voice.stop(); return; }
    const lang = Voice.effectiveLang();
    Voice.speak({ en: "Hello, this is SkyWatch. Today looks like a great day.", ur: "السلام علیکم، میں اسکائی واچ ہوں۔ آج موسم بہت اچھا ہے۔", ro: "Assalam o alaikum, main SkyWatch hoon. Aaj mausam bohat acha hai." }[lang], { lang, caption: "Testing voice" });
  });
  $("#refreshNow").addEventListener("click", () => { if (state.city) { loadCity(state.city); toast("Refreshing…"); } });
  $("#resetAll").addEventListener("click", () => { if (confirm("Reset all settings to default?")) { store.del("settings"); location.reload(); } });
  $("#savedList").addEventListener("click", e => {
    const rm = e.target.closest("[data-rm]"), nm = e.target.closest(".name");
    if (rm) { toggleFav(state.favorites[Number(rm.dataset.rm)]); }
    else if (nm) { const l = state.favorites[Number(nm.dataset.i)]; if (l) { loadCity(l); location.hash = "#/home"; } }
  });
}

/* ---------- 16. SEARCH & LOCATION ---------- */
let sugg = [], selIdx = -1, suggTok = 0;
const hideSuggest = () => { $("#suggestList").hidden = true; selIdx = -1; };
function renderSuggest(q) {
  const ul = $("#suggestList");
  ul.innerHTML = sugg.length ? sugg.map((s, i) => `<li role="option" data-i="${i}" class="${i === selIdx ? "on" : ""}">${icon("pin")}<div>${esc(s.name)}<small>${esc([s.admin1, s.country].filter(Boolean).join(", "))}</small></div></li>`).join("")
    : `<li class="suggest-empty">No matching cities for “${esc(q)}”</li>`;
  ul.hidden = false;
}
async function chooseLocation(loc) {
  $("#cityInput").value = ""; hideSuggest(); closeLocMenu();
  await loadCity(loc, { speak: settings.autoSpeak });
}
async function searchCity(q) {
  try {
    const r = await geocode(q, 1);
    if (!r.length) { showError(`Could not find “${q}”. Check the spelling or try adding the country.`); return; }
    await chooseLocation(r[0]);
  } catch (e) { showError(errText(e)); }
}
let locRec = [];
function renderLocMenu() {
  const fav = state.favorites; locRec = state.recents.filter(r => !fav.some(f => locKey(f) === locKey(r))).slice(0, 5);
  const item = (l, i, k) => `<button type="button" data-k="${k}" data-i="${i}">${icon(k === "fav" ? "star" : "clock")}${esc(l.name)}<small>${esc(l.country || "")}</small></button>`;
  $("#locMenu").innerHTML = `<button type="button" data-k="geo">${icon("target")}Use my location</button>`
    + (fav.length ? `<h4>Saved</h4>` + fav.map((l, i) => item(l, i, "fav")).join("") : "")
    + (locRec.length ? `<h4>Recent</h4>` + locRec.map((l, i) => item(l, i, "rec")).join("") : "");
}
function closeLocMenu() { $("#locMenu").hidden = true; $("#locBtn").setAttribute("aria-expanded", "false"); }
function useMyLocation() {
  closeLocMenu();
  if (!navigator.geolocation) { toast("Location is not supported in this browser."); return; }
  toast("Finding your location…");
  navigator.geolocation.getCurrentPosition(async pos => {
    const { latitude, longitude } = pos.coords, rev = await reverseGeo(latitude, longitude).catch(() => null);
    loadCity({ name: rev?.name || "My location", admin1: rev?.admin1 || "", country: rev?.country || "", latitude, longitude, timezone: "" }, { speak: settings.autoSpeak });
  }, () => toast("Location is blocked or unavailable. Search for a city instead (open the app via http://localhost if this keeps happening)."), { timeout: 10000, maximumAge: 6e5 });
}
function bindSearch() {
  const input = $("#cityInput"), form = $("#weatherForm");
  input.addEventListener("input", debounce(async () => {
    const q = input.value.trim(), my = ++suggTok;
    if (q.length < 2) { hideSuggest(); return; }
    try { const r = await geocode(q, 6); if (my !== suggTok) return; sugg = r; selIdx = -1; renderSuggest(q); } catch { /* ignore while typing */ }
  }, 260));
  input.addEventListener("keydown", e => {
    const ul = $("#suggestList");
    if (ul.hidden || !sugg.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); selIdx = (selIdx + 1) % sugg.length; renderSuggest(input.value); }
    else if (e.key === "ArrowUp") { e.preventDefault(); selIdx = (selIdx - 1 + sugg.length) % sugg.length; renderSuggest(input.value); }
  });
  $("#suggestList").addEventListener("click", e => { const li = e.target.closest("li[data-i]"); if (li) chooseLocation(sugg[Number(li.dataset.i)]); });
  form.addEventListener("submit", e => {
    e.preventDefault(); const q = input.value.trim(); if (!q) return;
    ++suggTok;
    if (selIdx >= 0 && sugg[selIdx]) chooseLocation(sugg[selIdx]); else searchCity(q);
  });
  $("#locBtn").addEventListener("click", () => {
    const m = $("#locMenu"), open = m.hidden; if (open) renderLocMenu();
    m.hidden = !open; $("#locBtn").setAttribute("aria-expanded", open);
  });
  $("#locMenu").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.k === "geo") useMyLocation();
    else { const l = (b.dataset.k === "fav" ? state.favorites : locRec)[Number(b.dataset.i)]; if (l) chooseLocation(l); }
  });
}

/* ---------- 17. ROUTER & INIT ---------- */
const PAGES = ["home", "forecast", "radar", "maps", "news", "settings"];
function show(page) {
  if (state.page === "radar" && page !== "radar") RadarView.stop();
  state.page = page; document.body.dataset.page = page;
  $$(".page").forEach(p => p.classList.toggle("is-active", p.id === "page-" + page));
  $$(".nav-item").forEach(n => { const on = n.dataset.page === page; n.classList.toggle("active", on); on ? n.setAttribute("aria-current", "page") : n.removeAttribute("aria-current"); });
  document.body.classList.remove("menu-open");
  $("#page-" + page).scrollTop = 0;
  if (page === "home") RadarMini.invalidate();
  if (page === "radar") RadarView.ensure();
  if (page === "maps") MapsView.ensure();
  if (page === "news") $("#newsDot").hidden = true;
  if (page === "forecast" && state.weather) renderHourly();
}
function route() {
  const h = (location.hash || "#/home").replace(/^#\/?/, "").split("/")[0];
  show(PAGES.includes(h) ? h : "home");
}
function speakNews(i) {
  const n = state.news[i]; if (!n) return;
  if (!settings.voiceOn) { toast("Weather voice is turned off in Settings."); return; }
  if (Voice.speaking) { Voice.stop(); return; }
  Voice.speak(n.spoken, { lang: "en", caption: n.title });
}
function bindEvents() {
  $("#mobileMenuButton").onclick = () => document.body.classList.toggle("menu-open");
  $("#sidebarBackdrop").onclick = () => document.body.classList.remove("menu-open");
  $("#favBtn").onclick = () => toggleFav();
  $("#speakBtn").onclick = speakReport;
  $("#soundBtn").onclick = toggleSound;
  $("#voiceStop").onclick = () => Voice.stop();
  $("#micBtn").onclick = startVoiceSearch;
  $("#forecastList").addEventListener("click", e => { const c = e.target.closest(".forecast-card"); if (!c) return; selectDay(Number(c.dataset.i)); location.hash = "#/forecast"; });
  $("#fcDays").addEventListener("click", e => { const r = e.target.closest(".day-row"); if (r) selectDay(Number(r.dataset.i)); });
  $("#fcMetric").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; state.fcMetric = b.dataset.metric; $$("#fcMetric button").forEach(x => x.classList.toggle("on", x === b)); renderChart(); });
  $("#fcSpeak").onclick = () => speakSentences(forecastSentences, `7-day forecast for ${state.city?.name || ""}`);
  $("#newsSpeak").onclick = () => speakNews(Number($("#weatherNews").dataset.n));
  $("#newsFilters").addEventListener("click", e => { const b = e.target.closest(".chip"); if (!b) return; state.newsCat = b.dataset.cat; renderNews(); });
  $("#newsBrief").addEventListener("click", e => { if (e.target.closest("#briefPlay")) speakReport(); });
  $("#newsGrid").addEventListener("click", e => { const b = e.target.closest("button[data-n]"); if (b) speakNews(Number(b.dataset.n)); });
  document.addEventListener("keydown", e => {
    const k = e.key.toLowerCase();
    if (e.ctrlKey && k === "k") { e.preventDefault(); $("#cityInput").focus(); }
    if (e.altKey && k === "r") { e.preventDefault(); if (state.city) loadCity(state.city); }
    if (e.altKey && k === "v") { e.preventDefault(); speakReport(); }
    if (k === "escape") { hideSuggest(); closeLocMenu(); document.body.classList.remove("menu-open"); }
  });
  document.addEventListener("pointerdown", () => Ambience.resume(), { passive: true });
  document.addEventListener("click", e => { if (!e.target.closest(".weather-search")) hideSuggest(); if (!e.target.closest(".loc-wrap")) closeLocMenu(); });
  window.addEventListener("hashchange", route);
  window.addEventListener("resize", debounce(() => { RadarMini.invalidate(); RadarView.invalidate(); MapsView.invalidate(); }, 200));
  window.addEventListener("online", () => { if (state.city) loadCity(state.city, { silent: true }); });
}
async function init() {
  $("#brandIcon").innerHTML = wxIcon("partly", true);
  Scene.init(); Scene.setMotion(motionFactor()); Scene.setQuality(qualityFactor());
  bindSettings(); bindSearch(); bindEvents(); renderSaved(); renderLocMenu(); updateSoundBtn(); fillVoiceSelect();
  tickClock(); setInterval(tickClock, 1000);
  route();
  RadarMini.init();
  const saved = store.get("city", null) || DEFAULT_CITY;
  await loadCity(saved);
  if (!state.weather && saved !== DEFAULT_CITY) await loadCity(DEFAULT_CITY);
  scheduleRefresh();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
