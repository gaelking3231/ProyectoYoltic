/**
 * ══════════════════════════════════════════════════════════════
 * YOLTIC — Smart Glasses Firmware
 * ESP32-S3 Main Sketch
 * ══════════════════════════════════════════════════════════════
 * 
 * Architecture:
 *   Core 0: Wi-Fi + Firebase Realtime Database listener
 *   Core 1: I2S audio capture + BLE transmission (main loop)
 * 
 * Data Flow:
 *   INMP441 Mic → I2S → PCM Buffer → BLE → Flutter App → Firebase
 *   Firebase RTDB → Wi-Fi → ESP32 (config updates)
 */

#include <WiFi.h>
#include <driver/i2s.h>
#include <Firebase_ESP_Client.h>
#include "config.h"
#include "ble_audio.h"

// Provide token generation process info
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Wire.h>

// ──────────────────────────────────────────────────────────────
// Global State
// ──────────────────────────────────────────────────────────────

FirebaseData   fbdo;
FirebaseAuth   fbAuth;
FirebaseConfig fbConfig;

// Audio buffer for I2S capture
int16_t        audioBuffer[AUDIO_BUFFER_SIZE];
uint8_t        transmitBuffer[AUDIO_BUFFER_SIZE * 2]; // 16-bit = 2 bytes/sample
bool           isRecording = false;
bool           wifiConnected = false;
unsigned long  lastFirebaseCheck = 0;

// Device config (synced from Firebase RTDB)
int            fbVolume = DEFAULT_VOLUME;
String         fbDialect = "isthmus";

// Task handle for WiFi/Firebase core
TaskHandle_t   wifiTaskHandle = NULL;

// OLED Display
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// ──────────────────────────────────────────────────────────────
// I2S Audio Setup
// ──────────────────────────────────────────────────────────────

void initI2S() {
  Serial.println("🎙️ Initializing I2S audio...");
  
  i2s_config_t i2sConfig = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = AUDIO_SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = AUDIO_BUFFER_COUNT,
    .dma_buf_len = AUDIO_BUFFER_SIZE,
    .use_apll = false,
    .tx_desc_auto_clear = false,
    .fixed_mclk = 0,
  };
  
  i2s_pin_config_t pinConfig = {
    .bck_io_num = I2S_SCK_PIN,
    .ws_io_num = I2S_WS_PIN,
    .data_out_num = I2S_PIN_NO_CHANGE,
    .data_in_num = I2S_SD_PIN,
  };
  
  esp_err_t err = i2s_driver_install(I2S_PORT, &i2sConfig, 0, NULL);
  if (err != ESP_OK) {
    Serial.printf("❌ I2S driver install failed: %d\n", err);
    return;
  }
  
  err = i2s_set_pin(I2S_PORT, &pinConfig);
  if (err != ESP_OK) {
    Serial.printf("❌ I2S pin config failed: %d\n", err);
    return;
  }
  
  i2s_zero_dma_buffer(I2S_PORT);
  
  Serial.printf("✅ I2S Ready: %d Hz, %d-bit, mono\n", 
    AUDIO_SAMPLE_RATE, AUDIO_BIT_DEPTH);
}

// ──────────────────────────────────────────────────────────────
// Wi-Fi Connection
// ──────────────────────────────────────────────────────────────

void connectWiFi() {
  Serial.printf("📶 Connecting to WiFi: %s\n", WIFI_SSID);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  unsigned long startAttemptTime = millis();
  
  while (WiFi.status() != WL_CONNECTED && 
         millis() - startAttemptTime < WIFI_TIMEOUT_MS) {
    delay(500);
    Serial.print(".");
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.printf("\n✅ WiFi connected! IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    wifiConnected = false;
    Serial.println("\n❌ WiFi connection failed");
  }
}

// ──────────────────────────────────────────────────────────────
// Firebase RTDB Setup
// ──────────────────────────────────────────────────────────────

void initFirebase() {
  if (!wifiConnected) return;
  
  Serial.println("🔥 Initializing Firebase RTDB...");
  
  fbConfig.database_url = FIREBASE_HOST;
  fbConfig.signer.tokens.legacy_token = FIREBASE_AUTH;
  fbConfig.token_status_callback = tokenStatusCallback;
  
  Firebase.begin(&fbConfig, &fbAuth);
  Firebase.reconnectWiFi(true);
  
  // Set initial device status
  String statusPath = String("devices/") + DEVICE_ID + "/status";
  Firebase.RTDB.setString(&fbdo, statusPath.c_str(), "online");
  
  Serial.println("✅ Firebase RTDB connected");
}

// ──────────────────────────────────────────────────────────────
// Firebase Config Listener (runs on Core 0)
// ──────────────────────────────────────────────────────────────

void checkFirebaseConfig() {
  if (!wifiConnected || !Firebase.ready()) return;
  
  String basePath = String("devices/") + DEVICE_ID;
  
  // 1. Check for incoming translations (Zapotec text to show on glasses)
  if (Firebase.RTDB.getString(&fbdo, (basePath + "/last_translation").c_str())) {
    String newTranslation = fbdo.stringData();
    static String currentTranslation = "";
    
    if (newTranslation.length() > 0 && newTranslation != currentTranslation) {
      currentTranslation = newTranslation;
      Serial.printf("📜 New translation received: %s\n", newTranslation.c_str());
      
      // Update OLED
      display.clearDisplay();
      display.setCursor(0, 0);
      display.println("TRADUCCION:");
      display.println("");
      display.setTextSize(1);
      display.println(newTranslation);
      display.display();
    }
  }

  // 2. Check for config updates
  if (Firebase.RTDB.getJSON(&fbdo, (basePath + "/config").c_str())) {
    FirebaseJson& json = fbdo.jsonData();
    FirebaseJsonData result;
    
    // Read volume
    if (json.get(result, "volume")) {
      int newVolume = result.intValue;
      if (newVolume != fbVolume) {
        fbVolume = newVolume;
        Serial.printf("🔊 Volume from cloud: %d%%\n", fbVolume);
      }
    }
    
    // Read dialect
    if (json.get(result, "dialect")) {
      String newDialect = result.stringValue;
      if (newDialect != fbDialect) {
        fbDialect = newDialect;
        Serial.printf("🌐 Dialect from cloud: %s\n", fbDialect.c_str());
      }
    }
  }
}

// ──────────────────────────────────────────────────────────────
// Core 0 Task: WiFi + Firebase
// ──────────────────────────────────────────────────────────────

void wifiFirebaseTask(void* parameter) {
  Serial.println("🧵 Core 0: WiFi/Firebase task started");
  
  connectWiFi();
  initFirebase();
  
  while (true) {
    // Reconnect WiFi if needed
    if (WiFi.status() != WL_CONNECTED) {
      wifiConnected = false;
      Serial.println("📶 WiFi lost, reconnecting...");
      connectWiFi();
      if (wifiConnected) initFirebase();
    }
    
    // Check for config updates from Firebase RTDB
    if (millis() - lastFirebaseCheck > FIREBASE_POLL_INTERVAL) {
      checkFirebaseConfig();
      lastFirebaseCheck = millis();
    }
    
    // Update device heartbeat
    static unsigned long lastHeartbeat = 0;
    if (millis() - lastHeartbeat > 30000) { // Every 30s
      if (wifiConnected && Firebase.ready()) {
        String heartbeatPath = String("devices/") + DEVICE_ID + "/lastSeen";
        Firebase.RTDB.setInt(&fbdo, heartbeatPath.c_str(), millis());
      }
      lastHeartbeat = millis();
    }
    
    delay(100); // Yield to other tasks
  }
}

// ──────────────────────────────────────────────────────────────
// Audio Recording
// ──────────────────────────────────────────────────────────────

/**
 * Record audio from I2S and stream via BLE
 * Includes simple VAD (Voice Activity Detection) to filter noise
 */
void recordAndStreamAudio() {
  if (!isBleConnected()) {
    Serial.println("⚠️ No BLE client — cannot record");
    return;
  }
  
  isRecording = true;
  Serial.println("🎙️ Recording started...");
  
  // Notify status
  digitalWrite(LED_STATUS_PIN, HIGH);
  
  // Accumulate audio
  const int recordDurationMs = 4000; // Increased to 4s
  const int totalSamples = (AUDIO_SAMPLE_RATE * recordDurationMs) / 1000;
  const int totalBytes = totalSamples * 2;
  
  uint8_t* fullBuffer = (uint8_t*)malloc(totalBytes);
  if (fullBuffer == NULL) {
    Serial.println("❌ Failed to allocate audio buffer");
    isRecording = false;
    return;
  }
  
  int bytesRecorded = 0;
  size_t bytesRead = 0;
  unsigned long startTime = millis();
  
  // VAD Parameters
  const int threshold = 500; // Adjust based on conference noise
  bool voiceDetected = false;
  int silenceCounter = 0;
  const int silenceLimit = 20; // Chunks of silence before stopping
  
  while (bytesRecorded < totalBytes && 
         millis() - startTime < recordDurationMs + 1000) {
    
    esp_err_t err = i2s_read(I2S_PORT, audioBuffer, AUDIO_BUFFER_SIZE * sizeof(int16_t), &bytesRead, portMAX_DELAY);
    
    if (err == ESP_OK && bytesRead > 0) {
      int16_t* samples = audioBuffer;
      int numSamples = bytesRead / sizeof(int16_t);
      
      // Simple RMS-like VAD
      long long sumSq = 0;
      for (int i = 0; i < numSamples; i++) {
        sumSq += (long long)samples[i] * samples[i];
      }
      long rms = sqrt(sumSq / numSamples);
      
      if (rms > threshold) {
        voiceDetected = true;
        silenceCounter = 0;
      } else if (voiceDetected) {
        silenceCounter++;
      }

      // If we haven't detected voice yet, we just discard or wait
      if (!voiceDetected && bytesRecorded == 0) {
        // Optional: still record a tiny bit to avoid clipping
        continue; 
      }

      // Stop if user stopped talking
      if (silenceCounter > silenceLimit) {
        Serial.println("🤫 Silence detected, stopping early...");
        break;
      }
      
      // Volume scaling
      float volumeScale = (float)currentVolume / 100.0f;
      for (int i = 0; i < numSamples; i++) {
        samples[i] = (int16_t)(samples[i] * volumeScale);
      }
      
      int copyBytes = min((int)bytesRead, totalBytes - bytesRecorded);
      memcpy(&fullBuffer[bytesRecorded], audioBuffer, copyBytes);
      bytesRecorded += copyBytes;
    }
  }
  
  Serial.printf("🎵 Recorded %d bytes (%.1fs)\n", 
    bytesRecorded, 
    (float)bytesRecorded / (AUDIO_SAMPLE_RATE * 2));
  
  // Stream via BLE to Flutter app
  streamAudioBuffer(fullBuffer, bytesRecorded);
  
  // Cleanup
  free(fullBuffer);
  isRecording = false;
  digitalWrite(LED_STATUS_PIN, LOW);
  
  Serial.println("✅ Recording complete");
}

// ──────────────────────────────────────────────────────────────
// Setup
// ──────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(SERIAL_BAUD_RATE);
  delay(1000);
  
  Serial.println();
  Serial.println("══════════════════════════════════════");
  Serial.println("  YOLTIC — Smart Glasses v1.0");
  Serial.println("  Zapotec Translation Assistant");
  Serial.println("══════════════════════════════════════");
  Serial.println();
  
  // Setup GPIO
  pinMode(LED_STATUS_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  digitalWrite(LED_STATUS_PIN, LOW);

  // Initialize OLED
  Wire.begin(21, 22); // Standard I2C pins for ESP32, change if using S3 specific pins
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("❌ SSD1306 allocation failed"));
  } else {
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0,0);
    display.println("YOLTIC V1.0");
    display.println("ESPERANDO BLE...");
    display.display();
    Serial.println("✅ OLED Ready");
  }
  
  // Initialize I2S for audio capture
  initI2S();
  
  // Initialize BLE (runs on Core 1 / main loop)
  initBLE();
  
  // Start WiFi/Firebase task on Core 0
  xTaskCreatePinnedToCore(
    wifiFirebaseTask,
    "WiFi_Firebase",
    STACK_SIZE_WIFI,
    NULL,
    1,        // Priority
    &wifiTaskHandle,
    CORE_WIFI_FIREBASE
  );
  
  Serial.println("🚀 YOLTIC Ready!");
  Serial.println("   Press BOOT button to record audio");
  Serial.println("   BLE: Waiting for Flutter app...");
}

// ──────────────────────────────────────────────────────────────
// Main Loop (Core 1: Audio + BLE)
// ──────────────────────────────────────────────────────────────

void loop() {
  // Check record button (BOOT button on ESP32-S3)
  static bool lastButtonState = HIGH;
  bool buttonState = digitalRead(BUTTON_PIN);
  
  // Button pressed (active low)
  if (buttonState == LOW && lastButtonState == HIGH && !isRecording) {
    delay(50); // Debounce
    if (digitalRead(BUTTON_PIN) == LOW) {
      recordAndStreamAudio();
    }
  }
  
  lastButtonState = buttonState;
  
  // Blink LED slowly when BLE is connected
  static unsigned long lastBlink = 0;
  if (isBleConnected() && !isRecording) {
    if (millis() - lastBlink > 2000) {
      digitalWrite(LED_STATUS_PIN, !digitalRead(LED_STATUS_PIN));
      lastBlink = millis();
    }
  } else if (!isBleConnected() && !isRecording) {
    // Fast blink when waiting for BLE connection
    if (millis() - lastBlink > 500) {
      digitalWrite(LED_STATUS_PIN, !digitalRead(LED_STATUS_PIN));
      lastBlink = millis();
    }
  }
  
  delay(10);
}
