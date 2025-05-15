
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const sharp = require('sharp');
const Tesseract = require('tesseract.js');
const app = express();
const port = process.env.PORT || 10000;
const upload = multer();

app.use(cors());
app.use(express.json());

app.post('/pdf/analyze', upload.single('file'), async (req, res) => {
  try {
    const imageBuffer = req.file.buffer;
    const image = await sharp(imageBuffer).resize(1000).toBuffer();
    const { data: { text } } = await Tesseract.recognize(image, 'eng');

    const zahlen = Array.from(text.matchAll(/\d+(\.\d+)?/g)).map(m => parseFloat(m[0]));
    const werte = zahlen.filter(z => z > 2 && z < 2000).sort((a, b) => b - a);
    const [x1, x2, x3] = werte;

    const stueckzahl = parseInt(req.body.stueckzahl) || 1;
    const material = req.body.material || 'stahl';

    const dichten = {
      aluminium: 2.7,
      edelstahl: 7.9,
      stahl: 7.85,
      messing: 8.4,
      kupfer: 8.9
    };

    const kgPreise = {
      aluminium: 7,
      edelstahl: 6.5,
      stahl: 1.5,
      messing: 8,
      kupfer: 10
    };

    const dichte = dichten[material] || 7.85;
    const kgPreis = kgPreise[material] || 1.5;

    let volumen = 0, form = "", gewicht = 0;
    if (text.toLowerCase().includes("ø") || text.toLowerCase().includes("durchmesser")) {
      // Rundmaterial (z. B. Ø60 × 100)
      const d = x1, l = x2 || 100;
      volumen = Math.PI * Math.pow((d / 10) / 2, 2) * (l / 10); // cm³
      form = "rund";
    } else {
      // Flachmaterial (z. B. 120 × 60 × 10)
      const l = x1, b = x2, h = x3 || 10;
      volumen = (l / 10) * (b / 10) * (h / 10); // cm³
      form = "flach";
    }

    gewicht = volumen * dichte / 1000;
    if (!gewicht || gewicht > 100) return res.json({ manuell: true });

    const materialkosten = gewicht * kgPreis;

    // Laufzeit aus Excel-Werten (vereinfacht): Basis + Gewicht + Fläche
    const laufzeitMin = 5 + (gewicht * 1.2) + (Math.sqrt(volumen) * 0.8);
    const laufzeitKosten = (laufzeitMin / 60) * 35;

    const rüsten = 60, programmieren = 30;
    const gesamtKosten = materialkosten + laufzeitKosten + (rüsten + programmieren) / stueckzahl;
    const vk = gesamtKosten * 1.15;

    return res.json({ 
      preis: parseFloat(vk.toFixed(2)), 
      gewicht: parseFloat(gewicht.toFixed(2)),
      form,
      laufzeitMin: parseFloat(laufzeitMin.toFixed(1))
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Fehler bei der Analyse' });
  }
});

app.listen(port, () => {
  console.log("🚀 Excel-Profi-Preisrechner läuft auf Port", port);
});
