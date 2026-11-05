const SERVER = "wss://skywriting-iii.onrender.com/";

let ws;
let light1 = 0;          // raw reading, 0-4095
let light2 = 0;          // raw reading, 0-4095
let light3 = 0;          // raw reading, 0-4095
let hasSensorData = false;
let smooth1 = 0;         // smoothed value for drawing
let smooth2 = 0;         // smoothed value for drawing
let smooth3 = 0;         // smoothed value for drawing
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
    const msg = String(event.data).trim();

    const sensorMessage = /^PHO([0-2]),?(\d+)$/.exec(msg);
    if (!sensorMessage) return;

    const value = Number(sensorMessage[2]);
    if (!Number.isFinite(value)) return;

    switch (sensorMessage[1]) {
      case "0": light1 = value; break;
      case "1": light2 = value; break;
      case "2": light3 = value; break;
    }
    hasSensorData = true;
  };

  ws.onclose = () => {
    console.log("disconnected, retrying...");
    setTimeout(connect, 2000);
  };
}

function draw() {
  smooth1 = lerp(smooth1, light1, 0.1);   // ease out the jitter
  smooth2 = lerp(smooth2, light2, 0.1);
  smooth3 = lerp(smooth3, light3, 0.1);

  const t = constrain(map((smooth1 + smooth2 + smooth3) / 3, lightMin, lightMax, 0, 1), 0, 1);

  background(lerpColor(color(20), color(255, 240, 180), t));

  // circle grows with light
  fill(255 - t * 200);
  noStroke();
  circle(width / 2, height / 2, 40 + t * 300);

  // text
  fill(t > 0.5 ? 20 : 220);
  const status = ws.readyState !== 1 ? "connecting..." : hasSensorData ? "receiving sensor data" : "connected; waiting for sensor";
  text(status, 10, 20);
  text("photoresistor 1: " + int(smooth1), 10, 40);
  text("photoresistor 2: " + int(smooth2), 10, 60);
  text("photoresistor 3: " + int(smooth3), 10, 80);
}

function send(msg) {
  if (ws.readyState === 1) ws.send(msg);
}

function keyPressed() {
  if (key === "1" || key === "0") {
    ledState = int(key);
    send("LED" + ledState); // need a keyword to signify LED messages, e.g. "LED1" or "L1" so Arduino can ignore sensor messages
  }
  if (key === " ") {
    ledState = 1 - ledState;   // cycle 1 -> 2 -> 3 -> 1
    send(String(ledState));
  }
}