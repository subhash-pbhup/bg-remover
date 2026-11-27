const express = require("express");
const path = require("path");
const JSZip = require("jszip");

const app = express();
app.use(express.json({ limit: "80mb" }));
app.use(express.static(path.join(__dirname, "public")));

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
      "Content-Length": zipBuffer.length,
    });
    return res.send(zipBuffer);
  } catch (err) {
    console.error("ZIP generation error:", err);
    return res.status(500).json({ error: "ZIP file nahi ban payi." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Sanskar Tech BG Remover running on http://localhost:${PORT}`);
});