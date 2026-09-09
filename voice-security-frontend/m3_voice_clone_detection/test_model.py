import os
import sys

import numpy as np
import librosa
import torch
import torch.nn as nn


# ============================================================
# SETTINGS
# ============================================================

MODEL_FILE = r"models\voice_clone_cnn.pth"

SAMPLE_RATE = 16000

SEGMENT_DURATION = 2
SEGMENT_SAMPLES = SAMPLE_RATE * SEGMENT_DURATION

MAX_DURATION = 120

N_MFCC = 40
N_FFT = 512
HOP_LENGTH = 256
TARGET_WIDTH = 126


# ============================================================
# DEVICE
# ============================================================

device = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)


# ============================================================
# CNN MODEL
# MUST MATCH TRAINING MODEL
# ============================================================

class VoiceCloneCNN(nn.Module):

    def __init__(self):

        super().__init__()

        self.features = nn.Sequential(

            # BLOCK 1
            nn.Conv2d(1, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Dropout2d(0.10),

            # BLOCK 2
            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Dropout2d(0.15),

            # BLOCK 3
            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Dropout2d(0.20),

            # BLOCK 4
            nn.Conv2d(128, 256, kernel_size=3, padding=1),
            nn.BatchNorm2d(256),
            nn.ReLU(),
            nn.AdaptiveAvgPool2d((1, 1))
        )

        self.classifier = nn.Sequential(

            nn.Flatten(),

            nn.Linear(256, 128),

            nn.ReLU(),

            nn.Dropout(0.40),

            nn.Linear(128, 2)
        )

    def forward(self, x):

        x = self.features(x)

        x = self.classifier(x)

        return x


# ============================================================
# LOAD MODEL
# ============================================================

def load_model():

    if not os.path.exists(MODEL_FILE):

        raise FileNotFoundError(
            f"Model file not found: {MODEL_FILE}"
        )

    checkpoint = torch.load(
        MODEL_FILE,
        map_location=device,
        weights_only=False
    )

    model = VoiceCloneCNN()

    model.load_state_dict(
        checkpoint["model_state_dict"]
    )

    model.to(device)

    model.eval()

    mean = float(
        checkpoint["mean"]
    )

    std = float(
        checkpoint["std"]
    )

    val_accuracy = float(
        checkpoint["val_accuracy"]
    )

    return model, mean, std, val_accuracy


# ============================================================
# LOAD AUDIO
# ============================================================

def load_audio(filename):

    if not os.path.exists(filename):

        raise FileNotFoundError(
            f"Audio file not found: {filename}"
        )

    audio, sr = librosa.load(
        filename,
        sr=SAMPLE_RATE,
        mono=True,
        duration=MAX_DURATION
    )

    duration = len(audio) / SAMPLE_RATE

    return audio, duration


# ============================================================
# CREATE 2-SECOND SEGMENTS
# ============================================================

def create_segments(audio):

    segments = []

    total_samples = len(audio)

    number_of_segments = (
        total_samples // SEGMENT_SAMPLES
    )

    for i in range(number_of_segments):

        start = i * SEGMENT_SAMPLES

        end = start + SEGMENT_SAMPLES

        segment = audio[start:end]

        if len(segment) == SEGMENT_SAMPLES:

            segments.append(segment)

    return segments


# ============================================================
# EXTRACT MFCC
# ============================================================

def extract_mfcc(audio):

    mfcc = librosa.feature.mfcc(
        y=audio,
        sr=SAMPLE_RATE,
        n_mfcc=N_MFCC,
        n_fft=N_FFT,
        hop_length=HOP_LENGTH
    )

    # Force width to 126

    if mfcc.shape[1] > TARGET_WIDTH:

        mfcc = mfcc[:, :TARGET_WIDTH]

    elif mfcc.shape[1] < TARGET_WIDTH:

        padding = TARGET_WIDTH - mfcc.shape[1]

        mfcc = np.pad(
            mfcc,
            ((0, 0), (0, padding)),
            mode="constant"
        )

    return mfcc


# ============================================================
# PREDICT ONE SEGMENT
# ============================================================

def predict_segment(model, segment):

    # Extract MFCC

    mfcc = extract_mfcc(segment)

    # IMPORTANT:
    # Same normalization used during feature creation

    mfcc = (
        mfcc - np.mean(mfcc)
    ) / (
        np.std(mfcc) + 1e-8
    )

    # Convert to tensor

    X = torch.tensor(
        mfcc,
        dtype=torch.float32
    )

    # 40 x 126
    # ->
    # 1 x 1 x 40 x 126

    X = X.unsqueeze(0)
    X = X.unsqueeze(0)

    X = X.to(device)

    # Prediction

    with torch.no_grad():

        outputs = model(X)

        probabilities = torch.softmax(
            outputs,
            dim=1
        )

    real_probability = (
        probabilities[0][0].item()
    )

    fake_probability = (
        probabilities[0][1].item()
    )

    return (
        real_probability,
        fake_probability
    )


# ============================================================
# CORE PREDICTION FUNCTION
# USED BY FASTAPI
# ============================================================

def predict_audio(filename):

    # Load model

    model, mean, std, val_accuracy = load_model()

    # Load audio

    audio, duration = load_audio(filename)

    # Create 2-second segments

    segments = create_segments(audio)

    if len(segments) == 0:

        raise ValueError(
            "Audio must be at least 2 seconds long."
        )

    real_probabilities = []
    fake_probabilities = []

    real_count = 0
    fake_count = 0

    # Analyze every segment

    for segment in segments:

        real_probability, fake_probability = (
            predict_segment(
                model,
                segment
            )
        )

        real_probabilities.append(
            real_probability
        )

        fake_probabilities.append(
            fake_probability
        )

        if fake_probability > real_probability:

            fake_count += 1

        else:

            real_count += 1

    # Average probabilities

    average_real = float(
        np.mean(real_probabilities)
    )

    average_fake = float(
        np.mean(fake_probabilities)
    )

    # Final result

    if average_fake > average_real:

        final_result = "FAKE"

    else:

        final_result = "REAL"

    return {

        "result": final_result,

        "real_probability": round(
            average_real * 100,
            2
        ),

        "fake_probability": round(
            average_fake * 100,
            2
        ),

        "segments_analyzed": len(
            segments
        ),

        "real_segments": real_count,

        "fake_segments": fake_count,

        "duration_seconds": round(
            duration,
            2
        ),

        "validation_accuracy": round(
            val_accuracy,
            2
        )
    }


# ============================================================
# COMMAND LINE ANALYSIS
# ============================================================

def analyze_audio(filename):

    print()
    print("=" * 60)
    print("AI VOICE CLONE DETECTION")
    print("2-MINUTE AUDIO TEST")
    print("=" * 60)

    print()
    print("Loading trained model...")

    model, mean, std, val_accuracy = load_model()

    print("Model loaded successfully.")

    print(
        f"Validation accuracy: "
        f"{val_accuracy:.2f}%"
    )

    print(
        f"Device: {device}"
    )

    print()
    print("Loading audio:")
    print(filename)

    audio, duration = load_audio(filename)

    print(
        f"Sample rate: {SAMPLE_RATE}"
    )

    print(
        f"Audio duration: "
        f"{duration:.2f} seconds"
    )

    if duration >= MAX_DURATION:

        print(
            "Only the first 2 minutes will be analyzed."
        )

    print()
    print("=" * 60)
    print("ANALYZING AUDIO")
    print("=" * 60)

    segments = create_segments(audio)

    number_of_segments = len(segments)

    print()
    print(
        f"Total segments: "
        f"{number_of_segments}"
    )

    if number_of_segments == 0:

        print()
        print(
            "ERROR: Audio is shorter than 2 seconds."
        )

        return

    real_probabilities = []
    fake_probabilities = []

    real_count = 0
    fake_count = 0

    # Analyze each segment

    for i, segment in enumerate(segments):

        start_time = (
            i * SEGMENT_DURATION
        )

        end_time = (
            start_time + SEGMENT_DURATION
        )

        real_probability, fake_probability = (
            predict_segment(
                model,
                segment
            )
        )

        real_probabilities.append(
            real_probability
        )

        fake_probabilities.append(
            fake_probability
        )

        if fake_probability > real_probability:

            result = "FAKE"

            fake_count += 1

        else:

            result = "REAL"

            real_count += 1

        print(
            f"Segment "
            f"{i + 1:3d} "
            f"[{start_time:6.1f}s - "
            f"{end_time:6.1f}s]  "
            f"{result:4s}  "
            f"REAL: "
            f"{real_probability * 100:6.2f}%  "
            f"FAKE: "
            f"{fake_probability * 100:6.2f}%"
        )

    # Average probability

    average_real = np.mean(
        real_probabilities
    )

    average_fake = np.mean(
        fake_probabilities
    )

    # Percentages

    real_percentage = (
        100 *
        real_count /
        number_of_segments
    )

    fake_percentage = (
        100 *
        fake_count /
        number_of_segments
    )

    # Final result

    if average_fake > average_real:

        final_result = "FAKE"

    else:

        final_result = "REAL"

    # Final output

    print()
    print("=" * 60)
    print("FINAL AUDIO RESULT")
    print("=" * 60)

    print()

    print(
        f"Total duration: "
        f"{duration:.2f} seconds"
    )

    print(
        f"Segments analyzed: "
        f"{number_of_segments}"
    )

    print()

    print(
        f"REAL segments: "
        f"{real_count} "
        f"({real_percentage:.2f}%)"
    )

    print(
        f"FAKE segments: "
        f"{fake_count} "
        f"({fake_percentage:.2f}%)"
    )

    print()

    print(
        f"Average REAL probability: "
        f"{average_real * 100:.2f}%"
    )

    print(
        f"Average FAKE probability: "
        f"{average_fake * 100:.2f}%"
    )

    print()

    print(
        f"FINAL RESULT: "
        f"{final_result}"
    )

    print()

    print("=" * 60)


# ============================================================
# MAIN
# ============================================================

def main():

    if len(sys.argv) < 2:

        print()

        print("Usage:")

        print(
            'python test_model.py "test_audio\\sample.wav"'
        )

        sys.exit(1)

    audio_file = sys.argv[1]

    analyze_audio(audio_file)


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":

    main()