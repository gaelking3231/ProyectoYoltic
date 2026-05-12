/**
 * YOLTIC — BLE Audio Transmission Protocol
 * 
 * Handles BLE server setup, audio characteristic notifications,
 * and the packet protocol for streaming audio from ESP32-S3
 * to the Flutter mobile bridge.
 * 
 * Packet Format:
 *   [seq_num (2 bytes, big-endian)]
 *   [flags   (1 byte)]
 *   [data    (up to 509 bytes)]
 * 
 * Flags:
 *   0x01 = Start of audio segment
 *   0x02 = End of audio segment
 *   0x04 = Currently streaming
 */

#ifndef BLE_AUDIO_H
#define BLE_AUDIO_H

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include "config.h"

// ──────────────────────────────────────────────────────────────
// BLE State
// ──────────────────────────────────────────────────────────────

static BLEServer*         pServer = nullptr;
static BLECharacteristic* pAudioChar = nullptr;
static BLECharacteristic* pConfigChar = nullptr;
static BLECharacteristic* pStatusChar = nullptr;
static bool               bleClientConnected = false;
static uint16_t           bleSequenceNumber = 0;

// Device config (updated via BLE config characteristic)
static uint8_t            currentVolume = DEFAULT_VOLUME;
static uint8_t            currentDialect = DEFAULT_DIALECT;

// ──────────────────────────────────────────────────────────────
// BLE Server Callbacks
// ──────────────────────────────────────────────────────────────

class YolticServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    bleClientConnected = true;
    Serial.println("📱 BLE Client connected");
    
    // Update status characteristic
    uint8_t status[] = {0x01}; // Connected
    pStatusChar->setValue(status, 1);
    pStatusChar->notify();
  }

  void onDisconnect(BLEServer* pServer) {
    bleClientConnected = false;
    Serial.println("📱 BLE Client disconnected");
    
    // Restart advertising
    delay(500);
    BLEDevice::startAdvertising();
    Serial.println("📡 BLE Advertising restarted");
  }
};

// ──────────────────────────────────────────────────────────────
// Config Characteristic Callbacks
// Receives volume/dialect changes from Flutter app
// ──────────────────────────────────────────────────────────────

class ConfigCallback : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pCharacteristic) {
    uint8_t* data = pCharacteristic->getData();
    size_t len = pCharacteristic->getLength();
    
    if (len < 2) return;
    
    uint8_t cmd = data[0];
    uint8_t value = data[1];
    
    switch (cmd) {
      case 0x01: // Volume
        currentVolume = constrain(value, 0, 100);
        Serial.printf("🔊 Volume updated: %d%%\n", currentVolume);
        break;
        
      case 0x02: // Dialect
        currentDialect = value;
        Serial.printf("🌐 Dialect updated: 0x%02X\n", currentDialect);
        break;
        
      default:
        Serial.printf("⚠️ Unknown config command: 0x%02X\n", cmd);
        break;
    }
  }
};

// ──────────────────────────────────────────────────────────────
// BLE Initialization
// ──────────────────────────────────────────────────────────────

void initBLE() {
  Serial.println("🔧 Initializing BLE...");
  
  BLEDevice::init(BLE_DEVICE_NAME);
  
  // Request maximum MTU
  BLEDevice::setMTU(BLE_MTU_SIZE);
  
  // Create BLE Server
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new YolticServerCallbacks());
  
  // Create YOLTIC Service
  BLEService* pService = pServer->createService(BLE_SERVICE_UUID);
  
  // Audio Data Characteristic (notify — for sending audio chunks)
  pAudioChar = pService->createCharacteristic(
    BLE_AUDIO_CHAR_UUID,
    BLECharacteristic::PROPERTY_NOTIFY
  );
  pAudioChar->addDescriptor(new BLE2902());
  
  // Config Characteristic (write — for receiving config from app)
  pConfigChar = pService->createCharacteristic(
    BLE_CONFIG_CHAR_UUID,
    BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR
  );
  pConfigChar->setCallbacks(new ConfigCallback());
  
  // Status Characteristic (notify — connection/streaming status)
  pStatusChar = pService->createCharacteristic(
    BLE_STATUS_CHAR_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  pStatusChar->addDescriptor(new BLE2902());
  
  // Start Service
  pService->start();
  
  // Start Advertising
  BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(BLE_SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
  
  Serial.println("✅ BLE Ready — Advertising as " BLE_DEVICE_NAME);
}

// ──────────────────────────────────────────────────────────────
// Audio Packet Transmission
// ──────────────────────────────────────────────────────────────

/**
 * Send a single audio packet via BLE notification
 * 
 * @param data      Raw PCM audio data
 * @param length    Length of audio data
 * @param flags     Packet flags (FLAG_START_OF_AUDIO, FLAG_END_OF_AUDIO, FLAG_STREAMING)
 */
void sendAudioPacket(uint8_t* data, size_t length, uint8_t flags) {
  if (!bleClientConnected || pAudioChar == nullptr) return;
  
  // Build packet: [seq(2B)][flags(1B)][data(nB)]
  uint8_t packet[BLE_PACKET_SIZE];
  
  // Sequence number (big-endian)
  packet[0] = (bleSequenceNumber >> 8) & 0xFF;
  packet[1] = bleSequenceNumber & 0xFF;
  
  // Flags
  packet[2] = flags;
  
  // Audio data
  size_t copyLen = min(length, (size_t)BLE_AUDIO_PAYLOAD_SIZE);
  memcpy(&packet[BLE_HEADER_SIZE], data, copyLen);
  
  // Send notification
  pAudioChar->setValue(packet, BLE_HEADER_SIZE + copyLen);
  pAudioChar->notify();
  
  bleSequenceNumber++;
}

/**
 * Stream a complete audio buffer via BLE
 * Splits into BLE_AUDIO_PAYLOAD_SIZE chunks with proper flags
 * 
 * @param audioBuffer   Complete raw PCM audio data
 * @param totalLength   Total length of audio data
 */
void streamAudioBuffer(uint8_t* audioBuffer, size_t totalLength) {
  if (!bleClientConnected) {
    Serial.println("⚠️ No BLE client connected, skipping audio stream");
    return;
  }
  
  bleSequenceNumber = 0;
  size_t offset = 0;
  
  Serial.printf("📤 Streaming %d bytes of audio...\n", totalLength);
  
  while (offset < totalLength) {
    size_t remaining = totalLength - offset;
    size_t chunkSize = min(remaining, (size_t)BLE_AUDIO_PAYLOAD_SIZE);
    
    uint8_t flags = FLAG_STREAMING;
    
    // First packet
    if (offset == 0) {
      flags |= FLAG_START_OF_AUDIO;
    }
    
    // Last packet
    if (offset + chunkSize >= totalLength) {
      flags |= FLAG_END_OF_AUDIO;
    }
    
    sendAudioPacket(&audioBuffer[offset], chunkSize, flags);
    
    offset += chunkSize;
    
    // Small delay to prevent BLE congestion
    // BLE 5.0 on ESP32-S3 can handle ~2ms between packets
    delay(3);
  }
  
  Serial.printf("✅ Audio stream complete: %d packets sent\n", bleSequenceNumber);
}

/**
 * Check if a BLE client (Flutter app) is connected
 */
bool isBleConnected() {
  return bleClientConnected;
}

/**
 * Get current device volume (set via BLE config)
 */
uint8_t getVolume() {
  return currentVolume;
}

/**
 * Get current dialect code (set via BLE config)
 */
uint8_t getDialect() {
  return currentDialect;
}

#endif // BLE_AUDIO_H
