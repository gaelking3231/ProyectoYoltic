/**
 * YOLTIC — Interfaz de Proveedores de Traducción
 * 
 * Backend de traducción intercambiable que soporta:
 *   - Gemini (PREDETERMINADO) — Lingüista experto con glosario maestro
 *   - Google Cloud Translation — API genérica de traducción
 *   - Modelo Personalizado — Endpoint propio fine-tuned
 */

import { GeminiTranslationProvider } from "./geminiProvider";

export interface TranslationResult {
  translatedText: string;
  confidence: number;
  detectedDialect?: string;
  processingTimeMs: number;
  /** Notas del lingüista sobre decisiones de traducción */
  linguisticNotes?: string;
  /** Palabras del glosario maestro que se aplicaron */
  glossaryWordsUsed?: string[];
  /** Texto original (para traducciones desde audio) */
  originalText?: string;
}

export interface TranslationProvider {
  translate(
    audioBuffer: Buffer,
    dialect: string,
    targetLanguage: string
  ): Promise<TranslationResult>;
}

/**
 * Google Cloud Translation Provider
 * Usa Google Translate API (modelo PaLM 2 con soporte Zapoteco)
 */
export class GoogleTranslationProvider implements TranslationProvider {
  private apiKey: string;
  private endpoint: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.endpoint = "https://translation.googleapis.com/language/translate/v2";
  }

  async translate(
    audioBuffer: Buffer,
    dialect: string,
    targetLanguage: string = "es"
  ): Promise<TranslationResult> {
    const startTime = Date.now();

    try {
      // Paso 1: Speech-to-Text (Audio Zapoteco → Texto Zapoteco)
      const zapotecText = await this.speechToText(audioBuffer, dialect);

      // Paso 2: Traducción de Texto (Texto Zapoteco → Texto Español)
      const translatedText = await this.translateText(
        zapotecText,
        this.getLanguageCode(dialect),
        targetLanguage
      );

      const processingTimeMs = Date.now() - startTime;

      return {
        translatedText,
        confidence: 0.85,
        detectedDialect: dialect,
        processingTimeMs,
      };
    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      throw new TranslationError(
        `Google Translation falló: ${(error as Error).message}`,
        processingTimeMs
      );
    }
  }

  private async speechToText(
    audioBuffer: Buffer,
    dialect: string
  ): Promise<string> {
    const response = await fetch(
      `https://speech.googleapis.com/v1/speech:recognize?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: {
            encoding: "LINEAR16",
            sampleRateHertz: 16000,
            languageCode: this.getLanguageCode(dialect),
            model: "default",
            enableAutomaticPunctuation: true,
          },
          audio: {
            content: audioBuffer.toString("base64"),
          },
        }),
      }
    );

    const data = await response.json() as any;

    if (!data.results || data.results.length === 0) {
      throw new Error("No se detectó habla en el audio");
    }

    return data.results
      .map((r: any) => r.alternatives[0].transcript)
      .join(" ");
  }

  private async translateText(
    text: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<string> {
    const response = await fetch(
      `${this.endpoint}?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: text,
          source: sourceLanguage,
          target: targetLanguage,
          format: "text",
        }),
      }
    );

    const data = await response.json() as any;
    return data.data.translations[0].translatedText;
  }

  private getLanguageCode(dialect: string): string {
    // Códigos ISO 639-3 del Zapoteco por familia dialectal
    const dialectMap: Record<string, string> = {
      valley: "zab",       // Zapoteco del Valle
      isthmus: "zai",      // Zapoteco del Istmo
      sierra_norte: "zap", // Zapoteco de la Sierra Norte
      sierra_sur: "zas",   // Zapoteco de la Sierra Sur
    };
    return dialectMap[dialect] || "zap";
  }
}

/**
 * Proveedor de Modelo Personalizado
 * Conecta a un endpoint de modelo fine-tuned hospedado por el usuario
 */
export class CustomModelProvider implements TranslationProvider {
  private endpoint: string;
  private apiKey: string;

  constructor(endpoint: string, apiKey: string) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
  }

  async translate(
    audioBuffer: Buffer,
    dialect: string,
    targetLanguage: string = "es"
  ): Promise<TranslationResult> {
    const startTime = Date.now();

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          audio: audioBuffer.toString("base64"),
          dialect,
          targetLanguage,
          format: "wav",
          sampleRate: 16000,
        }),
      });

      if (!response.ok) {
        throw new Error(`Modelo personalizado retornó ${response.status}`);
      }

      const data = await response.json() as any;
      const processingTimeMs = Date.now() - startTime;

      return {
        translatedText: data.translation || data.translatedText,
        confidence: data.confidence || 0.7,
        detectedDialect: data.detectedDialect || dialect,
        processingTimeMs,
      };
    } catch (error) {
      const processingTimeMs = Date.now() - startTime;
      throw new TranslationError(
        `Modelo personalizado falló: ${(error as Error).message}`,
        processingTimeMs
      );
    }
  }
}

/**
 * Error de Traducción con metadatos de tiempo
 */
export class TranslationError extends Error {
  public processingTimeMs: number;

  constructor(message: string, processingTimeMs: number) {
    super(message);
    this.name = "TranslationError";
    this.processingTimeMs = processingTimeMs;
  }
}

/**
 * Factory — Crea el proveedor de traducción según la configuración.
 * 
 * PREDETERMINADO: Gemini (lingüista experto con glosario maestro)
 * 
 * Variable de entorno TRANSLATION_PROVIDER:
 *   - "gemini"  → API de Gemini con system prompt lingüístico (DEFAULT)
 *   - "google"  → Google Cloud Translation API
 *   - "custom"  → Endpoint de modelo personalizado
 */
export function createTranslationProvider(): TranslationProvider {
  const providerType = process.env.TRANSLATION_PROVIDER || "gemini";
  const apiKey = process.env.TRANSLATION_API_KEY || "";

  switch (providerType) {
    case "gemini": {
      if (!apiKey) {
        throw new Error("TRANSLATION_API_KEY es requerida para el proveedor Gemini");
      }
      const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
      // Envolver GeminiTranslationProvider para que cumpla la interfaz TranslationProvider
      const gemini = new GeminiTranslationProvider(apiKey, model);
      return {
        async translate(
          audioBuffer: Buffer,
          dialect: string,
          targetLanguage: string
        ): Promise<TranslationResult> {
          // Usar traducción de audio (multimodal: transcribe + traduce)
          return gemini.translateAudio(audioBuffer, dialect, targetLanguage);
        },
      };
    }

    case "custom": {
      const endpoint = process.env.CUSTOM_MODEL_ENDPOINT || "";
      if (!endpoint) {
        throw new Error("CUSTOM_MODEL_ENDPOINT es requerida para el proveedor custom");
      }
      return new CustomModelProvider(endpoint, apiKey);
    }

    case "google":
    default: {
      if (!apiKey) {
        throw new Error("TRANSLATION_API_KEY es requerida para el proveedor Google");
      }
      return new GoogleTranslationProvider(apiKey);
    }
  }
}

