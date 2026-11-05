#include <Wire.h>

void setup() {
  Serial.begin(115200);
  Wire.begin();
  delay(200);
  Serial.println("Scanning I2C...");
  byte found = 0;
  for (byte addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.print("Device at 0x");
      if (addr < 16) Serial.print('0');
      Serial.println(addr, HEX);
      found++;
    }
  }
  if (!found) Serial.println("Nothing found. Check SDA, SCL and power.");
}

void loop() {}
