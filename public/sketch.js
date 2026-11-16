const SERVER = "wss://skywriting-iii.onrender.com/";

let ws;
let r = 0;          // raw reading, 0-4095
let g = 0;          // raw reading, 0-4095
let b = 0;          // raw reading, 0-4095
let hasSensorData = false;
let r_smooth = 0;         // smoothed value for drawing
let g_smooth = 0;         // smoothed value for drawing
let b_smooth = 0;         // smoothed value for drawing
let lightMin = 0;       // calibrate these from Serial Monitor
let lightMax = 65535;
let ledState = 0;       // 0 = off, 1/2/3 = which LED

function setup() {
  createCanvas(400, 400);
  textSize(14);
  connect();
}

function connect() {
  ws = new WebSocket(SERVER);

  ws.onopen = () => console.log("connected to " + SERVER);

  ws.onmessage = (event) => {
    const msg = String(event.data).trim();
    console.log("received: " + msg);

    const sensorMessage = /^(r||g||b),?(\d+)$/.exec(msg);
    if (!sensorMessage) return;

    const value = Number(sensorMessage[2]);
    if (!Number.isFinite(value)) return;

    switch (sensorMessage[0]) {
      case "r": r = map(value, lightMin, lightMax, 0, 255); break;
      case "g": g = map(value, lightMin, lightMax, 0, 255); break;
      case "b": b = map(value, lightMin, lightMax, 0, 255); break;
    }
    hasSensorData = true;
  };

  ws.onclose = () => {
    console.log("disconnected, retrying...");
    setTimeout(connect, 2000);
  };
}

function draw() {
  let t = map(r + g + b, 0, 255 * 3, 0, 1);   // normalize to 0-1
  r_smooth = lerp(r_smooth, r, t);   // ease out the jitter
  g_smooth = lerp(g_smooth, g, t);
  b_smooth = lerp(b_smooth, b, t);

  background(lerpColor(color(20), color(r_smooth, g_smooth, b_smooth), t));

  // // circle grows with light
  // fill(255 - t * 200);
  // noStroke();
  // circle(width / 2, height / 2, 40 + t * 300);

  // text
  fill(t > 0.5 ? 20 : 220);
  const status = ws.readyState !== 1 ? "connecting..." : hasSensorData ? "receiving sensor data" : "connected; waiting for sensor";
  text(status, 10, 20);
  text("r: " + int(r_smooth), 10, 40);
  text("g: " + int(g_smooth), 10, 60);
  text("b: " + int(b_smooth), 10, 80);
}

// function send(msg) {
//   if (ws.readyState === 1) ws.send(msg);
// }

// function keyPressed() {
//   if (key === "1" || key === "0") {
//     ledState = int(key);
//     send("LED" + ledState); // need a keyword to signify LED messages, e.g. "LED1" or "L1" so Arduino can ignore sensor messages
//   }
//   if (key === " ") {
//     ledState = 1 - ledState;   // cycle 1 -> 2 -> 3 -> 1
//     send(String(ledState));
//   }
// }