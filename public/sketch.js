const SERVER = "wss://h4p-websockets.onrender.com/";

let ws;
let light1 = 0;          // raw reading, 0-4095
let light2 = 0;          // raw reading, 0-4095
let light3 = 0;          // raw reading, 0-4095
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
    const msg = String(event.data).trim();

    // only accept sensor lines like "PHO0,2048"; ignore LED messages from others
    if (msg.startsWith("PHO")) {
      switch (msg[3]) {
        case "0": light1 = Number(msg.slice(4)); break;
        case "1": light2 = Number(msg.slice(4)); break;
        case "2": light3 = Number(msg.slice(4)); break;
      }
      
      send(msg);  // echo to other clients
    }

  };

  ws.onclose = () => {
    console.log("disconnected, retrying...");
    setTimeout(connect, 2000);
  };
}

function draw() {
  smooth1 = lerp(smooth, light1, 0.1);   // ease out the jitter
  smooth2 = lerp(smooth, light2, 0.1);
  smooth3 = lerp(smooth, light3, 0.1);

  const t = constrain(map(smooth, lightMin, lightMax, 0, 1), 0, 1);

  background(lerpColor(color(20), color(255, 240, 180), t));

  // circle grows with light
  fill(255 - t * 200);
  noStroke();
  circle(width / 2, height / 2, 40 + t * 300);

  // text
  fill(t > 0.5 ? 20 : 220);
  text(ws.readyState === 1 ? "connected" : "connecting...", 10, 20);
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