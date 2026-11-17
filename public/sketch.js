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
const lightMin = 0;
const lightMax = { r: 21504, g: 21504, b: 21504 };

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
  { hue: [340, 20],  brightness: [0, 33],   text: "It\’s hard to help blushing from the stressful task of writing a well-phrased journal entry at the conclusion of another strenuous day of idleness." },
  { hue: [340, 20],  brightness: [33, 66],  text: "In spring it is the dawn that is most beautiful. As the light creeps over the hills, their outlines are dyed a faint red and wisps of purplish cloud trail over them." },
  { hue: [340, 20],  brightness: [0, 100], text: "I wished that all this might indeed continue for a centillion years." },
  { hue: [340, 20],  brightness: [0, 66], text: "The years have passed, And age has come my way. Yet I need only look at this fair flower For all my cares to melt away." },
  // oranges / yellows  (20-70)
  { hue: [20, 70],   brightness: [0, 33],   text: "May dawn bring you a voyage fair and far." },
  { hue: [20, 70],   brightness: [0, 66],  text: "In autumn it is the evenings that are most beautiful, when the glittering sun sinks close to the edge of the hills and the crows fly back to their nests in threes and fours and twos." },
  { hue: [20, 70],   brightness: [0, 66],  text: "I should like each of you to write down the first ancient poem that comes into your head." },
  { hue: [20, 70],   brightness: [0, 100], text: "How can you be so indifferent to it all? I would like everyone to view." },
  { hue: [20, 70],   brightness: [0, 100], text: "I was once wounded by the sharp edge of the silhouette of a skyscraper. I hid it in the smoky glow of dusk." },
  // greens  (70-160)
  { hue: [70, 160],  brightness: [0, 66],  text: "Light filtered through leaves, a quiet green sky." },
  { hue: [70, 160],  brightness: [0, 66],  text: "The eternal silence of these infinite spaces, how frightening it must be for someone like you!" },
  // blues / cyans  (160-260)
  { hue: [160, 260], brightness: [0, 33],   text: "Fly where the sky is thin." },
    { hue: [160, 260], brightness: [0, 50],   text: "It is a rainy day and one is feeling bored. To pass the time, one starts looking through some old papers. And then one comes across the letters of a man one used to love." },
    { hue: [160, 260], brightness: [0, 100],   text: "What is a blue smile? A blue lie? A blue Valentine?" },
  { hue: [160, 260], brightness: [0, 100], text: "Come! How long will your mind be chained to the earth? Do you see into what regions you have come?" },
  { hue: [160, 260], brightness: [0, 100], text: "That which has no beginning has no end." },   // 2nd match: random pick
    { hue: [160, 260], brightness: [0, 100], text: "Drips, streams, currents, torrents of air fret the wash of blue Ocean." },   // 2nd match: random pick
  // violets / magentas  (260-340)
  { hue: [260, 340], brightness: [0, 66],  text: "Dusk: the sky takes off its colours one by one." },
  // any hue
  // { hue: null,       brightness: [0, 10],   text: "The disgrace begins when a man writes not well, but badly." },
  // { hue: null,       brightness: [0, 10],   text: "The stars, round and spherical in form, complete their orbits and circles with marvelous swiftness. Words, spiky and quirky, spreads out slowly." },
  // { hue: null,       brightness: [0, 10],   text: "The stars: though scattered in crowds across the whole sky, share a constant diurnal motion." },
  // { hue: null,       brightness: [0, 10], text: "Things That Cannot Be Compared \nSummer and winter. Night and day. Rain and sunshine. Youth and age. A person’s laughter and his anger. Black and white. Love and hatred. The little indigo plant and the great philodendron. Rain and mist." },
  // { hue: null,       brightness: [0, 10],   text: "It is night and one is expecting a visitor. Suddenly one is startled by the sound of rain-drops, which the wind blows against the shutters." },
  // { hue: null,       brightness: [0, 10],   text: "In a garden full of evergreens the crows are all asleep. Then, towards the middle of the night, the crows in one of the trees suddenly wake up in a great flurry and start flapping about. Their unrest spreads to the other trees, and soon all the birds have been startled from their sleep and are cawing in alarm. How different from the same crows in daytime!" },
  // { hue: null,       brightness: [0, 20],   text: "Last year\’s paper fan. A night with a clear moon." },
  // { hue: null,       brightness: [0, 20],   text: "Swimming in the midnight breeze…" },
  { hue: null,       brightness: [0, 50],   text: "But now it is growing light; there is a sound of people\’s voices, and it looks as if the sun will soon be up." },
  { hue: null,       brightness: [0, 50],   text: "On the actual day of the festival the sky is usually cloudy." },
  { hue: null,       brightness: [10, 80],   text: "When storm-petrels fly in a calm, clear sky, swept in troops before the coming winds, wild ducks, or gulls that flash the sea's light, stretch out their wings and make for shore, or a cloud that lies long on the hilltops." },
  // { hue: null,       brightness: [10, 80],   text: "If shooting stars clash from opposing directions, be on guard for winds that shift from all quarters, winds hard to predict, winds that blow far too erratic for human assessment." },
  // { hue: null,       brightness: [10, 80],   text: "May the stars in the sky preserve their appearance, for star-readers to enjoy during the swirly nights." },
  { hue: null,       brightness: [0, 80],   text: "Beware of the juncture of months, eight nights when the sky is subtly deceptive, bereft of the glint of the bright-eyed moon." },
  { hue: null,       brightness: [0, 80],   text: "A priest\’s language. The speech of men and of women. The common people always tend to add extra syllables to their words." },
  { hue: null,       brightness: [0, 80],   text: "An inkstone with such a hard, smooth surface that the stick glides over it without leaving any deposit of ink." },
  { hue: null,       brightness: [0, 100], text: "Up, up the long, delirious burning blue." },
  { hue: null,       brightness: [0, 100], text: "The ray from your eyes. " },
  { hue: null,       brightness: [0, 100], text: "Things That Cannot Be Compared \nSummer and winter. Night and day. Rain and sunshine. Youth and age. A person’s laughter and his anger. Black and white. Love and hatred. The little indigo plant and the great philodendron. Rain and mist." },
  { hue: null,       brightness: [0, 80], text: "The upper air, the middle air, the lower air is blank." },
  { hue: null,       brightness: [0, 80], text: "People standing near by were speculating about the contents of this message, but I was too far away to hear." },
  { hue: null,       brightness: [0, 90], text: "I\’ll write something on the right, and leave the bottom blank." },
  { hue: null,       brightness: [0, 50], text: "Sometimes a person who is utterly devoid of charm will try to create a good impression by using very elegant language; yet he only succeeds in being ridiculous." },
  { hue: null,       brightness: [0, 50], text: "A good lover will behave as elegantly at dawn as at any other time.\nIndeed, one\’s attachment to a man depends largely on the elegance of his leave-taking." },

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

    const maxForChannel = lightMax[channel];
    const mapped = constrain(map(value, lightMin, maxForChannel, 0, 255), 0, 255);
    if (!Number.isFinite(mapped)) {          // a NaN here would poison the smoothing forever
      console.warn("bad mapping for " + channel + ": value " + value +
                   ", lightMin " + lightMin + ", lightMax " + maxForChannel);
      return;
    }

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

// If a value ever becomes NaN or undefined, reset it to 0 and say which one,
// instead of letting it poison the smoothing (lerp(NaN, x, k) is NaN forever).
function finiteOr0(v, name) {
  if (Number.isFinite(v)) return v;
  console.warn(name + " was " + v + ", reset to 0");
  return 0;
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