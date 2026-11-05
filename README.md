# esp-sockets

Barebones WebSocket relay for the ESP32 + p5.js class.

    npm install
    npm start

Open http://localhost:3000 in two tabs. Click in one, the other shows the message.

Students on the same WiFi open http://<your-lan-ip>:3000 instead.
Find the LAN IP with `ipconfig getifaddr en0`.

To use from editor.p5js.org (https), expose the relay with a tunnel:

    cloudflared tunnel --url http://localhost:3000

and connect with wss://<the-printed-url>.

note: If you are using school or public wifi, it might block small loT. Make sure you connect to repeat router or phone hotspot instead

