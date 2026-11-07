import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { defineConfig, Plugin } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_FILE = path.resolve(__dirname, 'server_db.json');
const BACKUPS_DIR = path.resolve(__dirname, 'backups');

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

function readDbFromFile(): any | null {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading DB_FILE in vite plugin:', err);
  }
  return null;
}

function writeDbToFile(data: any): boolean {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing DB_FILE in vite plugin:', err);
    return false;
  }
}

function writeAutoBackupSnapshot(state: any, reason = 'auto_2h'): {
  latestPath: string;
  snapshotFilename: string;
  backupDirPath: string;
} {
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

  // Keep max 25 timestamped auto-backup files so disk doesn't fill up
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
    // ignore cleanup error
  }

  return {
    latestPath,
    snapshotFilename,
    backupDirPath: dir,
  };
}

function listSavedAutoBackups() {
  const dir = ensureBackupsDir();
  try {
    const allFiles = fs
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

    return {
      backupDirPath: dir,
      windowsDefaultPath: 'C:\\TarazBan_Backups\\TarazBan_Latest_AutoBackup.json',
      files: allFiles,
    };
  } catch {
    return {
      backupDirPath: dir,
      windowsDefaultPath: 'C:\\TarazBan_Backups\\TarazBan_Latest_AutoBackup.json',
      files: [],
    };
  }
}

function apiServerPlugin(): Plugin {
  return {
    name: 'api-server-middleware',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api')) {
          return next();
        }

        if (req.url === '/api/state' && req.method === 'GET') {
          const dbData = readDbFromFile();
          res.setHeader('Content-Type', 'application/json');
          if (dbData) {
            return res.end(
              JSON.stringify({
                success: true,
                exists: true,
                updatedAt: dbData.updatedAt || new Date().toISOString(),
                state: dbData.state,
              })
            );
          }
          return res.end(
            JSON.stringify({
              success: true,
              exists: false,
              state: null,
            })
          );
        }

        if (req.url === '/api/state' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const { state } = JSON.parse(body || '{}');
              const payload = {
                updatedAt: new Date().toISOString(),
                state,
              };
              writeDbToFile(payload);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, updatedAt: payload.updatedAt }));
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: String(err) }));
            }
          });
          return;
        }

        if (req.url === '/api/auto-backup' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body || '{}');
              const stateToBackup = parsed.state || parsed.data || readDbFromFile()?.state;
              const reason = parsed.reason || 'auto_2h';
              if (!stateToBackup) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ success: false, error: 'No state to backup' }));
              }
              // Also persist to DB_FILE so close-backup updates central DB too
              writeDbToFile({
                updatedAt: new Date().toISOString(),
                state: stateToBackup,
              });
              const info = writeAutoBackupSnapshot(stateToBackup, reason);
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  success: true,
                  ...info,
                  savedAt: new Date().toISOString(),
                })
              );
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: String(err) }));
            }
          });
          return;
        }

        if (req.url === '/api/backups-list' && req.method === 'GET') {
          const listInfo = listSavedAutoBackups();
          res.setHeader('Content-Type', 'application/json');
          return res.end(
            JSON.stringify({
              success: true,
              ...listInfo,
            })
          );
        }

        if (req.url === '/api/restore-from-file' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const { filename } = JSON.parse(body || '{}');
              const safeName = path.basename(String(filename || 'TarazBan_Latest_AutoBackup.json'));
              const fullPath = path.join(ensureBackupsDir(), safeName);
              if (!fs.existsSync(fullPath)) {
                res.statusCode = 404;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ success: false, error: 'Backup file not found' }));
              }
              const raw = fs.readFileSync(fullPath, 'utf-8');
              const parsed = JSON.parse(raw);
              const restoredState = parsed.data || parsed.state || parsed;
              writeDbToFile({
                updatedAt: new Date().toISOString(),
                state: restoredState,
              });
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  success: true,
                  state: restoredState,
                  restoredFrom: fullPath,
                })
              );
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: String(err) }));
            }
          });
          return;
        }

        if (req.url === '/api/reset-blank' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const { blankState } = JSON.parse(body || '{}');
              const payload = {
                updatedAt: new Date().toISOString(),
                state: blankState || null,
              };
              writeDbToFile(payload);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, message: 'Reset successfully' }));
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: String(err) }));
            }
          });
          return;
        }

        if (req.url === '/api/health') {
          res.setHeader('Content-Type', 'application/json');
          return res.end(
            JSON.stringify({
              status: 'ok',
              mode: 'central_server',
              time: new Date().toISOString(),
              dbExists: fs.existsSync(DB_FILE),
              backupDirPath: ensureBackupsDir(),
            })
          );
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      apiServerPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
        manifest: {
          id: '/',
          name: 'ترازبان ارزی — حسابداری صرافی و معاملات ارزی',
          short_name: 'ترازبان',
          description: 'نرم‌افزار حسابداری تخصصی صرافی، خرید و فروش ارز، تسویه چندارزی و مدیریت خزانه',
          theme_color: '#0B0F17',
          background_color: '#0B0F17',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
