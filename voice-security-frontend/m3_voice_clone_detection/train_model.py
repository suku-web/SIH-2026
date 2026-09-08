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

DURATION = 2

NUM_SAMPLES = SAMPLE_RATE * DURATION

N_MFCC = 40

N_FFT = 512

HOP_LENGTH = 256


# ============================================================
# DEVICE
# ============================================================

device = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)


# ============================================================
# CNN MODEL
# ============================================================

class VoiceCloneCNN(nn.Module):

    def __init__(self):

        super().__init__()

        self.features = nn.Sequential(

            # BLOCK 1

            nn.Conv2d(
                1,
                32,
                kernel_size=3,
                padding=1
            ),

            nn.BatchNorm2d(32),

            nn.ReLU(),

            nn.MaxPool2d(2),

            nn.Dropout2d(0.10),


            # BLOCK 2

            nn.Conv2d(
                32,
                64,
                kernel_size=3,
                padding=1
            ),

            nn.BatchNorm2d(64),

            nn.ReLU(),

            nn.MaxPool2d(2),

            nn.Dropout2d(0.15),


            # BLOCK 3

            nn.Conv2d(
                64,
                128,
                kernel_size=3,
                padding=1
            ),

            nn.BatchNorm2d(128),

            nn.ReLU(),

            nn.MaxPool2d(2),

            nn.Dropout2d(0.20),


            # BLOCK 4

            nn.Conv2d(
                128,
                256,
                kernel_size=3,
                padding=1
            ),

            nn.BatchNorm2d(256),

            nn.ReLU(),

            nn.AdaptiveAvgPool2d(
                (1, 1)
            )
        )


        # CLASSIFIER

        self.classifier = nn.Sequential(

            nn.Flatten(),

            nn.Linear(
                256,
                128
            ),

            nn.ReLU(),

            nn.Dropout(0.40),

            nn.Linear(
                128,
                2
            )
        )


    def forward(self, x):

        x = self.features(x)

        x = self.classifier(x)

        return x


# ============================================================
# LOAD MODEL
# ============================================================

def load_model():

    print()
    print("Loading trained model...")

    if not os.path.exists(MODEL_FILE):

        print()
        print("ERROR: Model file not found.")

        print(
            "Expected:"
        )

        print(
            MODEL_FILE
        )

        sys.exit(1)


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


    print(
        "Model loaded successfully."
    )

    print(
        f"Validation accuracy: "
        f"{float(checkpoint['val_accuracy']):.2f}%"
    )

    print(
        f"Device: {device}"
    )


    return model, mean, std


# ============================================================
# LOAD AUDIO
# ============================================================

def load_audio(filename):

    print()
    print(
        "Loading audio:"
    )

    print(
        filename
    )


    if not os.path.exists(filename):

        print()
        print(
            "ERROR: Audio file not found."
        )

        sys.exit(1)


    audio, sr = librosa.load(
        filename,
        sr=SAMPLE_RATE,
        mono=True
    )


    print(
        f"Original sample rate: {sr}"
    )

    print(
        f"Original samples: {len(audio)}"
    )


    # ========================================================
    # FORCE AUDIO TO 2 SECONDS
    # ========================================================

    if len(audio) > NUM_SAMPLES:

        print(
            "Audio is longer than 2 seconds."
        )

        print(
            "Using first 2 seconds."
        )

        audio = audio[:NUM_SAMPLES]


    elif len(audio) < NUM_SAMPLES:

        print(
            "Audio is shorter than 2 seconds."
        )

        print(
            "Padding with zeros."
        )

        audio = np.pad(
            audio,
            (
                0,
                NUM_SAMPLES - len(audio)
            )
        )


    print(
        f"Final samples: {len(audio)}"
    )


    return audio


# ============================================================
# EXTRACT MFCC
# ============================================================

def extract_mfcc(audio):

    print()
    print(
        "Extracting MFCC features..."
    )


    mfcc = librosa.feature.mfcc(
        y=audio,
        sr=SAMPLE_RATE,
        n_mfcc=N_MFCC,
        n_fft=N_FFT,
        hop_length=HOP_LENGTH
    )


    print(
        f"MFCC shape: {mfcc.shape}"
    )


    return mfcc


# ============================================================
# FIX MFCC SIZE
# ============================================================

def fix_mfcc_size(mfcc):

    target_width = 126

    current_width = mfcc.shape[1]


    if current_width > target_width:

        mfcc = mfcc[:, :target_width]


    elif current_width < target_width:

        padding = target_width - current_width

        mfcc = np.pad(
            mfcc,
            (
                (0, 0),
                (0, padding)
            ),
            mode="constant"
        )


    return mfcc


# ============================================================
# PREDICT
# ============================================================

def predict(
    model,
    mfcc,
    mean,
    std
):

    # --------------------------------------------------------
    # NORMALIZATION
    # --------------------------------------------------------

    mfcc = (
        mfcc - mean
    ) / std


    # --------------------------------------------------------
    # CONVERT TO TENSOR
    # --------------------------------------------------------

    X = torch.tensor(
        mfcc,
        dtype=torch.float32
    )


    # Add:
    #
    # Batch dimension
    # Channel dimension
    #
    # 40 × 126
    #
    # becomes
    #
    # 1 × 1 × 40 × 126

    X = X.unsqueeze(0)

    X = X.unsqueeze(0)


    X = X.to(device)


    # --------------------------------------------------------
    # MODEL PREDICTION
    # --------------------------------------------------------

    with torch.no_grad():

        outputs = model(X)

        probabilities = torch.softmax(
            outputs,
            dim=1
        )


    real_probability = (
        probabilities[0][0].item()
        * 100
    )


    fake_probability = (
        probabilities[0][1].item()
        * 100
    )


    if fake_probability > real_probability:

        prediction = "FAKE"

    else:

        prediction = "REAL"


    return (
        prediction,
        real_probability,
        fake_probability
    )


# ============================================================
# MAIN
# ============================================================

def main():

    print("=" * 60)

    print(
        "AI VOICE CLONE DETECTION"
    )

    print(
        "INDIVIDUAL AUDIO TEST"
    )

    print("=" * 60)


    # --------------------------------------------------------
    # CHECK ARGUMENT
    # --------------------------------------------------------

    if len(sys.argv) < 2:

        print()

        print(
            "Usage:"
        )

        print(
            "python test_model.py <audio_file.wav>"
        )

        print()

        print(
            "Example:"
        )

        print(
            'python test_model.py "test_audio/sample.wav"'
        )

        sys.exit(1)


    audio_file = sys.argv[1]


    # --------------------------------------------------------
    # LOAD MODEL
    # --------------------------------------------------------

    model, mean, std = load_model()


    # --------------------------------------------------------
    # LOAD AUDIO
    # --------------------------------------------------------

    audio = load_audio(
        audio_file
    )


    # --------------------------------------------------------
    # EXTRACT MFCC
    # --------------------------------------------------------

    mfcc = extract_mfcc(
        audio
    )


    # --------------------------------------------------------
    # FIX SIZE
    # --------------------------------------------------------

    mfcc = fix_mfcc_size(
        mfcc
    )


    print(
        f"Final MFCC shape: {mfcc.shape}"
    )


    # --------------------------------------------------------
    # PREDICTION
    # --------------------------------------------------------

    prediction, real_probability, fake_probability = predict(
        model,
        mfcc,
        mean,
        std
    )


    # ========================================================
    # RESULT
    # ========================================================

    print()

    print("=" * 60)

    print(
        "PREDICTION RESULT"
    )

    print("=" * 60)

    print()

    print(
        f"REAL probability : "
        f"{real_probability:.2f}%"
    )

    print(
        f"FAKE probability : "
        f"{fake_probability:.2f}%"
    )

    print()

    print(
        f"FINAL RESULT: {prediction}"
    )

    print()

    print("=" * 60)


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":

    main()