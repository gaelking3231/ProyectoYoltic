/**
 * YOLTIC — Configuración del Cliente Firebase
 * 
 * Inicialización de servicios Firebase para el dashboard Next.js.
 * Proyecto: proyectoyoltic
 */

import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};


// Inicializar Firebase solo si tenemos la configuración mínima necesaria (evita errores en build)
const app = (getApps().length === 0 && firebaseConfig.apiKey) 
  ? initializeApp(firebaseConfig) 
  : (getApps().length > 0 ? getApp() : null);

// Exportar servicios con protección contra nulos
export const db = app ? getFirestore(app) : null as any;
export const storage = app ? getStorage(app) : null as any;
export const auth = app ? getAuth(app) : null as any;
export const rtdb = app ? getDatabase(app) : null as any;


export default app;
