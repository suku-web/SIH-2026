const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();

const PORT = 5000;

// Shared recordings folder
const recordingsFolder = path.join(
  __dirname,
  "..",
  "voice-recordings"
);

// Create folder if it doesn't exist
if (!fs.existsSync(recordingsFolder)) {
  fs.mkdirSync(recordingsFolder, {
    recursive: true,
  });
}

app.use(cors());
app.use(express.json());


// -----------------------------
// MULTER STORAGE
// -----------------------------

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, recordingsFolder);
  },

  filename: function (req, file, cb) {
    const id = crypto.randomUUID();

    cb(
      null,
      `recording_${Date.now()}_${id}.webm`
    );
  },
});

const upload = multer({
  storage: storage,

  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});


// -----------------------------
// HOME
// -----------------------------

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Voice Security Backend is running",
  });
});


// -----------------------------
// SAVE ENROLLMENT
// -----------------------------

app.post(
  "/api/enroll",
  upload.single("audio"),
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No audio file received",
        });
      }

      const recordingId =
        path.parse(req.file.filename).name;

      const enrollment = {
        recordingId: recordingId,

        name: req.body.name || "",

        userId: req.body.userId || "",

        duration: req.body.duration || "0",

        mimeType:
          req.body.mimeType ||
          req.file.mimetype,

        fileName: req.file.filename,

        fileSize: req.file.size,

        timestamp:
          new Date().toISOString(),

        audioUrl:
          `/api/audio/${encodeURIComponent(
            req.file.filename
          )}`,

        downloadUrl:
          `/api/download/${encodeURIComponent(
            req.file.filename
          )}`,
      };


      // Save metadata
      const metadataPath =
        path.join(
          recordingsFolder,
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
      console.log(
        "Name:",
        enrollment.name
      );
      console.log(
        "User ID:",
        enrollment.userId
      );
      console.log(
        "Duration:",
        enrollment.duration,
        "seconds"
      );
      console.log(
        "File:",
        enrollment.fileName
      );
      console.log(
        "Folder:",
        recordingsFolder
      );
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


// -----------------------------
// GET ALL ENROLLMENTS
// -----------------------------

app.get(
  "/api/enrollments",
  (req, res) => {
    try {
      const files =
        fs.readdirSync(
          recordingsFolder
        );

      const jsonFiles =
        files.filter(
          (file) =>
            file.endsWith(".json")
        );


      const enrollments =
        jsonFiles.map((file) => {
          const filePath =
            path.join(
              recordingsFolder,
              file
            );

          return JSON.parse(
            fs.readFileSync(
              filePath,
              "utf8"
            )
          );
        });


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


// -----------------------------
// PLAY AUDIO
// -----------------------------

app.get(
  "/api/audio/:filename",
  (req, res) => {
    const filename =
      path.basename(
        req.params.filename
      );

    const filePath =
      path.join(
        recordingsFolder,
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


// -----------------------------
// DOWNLOAD AUDIO
// -----------------------------

app.get(
  "/api/download/:filename",
  (req, res) => {
    const filename =
      path.basename(
        req.params.filename
      );

    const filePath =
      path.join(
        recordingsFolder,
        filename
      );


    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message:
          "Audio recording not found",
      });
    }


    res.download(
      filePath,
      filename
    );
  }
);


// -----------------------------
// START SERVER
// -----------------------------

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
      `Recordings folder: ${recordingsFolder}`
    );
    console.log(
      "======================================"
    );
    console.log("");
  }
);
app.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("======================================");
  console.log("VOICE SECURITY BACKEND");
  console.log("======================================");
  console.log(`Local: http://localhost:${PORT}`);
  console.log(`Recordings folder: ${recordingsFolder}`);
  console.log("======================================");
});