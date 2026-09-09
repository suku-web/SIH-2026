from pathlib import Path
import librosa
import numpy as np
import torch
from tqdm import tqdm

# ============================================================
# CONFIGURATION
# ============================================================

DATASET_PATH = Path("data/archive/for-2sec/for-2seconds")
OUTPUT_PATH = Path("data/features")

SAMPLE_RATE = 16000
DURATION = 2
N_MFCC = 40

# Start with a small number because you are using CPU
MAX_FILES_PER_CLASS = 1000


# ============================================================
# FEATURE EXTRACTION
# ============================================================

def extract_mfcc(file_path):
    try:
        audio, sr = librosa.load(
            file_path,
            sr=SAMPLE_RATE,
            duration=DURATION,
            mono=True
        )

        # Ensure exactly 2 seconds
        target_length = SAMPLE_RATE * DURATION

        if len(audio) < target_length:
            audio = np.pad(
                audio,
                (0, target_length - len(audio))
            )
        else:
            audio = audio[:target_length]

        # MFCC
        mfcc = librosa.feature.mfcc(
            y=audio,
            sr=SAMPLE_RATE,
            n_mfcc=N_MFCC,
            n_fft=512,
            hop_length=256
        )

        # Normalize
        mfcc = (mfcc - np.mean(mfcc)) / (
            np.std(mfcc) + 1e-8
        )

        return mfcc.astype(np.float32)

    except Exception as e:
        print(f"\nError processing {file_path}: {e}")
        return None


# ============================================================
# PROCESS ONE SPLIT
# ============================================================

def process_split(split):

    X = []
    y = []

    print("\n" + "=" * 60)
    print(f"PROCESSING {split.upper()}")
    print("=" * 60)

    for label_name, label in [("real", 0), ("fake", 1)]:

        folder = DATASET_PATH / split / label_name

        files = list(folder.glob("*.wav"))

        # Limit number of files for first experiment
        files = files[:MAX_FILES_PER_CLASS]

        print(
            f"\n{label_name.upper()} files: {len(files)}"
        )

        for file_path in tqdm(files):

            features = extract_mfcc(file_path)

            if features is not None:
                X.append(features)
                y.append(label)

    return np.array(X, dtype=np.float32), np.array(y)


# ============================================================
# MAIN
# ============================================================

def main():

    OUTPUT_PATH.mkdir(
        parents=True,
        exist_ok=True
    )

    print("=" * 60)
    print("AI VOICE CLONE DETECTION")
    print("MFCC FEATURE EXTRACTION")
    print("=" * 60)

    for split in ["training", "validation", "testing"]:

        X, y = process_split(split)

        output_file = OUTPUT_PATH / f"{split}.npz"

        np.savez_compressed(
            output_file,
            X=X,
            y=y
        )

        print(
            f"\nSaved: {output_file}"
        )

        print(
            f"Features shape: {X.shape}"
        )

        print(
            f"Labels shape: {y.shape}"
        )

    print("\n" + "=" * 60)
    print("FEATURE EXTRACTION COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    main()