const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const JSZip = require('jszip');

// background-removal-node लाइब्रेरी को इम्पोर्ट करें
const { removeBackground } = require('@imgly/background-removal-node');

const app = express();
const port = process.env.PORT || 3000;

// मेमोरी स्टोरेज का इस्तेमाल करें ताकि हम सीधे बफर पर काम कर सकें
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB लिमिट
});

// ZIP डाउनलोड के लिए बॉडी पार्सर की लिमिट बढ़ाएं (क्योंकि Base64 इमेजेज बड़ी होती हैं)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// स्टैटिक फाइल्स सर्व करें (build.js आपकी index.html को dist/public में कॉपी करता है)
app.use(express.static(path.join(__dirname, 'dist', 'public')));

// रूट URL पर index.html भेजें
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'public', 'index.html'));
});

// API 1: बैकग्राउंड रिमूव करने के लिए
app.post('/remove-bg', upload.array('images'), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'कोई इमेज अपलोड नहीं हुई।' });
        }

        const results = [];
        
        // एक-एक करके इमेजेज प्रोसेस करें
        for (const file of req.files) {
            try {
                // Buffer को Blob में बदलें (क्योंकि @imgly को Blob चाहिए)
                const imageBlob = new Blob([file.buffer], { type: file.mimetype });
                
                // AI मॉडल से बैकग्राउंड रिमूव करवाएं
                const resultBlob = await removeBackground(imageBlob);
                
                // Blob को Base64 में बदलें ताकि Frontend दिखा सके
                const arrayBuffer = await resultBlob.arrayBuffer();
                const base64 = Buffer.from(arrayBuffer).toString('base64');
                const dataUrl = `data:image/png;base64,${base64}`;
                
                // फ़ाइल का नाम सेट करें
                const originalName = file.originalname.split('.')[0];
                const outputName = `${originalName}-bg-removed.png`;

                results.push({ success: true, dataUrl: dataUrl, outputName: outputName });
            } catch (err) {
                console.error(`Error processing ${file.originalname}:`, err);
                results.push({ success: false, error: `Failed to process ${file.originalname}` });
            }
        }

        res.json({ results });

    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).json({ error: 'सर्वर में कोई तकनीकी खराबी आई है।' });
    }
});

// API 2: सभी रिजल्ट्स को ZIP में डाउनलोड करने के लिए
app.post('/download-zip', async (req, res) => {
    try {
        const files = req.body.files;
        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'कोई फ़ाइल नहीं मिली।' });
        }

        const zip = new JSZip();
        
        files.forEach(file => {
            // dataUrl से "data:image/png;base64," हटाकर सिर्फ base64 डेटा लें
            const base64Data = file.dataUrl.replace(/^data:image\/png;base64,/, "");
            zip.file(file.outputName, base64Data, { base64: true });
        });

        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
        
        res.set('Content-Type', 'application/zip');
        res.set('Content-Disposition', 'attachment; filename="sanskar-tech-bg-removed.zip"');
        res.send(zipBuffer);

    } catch (error) {
        console.error('ZIP Error:', error);
        res.status(500).json({ error: 'ZIP फ़ाइल बनाने में त्रुटि हुई।' });
    }
});

// सर्वर स्टार्ट करें
app.listen(port, () => {
    console.log(`Sanskar Tech BG Remover running on port ${port}`);
});