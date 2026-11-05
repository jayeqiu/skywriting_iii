// XIAO ESP32-C6 + MPU6050 + LED, talking to the Node relay over WebSockets.
//
// Sends one CSV line per sample:  ax,ay,az,gx,gy,gz   (m/s^2 and rad/s)
// Receives "1" / "0" to turn the LED on D7 on or off.
//
// Libraries (Library Manager):
//   "WebSockets" by Markus Sattler
//   "Adafruit MPU6050" (pulls in Adafruit Unified Sensor + BusIO)

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <Wire.h>
// #include <Adafruit_MPU6050.h>
// #include <Adafruit_Sensor.h>

// ---- settings -------------------------------------------------------------
const char* WIFI_SSID = "gd-network-2g";
const char* WIFI_PASS = "HeheheHahaha";

// const char* SERVER_HOST = "192.168.8.220";   // laptop running server.js
// const int   SERVER_PORT = 3000;
const char* SERVER_HOST = "h4p-esp-sockets.onrender.com/";   // laptop running server.js
const int   SERVER_PORT = 443;
const bool USE_SSL = true;

const int LED = D9;
const unsigned long SEND_INTERVAL_MS = 50;    // 20 samples per second
// ---------------------------------------------------------------------------

WebSocketsClient ws;
// Adafruit_MPU6050 mpu;
unsigned long lastSend = 0;

void onWsEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      Serial.println("ws connected");
      break;
    case WStype_DISCONNECTED:
      Serial.println("ws disconnected");
      break;
    case WStype_TEXT:
      // payload is not null-terminated, so look at the first byte only
      if (length > 0) {
        if (payload[0] == '1') digitalWrite(LED, HIGH);
        if (payload[0] == '0') digitalWrite(LED, LOW);
      }
      break;
    default:
      break;
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(LED, OUTPUT);

  // --- sensor ---
  // Wire.begin();                           // D4 = SDA, D5 = SCL
  // if (!mpu.begin()) {
  //   Serial.println("MPU6050 not found");
  //   while (true) {                        // fast blink = sensor missing
  //     digitalWrite(LED, !digitalRead(LED));
  //     delay(100);
  //   }
  // }
  // mpu.setAccelerometerRange(MPU6050_RANGE_4_G);
  // mpu.setGyroRange(MPU6050_RANGE_500_DEG);
  // mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);

  // --- wifi ---
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("wifi");
  while (WiFi.status() != WL_CONNECTED) {
    digitalWrite(LED, !digitalRead(LED));   // slow blink while connecting
    delay(300);
    Serial.print(".");
  }
  digitalWrite(LED, LOW);
  Serial.print(" connected, ip ");
  Serial.println(WiFi.localIP());

  // --- websocket ---
  ws.begin(SERVER_HOST, SERVER_PORT, "/");
  ws.onEvent(onWsEvent);
  ws.setReconnectInterval(2000);          // retry every 2 s if the server drops
}

void loop() {
  ws.loop();                               // keeps the connection alive, must run often

  // if (ws.isConnected() && millis() - lastSend >= SEND_INTERVAL_MS) {
  //   lastSend = millis();

    // sensors_event_t a, g, temp;
    // mpu.getEvent(&a, &g, &temp);

    // char line[96];
    // snprintf(line, sizeof(line), "%.2f,%.2f,%.2f,%.2f,%.2f,%.2f",
    //          a.acceleration.x, a.acceleration.y, a.acceleration.z,
    //          g.gyro.x, g.gyro.y, g.gyro.z);
    // ws.sendTXT(line);
  // }
}
