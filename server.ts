import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const DB_FILE = path.join(__dirname, 'server_db.json');

app.use(express.json({ limit: '50mb' }));

// Helper to read DB from file
function readDbFromFile(): any | null {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading DB_FILE:', err);
  }
  return null;
}

// Helper to write DB to file
function writeDbToFile(data: any): boolean {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing DB_FILE:', err);
    return false;
  }
}

// API Routes for Network / Multi-device Sync

// 1. Get entire shared database state
app.get('/api/state', (req, res) => {
  const dbData = readDbFromFile();
  if (dbData) {
    return res.json({
      success: true,
      exists: true,
      updatedAt: dbData.updatedAt || new Date().toISOString(),
      state: dbData.state,
    });
  }
  return res.json({
    success: true,
    exists: false,
    state: null,
  });
});

// 2. Save entire shared database state (Sync across all clients)
app.post('/api/state', (req, res) => {
  const { state } = req.body;
  if (!state) {
    return res.status(400).json({ success: false, error: 'State is required' });
  }

  const payload = {
    updatedAt: new Date().toISOString(),
    state,
  };

  const ok = writeDbToFile(payload);
  if (ok) {
    return res.json({ success: true, updatedAt: payload.updatedAt });
  } else {
    return res.status(500).json({ success: false, error: 'Failed to save to server' });
  }
});

// 3. Reset / Blank Database (دیتابیس کاملاً خام و بدون سند/مشتری برای شروع واقعی)
app.post('/api/reset-blank', (req, res) => {
  const { blankState } = req.body;
  const payload = {
    updatedAt: new Date().toISOString(),
    state: blankState || null,
  };

  const ok = writeDbToFile(payload);
  if (ok) {
    return res.json({ success: true, message: 'Database reset to blank successfully' });
  } else {
    return res.status(500).json({ success: false, error: 'Failed to reset database' });
  }
});

// 4. Server health & status
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: 'network_server',
    time: new Date().toISOString(),
    dbExists: fs.existsSync(DB_FILE),
  });
});

async function startServer() {
  // Mount Vite middleware in development mode
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 TarazBan Network Central Server running at http://0.0.0.0:${PORT}`);
    console.log(`📱 Connect any PC or mobile phone via server IP: http://<SERVER_IP>:${PORT}`);
  });
}

startServer();
