import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Support large payload for high-resolution signature PNG base64 strings
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));

  // Directories for persistent storage on server
  const dataDir = path.join(__dirname, 'data');
  const signaturesDir = path.join(__dirname, 'public', 'signatures');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(signaturesDir)) {
    fs.mkdirSync(signaturesDir, { recursive: true });
  }

  const signaturesFile = path.join(dataDir, 'signatures.json');

  // Helper to read server signatures
  const readServerSignatures = (): Record<string, any> => {
    try {
      if (fs.existsSync(signaturesFile)) {
        const raw = fs.readFileSync(signaturesFile, 'utf-8');
        return JSON.parse(raw) || {};
      }
    } catch (e) {
      console.error('Error reading signatures file:', e);
    }
    return {};
  };

  // Helper to write server signatures and save PNG files to public/signatures
  const saveServerSignatures = (records: Record<string, any>) => {
    fs.writeFileSync(signaturesFile, JSON.stringify(records, null, 2), 'utf-8');

    // Also write physical PNG files on server disk so they can be referenced directly
    for (const [key, rec] of Object.entries(records)) {
      if (rec && rec.signatureDataUrl && typeof rec.signatureDataUrl === 'string') {
        try {
          const base64Data = rec.signatureDataUrl.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          const safeFileName = `${encodeURIComponent(rec.cleanName || rec.name || key)}.png`;
          fs.writeFileSync(path.join(signaturesDir, safeFileName), buffer);
        } catch (e) {
          console.warn(`Could not write png for ${key}:`, e);
        }
      }
    }
  };

  // 1. API: Get all signatures stored on server
  app.get('/api/signatures', (_req, res) => {
    try {
      const signatures = readServerSignatures();
      return res.json({
        success: true,
        count: Object.keys(signatures).length,
        signatures,
        updatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Server error' });
    }
  });

  // 2. API: Save single or batch signatures onto server
  app.post('/api/signatures', (req, res) => {
    try {
      const { signatures, record } = req.body;
      const current = readServerSignatures();

      if (record && record.name) {
        const key = (record.cleanName || record.name).replace(/\s+/g, '').toLowerCase().trim();
        current[key] = {
          ...record,
          uploadedAt: record.uploadedAt || new Date().toISOString(),
          isCustomSignature: true,
        };
      }

      if (signatures && typeof signatures === 'object') {
        for (const [k, v] of Object.entries(signatures)) {
          if (v && typeof v === 'object' && (v as any).name) {
            const safeKey = k.replace(/\s+/g, '').toLowerCase().trim();
            current[safeKey] = {
              ...(v as any),
              uploadedAt: (v as any).uploadedAt || new Date().toISOString(),
              isCustomSignature: true,
            };
          }
        }
      }

      saveServerSignatures(current);
      console.log(`Saved ${Object.keys(current).length} signatures to server disk.`);

      return res.json({
        success: true,
        count: Object.keys(current).length,
        signatures: current,
        message: 'บันทึกลายเซ็นลง Server เรียบร้อยแล้ว',
      });
    } catch (err: any) {
      console.error('Error saving signatures to server:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Server error' });
    }
  });

  // 3. API: Delete signature from server
  app.delete('/api/signatures/:key', (req, res) => {
    try {
      const key = req.params.key.replace(/\s+/g, '').toLowerCase().trim();
      const current = readServerSignatures();
      if (current[key]) {
        delete current[key];
        saveServerSignatures(current);
      }
      return res.json({ success: true, count: Object.keys(current).length });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Server error' });
    }
  });

  // 4. API: Health and status
  app.get('/api/health', (_req, res) => {
    const current = readServerSignatures();
    return res.json({
      status: 'ok',
      totalSignaturesOnServer: Object.keys(current).length,
      timestamp: new Date().toISOString(),
    });
  });

  // Serve Vite in dev or static files in production
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Equipment Inspection Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
