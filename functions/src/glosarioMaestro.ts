/**
 * YOLTIC — Glosario Maestro de Zapoteco del Istmo
 * 
 * Fuente de verdad absoluta para la traducción.
 * 
 * ARQUITECTURA HÍBRIDA:
 *   1. Firestore (glosario_maestro) → Fuente principal, editable en consola.
 *   2. Fallback local → Datos base que siempre están disponibles
 *      aunque Firestore no responda.
 * 
 * Los datos de Firestore se inyectan como System Instructions
 * en CADA petición a Gemini, garantizando que el modelo use
 * el estilo y vocabulario exacto del glosario.
 */

import * as admin from "firebase-admin";

// ══════════════════════════════════════════════════════════════
// Tipos del Glosario
// ══════════════════════════════════════════════════════════════

export interface EntradaGlosario {
  /** Texto en español */
  es: string;
  /** Texto en zapoteco del Istmo */
  zap: string;
  /** Categoría temática */
  categoria: string;
}

// ══════════════════════════════════════════════════════════════
// Caché en Memoria (evita lecturas repetidas a Firestore)
// ══════════════════════════════════════════════════════════════

let cacheGlosario: EntradaGlosario[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

// ══════════════════════════════════════════════════════════════
// Lectura desde Firestore
// ══════════════════════════════════════════════════════════════

/**
 * Obtiene todas las entradas del glosario desde Firestore.
 * Usa caché en memoria para evitar lecturas excesivas.
 * Si Firestore falla, retorna el glosario local de fallback.
 */
export async function obtenerGlosarioDeFirestore(): Promise<EntradaGlosario[]> {
  const ahora = Date.now();

  // Retornar caché si aún es válido
  if (cacheGlosario && (ahora - cacheTimestamp) < CACHE_TTL_MS) {
    return cacheGlosario;
  }

  try {
    const db = admin.firestore();
    const snapshot = await db.collection("glosario_maestro").get();

    if (snapshot.empty) {
      console.warn("⚠ Colección glosario_maestro vacía. Usando fallback local.");
      return GLOSARIO_LOCAL;
    }

    const entradas: EntradaGlosario[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        es: data.es || "",
        zap: data.zap || "",
        categoria: data.categoria || "general",
      };
    });

    // Actualizar caché
    cacheGlosario = entradas;
    cacheTimestamp = ahora;

    console.log(`📚 Glosario cargado: ${entradas.length} entradas desde Firestore`);
    return entradas;

  } catch (error) {
    console.error("❌ Error leyendo glosario de Firestore:", (error as Error).message);
    console.warn("⚠ Usando glosario local de fallback.");
    return GLOSARIO_LOCAL;
  }
}

/**
 * Fuerza la recarga del glosario desde Firestore,
 * ignorando el caché actual.
 */
export function invalidarCacheGlosario(): void {
  cacheGlosario = null;
  cacheTimestamp = 0;
}

// ══════════════════════════════════════════════════════════════
// Generador de System Instructions para Gemini
// ══════════════════════════════════════════════════════════════

/**
 * Genera el bloque de texto del glosario para inyectar
 * como System Instructions en la API de Gemini.
 * 
 * Lee PRIMERO desde Firestore (colección glosario_maestro).
 * Si no hay datos, usa el fallback local.
 */
export async function generarTextoGlosario(): Promise<string> {
  const entradas = await obtenerGlosarioDeFirestore();

  const lineas = entradas.map((e) => {
    return `• "${e.es}" → "${e.zap}" [${e.categoria}]`;
  });

  return lineas.join("\n");
}

/**
 * Genera las reglas gramaticales clave del Zapoteco del Istmo
 * para inyectar como parte de las System Instructions.
 */
export function generarReglasGramaticales(): string {
  return `
## REGLAS GRAMATICALES — ZAPOTECO DEL ISTMO (Diidxazá)

### Orden Sintáctico: VERBO-SUJETO-OBJETO (VSO)
El Zapoteco del Istmo sigue un orden VSO, diferente al SVO del español.
- ZAP: "Ridxi naa gueta" (Come-yo-tortilla)
- ESP: "Yo como tortilla" (Yo-come-tortilla)
- ZAP: "Riene naa lu" (Ve-yo-tú)  
- ESP: "Yo te veo" (Yo-te-ve)

### Sistema de Aspecto Verbal (NO hay tiempo verbal como tal)
Los verbos se marcan por ASPECTO, no por tiempo:
- Habitual/Presente: prefijo "r-" o "ri-" (ridxi = "come habitualmente")
- Completivo/Pasado: prefijo "gu-" o "bi-" (gudxi = "comió")
- Potencial/Futuro: prefijo "z-" o "za-" (zadxi = "comerá")  
- Continuativo: prefijo "ca-" (cayuni = "está haciendo")

### Pronombres Posesivos (van DESPUÉS del sustantivo)
- "xhiisi naa" = "mi hijo" (hijo-de-yo)
- "yoo lu" = "tu casa" (casa-tú)
- "diidxa laabe" = "su palabra" (palabra-él)

### Clasificadores Nominales
Se usan prefijos para clasificar sustantivos:
- bi-/bi = animales y entidades animadas
- gui-/guie = plantas, flores
- gui'chi' = cosas planas (papel, tela)
- nisa = líquidos

### Tono 
El Zapoteco del Istmo es una lengua TONAL.
Existen al menos 4 tonos que distinguen significado:
- Alto, Bajo, Ascendente, Descendente

### Negación
Se usa "cadi" antepuesto al verbo:
- "Cadi guní' lii" = "De nada" (No-haces-tú)
  `.trim();
}

/**
 * Busca coincidencias en el glosario para un texto dado.
 * Útil para pre-enriquecer el contexto de traducción.
 */
export async function buscarEnGlosario(texto: string): Promise<EntradaGlosario[]> {
  const entradas = await obtenerGlosarioDeFirestore();
  const textoNorm = texto.toLowerCase().trim();

  return entradas.filter((e) => {
    const esNorm = e.es.toLowerCase();
    const zapNorm = e.zap.toLowerCase();
    return (
      esNorm.includes(textoNorm) ||
      zapNorm.includes(textoNorm) ||
      textoNorm.includes(esNorm) ||
      textoNorm.includes(zapNorm)
    );
  });
}

// ══════════════════════════════════════════════════════════════
// Glosario Local de Fallback
// (se usa SOLO si Firestore no está disponible)
// ══════════════════════════════════════════════════════════════

const GLOSARIO_LOCAL: EntradaGlosario[] = [
  { es: "Hola", zap: "Padiuxi", categoria: "saludo" },
  { es: "¿Cómo estás?", zap: "¿Xha xhie lii?", categoria: "social" },
  { es: "¿Cómo te llamas?", zap: "¿Xha lá lii?", categoria: "social" },
  { es: "Mi nombre es Levi", zap: "Naa lá Levi", categoria: "personal" },
  { es: "Mucho gusto", zap: "Riuu' dxi'che lii", categoria: "social" },
  { es: "¿A dónde vas?", zap: "¿Raú ué?", categoria: "movilidad" },
  { es: "¿Dónde está el baño?", zap: "¿Paraa nuu guído'?", categoria: "urgencia" },
  { es: "Tengo hambre", zap: "Gaxha naa", categoria: "necesidad" },
  { es: "Quiero agua", zap: "Racala'dxe nisa", categoria: "necesidad" },
  { es: "¿Cuánto cuesta esto?", zap: "¿Panda quí'ni' ndi'?", categoria: "comercio" },
  { es: "Me gustas mucho", zap: "Nadxií lii", categoria: "romance" },
  { es: "Estás muy bonita", zap: "Sicarúpe' lii", categoria: "romance" },
  { es: "Te quiero", zap: "Nadxiiee lii", categoria: "romance" },
  { es: "Muchas gracias", zap: "Xquixepe' lii", categoria: "cortesía" },
  { es: "De nada", zap: "Cadi guní' lii", categoria: "cortesía" },
  { es: "Yo hablo zapoteco", zap: "Naa riní' diidxazá", categoria: "identidad" },
  { es: "Bienvenido a Yoltic", zap: "Biutixe lade Yoltic", categoria: "proyecto" },
  { es: "Soy ingeniero", zap: "Ingeniero naa", categoria: "orgullo" },
  { es: "Estudio en el TESE", zap: "Escuela TESE nuu naa", categoria: "contexto" },
  { es: "Adiós", zap: "Ziuulá'", categoria: "despedida" },
];
