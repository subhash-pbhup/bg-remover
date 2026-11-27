// server.js
var express = require("express");
var multer = require("multer");
var path = require("path");
var JSZip = require("jszip");
var { removeBackground } = require("@imgly/background-removal-node");
var app = express();
app.use(express.json({ limit: "80mb" }));
var upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    // 10 MB per file
    files: 10
    // Max 10 files per batch
  }
});
app.use(express.static(path.join(__dirname, "public")));
function normalizeMimeType(file) {
  if (file.mimetype && file.mimetype.startsWith("image/")) {
    return file.mimetype;
  }
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}
async function runSequentially(items, workerFn) {
  const results = [];
  for (let i = 0; i < items.length; i++) {
    results.push(await workerFn(items[i], i));
  }
  return results;
}
app.post("/remove-bg", (req, res) => {
  upload.array("images", 10)(req, res, async (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({
        error: uploadErr.code === "LIMIT_FILE_SIZE" ? "Har file maximum 10 MB ki honi chahiye." : uploadErr.code === "LIMIT_FILE_COUNT" ? "Ek baar mein maximum 10 images upload ki ja sakti hain." : uploadErr.message || "Upload error."
      });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "Kripya kam se kam ek image chunein." });
    }
    try {
      const processed = await runSequentially(req.files, async (file) => {
        try {
          const mimeType = normalizeMimeType(file);
          const uint8 = new Uint8Array(file.buffer);
          const inputBlob = new Blob([uint8], { type: mimeType });
          const outputBlob = await removeBackground(inputBlob, {
            model: "small",
            output: {
              format: "image/png",
              quality: 0.9
            }
          });
          const arrayBuffer = await outputBlob.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString("base64");
          const baseName = (file.originalname || "image").replace(/\.[^/.]+$/, "");
          return {
            originalName: file.originalname,
            outputName: `${baseName}-sanskar-nobg.png`,
            success: true,
            dataUrl: `data:image/png;base64,${base64}`
          };
        } catch (imgErr) {
          console.error(`Error processing [${file.originalname}]:`, imgErr);
          return {
            originalName: file.originalname,
            outputName: null,
            success: false,
            error: imgErr && imgErr.message ? imgErr.message : "Background remove nahi ho paya."
          };
        }
      });
      return res.status(200).json({ results: processed });
    } catch (err) {
      console.error("Batch processing fatal error:", err);
      return res.status(500).json({
        error: err && err.message ? err.message : "Server par image process nahi ho saki."
      });
    }
  });
});
app.post("/download-zip", async (req, res) => {
  try {
    const { files } = req.body;
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: "ZIP banane ke liye koi processed image nahi mili." });
    }
    const zip = new JSZip();
    for (const item of files) {
      if (!item || !item.dataUrl || !item.outputName) continue;
      const base64Data = item.dataUrl.replace(/^data:image\/png;base64,/, "");
      zip.file(item.outputName, base64Data, { base64: true });
    }
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    res.set({
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="sanskar-tech-bg-removed.zip"',
      "Content-Length": zipBuffer.length
    });
    return res.send(zipBuffer);
  } catch (err) {
    console.error("ZIP generation error:", err);
    return res.status(500).json({ error: "ZIP file nahi ban payi." });
  }
});
app.use((err, req, res, next) => {
  console.error("Express error middleware:", err);
  if (res.headersSent) return next(err);
  return res.status(err.status || 500).json({
    error: err && err.message ? err.message : "Internal server error."
  });
});
var PORT = process.env.PORT || 3e3;
app.listen(PORT, () => {
  console.log(`Sanskar Tech BG Remover running on http://localhost:${PORT}`);
});
