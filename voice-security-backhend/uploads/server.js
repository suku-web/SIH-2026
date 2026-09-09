const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();

const PORT = 5000;

// ==========================================
// UPLOAD FOLDER
// ==========================================

const uploadFolder = path.join(
  __dirname,
  "uploads"
);

if (!fs.existsSync(uploadFolder)) {
  fs.mkdirSync(uploadFolder, {
    recursive: true,
  });
}

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(cors());

app.use(express.json());

// ==========================================
// MULTER STORAGE
// ==========================================

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadFolder);
  },

  filename: function (req, file, cb) {
    const userId = String(
      req.body.userId || "unknown"
    ).replace(/[^a-zA-Z0-9_-]/g, "_");

    const recordingId =
      crypto.randomUUID();

    cb(
      null,
      `${userId}_${recordingId}.webm`
    );
  },
});

const upload = multer({
  storage: storage,

  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

// ==========================================
// TEST BACKEND
// ==========================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message:
      "Voice Security Backend is running",
  });
});

// ==========================================
// VOICE ENROLLMENT
// ==========================================

app.post(
  "/api/enroll",
  upload.single("audio"),
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message:
            "No audio file received",
        });
      }

      const recordingId =
        path.parse(
          req.file.filename
        ).name;

      const enrollment = {
        recordingId: recordingId,

        userId:
          req.body.userId || "",

        name:
          req.body.name || "",

        duration:
          req.body.duration || "",

        sampleRate:
          req.body.sampleRate || "",

        format:
          req.file.mimetype,

        fileName:
          req.file.filename,

        fileSize:
          req.file.size,

        timestamp:
          new Date().toISOString(),

        audioUrl:
          `/api/audio/${encodeURIComponent(
            req.file.filename
          )}`,
      };

      // Save enrollment metadata
      const metadataPath =
        path.join(
          uploadFolder,
          `${recordingId}.json`
        );

      fs.writeFileSync(
        metadataPath,
        JSON.stringify(
          enrollment,
          null,
          2
        )
      );

      // Show enrollment in terminal
      console.log("");
      console.log(
        "================================"
      );
      console.log(
        "VOICE ENROLLMENT SAVED"
      );
      console.log(
        "================================"
      );

      console.log(enrollment);

      console.log(
        "================================"
      );
      console.log("");

      res.json({
        success: true,

        message:
          "Voice enrollment saved successfully",

        enrollment: enrollment,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        success: false,

        message:
          "Failed to save voice enrollment",
      });
    }
  }
);

// ==========================================
// GET ALL ENROLLMENTS
// ==========================================

app.get(
  "/api/enrollments",
  (req, res) => {
    try {
      const files =
        fs.readdirSync(
          uploadFolder
        );

      const metadataFiles =
        files.filter((file) =>
          file.endsWith(".json")
        );

      const enrollments =
        metadataFiles.map(
          (file) => {
            const filePath =
              path.join(
                uploadFolder,
                file
              );

            return JSON.parse(
              fs.readFileSync(
                filePath,
                "utf8"
              )
            );
          }
        );

      res.json({
        success: true,

        count:
          enrollments.length,

        enrollments:
          enrollments,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        success: false,

        message:
          "Could not retrieve enrollments",
      });
    }
  }
);

// ==========================================
// GET AUDIO FILE
// ==========================================

app.get(
  "/api/audio/:filename",
  (req, res) => {
    const filename =
      path.basename(
        req.params.filename
      );

    const filePath =
      path.join(
        uploadFolder,
        filename
      );

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,

        message:
          "Audio recording not found",
      });
    }

    res.sendFile(filePath);
  }
);

// ==========================================
// START SERVER
// ==========================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log("");

    console.log(
      "======================================"
    );

    console.log(
      "VOICE SECURITY BACKEND"
    );

    console.log(
      "======================================"
    );

    console.log(
      `Local: http://localhost:${PORT}`
    );

    console.log(
      `Recordings: ${uploadFolder}`
    );

    console.log(
      "======================================"
    );

    console.log("");
  }
);