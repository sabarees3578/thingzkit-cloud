// Enthutech IoT - Web Editor
// Edit your code and upload directly to your ESP32 via OTA (Over-The-Air) or USB

#include <EnthutechIoT.h>

const char* WIFI_SSID = "YourWiFi";
const char* WIFI_PASS = "YourPassword";
const char* DEVICE_ID = "DEV-A2DD2A86";
const char* API_KEY = "ET-653EC3617BBA4E8F0C9A25AC";
const char* SERVER_IP = "localhost";

EnthutechIoT iot(DEVICE_ID, API_KEY);

void setup() {
    Serial.begin(115200);
    iot.begin(WIFI_SSID, WIFI_PASS, SERVER_IP, 4000);
}

void loop() {
    iot.loop();
    
    // Send sensor data
    iot.beginPayload();
    iot.addField("temperature", analogRead(A0) / 10.0);
    iot.addField("humidity", analogRead(A0) / 20.0);
    iot.sendPayload();
    
    delay(5000);
}