import path from 'node:path';
import express from 'express';
import { config } from './config.js';
import { buildLiveStandings } from './liveStandings.js';

const app = express();
const publicDir = path.join(config.root, 'public');

app.set('trust proxy', 1);
app.use(express.json());

app.get('/styles.css', (_req, res) => res.sendFile(path.join(publicDir, 'styles.css')));
app.get('/', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));
app.get('/app.js', (_req, res) => res.sendFile(path.join(publicDir, 'app.js')));
app.get('/api/config', (_req, res) => res.json({ refreshSeconds: config.refreshSeconds }));

app.get('/api/live-standings', async (_req, res) => {
  try {
    const data = await buildLiveStandings();
    res.set('Cache-Control', 'no-store');
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(502).json({
      error: 'Impossibile aggiornare la classifica live.',
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(config.port, () => {
  console.log(`Scaloni Live: http://localhost:${config.port}`);
});
