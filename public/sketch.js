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
let lightMax = 21504;

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
    const text = typeof event.data === "string"
      ? event.data
      : new TextDecoder().decode(event.data);
    const msg = text.trim();

    const m = /^([rgb]),?(\d+)$/.exec(msg);
    if (!m) {
      console.log("ignored message:", msg);   // only log what we don't understand
      return;
    }

    const channel = m[1];
    const value = Number(m[2]);
    if (!Number.isFinite(value)) return;

    const mapped = constrain(map(value, lightMin, lightMax, 0, 255), 0, 255);

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

  background(r_smooth, g_smooth, b_smooth);

  // pick readable text colour from the background's brightness
  const brightness = 0.299 * r_smooth + 0.587 * g_smooth + 0.114 * b_smooth;
  fill(brightness > 128 ? 20 : 235);

  const status = ws.readyState !== 1
    ? "connecting..."
    : hasSensorData ? "receiving sensor data" : "connected; waiting for sensor";
  text(status, 10, 20);
  text("r: " + int(r) + "  (raw " + rawR + ")", 10, 40);
  text("g: " + int(g) + "  (raw " + rawG + ")", 10, 60);
  text("b: " + int(b) + "  (raw " + rawB + ")", 10, 80);
}