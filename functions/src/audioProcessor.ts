/**
 * YOLTIC — Audio Processor
 * 
 * WAV file validation, metadata extraction, and Storage path management
 * for the linguistic auditing pipeline.
 */

import * as admin from "firebase-admin";

export interface AudioMetadata {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  duration: number; // seconds
  fileSize: number; // bytes
  isValid: boolean;
  error?: string;
}

/**
 * Parse WAV file header and extract metadata
 */
export function parseWavMetadata(buffer: Buffer): AudioMetadata {
  try {
    // Minimum WAV header is 44 bytes
    if (buffer.length < 44) {
      return {
        sampleRate: 0,
        channels: 0,
        bitsPerSample: 0,
        duration: 0,
        fileSize: buffer.length,
        isValid: false,
        error: "File too small to be a valid WAV",
      };
    }

    // Validate RIFF header
    const riff = buffer.toString("ascii", 0, 4);
    const wave = buffer.toString("ascii", 8, 12);

    if (riff !== "RIFF" || wave !== "WAVE") {
      return {
        sampleRate: 0,
        channels: 0,
        bitsPerSample: 0,
        duration: 0,
        fileSize: buffer.length,
        isValid: false,
        error: "Invalid WAV header: missing RIFF/WAVE markers",
      };
    }

    // Parse fmt chunk
    const audioFormat = buffer.readUInt16LE(20);
    const channels = buffer.readUInt16LE(22);
    const sampleRate = buffer.readUInt32LE(24);
    const bitsPerSample = buffer.readUInt16LE(34);

    // Calculate duration from data chunk size
    const dataSize = buffer.readUInt32LE(40);
    const bytesPerSample = bitsPerSample / 8;
    const duration =
      bytesPerSample > 0 && channels > 0 && sampleRate > 0
        ? dataSize / (sampleRate * channels * bytesPerSample)
        : 0;

    // Validate audio format (1 = PCM)
    if (audioFormat !== 1) {
      return {
        sampleRate,
        channels,
        bitsPerSample,
        duration,
        fileSize: buffer.length,
        isValid: false,
        error: `Unsupported audio format: ${audioFormat} (expected PCM/1)`,
      };
    }

    return {
      sampleRate,
      channels,
      bitsPerSample,
      duration,
      fileSize: buffer.length,
      isValid: true,
    };
  } catch (error) {
    return {
      sampleRate: 0,
      channels: 0,
      bitsPerSample: 0,
      duration: 0,
      fileSize: buffer.length,
      isValid: false,
      error: `Parse error: ${(error as Error).message}`,
    };
  }
}

/**
 * Generate the Storage path for an audio file
 */
export function getAudioStoragePath(
  userId: string,
  conversationId: string
): string {
  return `audio/${userId}/${conversationId}.wav`;
}

/**
 * Download audio file from Firebase Storage
 */
export async function downloadAudioFromStorage(
  storagePath: string
): Promise<Buffer> {
  const bucket = admin.storage().bucket();
  const file = bucket.file(storagePath);

  // Check if file exists
  const [exists] = await file.exists();
  if (!exists) {
    throw new Error(`Audio file not found: ${storagePath}`);
  }

  // Download file contents
  const [contents] = await file.download();
  return contents;
}

/**
 * Archive processed audio with metadata
 * Moves or copies audio to an archive path for linguistic auditing
 */
export async function archiveAudio(
  userId: string,
  conversationId: string,
  metadata: AudioMetadata
): Promise<string> {
  const bucket = admin.storage().bucket();
  const sourcePath = getAudioStoragePath(userId, conversationId);
  const archivePath = `archive/${userId}/${conversationId}.wav`;

  const sourceFile = bucket.file(sourcePath);
  const [exists] = await sourceFile.exists();

  if (exists) {
    await sourceFile.copy(bucket.file(archivePath));

    // Set custom metadata for auditing
    await bucket.file(archivePath).setMetadata({
      metadata: {
        sampleRate: String(metadata.sampleRate),
        channels: String(metadata.channels),
        duration: String(metadata.duration),
        processedAt: new Date().toISOString(),
        conversationId,
        userId,
      },
    });
  }

  return archivePath;
}
