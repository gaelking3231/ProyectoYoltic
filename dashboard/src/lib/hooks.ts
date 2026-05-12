/**
 * YOLTIC — Hooks Personalizados de React
 * 
 * Streams en tiempo real de Firestore para conversaciones, dispositivos y autenticación.
 * Todos los hooks usan onSnapshot para actualizaciones instantáneas de la UI.
 */

"use client";

import { useState, useEffect } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  doc,
  where,
  type DocumentData,
} from "firebase/firestore";
import { onAuthStateChanged, type User } from "firebase/auth";
import { db, auth } from "./firebase";

// ─── Tipos ───────────────────────────────────────────────────

export interface Conversation {
  id: string;
  userId: string;
  deviceId: string;
  status: "processing" | "translating" | "completed" | "error";
  createdAt: Date;
  audioUrl: string;
  audioDuration: number;
  originalText: string;
  translatedText: string;
  corrected_text?: string | null;
  corrected_spanish?: string | null;
  mode?: string;

  dialect: string;
  confidence: number;
  error?: string;
  metadata: {
    sampleRate: number;
    channels: number;
    processingTimeMs: number;
  };
}

export interface Device {
  id: string;
  userId: string;
  name: string;
  type: string;
  status: "online" | "offline" | "streaming";
  lastSeen: Date;
  firmware: string;
  config: {
    volume: number;
    dialect: string;
    sampleRate: number;
    sensitivity: number;
  };
}

// ─── useConversations ────────────────────────────────────────
// Stream en tiempo real de conversaciones, las más recientes primero

export function useConversations(maxCount: number = 50) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, "translations"),
      orderBy("timestamp", "desc"),
      limit(maxCount)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const convs: Conversation[] = snapshot.docs.map((doc) => {
          const data = doc.data() as DocumentData;
          return {
            id: doc.id,
            userId: data.userId || "",
            deviceId: data.deviceId || "",
            status: data.status || "completed",
            createdAt: data.timestamp?.toDate?.() || new Date(),
            audioUrl: data.audioUrl || "",
            audioDuration: data.audioDuration || 0,
            originalText: data.stt_text || data.originalText || data.zapoteco || data.text_original || "",
            translatedText: data.translation || data.espanol || data.text_translated || "",
            corrected_text: data.corrected_text || null,
            corrected_spanish: data.corrected_spanish || null,
            mode: (data.source || data.mode || "CLOUD").toUpperCase(),

            dialect: data.dialect || "isthmus",
            confidence: data.confidence || 0,
            error: data.error,
            metadata: {
              sampleRate: data.metadata?.sampleRate || 0,
              channels: data.metadata?.channels || 0,
              processingTimeMs: data.latency_ms || data.latencyMs || data.metadata?.processingTimeMs || 0,
            },
          };
        });
        setConversations(convs);
        setLoading(false);
      },
      (err) => {
        console.error("Error en stream de conversaciones:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [maxCount]);

  return { conversations, loading, error };
}

// ─── useDevices ──────────────────────────────────────────────
// Stream en tiempo real de todos los dispositivos del usuario

export function useDevices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "devices"),
      orderBy("lastSeen", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const devs: Device[] = snapshot.docs.map((doc) => {
          const data = doc.data() as DocumentData;
          return {
            id: doc.id,
            userId: data.userId,
            name: data.name || "Dispositivo Desconocido",
            type: data.type || "esp32-s3-glasses",
            status: data.status || "offline",
            lastSeen: data.lastSeen?.toDate?.() || new Date(),
            firmware: data.firmware || "0.0.0",
            config: {
              volume: data.config?.volume ?? 50,
              dialect: data.config?.dialect || "isthmus",
              sampleRate: data.config?.sampleRate || 16000,
              sensitivity: data.config?.sensitivity || 5,
            },
          };
        });
        setDevices(devs);
        setLoading(false);
      },
      (err) => {
        console.error("Error en stream de dispositivos:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { devices, loading };
}

// ─── useDevice ───────────────────────────────────────────────
// Stream en tiempo real para un solo dispositivo

export function useDevice(deviceId: string | null) {
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!deviceId) {
      setLoading(false);
      return;
    }

    const docRef = doc(db, "devices", deviceId);

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setDevice({
            id: snapshot.id,
            userId: data.userId,
            name: data.name || "Dispositivo Desconocido",
            type: data.type || "esp32-s3-glasses",
            status: data.status || "offline",
            lastSeen: data.lastSeen?.toDate?.() || new Date(),
            firmware: data.firmware || "0.0.0",
            config: {
              volume: data.config?.volume ?? 50,
              dialect: data.config?.dialect || "isthmus",
              sampleRate: data.config?.sampleRate || 16000,
              sensitivity: data.config?.sensitivity || 5,
            },
          });
        } else {
          setDevice(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Error en stream de dispositivo:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [deviceId]);

  return { device, loading };
}

// ─── useAuth ─────────────────────────────────────────────────
// Estado de autenticación Firebase

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, loading };
}

// ─── useStreamingStatus ──────────────────────────────────────
// Hook derivado: verifica si algún dispositivo está transmitiendo

export function useStreamingStatus() {
  const { devices } = useDevices();
  const isStreaming = devices.some((d) => d.status === "streaming");
  const streamingDevice = devices.find((d) => d.status === "streaming") || null;

  return { isStreaming, streamingDevice, devices };
}
