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
const LICENSE_FILE = path.join(__dirname, 'server_license.json');
const PUBLIC_LICENSE_FILE = path.join(__dirname, 'public', 'server_license.json');
const DIST_LICENSE_FILE = path.join(__dirname, 'dist', 'server_license.json');
const BACKUPS_DIR = path.join(__dirname, 'backups');

app.use(express.json({ limit: '50mb' }));
app.use(express.text({ type: 'text/plain', limit: '50mb' }));

function readServerLicense(): any | null {
  const candidates = [LICENSE_FILE, DIST_LICENSE_FILE, PUBLIC_LICENSE_FILE];
  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      }
    } catch {
      // ignore invalid file
    }
  }
  return null;
}

function writeServerLicense(data: any): boolean {
  try {
    const json = JSON.stringify(data, null, 2);
    fs.writeFileSync(LICENSE_FILE, json, 'utf-8');
    if (fs.existsSync(path.dirname(PUBLIC_LICENSE_FILE))) {
      fs.writeFileSync(PUBLIC_LICENSE_FILE, json, 'utf-8');
    }
    if (fs.existsSync(path.dirname(DIST_LICENSE_FILE))) {
      fs.writeFileSync(DIST_LICENSE_FILE, json, 'utf-8');
    }
    return true;
  } catch (err) {
    console.error('Error writing server license:', err);
    return false;
  }
}

function ensureBackupsDir(): string {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }
  } catch (err) {
    console.error('Error creating backups directory:', err);
  }
  return BACKUPS_DIR;
}

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

function writeAutoBackupSnapshot(state: any, reason = 'auto_2h') {
  const dir = ensureBackupsDir();
  const now = new Date();
  const iso = now.toISOString();
  const stamp = iso.replace(/[:.]/g, '-').slice(0, 19);
  const safeReason = String(reason || 'auto').replace(/[^a-zA-Z0-9_-]/g, '');
  const snapshotFilename = `TarazBan_AutoBackup_${stamp}_${safeReason}.json`;
  const latestPath = path.join(dir, 'TarazBan_Latest_AutoBackup.json');
  const snapshotPath = path.join(dir, snapshotFilename);

  const payload = {
    backupVersion: '4.3.0-AUTO-BACKUP',
    exportedAt: iso,
    reason,
    backupDirPath: dir,
    data: state,
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  fs.writeFileSync(latestPath, jsonStr, 'utf-8');
  fs.writeFileSync(snapshotPath, jsonStr, 'utf-8');

  try {
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith('TarazBan_AutoBackup_') && f.endsWith('.json'))
      .sort()
      .reverse();
    if (files.length > 25) {
      for (const oldFile of files.slice(25)) {
        fs.unlinkSync(path.join(dir, oldFile));
      }
    }
  } catch {
    // ignore
  }

  return {
    latestPath,
    snapshotFilename,
    backupDirPath: dir,
  };
}

// 0. Server-level License Persistence (Activate once on server -> stays unlocked)
app.get('/api/license', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  const lic = readServerLicense();
  if (lic && lic.isActivated) {
    return res.json({
      success: true,
      isActivated: true,
      license: lic,
    });
  }
  return res.json({
    success: true,
    isActivated: false,
    license: lic || null,
  });
});

app.post('/api/license', (req, res) => {
  const raw = req.body || {};
  const src = raw.license || raw;
  const payload = {
    isActivated: true,
    machineId: src.machineId || 'TB-SRV-LINUX-ENTERPRISE',
    activatedKey: src.activatedKey || src.activationKey || '',
    activatedAt: src.activatedAt || new Date().toISOString(),
    unlockedForAllIpClients: true,
  };
  const ok = writeServerLicense(payload);
  return res.json({ success: ok, isActivated: true, license: payload });
});

app.delete('/api/license', (req, res) => {
  const payload = {
    isActivated: false,
    unlockedForAllIpClients: false,
    deactivatedAt: new Date().toISOString(),
  };
  const ok = writeServerLicense(payload);
  return res.json({ success: ok, isActivated: false });
});

// 1. Get entire shared database state
app.get('/api/state', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
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

// 3. Auto-Backup endpoint (every 2 hours + on window close via sendBeacon/fetch)
app.post('/api/auto-backup', (req, res) => {
  try {
    const parsedBody =
      typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const stateToBackup = parsedBody.state || parsedBody.data || readDbFromFile()?.state;
    const reason = parsedBody.reason || 'auto_2h';
    if (!stateToBackup) {
      return res.status(400).json({ success: false, error: 'No state to backup' });
    }
    writeDbToFile({
      updatedAt: new Date().toISOString(),
      state: stateToBackup,
    });
    const info = writeAutoBackupSnapshot(stateToBackup, reason);
    return res.json({
      success: true,
      ...info,
      savedAt: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: String(err) });
  }
});

// 4. List saved auto-backups & exact directory path
app.get('/api/backups-list', (req, res) => {
  const dir = ensureBackupsDir();
  try {
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((filename) => {
        const fullPath = path.join(dir, filename);
        const stat = fs.statSync(fullPath);
        return {
          filename,
          fullPath,
          sizeKb: Math.max(1, Math.round(stat.size / 1024)),
          savedAt: stat.mtime.toISOString(),
          isLatest: filename === 'TarazBan_Latest_AutoBackup.json',
        };
      })
      .sort((a, b) => (a.isLatest ? -1 : b.isLatest ? 1 : b.savedAt.localeCompare(a.savedAt)));

    return res.json({
      success: true,
      backupDirPath: dir,
      windowsDefaultPath: 'C:\\TarazBan_Backups\\TarazBan_Latest_AutoBackup.json',
      files,
    });
  } catch (err) {
    return res.json({
      success: true,
      backupDirPath: dir,
      windowsDefaultPath: 'C:\\TarazBan_Backups\\TarazBan_Latest_AutoBackup.json',
      files: [],
    });
  }
});

// 5. Restore from a saved auto-backup file on disk
app.post('/api/restore-from-file', (req, res) => {
  try {
    const { filename } = req.body || {};
    const safeName = path.basename(String(filename || 'TarazBan_Latest_AutoBackup.json'));
    const fullPath = path.join(ensureBackupsDir(), safeName);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ success: false, error: 'Backup file not found' });
    }
    const raw = fs.readFileSync(fullPath, 'utf-8');
    const parsed = JSON.parse(raw);
    const restoredState = parsed.data || parsed.state || parsed;
    writeDbToFile({
      updatedAt: new Date().toISOString(),
      state: restoredState,
    });
    return res.json({
      success: true,
      state: restoredState,
      restoredFrom: fullPath,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: String(err) });
  }
});

// 6. Reset / Blank Database
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

// 7. Server health & status
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: 'network_server',
    time: new Date().toISOString(),
    dbExists: fs.existsSync(DB_FILE),
    backupDirPath: ensureBackupsDir(),
  });
});

async function startServer() {
  ensureBackupsDir();
  const distPath = path.join(__dirname, 'dist');
  if (fs.existsSync(distPath) && process.env.NODE_ENV === 'production') {
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          if (
            filePath.endsWith('index.html') ||
            filePath.endsWith('sw.js') ||
            filePath.endsWith('server_license.json')
          ) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
          }
        },
      })
    );
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 ARKA Central Network Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
