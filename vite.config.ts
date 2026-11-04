import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import fs from 'fs';
import { defineConfig, Plugin } from 'vite';

const DB_FILE = path.resolve(__dirname, 'server_db.json');

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
