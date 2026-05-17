#include "mbedtls/base64.h"
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>
#include <ArduinoWebsockets.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <Wire.h>
#include <driver/i2s.h>

using namespace websockets;
WebsocketsClient client;

// ==========================================
// Configuración WiFi y Servidor Híbrido
// ==========================================
const char *ssid = "Mega_2.4G_C5B0";
const char *password = "ehs9u5cY"; // Sin espacios al final
// ¡AQUÍ ESTÁ EL PROBLEMA! Azure cambió las URLs para incluir un código aleatorio por seguridad.
const char *websockets_server = "yoltic-inference-ai-gre0cqg8cvcye9en.westeurope-01.azurewebsites.net";
// Azure requiere HTTPS/WSS obligatoriamente. El puerto de WSS es 443.
const uint16_t websockets_port = 443;
const char *websockets_url = "wss://yoltic-inference-ai-gre0cqg8cvcye9en.westeurope-01.azurewebsites.net/ws";

// ==========================================
// Configuración OLED (I2C)
// ==========================================
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define I2C_SDA 8
#define I2C_SCL 9
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// ==========================================
// Configuración I2S (Duplex)
// ==========================================
#define I2S_PORT I2S_NUM_0
#define I2S_SCK 12
#define I2S_WS 13
#define I2S_SD_IN 11  // Micrófono INMP441
#define I2S_SD_OUT 10 // Amplificador MAX98357A

// ==========================================
// Configuración de Audio
// ==========================================
#define SAMPLE_RATE 16000
#define RECORD_TIME 5 // 5 Segundos de grabación restaurados
#define AUDIO_BUFFER_SIZE                                                      \
  (SAMPLE_RATE * 4 *                                                           \
   RECORD_TIME) // 16kHz * 16-bit(2 bytes) * 2 Canales * 5s = 320KB
uint8_t *audioBuffer;

// Generar cabecera WAV de 44 bytes para facilitar el procesamiento en el
// servidor
void createWavHeader(byte *header, int waveDataSize) {
  header[0] = 'R';
  header[1] = 'I';
  header[2] = 'F';
  header[3] = 'F';
  unsigned int fileSize = waveDataSize + 36;
  header[4] = (byte)(fileSize & 0xFF);
  header[5] = (byte)((fileSize >> 8) & 0xFF);
  header[6] = (byte)((fileSize >> 16) & 0xFF);
  header[7] = (byte)((fileSize >> 24) & 0xFF);
  header[8] = 'W';
  header[9] = 'A';
  header[10] = 'V';
  header[11] = 'E';
  header[12] = 'f';
  header[13] = 'm';
  header[14] = 't';
  header[15] = ' ';
  header[16] = 16;
  header[17] = 0;
  header[18] = 0;
  header[19] = 0;
  header[20] = 1;
  header[21] = 0;
  header[22] = 1;
  header[23] = 0;
  header[24] = 0x80;
  header[25] = 0x3E;
  header[26] = 0x00;
  header[27] = 0x00; // 16000
  header[28] = 0x00;
  header[29] = 0x7D;
  header[30] = 0x00;
  header[31] = 0x00; // Byte rate
  header[32] = 2;
  header[33] = 0;
  header[34] = 16;
  header[35] = 0;
  header[36] = 'd';
  header[37] = 'a';
  header[38] = 't';
  header[39] = 'a';
  header[40] = (byte)(waveDataSize & 0xFF);
  header[41] = (byte)((waveDataSize >> 8) & 0xFF);
  header[42] = (byte)((waveDataSize >> 16) & 0xFF);
  header[43] = (byte)((waveDataSize >> 24) & 0xFF);
}

void setupI2S() {
  i2s_config_t i2s_config = {
      .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX | I2S_MODE_RX),
      .sample_rate = SAMPLE_RATE,
      .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
      .channel_format = I2S_CHANNEL_FMT_RIGHT_LEFT,
      .communication_format = I2S_COMM_FORMAT_STAND_I2S,
      .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
      .dma_buf_count = 8,
      .dma_buf_len = 1024,
      .use_apll = false,
      .tx_desc_auto_clear = true,
      .fixed_mclk = 0};

  i2s_pin_config_t pin_config = {.bck_io_num = I2S_SCK,
                                 .ws_io_num = I2S_WS,
                                 .data_out_num = I2S_SD_OUT,
                                 .data_in_num = I2S_SD_IN};

  i2s_driver_install(I2S_PORT, &i2s_config, 0, NULL);
  i2s_set_pin(I2S_PORT, &pin_config);
}

void showOLED(String text) {
  display.clearDisplay();
  display.setCursor(0, 0);
  display.println(text);
  display.display();
}

void setup() {
  Serial.begin(115200);

  // Inicializar PSRAM para buffers de audio pesados
  if (psramFound()) {
    Serial.println("PSRAM Inicializada.");
    audioBuffer = (uint8_t *)ps_malloc(AUDIO_BUFFER_SIZE + 44);
    createWavHeader(audioBuffer, AUDIO_BUFFER_SIZE);
  } else {
    Serial.println("ERROR: Se requiere PSRAM para este modelo (N16R8).");
    while (1)
      ;
  }

  // Inicializar Pantalla OLED
  Wire.begin(I2C_SDA, I2C_SCL);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("ERROR: No se encontró OLED SSD1306.");
    while (1)
      ;
  }
  display.setTextSize(2); // Texto grande
  display.setTextColor(SSD1306_WHITE);
  display.setTextWrap(true);

  showOLED("Conectando\nWiFi...");

  // Conectar WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  showOLED("WiFi OK");
  Serial.println("\nWiFi Conectado!");

  // Inicializar el bus I2S Duplex (Mic y Amp)
  setupI2S();

  // Conectar a WebSockets
  showOLED("Conectando\nServidor");
  client.onMessage(onMessageCallback);

  // Permitir certificados de Azure sin verificacion estricta SSL
  client.setInsecure();

  // Conectar a WebSockets en la ruta /ws usando la URL segura WSS://
  bool connected = client.connect(websockets_url);
  if (connected) {
    showOLED("Listo!");
    Serial.println("Conectado a Servidor WebSocket Híbrido");
  } else {
    showOLED("Error WS");
    Serial.println("Fallo al conectar WebSocket");
  }
}

void recordAudio() {
  showOLED("ESCUCHANDO");
  size_t bytesRead = 0;
  size_t totalBytesRead = 0;
  size_t chunkSize = 4096; // 4KB por ciclo

  Serial.println("Grabando audio y manteniendo WS vivo...");

  while (totalBytesRead < AUDIO_BUFFER_SIZE) {
    size_t toRead = AUDIO_BUFFER_SIZE - totalBytesRead;
    if (toRead > chunkSize)
      toRead = chunkSize;

    i2s_read(I2S_PORT, (void *)(audioBuffer + 44 + totalBytesRead), toRead,
             &bytesRead, portMAX_DELAY);
    totalBytesRead += bytesRead;

    client.poll(); // ¡ESTO EVITA QUE AZURE CORTE LA CONEXIÓN
                   // (Reconectando/Tiempo Excedido)!
  }

  Serial.printf("Grabación finalizada. Bytes: %d\n", totalBytesRead);
}

// Estructura para usar PSRAM en ArduinoJson
struct SpiRamAllocator {
  void *allocate(size_t size) { return ps_malloc(size); }
  void deallocate(void *pointer) { free(pointer); }
  void *reallocate(void *ptr, size_t new_size) {
    return ps_realloc(ptr, new_size);
  }
};
// Reemplazamos DynamicJsonDocument con uno alojado en PSRAM
using SpiRamJsonDocument = BasicJsonDocument<SpiRamAllocator>;

void playRawAudio(const uint8_t *decodedAudio, size_t outputLength) {
  if (!decodedAudio || outputLength == 0)
    return;

  size_t bytesWritten;
  int16_t *mono_samples = (int16_t *)decodedAudio;
  size_t num_mono_samples = outputLength / 2;

  size_t stereo_length = outputLength * 2;
  int16_t *stereo_samples = (int16_t *)ps_malloc(stereo_length);

  if (stereo_samples) {
    for (size_t i = 0; i < num_mono_samples; i++) {
      stereo_samples[i * 2] = mono_samples[i];     // L
      stereo_samples[i * 2 + 1] = mono_samples[i]; // R
    }

    size_t chunk_size = 4096;
    for (size_t i = 0; i < stereo_length; i += chunk_size) {
      size_t to_write =
          (stereo_length - i > chunk_size) ? chunk_size : (stereo_length - i);
      i2s_write(I2S_PORT, ((uint8_t *)stereo_samples) + i, to_write,
                &bytesWritten, portMAX_DELAY);
    }

    free(stereo_samples);
  } else {
    Serial.println("Error: Sin memoria para buffer Stereo.");
  }
}

bool messageReceived = false;
String lastPayload = "";

void onMessageCallback(WebsocketsMessage message) {
  if (message.isText()) {
    String data = message.data();
    // Ignorar el mensaje de bienvenida del servidor para no desincronizar
    if (data.indexOf("YOLTIC") != -1 && data.indexOf("Conectado") != -1) {
      return;
    }
    lastPayload = data;
    messageReceived = true;
  } else if (message.isBinary()) {
    Serial.println("Audio binario recibido!");
    showOLED("Hablando...");
    playRawAudio((const uint8_t *)message.c_str(), message.length());
    showOLED("ESCUCHANDO"); // Restaurar pantalla
  }
}

void processTranslation() {
  showOLED("Enviando...");
  Serial.println("Enviando audio PCM por HTTP POST...");

  HTTPClient http;
  String postUrl = "https://yoltic-inference-ai-gre0cqg8cvcye9en.westeurope-01.azurewebsites.net/api/translate";
  
  http.begin(postUrl);
  http.addHeader("Content-Type", "application/octet-stream");
  http.setTimeout(50000); // 50 segundos para darle tiempo a Azure, Whisper y Claude
  
  // Enviar el audio directamente (HTTPClient se encarga de manejar el tamaño de 320KB internamente)
  int httpResponseCode = http.POST((uint8_t *)(audioBuffer + 44), AUDIO_BUFFER_SIZE);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.print("HTTP Code: ");
    Serial.println(httpResponseCode);
    Serial.println("Respuesta: " + response);
    
    // Parsear la traduccion
    SpiRamJsonDocument doc(1024);
    DeserializationError err = deserializeJson(doc, response);
    
    if (!err) {
      const char *translation = doc["translation"];
      if (translation && strlen(translation) > 0) {
        showOLED(String(translation));
      } else {
        showOLED("Trad. Vacia");
      }

      // Descargar y reproducir el audio TTS
      const char *audioUrl = doc["audio_url"];
      if (audioUrl && strlen(audioUrl) > 0) {
        Serial.printf("Descargando audio de: %s\n", audioUrl);
        HTTPClient httpAudio;
        httpAudio.begin(audioUrl);
        int httpCode = httpAudio.GET();
        if (httpCode == HTTP_CODE_OK) {
          int len = httpAudio.getSize();
          if (len > 0) {
            unsigned char *decodedAudio = (unsigned char *)ps_malloc(len);
            if (decodedAudio) {
              WiFiClient *stream = httpAudio.getStreamPtr();
              int bytesRead = stream->readBytes(decodedAudio, len);
              Serial.printf("Audio descargado de URL: %d bytes. Reproduciendo...\n", bytesRead);
              showOLED("Hablando...");
              playRawAudio(decodedAudio, bytesRead);
              showOLED(translation ? String(translation) : "Listo");
              free(decodedAudio);
            } else {
              Serial.println("Error: Sin memoria en PSRAM para descargar audio.");
            }
          }
        } else {
          Serial.printf("Error al descargar audio TTS: %d\n", httpCode);
        }
        httpAudio.end();
      }
      
      delay(5000); // Mostrar 5 segundos
    } else {
      showOLED("Error JSON");
      delay(3000);
    }
  } else {
    Serial.print("Error HTTP POST: ");
    Serial.println(httpResponseCode);
    showOLED("Error de\nConexion");
    delay(3000);
  }
  
  http.end();
}

void loop() {
  client.poll(); // Mantener vivo el WebSocket
  recordAudio();
  processTranslation();
}
