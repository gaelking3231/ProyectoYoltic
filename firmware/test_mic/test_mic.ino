#include <driver/i2s.h>

// ==========================================
// Pines del Micrófono INMP441
// ==========================================
#define I2S_SCK 12
#define I2S_WS  13
#define I2S_SD_IN  11

#define I2S_PORT I2S_NUM_0

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("Iniciando prueba del Micrófono INMP441...");
  Serial.println("HABLA AL MICRÓFONO Y MIRA LOS VALORES. SI SIEMPRE ES 0, HAY UN PROBLEMA DE CABLES.");

  i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = 16000,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 8,
    .dma_buf_len = 512,
    .use_apll = false,
    .tx_desc_auto_clear = false
  };

  i2s_pin_config_t pin_config = {
    .bck_io_num = I2S_SCK,
    .ws_io_num = I2S_WS,
    .data_out_num = I2S_PIN_NO_CHANGE, // No usamos salida aquí
    .data_in_num = I2S_SD_IN
  };

  i2s_driver_install(I2S_PORT, &i2s_config, 0, NULL);
  i2s_set_pin(I2S_PORT, &pin_config);
}

void loop() {
  int16_t samples[256];
  size_t bytesIn = 0;
  
  esp_err_t result = i2s_read(I2S_PORT, &samples, sizeof(samples), &bytesIn, portMAX_DELAY);

  if (result == ESP_OK) {
    int samplesRead = bytesIn / 2; // Cada sample es de 16 bits (2 bytes)
    
    if (samplesRead > 0) {
      // Calcular el volumen promedio (amplitud) de esta lectura
      long sum = 0;
      for (int i = 0; i < samplesRead; i++) {
        sum += abs(samples[i]);
      }
      long average_volume = sum / samplesRead;
      
      // Manda el dato al Serial (Útil para ver en Herramientas -> Serial Plotter)
      Serial.println(average_volume);
    }
  }
}
