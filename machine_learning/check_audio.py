import wave
import numpy as np
import sys

def check_wav(path):
    try:
        with wave.open(path, 'rb') as w:
            frames = w.readframes(w.getnframes())
            data = np.frombuffer(frames, dtype=np.int16)
            print(f"File: {path}")
            print(f"Max Amplitude: {np.max(np.abs(data))}")
            print(f"Mean Amplitude: {np.mean(np.abs(data))}")
            if np.max(np.abs(data)) < 100:
                print("🚨 WARNING: Audio is ALMOST SILENT!")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_wav(sys.argv[1])
