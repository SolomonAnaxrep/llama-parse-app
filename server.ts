import dotenv from "dotenv";
dotenv.config();

import express from "express";
import multer from "multer";
import cors from "cors";
import path from "path";
import { LlamaParseExtractionService } from "./services/LlamaParseExtractionService";
import { LlamaParseSchemaBuilder } from "./services/LlamaParseSchemaBuilder";

const app = express();
const PORT = 3031;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

// Store uploaded file in memory (simple in-memory storage)
let uploadedFile: { buffer: Buffer; fileName: string } | null = null;

// Initialize services
const extractionService = new LlamaParseExtractionService();
const schemaBuilder = new LlamaParseSchemaBuilder();

// Route: Upload PDF
app.post("/api/upload", upload.single("pdf"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    uploadedFile = {
      buffer: req.file.buffer,
      fileName: req.file.originalname,
    };

    res.json({
      success: true,
      message: "File uploaded successfully",
      fileName: req.file.originalname,
      fileSize: req.file.size,
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    res.status(500).json({ error: error.message || "Upload failed" });
  }
});

// Route: Extract data from PDF
app.post("/api/extract", async (req, res) => {
  try {
    if (!uploadedFile) {
      return res.status(400).json({ error: "No file uploaded. Please upload a PDF first." });
    }

    // Build schema
    const schema = schemaBuilder.buildDealsV3ExtractionSchema();

    // Extract data
    const result = await extractionService.extractFromPdf(
      uploadedFile.buffer,
      uploadedFile.fileName,
      {
        schema,
        citeSources: true,
        citationBbox: true,
        confidenceScores: true,
      }
    );

    res.json({
      success: true,
      result,
    });
  } catch (error: any) {
    console.error("Extraction error:", error);
    res.status(500).json({
      error: error.message || "Extraction failed",
      details: error.stack,
    });
  }
});

// Serve frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
