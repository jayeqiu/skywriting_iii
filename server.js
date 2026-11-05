// Barebones WebSocket relay: every message from one client goes to all the others.
// Serves ./public over http so sketches can use ws:// without https trouble.

const express = require("express");
const { WebSocketServer } = require("ws");

const PORT = 3000;

const app = express();
app.use(express.static("public"));

const server = app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("connected, clients:", wss.clients.size);

  ws.on("message", (data) => {
    const msg = data.toString();
    for (const client of wss.clients) {
      if (client !== ws && client.readyState === 1) client.send(msg);
    }
  });

  ws.on("close", () => {
    console.log("disconnected, clients:", wss.clients.size);
  });
});
