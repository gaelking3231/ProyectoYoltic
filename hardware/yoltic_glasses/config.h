/**
 * YOLTIC — ESP32-S3 Configuration
 * 
 * Hardware constants, pin assignments, BLE/WiFi configuration,
 * and audio parameters for the smart glasses.
 */

#ifndef CONFIG_H
#define CONFIG_H

// ══════════════════════════════════════════════════════════════
// Wi-Fi Configuration
// ══════════════════════════════════════════════════════════════

#define WIFI_SSID          "YOUR_WIFI_SSID"
#define WIFI_PASSWORD      "YOUR_WIFI_PASSWORD"
#define WIFI_TIMEOUT_MS    15000

// ══════════════════════════════════════════════════════════════
// Firebase Realtime Database
// (Used instead of Firestore for real-time ESP32 listeners)
// ══════════════════════════════════════════════════════════════

#define FIREBASE_HOST      "proyectoyoltic-default-rtdb.firebaseio.com"
#define FIREBASE_AUTH      "YOUR_FIREBASE_DATABASE_SECRET"
#define DEVICE_ID          "esp32-glasses-001"

// ══════════════════════════════════════════════════════════════
// BLE Configuration
// ══════════════════════════════════════════════════════════════

#define BLE_DEVICE_NAME    "YOLTIC-Glasses"

// Service UUID (must match Flutter app)
#define BLE_SERVICE_UUID           "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define BLE_AUDIO_CHAR_UUID        "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define BLE_CONFIG_CHAR_UUID       "beb5483e-36e1-4688-b7f5-ea07361b26a9"
#define BLE_STATUS_CHAR_UUID       "beb5483e-36e1-4688-b7f5-ea07361b26aa"

#define BLE_MTU_SIZE       517

// ══════════════════════════════════════════════════════════════
// I2S Audio Configuration (INMP441 MEMS Microphone)
// ══════════════════════════════════════════════════════════════

// I2S Pin Assignments for ESP32-S3
#define I2S_WS_PIN         15   // Word Select (LRCK)
#define I2S_SD_PIN         13   // Serial Data (DOUT from mic)
#define I2S_SCK_PIN        14   // Serial Clock (BCLK)
#define I2S_PORT           I2S_NUM_0

// Audio Parameters
#define AUDIO_SAMPLE_RATE  16000   // 16 kHz (optimal for speech)
#define AUDIO_BIT_DEPTH    16      // 16-bit PCM
#define AUDIO_CHANNELS     1       // Mono
#define AUDIO_BUFFER_SIZE  1024    // I2S DMA buffer size (samples)
#define AUDIO_BUFFER_COUNT 8       // Number of DMA buffers

// ══════════════════════════════════════════════════════════════
// BLE Audio Protocol
// ══════════════════════════════════════════════════════════════

// Packet structure: [seq_num(2B)][flags(1B)][audio_data(509B)]
#define BLE_PACKET_SIZE        512
#define BLE_HEADER_SIZE        3
#define BLE_AUDIO_PAYLOAD_SIZE (BLE_PACKET_SIZE - BLE_HEADER_SIZE)

// Audio flags
#define FLAG_START_OF_AUDIO    0x01
#define FLAG_END_OF_AUDIO      0x02
#define FLAG_STREAMING         0x04

// ══════════════════════════════════════════════════════════════
// Hardware Pins
// ══════════════════════════════════════════════════════════════

#define LED_STATUS_PIN     2     // Onboard LED for status
#define BUTTON_PIN         0     // Boot button (record trigger)
#define DAC_OUTPUT_PIN     25    // DAC output for audio feedback
#define BATTERY_ADC_PIN    34    // Battery voltage monitor

// ══════════════════════════════════════════════════════════════
// System Configuration
// ══════════════════════════════════════════════════════════════

#define SERIAL_BAUD_RATE       115200
#define FIREBASE_POLL_INTERVAL 2000   // ms between RTDB checks
#define WIFI_RECONNECT_DELAY   5000   // ms before WiFi reconnect
#define BLE_RECONNECT_DELAY    3000   // ms before BLE re-advertise

// FreeRTOS Core Assignment
#define CORE_WIFI_FIREBASE     0      // Core 0: WiFi + Firebase
#define CORE_AUDIO_BLE         1      // Core 1: Audio + BLE

// Task Stack Sizes
#define STACK_SIZE_WIFI        8192
#define STACK_SIZE_AUDIO       4096

// ══════════════════════════════════════════════════════════════
// Default Device Config
// ══════════════════════════════════════════════════════════════

#define DEFAULT_VOLUME         50
#define DEFAULT_DIALECT        0x02   // Zapoteco del Istmo
#define DEFAULT_SENSITIVITY    5
#define DEFAULT_SAMPLE_RATE    16000

#endif // CONFIG_H
