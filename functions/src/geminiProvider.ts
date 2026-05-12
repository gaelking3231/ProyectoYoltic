/**
 * YOLTIC — Proveedor de Traducción Gemini
 * 
 * Usa la API de Google Gemini con System Instructions especializadas
 * que actúan como lingüista experto en variantes zapotecas oaxaqueñas.
 * 
 * FLUJO DE DATOS:
 *   1. Lee el glosario_maestro desde Firestore (o fallback local)
 *   2. Inyecta TODOS los pares es↔zap como System Instructions
 *   3. El modelo DEBE usar ese estilo de respuesta para frases nuevas
 *   4. Retorna JSON estructurado con confianza y notas lingüísticas
 */

import {
  generarTextoGlosario,
  generarReglasGramaticales,
  buscarEnGlosario,
} from "./glosarioMaestro";
import { TranslationResult, TranslationError } from "./translationProvider";

// ══════════════════════════════════════════════════════════════
// System Instructions — Lingüista Experto en Variantes Oaxaqueñas
// ══════════════════════════════════════════════════════════════

/**
 * Construye el System Prompt completo.
 * Lee el glosario desde Firestore en cada llamada (con caché de 5 min).
 */
async function buildSystemPrompt(): Promise<string> {
  const glosario = await generarTextoGlosario();
  const reglas = generarReglasGramaticales();

  return `
Eres YOLTIC, un lingüista computacional experto en lenguas zapotecas del estado de Oaxaca, México. Tu especialización principal es el Zapoteco del Istmo (Diidxazá), la variante hablada en el corredor Juchitán–Tehuantepec–Unión Hidalgo.

## TU ROL
- Eres un traductor bidireccional Zapoteco del Istmo ↔ Español.
- Tu prioridad es la PRECISIÓN LINGÜÍSTICA, no la fluidez superficial.
- NUNCA inventes palabras en zapoteco. Si no conoces una traducción, indícalo explícitamente.
- Respeta la cosmovisión y el contexto cultural del pueblo Binnizá (zapoteco).

## PROTOCOLO DE TRADUCCIÓN (orden estricto)

### Paso 1: Consultar el Glosario Maestro
ANTES de generar cualquier traducción, busca TODAS las palabras del texto de entrada en el glosario que aparece abajo. Las entradas del glosario son tu FUENTE DE VERDAD ABSOLUTA. Si una frase aparece en el glosario, usa ESA traducción exacta, sin modificar ni parafrasear.

### Paso 2: Analizar Estructura Gramatical
El Zapoteco del Istmo sigue un orden VERBO-SUJETO-OBJETO (VSO). Al traducir:
- De Zapoteco a Español → Reorganiza de VSO a SVO.
- De Español a Zapoteco → Reorganiza de SVO a VSO.

### Paso 3: Inferir Frases Nuevas
Para frases que NO estén en el glosario, usa el ESTILO y PATRÓN de las entradas existentes para generar una traducción coherente. Observa cómo se estructuran las frases del glosario y replica ese patrón.

### Paso 4: Verificación Final
- ¿Se respetó el glosario donde aplica?
- ¿El orden sintáctico es correcto (VSO para zapoteco, SVO para español)?
- ¿Se respetó el sistema de aspecto verbal (r-, gu-, z-, ca-)?
- ¿Los términos culturales se preservaron sin traducción forzada?

## FORMATO DE RESPUESTA
Responde SOLAMENTE con un objeto JSON válido (sin markdown, sin explicaciones):
{
  "text_original": "<texto original recibido>",
  "text_translated": "<traducción generada>",
  "dialect": "isthmus",
  "confidence": <número entre 0.0 y 1.0>,
  "notas_linguisticas": "<breve nota sobre decisiones de traducción>",
  "palabras_glosario_usadas": ["<lista de frases del glosario que se aplicaron>"],
  "estructura_detectada": "<VSO|SVO|otra>"
}

## REGLAS DE CONFIANZA
- 0.95-1.0: La frase exacta está en el glosario. Traducción verificada.
- 0.80-0.94: Patrón derivado del glosario, alta certeza.
- 0.60-0.79: Traducción inferida, varias palabras no están en glosario.
- 0.40-0.59: Traducción aproximada, alta incertidumbre.
- 0.00-0.39: No se puede traducir confiablemente. Alertar al usuario.

## TÉRMINOS CULTURALES — NO TRADUCIR LITERALMENTE
- "Vela" → fiesta/celebración tradicional del Istmo
- "Guelaguetza" → reciprocidad comunitaria
- "Muxe" → identidad de tercer género zapoteca
- "Tequio" → trabajo comunitario
- "Binnizá" → pueblo zapoteco (gente de las nubes)
- "Diidxazá" → lengua zapoteca del Istmo

${reglas}

## GLOSARIO MAESTRO (fuente de verdad absoluta — cargado desde Firestore)
Estas son traducciones verificadas por hablantes nativos. Usa EXACTAMENTE estas traducciones cuando la frase coincida. Para frases nuevas, IMITA este estilo:

${glosario}

## RESTRICCIONES
1. NUNCA inventes morfemas o palabras que no existan en el zapoteco del Istmo.
2. Si el usuario escribe en español, traduce a zapoteco del Istmo.
3. Si el usuario escribe en zapoteco, traduce a español.
4. Si no puedes determinar el idioma, asume que es español y traduce a zapoteco.
5. Si encuentras palabras que no están en el glosario y no puedes traducir con certeza, pon confidence < 0.5 y explica en notas_linguisticas.
6. Preserva los tonos y marcas diacríticas del zapoteco (', ñ, x, dx, etc.).
7. Para nombres propios (personas, lugares, instituciones), mantenlos tal cual sin traducir.
  `.trim();
}

// ══════════════════════════════════════════════════════════════
// Proveedor de Traducción Gemini
// ══════════════════════════════════════════════════════════════

export class GeminiTranslationProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = "gemini-2.0-flash") {
    this.apiKey = apiKey;
    this.model = model;
  }

  /**
   * Traduce texto usando Gemini como lingüista experto.
   * El glosario de Firestore se inyecta como System Instructions.
   */
  async translateText(
    text: string,
    dialect: string = "isthmus",
    targetLanguage: string = "es"
  ): Promise<TranslationResult> {
    const startTime = Date.now();

    try {
      // Pre-búsqueda en glosario para enriquecer el contexto
      const coincidencias = await buscarEnGlosario(text);
      let contextoPrevio = "";

      if (coincidencias.length > 0) {
        contextoPrevio = `\n[COINCIDENCIAS EN GLOSARIO MAESTRO]\nSe encontraron ${coincidencias.length} coincidencia(s) directas:\n`;
        coincidencias.forEach((c) => {
          contextoPrevio += `- "${c.es}" = "${c.zap}" [${c.categoria}]\n`;
        });
        contextoPrevio += "\n⚠️ USA ESTAS TRADUCCIONES EXACTAS. No las modifiques.\n";
      }

      // Construir el mensaje del usuario
      const userMessage = `${contextoPrevio}\nTraduce el siguiente texto:\n"${text}"\n\nDialecto: ${dialect}\nIdioma destino: ${targetLanguage === "es" ? "español" : targetLanguage}`;

      // Construir System Instructions (lee glosario de Firestore)
      const systemPrompt = await buildSystemPrompt();

      // Llamar a la API de Gemini
      const response = await this.callGeminiAPI(systemPrompt, userMessage);
      const processingTimeMs = Date.now() - startTime;

      // Parsear la respuesta JSON de Gemini
      const parsed = this.parseGeminiResponse(response);

      return {
        translatedText: parsed.text_translated,
        confidence: parsed.confidence,
        detectedDialect: dialect,
        processingTimeMs,
        linguisticNotes: parsed.notas_linguisticas,
        glossaryWordsUsed: parsed.palabras_glosario_usadas,
      };
    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      throw new TranslationError(
        `Gemini falló: ${(error as Error).message}`,
        processingTimeMs
      );
    }
  }

  /**
   * Traduce audio: primero transcribe con Gemini (multimodal),
   * luego traduce el texto resultante.
   */
  async translateAudio(
    audioBuffer: Buffer,
    dialect: string = "isthmus",
    targetLanguage: string = "es"
  ): Promise<TranslationResult & { originalText: string }> {
    const startTime = Date.now();

    try {
      // Paso 1: Transcripción de audio con Gemini multimodal
      const transcription = await this.transcribeAudio(audioBuffer, dialect);

      // Paso 2: Traducción del texto transcrito
      const translation = await this.translateText(
        transcription,
        dialect,
        targetLanguage
      );

      return {
        ...translation,
        originalText: transcription,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      throw new TranslationError(
        `Traducción de audio falló: ${(error as Error).message}`,
        processingTimeMs
      );
    }
  }

  /**
   * Transcribe audio usando Gemini multimodal.
   */
  private async transcribeAudio(
    audioBuffer: Buffer,
    dialect: string
  ): Promise<string> {
    const audioBase64 = audioBuffer.toString("base64");

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: `Transcribe el siguiente audio en Zapoteco del Istmo (Diidxazá). 
Solo devuelve el texto transcrito, sin explicaciones. 
Si detectas español, transcríbelo tal cual. 
Dialecto esperado: ${dialect}.`,
            },
            {
              inline_data: {
                mime_type: "audio/wav",
                data: audioBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 500,
      },
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`API de Gemini error ${response.status}: ${errorData}`);
    }

    const data = (await response.json()) as any;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error("No se detectó habla en el audio");
    }

    return text.trim();
  }

  /**
   * Llama a la API de Gemini con las System Instructions del lingüista.
   * El glosario de Firestore va incluido en systemPrompt.
   */
  private async callGeminiAPI(
    systemPrompt: string,
    userMessage: string
  ): Promise<string> {
    const requestBody = {
      system_instruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: userMessage }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
      },
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`API de Gemini error ${response.status}: ${errorData}`);
    }

    const data = (await response.json()) as any;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error("Gemini no generó respuesta");
    }

    return text;
  }

  /**
   * Parsea la respuesta JSON de Gemini.
   */
  private parseGeminiResponse(raw: string): {
    text_original: string;
    text_translated: string;
    confidence: number;
    notas_linguisticas?: string;
    palabras_glosario_usadas?: string[];
    estructura_detectada?: string;
  } {
    try {
      let cleaned = raw.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
      }

      const parsed = JSON.parse(cleaned);

      return {
        text_original: parsed.text_original || "",
        text_translated: parsed.text_translated || "",
        confidence: Math.min(Math.max(parsed.confidence || 0, 0), 1),
        notas_linguisticas: parsed.notas_linguisticas,
        palabras_glosario_usadas: parsed.palabras_glosario_usadas,
        estructura_detectada: parsed.estructura_detectada,
      };
    } catch {
      return {
        text_original: "",
        text_translated: raw.trim(),
        confidence: 0.4,
        notas_linguisticas:
          "⚠ La respuesta de Gemini no fue JSON válido. Se usó el texto crudo.",
      };
    }
  }
}
