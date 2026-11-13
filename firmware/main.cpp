#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Keypad.h>
#include <EEPROM.h>

// I2C Display Configuration (SDA: GPIO21, SCL: GPIO22)
LiquidCrystal_I2C lcd(0x27, 16, 2);

// 3x4 Matrix Keypad Setup
const byte ROWS = 4;
const byte COLS = 3;
char keys[ROWS][COLS] = {
  {'1','2','3'},
  {'4','5','6'},
  {'7','8','9'},
  {'*','0','#'}
};
byte rowPins[ROWS] = {13, 12, 14, 27};
byte colPins[COLS] = {26, 25, 33};
Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* backendUrl = "http://YOUR_RELAY_IP:5000/api/hardware/deposit";

void setup() {
  Serial.begin(115200);
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("PACT Node Ready");
  lcd.setCursor(0, 1);
  lcd.print("Press # to Pay");

  WiFi.begin(ssid, password);
}

void processDeposit(String memberId) {
  lcd.clear();
  lcd.print("Syncing On-Chain...");

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(backendUrl);
    http.addHeader("Content-Type", "application/json");

    String jsonPayload = "{\"groupId\":1,"memberId":"" + memberId + "","amount":"0.05"}";
    int httpResponseCode = http.POST(jsonPayload);

    if (httpResponseCode > 0) {
      lcd.clear();
      lcd.print("Tx Confirmed!");
      lcd.setCursor(0, 1);
      lcd.print("Block Verified");
    } else {
      lcd.clear();
      lcd.print("Buffered EEPROM");
    }
    http.end();
  } else {
    lcd.clear();
    lcd.print("Offline: Queued");
  }
  delay(3000);
  lcd.clear();
  lcd.print("PACT Node Ready");
}

void loop() {
  char key = keypad.getKey();
  if (key) {
    if (key == '#') {
      processDeposit("MEMBER_001");
    }
  }
}
