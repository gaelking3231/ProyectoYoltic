# ==============================================================================
# YOLTIC ENGINE - FASE 2: FINE-TUNING DE WHISPER (ZAPOTECO DEL ISTMO)
# ==============================================================================
# Instrucciones:
# 1. Abre https://colab.research.google.com/
# 2. Sube este código copiando las celdas en un nuevo Notebook.
# 3. Ve a "Entorno de ejecución" -> "Cambiar tipo de entorno" -> Selecciona T4 GPU.
# 4. Sube tu archivo 'yoltic_dataset.zip' al menú izquierdo de Colab.
# 5. Ejecuta el código paso a paso.

# ---------------------------------------------------------
# CELDA 1: INSTALACIÓN DE DEPENDENCIAS Y EXTRACCIÓN
# ---------------------------------------------------------
# !pip install -q transformers datasets accelerate librosa evaluate jiwer
# !unzip -q yoltic_dataset.zip -d dataset/

# ---------------------------------------------------------
# CELDA 2: PREPARACIÓN DEL DATASET
# ---------------------------------------------------------
import pandas as pd
import os
from datasets import Dataset, Audio
from transformers import WhisperProcessor
from dataclasses import dataclass
from typing import Any, Dict, List, Union
import torch

# Leer el mapa maestro de audios
df = pd.read_csv("dataset/dataset.csv")

# Filtrar audios vacíos
df = df.dropna(subset=['zapoteco', 'filename'])
df['audio_path'] = df['filename'].apply(lambda x: os.path.join("dataset", x))

# Convertir a Dataset de HuggingFace (Audio -> Zapoteco)
dataset = Dataset.from_pandas(df[['audio_path', 'zapoteco']])
dataset = dataset.cast_column("audio_path", Audio(sampling_rate=16000))

# Cargar el Procesador de Whisper (Modelo Base pequeño para que sea rápido)
processor = WhisperProcessor.from_pretrained("openai/whisper-small", language="Spanish", task="transcribe")

def prepare_dataset(batch):
    # Cargar y remuestrear audio
    audio = batch["audio_path"]
    # Procesar características de entrada (espectrograma)
    batch["input_features"] = processor.feature_extractor(audio["array"], sampling_rate=audio["sampling_rate"]).input_features[0]
    # Procesar las etiquetas de texto (Zapoteco)
    batch["labels"] = processor.tokenizer(batch["zapoteco"]).input_ids
    return batch

print("Procesando audios y texto...")
yoltic_dataset = dataset.map(prepare_dataset, remove_columns=dataset.column_names, num_proc=2)

# ---------------------------------------------------------
# CELDA 3: ENTRENAMIENTO DEL MODELO NEURONAL
# ---------------------------------------------------------
from transformers import WhisperForConditionalGeneration, Seq2SeqTrainingArguments, Seq2SeqTrainer

# Cargar el modelo base
model = WhisperForConditionalGeneration.from_pretrained("openai/whisper-small")

@dataclass
class DataCollatorSpeechSeq2SeqWithPadding:
    processor: Any
    def __call__(self, features: List[Dict[str, Union[List[int], torch.Tensor]]]) -> Dict[str, torch.Tensor]:
        input_features = [{"input_features": feature["input_features"]} for feature in features]
        batch = self.processor.feature_extractor.pad(input_features, return_tensors="pt")
        label_features = [{"input_ids": feature["labels"]} for feature in features]
        labels_batch = self.processor.tokenizer.pad(label_features, return_tensors="pt")
        labels = labels_batch["input_ids"].masked_fill(labels_batch.attention_mask.ne(1), -100)
        batch["labels"] = labels
        return batch

data_collator = DataCollatorSpeechSeq2SeqWithPadding(processor=processor)

training_args = Seq2SeqTrainingArguments(
    output_dir="./yoltic-whisper-zapoteco",
    per_device_train_batch_size=8,
    learning_rate=1e-5,
    num_train_epochs=10, # 10 vueltas al dataset
    evaluation_strategy="no",
    save_strategy="epoch",
    logging_steps=5,
    predict_with_generate=True,
    fp16=True, # Acelerar con GPU
)

trainer = Seq2SeqTrainer(
    args=training_args,
    model=model,
    train_dataset=yoltic_dataset,
    data_collator=data_collator,
    tokenizer=processor.feature_extractor,
)

print("🚀 INICIANDO ENTRENAMIENTO DE YOLTIC ENGINE...")
trainer.train()

# ---------------------------------------------------------
# CELDA 4: GUARDAR EL NUEVO CEREBRO Y SUBIR A HUGGING FACE
# ---------------------------------------------------------
# IMPORTANTE: Descomenta la siguiente línea en Colab si te pide instalar la librería
# !pip install -q huggingface_hub

from huggingface_hub import notebook_login

print("🔑 Inicia sesión en Hugging Face (Pega tu Token de 'Write' o 'Fine-grained'):")
notebook_login()

print("✅ Entrenamiento finalizado. Subiendo modelo a Hugging Face...")

# Repositorio donde vivirá tu IA (cambia 'gaelking321' si usas otro usuario)
repo_name = "gaelking321/yoltic-whisper-zapoteco"

model.push_to_hub(repo_name)
processor.push_to_hub(repo_name)

print(f"🎉 ¡ÉXITO! El cerebro de Yoltic ha sido actualizado y ahora vive en la nube:")
print(f"👉 https://huggingface.co/{repo_name}")
