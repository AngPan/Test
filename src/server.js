import path from 'node:path';
import express from 'express';
import { config } from './config.js';
import { buildLiveStandings } from './liveStandings.js';
import { getRoundLineups, getFormationsExcel } from './fantacalcio.js';

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
      error: 'Classifica live temporaneamente non disponibile.'
    });
  }
});

app.get('/api/debug-round', async (_req, res) => {
  try {
    const xlsx = await getFormationsExcel(6);
    console.log('FORMATIONS_XLSX_TEST', JSON.stringify({
      ok: xlsx.ok,
      status: xlsx.status,
      contentType: xlsx.contentType,
      size: xlsx.size,
      prefix: xlsx.prefix,
      preview: xlsx.preview
    }));
  } catch (error) {
    console.error('FORMATIONS_XLSX_FAIL', error instanceof Error ? error.message : String(error));
  }

  try {
    const data = await getRoundLineups({ leagueMatchday: 6, serieAMatchday: 8 });
    const summarize = (value) => {
      if (Array.isArray(value)) {
        return { type: 'array', length: value.length, firstKeys: value[0] && typeof value[0] === 'object' ? Object.keys(value[0]) : [] };
      }
      if (value && typeof value === 'object') {
        const keys = Object.keys(value);
        const nested = {};
        for (const key of keys.slice(0, 10)) {
          const v = value[key];
          if (Array.isArray(v)) nested[key] = { type: 'array', length: v.length, firstKeys: v[0] && typeof v[0] === 'object' ? Object.keys(v[0]) : [] };
          else if (v && typeof v === 'object') nested[key] = { type: 'object', keys: Object.keys(v).slice(0, 20) };
          else nested[key] = { type: typeof v };
        }
        return { type: 'object', keys, nested };
      }
      return { type: typeof value };
    };
    res.json(summarize(data));
  } catch (error) {
    console.error('ROUND_DEBUG_ERROR', error);
    res.status(502).json({ error: 'round-debug-failed' });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(config.port, async () => {
  console.log(`Scaloni Live: http://localhost:${config.port}`);
  try {
    const xlsx = await getFormationsExcel(6);
    console.log('FORMATIONS_XLSX_TEST', JSON.stringify({
      ok: xlsx.ok,
      status: xlsx.status,
      contentType: xlsx.contentType,
      size: xlsx.size,
      prefix: xlsx.prefix
    }));
  } catch (error) {
    console.error('FORMATIONS_XLSX_FAIL', error instanceof Error ? error.message : String(error));
  }

  try {
    const data = await getRoundLineups({ leagueMatchday: 6, serieAMatchday: 8 });
    const summary = Array.isArray(data)
      ? { type: 'array', length: data.length, firstKeys: data[0] && typeof data[0] === 'object' ? Object.keys(data[0]) : [] }
      : { type: typeof data, keys: data && typeof data === 'object' ? Object.keys(data) : [] };
    console.log('ROUND_BULK_OK', JSON.stringify(summary));
  } catch (error) {
    console.error('ROUND_BULK_FAIL', error instanceof Error ? error.message : String(error));
  }
});
