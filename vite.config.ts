import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import { GoogleGenAI } from '@google/genai';

function expressApiPlugin(): Plugin {
  return {
    name: 'express-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/api/study-insights' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const data = JSON.parse(body || '{}');
              const { duration, warnings, mode, efficiency, topics } = data;
              const apiKey = process.env.GEMINI_API_KEY;

              let insightText = `Neural Telemetry (${mode} mode): Session length ${duration} with ${efficiency} efficiency. ${warnings} focus warning(s). Recommended 10-minute hydration break.`;

              if (apiKey) {
                try {
                  const ai = new GoogleGenAI({ apiKey });
                  const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: `Analyze this study session: Mode=${mode}, Duration=${duration}, Efficiency=${efficiency}, Warnings=${warnings}, Topics=${topics?.join(', ') || 'General'}. Give a 2-sentence technical summary and 1 action tip.`,
                  });
                  insightText = response.text || insightText;
                } catch (e) {
                  console.error('Gemini error:', e);
                }
              }

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ insight: insightText }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Failed to process request' }));
            }
          });
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), expressApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
