/**
 * YOLTIC — Carga Masiva al Glosario Maestro (vía REST API)
 * 
 * Usa la API REST de Firestore directamente para subir documentos.
 * NO requiere Firebase CLI ni credenciales de servicio.
 * Solo necesita la API key del proyecto.
 * 
 * Ejecutar: node seedGlosario.js
 */

const API_KEY = "AIzaSyCzphsTRNu3g5U7zUi9tNIR0GC3kzfPtRU";
const PROJECT_ID = "proyectoyoltic";
const COLLECTION = "glosario_maestro";

const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// ══════════════════════════════════════════════════════════════
// 20 entradas verificadas por hablantes nativos
// ══════════════════════════════════════════════════════════════

const GLOSARIO = [
  { id: "saludo_01", es: "Hola", zap: "Padiuxi", categoria: "saludo" },
  { id: "saludo_01_var1", es: "Hola", zap: "Paad Dios", categoria: "saludo" },
  { id: "saludo_01_var2", es: "Hola", zap: "Pa dios", categoria: "saludo" },
  { id: "social_02", es: "¿Cómo estás?", zap: "¿Xha xhie lii?", categoria: "social" },
  { id: "social_03", es: "¿Cómo te llamas?", zap: "¿Xha lá lii?", categoria: "social" },
  { id: "personal_04", es: "Mi nombre es Levi", zap: "Naa lá Levi", categoria: "personal" },
  { id: "social_05", es: "Mucho gusto", zap: "Riuu' dxi'che lii", categoria: "social" },
  { id: "movilidad_06", es: "¿A dónde vas?", zap: "¿Raú ué?", categoria: "movilidad" },
  { id: "urgencia_07", es: "¿Dónde está el baño?", zap: "¿Paraa nuu guído'?", categoria: "urgencia" },
  { id: "necesidad_08", es: "Tengo hambre", zap: "Gaxha naa", categoria: "necesidad" },
  { id: "necesidad_09", es: "Quiero agua", zap: "Racala'dxe nisa", categoria: "necesidad" },
  { id: "comercio_10", es: "¿Cuánto cuesta esto?", zap: "¿Panda quí'ni' ndi'?", categoria: "comercio" },
  { id: "romance_11", es: "Me gustas mucho", zap: "Nadxií lii", categoria: "romance" },
  { id: "romance_12", es: "Estás muy bonita", zap: "Sicarúpe' lii", categoria: "romance" },
  { id: "romance_13", es: "Te quiero", zap: "Nadxiiee lii", categoria: "romance" },
  { id: "cortesia_14", es: "Muchas gracias", zap: "Xquixepe' lii", categoria: "cortesía" },
  { id: "cortesia_15", es: "De nada", zap: "Cadi guní' lii", categoria: "cortesía" },
  { id: "identidad_16", es: "Yo hablo zapoteco", zap: "Naa riní' diidxazá", categoria: "identidad" },
  { id: "proyecto_17", es: "Bienvenido a Yoltic", zap: "Biutixe lade Yoltic", categoria: "proyecto" },
  { id: "orgullo_18", es: "Soy ingeniero", zap: "Ingeniero naa", categoria: "orgullo" },
  { id: "contexto_19", es: "Estudio en el TESE", zap: "Escuela TESE nuu naa", categoria: "contexto" },
  { id: "despedida_20", es: "Adiós", zap: "Ziuulá'", categoria: "despedida" },
];

// ══════════════════════════════════════════════════════════════
// Convertir a formato Firestore REST
// ══════════════════════════════════════════════════════════════

function toFirestoreDoc(entrada) {
  return {
    fields: {
      es: { stringValue: entrada.es },
      zap: { stringValue: entrada.zap },
      categoria: { stringValue: entrada.categoria },
    },
  };
}

// ══════════════════════════════════════════════════════════════
// Subir cada documento
// ══════════════════════════════════════════════════════════════

async function uploadDocument(entrada) {
  const url = `${BASE_URL}/${COLLECTION}/${entrada.id}?key=${API_KEY}`;

  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toFirestoreDoc(entrada)),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HTTP ${response.status}: ${error}`);
  }

  return await response.json();
}

async function seedGlosario() {
  console.log("🚀 YOLTIC — Carga Masiva al Glosario Maestro");
  console.log(`📂 Colección: ${COLLECTION}`);
  console.log(`🔥 Proyecto: ${PROJECT_ID}`);
  console.log(`📊 Documentos: ${GLOSARIO.length}\n`);

  let exitosos = 0;
  let fallidos = 0;

  for (const entrada of GLOSARIO) {
    try {
      await uploadDocument(entrada);
      console.log(`  ✅ [${entrada.id}] "${entrada.es}" → "${entrada.zap}"`);
      exitosos++;
    } catch (error) {
      console.log(`  ❌ [${entrada.id}] Error: ${error.message}`);
      fallidos++;
    }
  }

  console.log(`\n${"═".repeat(50)}`);
  console.log(`📊 Resultado: ${exitosos} exitosos, ${fallidos} fallidos`);

  if (fallidos > 0) {
    console.log("\n💡 Si ves errores de permisos:");
    console.log("   1. Ve a console.firebase.google.com → proyectoyoltic");
    console.log("   2. Firestore Database → Reglas");
    console.log("   3. Reemplaza las reglas con:");
    console.log("      rules_version = '2';");
    console.log("      service cloud.firestore {");
    console.log("        match /databases/{database}/documents {");
    console.log("          match /glosario_maestro/{docId} {");
    console.log("            allow read, write: if true;");
    console.log("          }");
    console.log("          match /{document=**} {");
    console.log("            allow read, write: if false;");
    console.log("          }");
    console.log("        }");
    console.log("      }");
    console.log("   4. Publica las reglas y ejecuta este script de nuevo");
  }

  // Verificación: leer los documentos
  console.log("\n🔍 Verificando documentos...");
  try {
    const listUrl = `${BASE_URL}/${COLLECTION}?key=${API_KEY}&pageSize=25`;
    const res = await fetch(listUrl);
    const data = await res.json();

    if (data.documents) {
      console.log(`   → ${data.documents.length} documentos en glosario_maestro\n`);
      data.documents.forEach((doc) => {
        const name = doc.name.split("/").pop();
        const es = doc.fields?.es?.stringValue || "?";
        const zap = doc.fields?.zap?.stringValue || "?";
        const cat = doc.fields?.categoria?.stringValue || "?";
        console.log(`   ✓ [${name}] ${es} → ${zap} (${cat})`);
      });
    } else {
      console.log("   ⚠ No se encontraron documentos (verificar permisos)");
    }
  } catch (e) {
    console.log(`   ⚠ Error en verificación: ${e.message}`);
  }

  console.log("\n🏁 Proceso completado.");
}

seedGlosario();
