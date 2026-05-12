export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import OpenAI, { toFile } from "openai";

export async function POST(req: Request) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    const startTime = Date.now();
    // 1. Recibir el stream binario del ESP32
    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 2. STT con OpenAI Whisper-1 usando SDK Oficial (Evita bugs de Node.js fetch/FormData)
    console.log("[1/3] Iniciando STT con Whisper (SDK Oficial)...");
    
    // Si el buffer es absurdamente pequeño (ej. 44 bytes de cabecera nada más), Whisper fallará. 
    // Lo protegemos.
    if (buffer.length < 100) {
      return NextResponse.json({ translation: "Silencio...", audio: "" });
    }

    const whisperResponse = await openai.audio.transcriptions.create({
      file: await toFile(buffer, "audio.wav", { type: "audio/wav" }),
      model: "whisper-1",
      language: "es", // Forzamos español/zapoteco
    });

    const text = whisperResponse.text ? whisperResponse.text.trim() : "";

    // Si el micrófono no detectó ruido o mandó puro silencio, Whisper regresa vacío
    if (!text) {
      return NextResponse.json({
        translation: "Silencio...",
        audio: "", // El ESP32 ignorará la reproducción si el base64 está vacío
      });
    }

    // 3. Traducción con OpenAI GPT-4o-mini (Zapoteco <-> Español)
    console.log(`[2/3] Traducción de STT (${text}) con GPT-4o-mini (SDK Oficial)...`);
    const chatResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 50,
      logprobs: true,
      messages: [
        { 
          role: "system", 
          content: "Eres un traductor experto de Zapoteco del Istmo a Español y viceversa. Responde SOLO con la traducción, MÁXIMO 20 caracteres. Usa este glosario básico para la demo de hoy: Hola = Padiuxi, Gracias = Xquixe pe lii, Buenos días = Sicarú guxhi, Adiós = Sicarú chu, Agua = Nisa, Mundo/Tierra = Guidxilayú, Perro = Bi'cu', Te quiero = Nadxiee lii, ¿Cómo estás? = Ximodo nuu." 
        },
        { role: "user", content: text }
      ],
    });

    const translation = chatResponse.choices[0].message.content?.trim() || "";

    // Calcular confianza real de la traducción basada en logprobs matemáticos
    let confidence = 0.95;
    const logprobs = chatResponse.choices[0].logprobs?.content;
    if (logprobs && logprobs.length > 0) {
      const avgLogprob = logprobs.reduce((acc: number, curr: any) => acc + Math.exp(curr.logprob), 0) / logprobs.length;
      confidence = parseFloat(avgLogprob.toFixed(2));
    }

    // 4. TTS con OpenAI TTS-1 (voz 'alloy')
    console.log(`[3/3] TTS de la traducción con OpenAI (SDK Oficial)...`);
    const ttsResponse = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: translation,
      response_format: "wav", // Solicitamos WAV directamente a OpenAI para que el Dashboard no falle
    });

    const audioArrayBuffer = await ttsResponse.arrayBuffer();
    const wavBuffer = Buffer.from(audioArrayBuffer);
    const wavBase64 = wavBuffer.toString("base64"); // Para el Dashboard (Firestore)

    // Extraer PCM puro del WAV buscando el chunk "data" para el ESP32
    // Esto evita que el ESP32 reproduzca la cabecera WAV y suene a robot o se desalinee
    let pcmBuffer = wavBuffer;
    for (let i = 0; i < wavBuffer.length - 8; i++) {
      if (
        wavBuffer[i] === 0x64 &&     // 'd'
        wavBuffer[i + 1] === 0x61 && // 'a'
        wavBuffer[i + 2] === 0x74 && // 't'
        wavBuffer[i + 3] === 0x61    // 'a'
      ) {
        const dataSize = wavBuffer.readUInt32LE(i + 4);
        pcmBuffer = wavBuffer.slice(i + 8, i + 8 + dataSize);
        break;
      }
    }
    const pcmBase64 = pcmBuffer.toString("base64"); // Para el ESP32

    const processingTime = Date.now() - startTime;

    // 5. Persistencia en Firebase Firestore
    try {
      await addDoc(collection(db, "translations"), {
        originalText: text,
        translation: translation,
        status: "completed",
        confidence: confidence, 
        timestamp: serverTimestamp(),
        audioUrl: `data:audio/wav;base64,${wavBase64}`, // Audio original de OpenAI que la web SI puede leer
        dialect: "isthmus",
        metadata: {
          sampleRate: 24000,
          channels: 1,
          processingTimeMs: processingTime,
        }
      });

      await addDoc(collection(db, "logs"), {
        event: "translation_processed",
        details: `STT: ${text} | Translation: ${translation}`,
        timestamp: serverTimestamp(),
      });
    } catch (firebaseError) {
      console.error("Error guardando en Firestore:", firebaseError);
    }

    // 6. Respuesta JSON al ESP32
    return NextResponse.json({
      translation,
      audio: pcmBase64, // Mandamos SOLO la data de voz al ESP32, 0% ruidos.
    });
  } catch (error: any) {
    console.error("Error en /api/translate:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}