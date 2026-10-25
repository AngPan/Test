import crypto from 'node:crypto';
import path from 'node:path';
import express from 'express';
import session from 'express-session';
import { config } from './config.js';
import { buildLiveStandings } from './liveStandings.js';

const app = express();
const publicDir = path.join(config.root, 'public');

app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(session({
  name: 'scaloni.sid',
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 30
  }
}));

function safeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function requireAuth(req, res, next) {
  if (req.session?.authenticated) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Non autenticato' });
  return res.redirect('/login');
}

app.get('/styles.css', (_req, res) => res.sendFile(path.join(publicDir, 'styles.css')));
app.get('/login', (req, res) => {
  if (req.session?.authenticated) return res.redirect('/');
  return res.sendFile(path.join(publicDir, 'login.html'));
});
app.post('/login', (req, res) => {
  if (safeEqual(req.body?.password || '', config.sitePassword)) {
    req.session.authenticated = true;
    return res.redirect('/');
  }
  return res.redirect('/login?error=1');
});
app.post('/logout', (req, res) => req.session.destroy(() => res.redirect('/login')));

app.get('/', requireAuth, (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));
app.get('/app.js', requireAuth, (_req, res) => res.sendFile(path.join(publicDir, 'app.js')));
app.get('/api/config', requireAuth, (_req, res) => res.json({ refreshSeconds: config.refreshSeconds }));

app.get('/api/live-standings', requireAuth, async (_req, res) => {
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

app.get('/health', (_req,res) => res.json({ok:true}));
app.listen(config.port, () => console.log(`Scaloni Live: http://localhost:${config.port}`));
