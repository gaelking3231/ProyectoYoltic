/**
 * YOLTIC — Cloud Functions
 * 
 * Firebase Cloud Functions acting as "The Translator" bridge.
 * Processes audio from smart glasses, calls translation API,
 * and writes results back to Firestore in real-time.
 */

import * as admin from "firebase-admin";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import {
  createTranslationProvider,
  TranslationError,
} from "./translationProvider";
import {
  downloadAudioFromStorage,
  parseWavMetadata,
  archiveAudio,
  getAudioStoragePath,
} from "./audioProcessor";

// Initialize Firebase Admin SDK
admin.initializeApp();

const db = admin.firestore();

// ══════════════════════════════════════════════════════════════
// TRIGGER: New Conversation Created
// Fires when the Flutter app creates a new conversation document
// after uploading audio from the smart glasses.
// ══════════════════════════════════════════════════════════════

export const onConversationCreated = onDocumentCreated(
  "conversaciones/{conversationId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      logger.error("No data associated with the event");
      return;
    }

    const conversationId = event.params.conversationId;
    const data = snapshot.data();

    logger.info(`🔄 Processing conversation: ${conversationId}`, {
      userId: data.userId,
      deviceId: data.deviceId,
      dialect: data.dialect,
    });

    const conversationRef = db.collection("conversaciones").doc(conversationId);

    try {
      // ─── Step 1: Download Audio from Storage ───────────────
      const audioPath = data.audioUrl || getAudioStoragePath(data.userId, conversationId);
      logger.info(`📥 Downloading audio: ${audioPath}`);

      const audioBuffer = await downloadAudioFromStorage(audioPath);

      // ─── Step 2: Validate Audio ────────────────────────────
      const audioMetadata = parseWavMetadata(audioBuffer);

      if (!audioMetadata.isValid) {
        logger.error(`❌ Invalid audio file: ${audioMetadata.error}`);
        await conversationRef.update({
          status: "error",
          error: `Invalid audio: ${audioMetadata.error}`,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return;
      }

      logger.info(`🎵 Audio validated`, {
        duration: `${audioMetadata.duration.toFixed(2)}s`,
        sampleRate: audioMetadata.sampleRate,
        channels: audioMetadata.channels,
      });

      // ─── Step 3: Update status to show we're translating ──
      await conversationRef.update({
        status: "translating",
        audioDuration: audioMetadata.duration,
        "metadata.sampleRate": audioMetadata.sampleRate,
        "metadata.channels": audioMetadata.channels,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // ─── Paso 4: Llamar al Proveedor de Traducción ─────────
      const provider = createTranslationProvider();
      const dialect = data.dialect || "isthmus";

      logger.info(`🌐 Traduciendo (${dialect} → es)...`);

      const result = await provider.translate(audioBuffer, dialect, "es");

      logger.info(`✅ Traducción completada`, {
        confidence: result.confidence,
        processingTime: `${result.processingTimeMs}ms`,
        translatedText: result.translatedText.substring(0, 100),
        linguisticNotes: result.linguisticNotes || "N/A",
      });

      // ─── Paso 5: Escribir Resultados en Firestore ──────────
      await conversationRef.update({
        status: "completed",
        text_original: result.originalText || `[audio:${dialect}]`,
        text_translated: result.translatedText,
        confidence: result.confidence,
        "metadata.processingTimeMs": result.processingTimeMs,
        "metadata.detectedDialect": result.detectedDialect || dialect,
        "metadata.linguisticNotes": result.linguisticNotes || "",
        "metadata.glossaryWordsUsed": result.glossaryWordsUsed || [],
        "metadata.provider": process.env.TRANSLATION_PROVIDER || "gemini",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      // ─── Step 6: Archive Audio for Linguistic Auditing ─────
      const archivePath = await archiveAudio(
        data.userId,
        conversationId,
        audioMetadata
      );
      logger.info(`📦 Audio archived: ${archivePath}`);

      // ─── Step 7: Sync to Realtime Database for ESP32 ───────
      // Mirror the latest translation to RTDB so the ESP32 can read it
      await admin.database().ref(`devices/${data.deviceId}/lastTranslation`).set({
        conversationId,
        translatedText: result.translatedText,
        confidence: result.confidence,
        timestamp: Date.now(),
      });

      logger.info(`🏁 Conversation ${conversationId} fully processed`);

    } catch (error) {
      const errorMessage = error instanceof TranslationError
        ? error.message
        : (error as Error).message;

      const processingTimeMs = error instanceof TranslationError
        ? error.processingTimeMs
        : 0;

      logger.error(`❌ Translation failed: ${errorMessage}`, { error });

      await conversationRef.update({
        status: "error",
        error: errorMessage,
        "metadata.processingTimeMs": processingTimeMs,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
);

// ══════════════════════════════════════════════════════════════
// TRIGGER: Device Config Updated
// Fires when a user changes device settings (volume, dialect)
// from the Dashboard or Mobile App. Mirrors to RTDB for ESP32.
// ══════════════════════════════════════════════════════════════

export const onDeviceConfigUpdated = onDocumentUpdated(
  "dispositivos/{deviceId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) {
      logger.error("No data associated with the event");
      return;
    }

    const deviceId = event.params.deviceId;

    // Check if config actually changed
    const configChanged =
      before.config?.volume !== after.config?.volume ||
      before.config?.dialect !== after.config?.dialect ||
      before.config?.sampleRate !== after.config?.sampleRate ||
      before.config?.sensitivity !== after.config?.sensitivity;

    if (!configChanged) {
      logger.info(`No config changes detected for device ${deviceId}`);
      return;
    }

    logger.info(`⚙️ Device config updated: ${deviceId}`, {
      volume: `${before.config?.volume} → ${after.config?.volume}`,
      dialect: `${before.config?.dialect} → ${after.config?.dialect}`,
    });

    try {
      // ─── Mirror config to Realtime Database for ESP32 ──────
      // The ESP32 listens to RTDB (not Firestore) for real-time config
      await admin.database().ref(`devices/${deviceId}/config`).set({
        volume: after.config?.volume ?? 50,
        dialect: after.config?.dialect ?? "isthmus",
        sampleRate: after.config?.sampleRate ?? 16000,
        sensitivity: after.config?.sensitivity ?? 5,
        updatedAt: Date.now(),
      });

      logger.info(`🔄 Config mirrored to RTDB for ESP32: ${deviceId}`);

      // ─── Audit Log ─────────────────────────────────────────
      await db.collection("audit_logs").add({
        type: "device_config_change",
        deviceId,
        userId: after.userId,
        before: before.config,
        after: after.config,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

    } catch (error) {
      logger.error(`❌ Failed to mirror config: ${(error as Error).message}`);
    }
  }
);
