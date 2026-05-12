import os
import torch
from datasets import load_dataset, Audio
from transformers import (
    WhisperFeatureExtractor,
    WhisperTokenizer,
    WhisperProcessor,
    WhisperForConditionalGeneration,
    Seq2SeqTrainingArguments,
    Seq2SeqTrainer
)
from peft import prepare_model_for_kbit_training, LoraConfig, get_peft_model
import evaluate

# 1. Parámetros del Curriculum Learning (Semana 1-3)
MODEL_NAME = "openai/whisper-small" # Ideal para cuantización extrema (<500ms en Edge)
DATASET_DIR = "dataset"
OUTPUT_DIR = "whisper_zapotec_lora"

def prepare_dataset():
    print("Cargando dataset desde Hugging Face format...")
    # Cargar el dataset desde la carpeta local (metadata.csv + wavs/)
    dataset = load_dataset("audiofolder", data_dir=DATASET_DIR)
    
    # Asegurar que el audio está en 16kHz para Whisper
    dataset = dataset.cast_column("audio", Audio(sampling_rate=16000))
    
    feature_extractor = WhisperFeatureExtractor.from_pretrained(MODEL_NAME)
    tokenizer = WhisperTokenizer.from_pretrained(MODEL_NAME, language="Spanish", task="transcribe")
    
    def prepare_dataset_fn(batch):
        # 1. Procesar el audio
        audio = batch["audio"]
        batch["input_features"] = feature_extractor(audio["array"], sampling_rate=audio["sampling_rate"]).input_features[0]
        
        # 2. Procesar el texto (Zapoteco transcrito)
        # En STT queremos que el modelo aprenda a escribir Zapoteco directamente
        batch["labels"] = tokenizer(batch["transcription"]).input_ids
        return batch

    print("Extrayendo features...")
    prepared_dataset = dataset.map(prepare_dataset_fn, remove_columns=dataset.column_names["train"], num_proc=1)
    return prepared_dataset["train"], feature_extractor, tokenizer

def fine_tune():
    train_dataset, feature_extractor, tokenizer = prepare_dataset()
    processor = WhisperProcessor.from_pretrained(MODEL_NAME, language="Spanish", task="transcribe")

    print("Cargando modelo Whisper con cuantización a 8-bit (INT8)...")
    model = WhisperForConditionalGeneration.from_pretrained(
        MODEL_NAME,
        load_in_8bit=True, # Cuantización para inferencia rápida
        device_map="auto"
    )
    
    # Preparar modelo para LoRA (Parameter-Efficient Fine-Tuning)
    model = prepare_model_for_kbit_training(model)
    
    config = LoraConfig(
        r=32,
        lora_alpha=64,
        target_modules=["q_proj", "v_proj"],
        lora_dropout=0.05,
        bias="none"
    )
    
    model = get_peft_model(model, config)
    model.print_trainable_parameters()

    # Argumentos de entrenamiento (Curriculum Learning)
    training_args = Seq2SeqTrainingArguments(
        output_dir=OUTPUT_DIR,
        per_device_train_batch_size=8,
        gradient_accumulation_steps=2,
        learning_rate=1e-3,
        warmup_steps=50,
        max_steps=500, # Ajustar según tamaño del dataset
        gradient_checkpointing=True,
        fp16=True, # Precision mixta para acelerar
        evaluation_strategy="steps",
        per_device_eval_batch_size=8,
        predict_with_generate=True,
        generation_max_length=225,
        save_steps=100,
        eval_steps=100,
        logging_steps=25,
        remove_unused_columns=False,
        label_names=["labels"],
    )

    from transformers.models.whisper.english_normalizer import BasicTextNormalizer
    normalizer = BasicTextNormalizer()

    # Data Collator manual para Whisper
    import torch
    from dataclasses import dataclass
    from typing import Any, Dict, List, Union

    @dataclass
    class DataCollatorSpeechSeq2SeqWithPadding:
        processor: Any
        def __call__(self, features: List[Dict[str, Union[List[int], torch.Tensor]]]) -> Dict[str, torch.Tensor]:
            input_features = [{"input_features": feature["input_features"]} for feature in features]
            batch = self.processor.feature_extractor.pad(input_features, return_tensors="pt")
            label_features = [{"input_ids": feature["labels"]} for feature in features]
            labels_batch = self.processor.tokenizer.pad(label_features, return_tensors="pt")
            labels = labels_batch["input_ids"].masked_fill(labels_batch.attention_mask.ne(1), -100)
            if (labels[:, 0] == self.processor.tokenizer.bos_token_id).all().cpu().item():
                labels = labels[:, 1:]
            batch["labels"] = labels
            return batch

    data_collator = DataCollatorSpeechSeq2SeqWithPadding(processor=processor)

    trainer = Seq2SeqTrainer(
        args=training_args,
        model=model,
        train_dataset=train_dataset,
        eval_dataset=train_dataset, # Usando el mismo solo como demo. Idealmente dividir train/test.
        data_collator=data_collator,
        tokenizer=processor.feature_extractor,
    )

    print("Iniciando Fine-Tuning LoRA (Whisper)...")
    trainer.train()
    
    print(f"Entrenamiento completado. Guardando modelo en {OUTPUT_DIR}...")
    model.save_pretrained(OUTPUT_DIR)
    processor.save_pretrained(OUTPUT_DIR)
    print("✅ Listo. Para inferencia <500ms en producción, recomendamos exportar a CTranslate2 (INT8).")

if __name__ == "__main__":
    fine_tune()
