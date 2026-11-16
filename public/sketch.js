const SERVER = "wss://skywriting-iii.onrender.com/";

let ws;
let rawR = 0, rawG = 0, rawB = 0;        // raw sensor counts, for calibrating
let r = 0, g = 0, b = 0;                 // mapped colour values, 0-255
let r_smooth = 0, g_smooth = 0, b_smooth = 0;
let hasSensorData = false;

// Calibrate from the raw numbers shown on the canvas.
// 614 ms integration: max count 65535. 50 ms integration: max count 21504.
// Real readings are usually far below the max, so set lightMax near the
// largest value you actually see.
let lightMin = 0;
let lightMax = 2000;

// ---------------- text selection ----------------
const SAT_MIN   = 0.15;   // below this saturation the colour is greyish: hue = none
const EVAL_MS   = 250;    // how often the reading is checked
const SETTLE_MS = 800;    // a new (hue, brightness) cell must stay put this long before text changes
const RESEND_MS = 5000;   // re-send the current text so a late-connecting board still gets it
const MAX_LEN   = 250;    // the board's text buffer is 256 bytes

// hue:        [from, to] in degrees, 0-360. from > to wraps through 0, e.g. [340, 20].
//             null = matches any hue (including grey / low-saturation light).
// brightness: [from, to] in percent, 0-100.
// Several entries can match the same reading: one is picked at random.
// Readings that match nothing are reported in the console.
const TEXTS = [
  // reds / pinks  (340-20)
  { hue: [340, 20],  brightness: [0, 33],   text: "The sky holds its breath before dawn." },
  { hue: [340, 20],  brightness: [33, 66],  text: "A low red sun leans on the hills." },
  { hue: [340, 20],  brightness: [66, 100], text: "Everything the light touches burns a little." },
  // oranges / yellows  (20-70)
  { hue: [20, 70],   brightness: [0, 33],   text: "A lamp left on in a far window." },
  { hue: [20, 70],   brightness: [33, 66],  text: "Amber afternoon; the hours slow down like honey." },
  { hue: [20, 70],   brightness: [66, 100], text: "Noon: the sky says nothing, loudly." },
  // greens  (70-160)
  { hue: [70, 160],  brightness: [33, 66],  text: "Light filtered through leaves, a quiet green sky." },
  // blues / cyans  (160-260)
  { hue: [160, 260], brightness: [0, 33],   text: "Night comes in at the edges, blue on blue." },
  { hue: [160, 260], brightness: [66, 100], text: "Clear air, clear water, nothing in between." },
  { hue: [160, 260], brightness: [66, 100], text: "The wash of blue ocean answers the sky." },   // 2nd match: random pick
  // violets / magentas  (260-340)
  { hue: [260, 340], brightness: [33, 66],  text: "Dusk: the sky takes off its colours one by one." },
  // any hue
  { hue: null,       brightness: [0, 10],   text: "Nearly dark. Perfect for a thought." },
  { hue: null,       brightness: [80, 100], text: "White light: every colour at once, saying nothing." },
];

let hsb = { hue: null, sat: 0, bri: 0 };
let matchCount = 0;
let currentText = "";
let currentKey = null;                   // which set of entries matched when the text was last chosen
let pendingKey = null, pendingSince = 0;
let lastEval = 0, lastResend = 0;

// RGB (0-255) -> hue (degrees on the colour wheel: 0 red, 120 green, 240 blue),
// saturation (0-1) and brightness (0-100, the strongest channel, as in HSB/HSV).
function rgbToHsb(r, g, b) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const d = max - min;
  let hue = 0;
  if (d > 0) {
    if (max === rn)      hue = ((gn - bn) / d) % 6;
    else if (max === gn) hue = (bn - rn) / d + 2;
    else                 hue = (rn - gn) / d + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  const sat = max === 0 ? 0 : d / max;
  return { hue: sat < SAT_MIN ? null : hue, sat, bri: max * 100 };
}

function hueInRange(h, [lo, hi]) {
  if (lo <= hi) return h >= lo && h < hi;
  return h >= lo || h < hi;              // wraps past 360
}

function briInRange(v, [lo, hi]) {
  return v >= lo && (v < hi || hi >= 100);   // top band includes 100
}

function matchIndices(reading) {
  const out = [];
  TEXTS.forEach((t, i) => {
    const hueOk = t.hue === null || (reading.hue !== null && hueInRange(reading.hue, t.hue));
    if (hueOk && briInRange(reading.bri, t.brightness)) out.push(i);
  });
  return out;
}

// the board's font is plain ASCII, so replace typographic characters
function toAscii(s) {
  return s
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\x0A\x20-\x7E]/g, "?");
}

function sendText(str) {
  if (ws && ws.readyState === 1 && str) ws.send("T:" + str);
}

function updateText() {
  hsb = rgbToHsb(r_smooth, g_smooth, b_smooth);
  const idx = matchIndices(hsb);
  matchCount = idx.length;
  const key = idx.join(",");

  // wait until the reading has stayed in the same cell for a moment
  if (key !== pendingKey) { pendingKey = key; pendingSince = millis(); return; }
  if (millis() - pendingSince < SETTLE_MS) return;
  if (key === currentKey) return;        // same set of candidates: keep the current text
  currentKey = key;

  if (idx.length === 0) {
    const h = hsb.hue === null ? "none (greyish)" : Math.round(hsb.hue) + " deg";
    console.warn("No text for hue " + h + ", brightness " + Math.round(hsb.bri) + "%");
    return;                              // the previous text stays on the display
  }

  const chosen = TEXTS[idx[floor(random(idx.length))]];
  currentText = toAscii(chosen.text).slice(0, MAX_LEN);
  console.log("hue " + (hsb.hue === null ? "none" : Math.round(hsb.hue)) +
              ", brightness " + Math.round(hsb.bri) + "% -> " + currentText);
  sendText(currentText);
}

// ---------------- p5 + websocket ----------------
function setup() {
  createCanvas(400, 400);
  textSize(14);
  connect();
}

function connect() {
  ws = new WebSocket(SERVER);
  ws.binaryType = "arraybuffer";   // if the server relays binary frames, we can still read them

  ws.onopen = () => console.log("connected to " + SERVER);

  ws.onmessage = (event) => {
    const raw = typeof event.data === "string"
      ? event.data
      : new TextDecoder().decode(event.data);
    const msg = raw.trim();

    if (msg.startsWith("T:")) return;    // our own text, echoed back by the server

    const m = /^([rgb]),?(\d+)$/.exec(msg);
    if (!m) {
      console.log("ignored message:", msg);   // only log what we don't understand
      return;
    }

    const channel = m[1];
    const value = Number(m[2]);
    if (!Number.isFinite(value)) return;

    const mapped = constrain(map(value, lightMin, lightMax[channel], 0, 255), 0, 255);

    switch (channel) {
      case "r": rawR = value; r = mapped; break;
      case "g": rawG = value; g = mapped; break;
      case "b": rawB = value; b = mapped; break;
    }
    hasSensorData = true;
  };

  ws.onerror = (e) => console.log("websocket error", e);

  ws.onclose = () => {
    console.log("disconnected, retrying...");
    hasSensorData = false;
    setTimeout(connect, 2000);
  };
}

function draw() {
  const k = 0.3;                       // smoothing: lower = smoother
  r_smooth = lerp(r_smooth, r, k);
  g_smooth = lerp(g_smooth, g, k);
  b_smooth = lerp(b_smooth, b, k);

  if (hasSensorData && millis() - lastEval >= EVAL_MS) {
    lastEval = millis();
    updateText();
  }
  if (millis() - lastResend >= RESEND_MS) {
    lastResend = millis();
    sendText(currentText);
  }

  background(r_smooth, g_smooth, b_smooth);
  const brightness = 0.299 * r_smooth + 0.587 * g_smooth + 0.114 * b_smooth;
  fill(brightness > 128 ? 20 : 235);

  const status = ws.readyState !== 1
    ? "connecting..."
    : hasSensorData ? "receiving sensor data" : "connected; waiting for sensor";
  text(status, 10, 20);
  text("raw r/g/b: " + rawR + " / " + rawG + " / " + rawB, 10, 40);
  text("hue: " + (hsb.hue === null ? "none" : Math.round(hsb.hue) + " deg") +
       "   brightness: " + Math.round(hsb.bri) + "%", 10, 60);
  text("matching texts: " + matchCount, 10, 80);
  text(currentText, 10, 110, width - 20, height - 120);   // wrapped inside a box
}