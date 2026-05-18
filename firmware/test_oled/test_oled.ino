#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1

// Pines I2C configurados para tus lentes Yoltic
#define I2C_SDA 8
#define I2C_SCL 9

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n=============================================");
  Serial.println("     YOLTIC - DIAGNOSTICO DE PANTALLA OLED   ");
  Serial.println("=============================================");

  // 1. INICIAR I2C SCANNER
  Serial.println("1. Escaneando bus I2C en busca de dispositivos...");
  Wire.begin(I2C_SDA, I2C_SCL);
  
  byte error, address;
  int nDevices = 0;
  
  for(address = 1; address < 127; address++) {
    Wire.beginTransmission(address);
    error = Wire.endTransmission();
    
    if (error == 0) {
      Serial.print("   -> ¡Dispositivo encontrado en direccion 0x");
      if (address < 16) Serial.print("0");
      Serial.print(address, HEX);
      Serial.println("!");
      nDevices++;
    }
    else if (error == 4) {
      Serial.print("   -> Error desconocido en direccion 0x");
      if (address < 16) Serial.print("0");
      Serial.println(address, HEX);
    }
  }
  
  if (nDevices == 0) {
    Serial.println("❌ ERROR CRITICO: No se detecto NINGUN dispositivo I2C.");
    Serial.println("   Verifica que los cables VCC, GND, SDA (Pin 8) y SCL (Pin 9) esten firmes.");
  } else {
    Serial.println("   Escaneo completado.");
  }
  
  Serial.println("\n2. Inicializando pantalla SSD1306 (Direccion 0x3C)...");
  
  // 2. INICIALIZAR PANTALLA
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("❌ ERROR: La pantalla OLED no respondio al comando de inicio.");
    Serial.println("   Recomendaciones:");
    Serial.println("   - Revisa si SDA y SCL estan invertidos (SDA al Pin 8, SCL al Pin 9).");
    Serial.println("   - Comprueba que la pantalla tenga suficiente voltaje (3.3V o 5V).");
    while(1);
  }
  
  Serial.println("✅ ¡Pantalla inicializada con exito!");
  
  // Mostrar pantalla de bienvenida
  display.clearDisplay();
  display.setTextSize(2);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(10, 15);
  display.println("YOLTIC OK!");
  display.setTextSize(1);
  display.setCursor(10, 45);
  display.println("Pantalla Activa");
  display.display();
  delay(2000);
}

void loop() {
  // Animacion simple de barra deslizante para confirmar que el refresco funciona
  for(int x = 0; x < SCREEN_WIDTH; x += 4) {
    display.clearDisplay();
    
    // Marco exterior
    display.drawRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, SSD1306_WHITE);
    
    // Titulo
    display.setTextSize(1);
    display.setCursor(20, 15);
    display.println("DIAGNOSTICO OK");
    
    // Dibujo de los lentes Yoltic estilizados
    display.drawCircle(45, 35, 10, SSD1306_WHITE);
    display.drawCircle(83, 35, 10, SSD1306_WHITE);
    display.drawLine(55, 35, 73, 35, SSD1306_WHITE);
    
    // Barra de carga animada
    display.fillRect(14, 52, x, 4, SSD1306_WHITE);
    
    display.display();
    delay(50);
  }
}
