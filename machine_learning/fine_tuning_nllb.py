import os
import torch
import pandas as pd
from datasets import Dataset
from transformers import (
    AutoTokenizer,
    AutoModelForSeq2SeqLM,
    Seq2SeqTrainingArguments,
    Seq2SeqTrainer,
    DataCollatorForSeq2Seq
)
from peft import prepare_model_for_kbit_training, LoraConfig, get_peft_model

# 1. Configuración de Modelos y Rutas
# NLLB-200 600M es excelente para lenguas de bajos recursos y corre rápido con INT8
MODEL_NAME = "facebook/nllb-200-distilled-600M"
DATASET_FILE = "dataset/metadata.csv"
OUTPUT_DIR = "nllb_zapotec_lora"

def prepare_dataset():
    print("Cargando textos Zapoteco <-> Español...")
    df = pd.read_csv(DATASET_FILE)
    
    # Limpiamos nulos
    df = df.dropna(subset=["transcription", "translation"])
    
    # Creamos un dataset de Hugging Face
    dataset = Dataset.from_pandas(df)
    
    # NLLB requiere configurar lenguajes. Zapoteco no está nativo, 
    # por lo que hacemos Fine-Tuning sobre una variante o token general.
    # Usaremos 'spa_Latn' (Español) como destino, y 'zsm_Latn' o 'ast_Latn' como base temporal para Zapoteco.
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, src_lang="spa_Latn", tgt_lang="spa_Latn")
    
    def preprocess_function(examples):
        inputs = examples["transcription"] # Zapoteco
        targets = examples["translation"]  # Español
        
        model_inputs = tokenizer(inputs, max_length=128, truncation=True)
        
        # Setup tokenizer for targets
        with tokenizer.as_target_tokenizer():
            labels = tokenizer(targets, max_length=128, truncation=True)
            
        model_inputs["labels"] = labels["input_ids"]
        return model_inputs

    tokenized_datasets = dataset.map(preprocess_function, batched=True)
    return tokenized_datasets, tokenizer

def fine_tune():
    train_dataset, tokenizer = prepare_dataset()

    print("Cargando modelo NLLB-200 (INT8 Cuantizado)...")
    model = AutoModelForSeq2SeqLM.from_pretrained(
        MODEL_NAME,
        load_in_8bit=True,
        device_map="auto"
    )
    
    model = prepare_model_for_kbit_training(model)
    
    config = LoraConfig(
        r=16,
        lora_alpha=32,
        target_modules=["q_proj", "v_proj"],
        lora_dropout=0.05,
        bias="none",
        task_type="SEQ_2_SEQ_LM"
    )
    
    model = get_peft_model(model, config)
    model.print_trainable_parameters()

    training_args = Seq2SeqTrainingArguments(
        output_dir=OUTPUT_DIR,
        evaluation_strategy="no",
        learning_rate=2e-4,
        per_device_train_batch_size=16,
        weight_decay=0.01,
        save_total_limit=3,
        num_train_epochs=10, # Más epochs porque es Seq2Seq de texto
        predict_with_generate=True,
        fp16=True,
        push_to_hub=False,
    )

    data_collator = DataCollatorForSeq2Seq(tokenizer, model=model)

    trainer = Seq2SeqTrainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        data_collator=data_collator,
        tokenizer=tokenizer,
    )

    print("Iniciando Fine-Tuning LoRA (NLLB-200 Zapoteco)...")
    trainer.train()
    
    print(f"Entrenamiento completado. Guardando en {OUTPUT_DIR}...")
    model.save_pretrained(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)
    print("✅ Pipeline listo para Curriculum Learning.")

if __name__ == "__main__":
    fine_tune()
