#include <driver/i2s.h>
#include <math.h>

// ==========================================
// Pines del Amplificador MAX98357A (Bocina)
// ==========================================
#define I2S_SCK 12
#define I2S_WS  13
#define I2S_SD_OUT 10

#define I2S_PORT I2S_NUM_0

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("Iniciando prueba de Bocina (Amplificador MAX98357A)...");
  Serial.println("Deberías escuchar un pitido constante (tono de 440Hz).");
  Serial.println("Si no suena, revisa que VCC esté a 5V/3.3V y GND conectado.");

  i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),
    .sample_rate = 16000,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 8,
    .dma_buf_len = 512,
    .use_apll = false,
    .tx_desc_auto_clear = true
  };

  i2s_pin_config_t pin_config = {
    .bck_io_num = I2S_SCK,
    .ws_io_num = I2S_WS,
    .data_out_num = I2S_SD_OUT,
    .data_in_num = I2S_PIN_NO_CHANGE // No usamos micrófono aquí
  };

  i2s_driver_install(I2S_PORT, &i2s_config, 0, NULL);
  i2s_set_pin(I2S_PORT, &pin_config);
}

void loop() {
  Serial.println("Reproduciendo tono de prueba...");
  
  // Generar un bloque de 1024 muestras (2048 bytes)
  const int buffer_size = 1024;
  int16_t samples[buffer_size];
  const int sampleRate = 16000;
  const int freq = 440;
  const int amplitude = 10000; // Un poco más fuerte
  
  for (int i = 0; i < buffer_size; i += 2) {
    // Calculamos la onda para este instante de tiempo
    // Usamos static float t para llevar la cuenta del tiempo continuo
    static float t = 0;
    int16_t val = amplitude * sin(2.0 * PI * freq * t);
    
    samples[i] = val;     // Canal Izquierdo
    samples[i+1] = val;   // Canal Derecho
    
    t += 1.0 / sampleRate;
    if (t >= 1.0) t -= 1.0;
  }
  
  size_t bytesWritten;
  // Escribir todo el bloque de golpe (más estable para I2S)
  i2s_write(I2S_PORT, samples, sizeof(samples), &bytesWritten, portMAX_DELAY);
  delay(10); // Pequeña pausa para no saturar
}
