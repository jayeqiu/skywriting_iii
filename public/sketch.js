const SERVER = "wss://h4p-websockets.onrender.com/";

let ws;
let light = 0;          // raw reading, 0-4095
let smooth = 0;         // smoothed value for drawing
let lightMin = 0;       // calibrate these from Serial Monitor
let lightMax = 1000;
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
    let msg = String(event.data).trim();

    // only accept sensor lines like "L,2048"; ignore LED messages from others
    if (msg.startsWith("L,")) {
      let v = Number(msg.slice(2));
      if (!isNaN(v)) light = v;
    }
  };

  ws.onclose = () => {
    console.log("disconnected, retrying...");
    setTimeout(connect, 2000);
  };
}

function draw() {
  smooth = lerp(smooth, light, 0.1);   // ease out the jitter

  let t = constrain(map(smooth, lightMin, lightMax, 0, 1), 0, 1);

  background(lerpColor(color(20), color(255, 240, 180), t));

  // circle grows with light
  fill(255 - t * 200);
  noStroke();
  circle(width / 2, height / 2, 40 + t * 300);

  // text
  fill(t > 0.5 ? 20 : 220);
  text(ws.readyState === 1 ? "connected" : "connecting...", 10, 20);
  text("light: " + int(light), 10, 40);
  text("press 1 / 2 / 3 = LED, 0 = off, space = cycle", 10, 60);
  text("LED: " + ledState, 10, 80);
}

function send(msg) {
  if (ws.readyState === 1) ws.send(msg);
}

function keyPressed() {
  if (key === "1" || key === "2" || key === "3") {
    ledState = int(key);
    send(key);
  }
  if (key === "0") {
    ledState = 0;
    send("0");        // your Arduino code ignores "0", see note below
  }
  if (key === " ") {
    ledState = (ledState % 3) + 1;   // cycle 1 -> 2 -> 3 -> 1
    send(String(ledState));
  }
}