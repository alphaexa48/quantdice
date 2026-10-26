import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const apiBase = process.env.CG_API_BASE || 'https://api.crypto.games/v1';
const liveEnabled = process.env.ENABLE_LIVE_BETTING !== 'false';
const maxLiveBet = Number(process.env.MAX_LIVE_BET || 0);
const maxSessionLoss = Number(process.env.MAX_SESSION_LOSS || 0);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const sessions = new Map();

function json(res, status, data) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); }
function parseBody(req) { return new Promise((resolve, reject) => { let raw = ''; req.on('data', chunk => { raw += chunk; if (raw.length > 20_000) req.destroy(); }); req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('Invalid JSON')); } }); req.on('error', reject); }); }
function cookie(req, name) { return (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(`${name}=`))?.slice(name.length + 1); }
function auth(req, res) { const session = sessions.get(cookie(req, 'df_session')); if (!session) { json(res, 401, { error: 'Login API diperlukan.' }); return null; } return session; }
async function cryptoGames(endpoint, options = {}) { const response = await fetch(`${apiBase}${endpoint}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } }); const text = await response.text(); let data; try { data = JSON.parse(text); } catch { data = { raw: text }; } if (!response.ok) throw new Error(`Crypto.Games HTTP ${response.status}`); return data; }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  try {
    if (req.method === 'GET' && url.pathname === '/api/status') return json(res, 200, { liveOnly: true, liveEnabled, authenticated: sessions.has(cookie(req, 'df_session')), maxLiveBet: maxLiveBet || null, maxSessionLoss: maxSessionLoss || null });
    if (req.method === 'POST' && url.pathname === '/api/login') {
      if (!liveEnabled) return json(res, 403, { error: 'Live mode disabled.' });
      const input = await parseBody(req); const apiKey = String(input.apiKey || '').trim(); const coin = String(input.coin || 'PLAY').trim().toUpperCase();
      if (!apiKey || apiKey.length < 8) return json(res, 400, { error: 'API key tidak valid.' });
      const settings = await cryptoGames(`/settings/${encodeURIComponent(coin)}`); const balance = await cryptoGames(`/balance/${encodeURIComponent(coin)}/${encodeURIComponent(apiKey)}`);
      const token = crypto.randomBytes(32).toString('hex'); sessions.set(token, { apiKey, coin, settings, startedBalance: Number(balance.Balance), sessionLoss: 0, rolls: 0, lastResult: null });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Set-Cookie': `df_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600`, 'Cache-Control': 'no-store' }); return res.end(JSON.stringify({ coin, balance, settings }));
    }
    if (req.method === 'POST' && url.pathname === '/api/logout') { const token = cookie(req, 'df_session'); if (token) sessions.delete(token); res.writeHead(200, { 'Set-Cookie': 'df_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' }); return res.end('{}'); }
    if (req.method === 'POST' && url.pathname === '/api/live/bet') {
      const session = auth(req, res); if (!session) return;
      const input = await parseBody(req); if (input.confirmation !== 'I UNDERSTAND REAL MONEY') return json(res, 400, { error: 'Konfirmasi real-money diperlukan.' });
      const bet = Number(input.Bet); const payout = Number(input.Payout); if (!Number.isFinite(bet) || bet <= 0 || !Number.isFinite(payout) || payout < 1.01) return json(res, 400, { error: 'Bet/payout tidak valid.' }); if (maxLiveBet > 0 && bet > maxLiveBet) return json(res, 400, { error: `Bet melebihi batas ${maxLiveBet}.` }); if (maxSessionLoss > 0 && session.sessionLoss >= maxSessionLoss) return json(res, 409, { error: 'Batas loss sesi tercapai.' });
      const result = await cryptoGames(`/placebet/${encodeURIComponent(session.coin)}/${encodeURIComponent(session.apiKey)}`, { method: 'POST', body: JSON.stringify({ Bet: Number(bet.toFixed(8)), Payout: payout, UnderOver: Boolean(input.UnderOver), ClientSeed: crypto.randomBytes(16).toString('hex') }) }); const profit = Number(result.Profit || 0); session.sessionLoss += Math.max(0, -profit); session.rolls += 1; session.lastResult = result; return json(res, 200, { result, risk: { sessionLoss: session.sessionLoss, rolls: session.rolls } });
    }
    if (req.method === 'GET' && url.pathname === '/api/account') { const session = auth(req, res); if (!session) return; const balance = await cryptoGames(`/balance/${encodeURIComponent(session.coin)}/${encodeURIComponent(session.apiKey)}`); return json(res, 200, { coin: session.coin, balance, settings: session.settings, risk: { sessionLoss: session.sessionLoss, rolls: session.rolls } }); }
    const requested = decodeURIComponent(url.pathname); const file = path.normalize(path.join(root, requested === '/' ? '/index.html' : requested)); if (!file.startsWith(root)) { res.writeHead(403); return res.end('Forbidden'); } fs.readFile(file, (error, data) => { if (error) { res.writeHead(404); return res.end('Not found'); } res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(data); });
  } catch (error) { console.error(error); json(res, 502, { error: error.message || 'Crypto.Games request failed' }); }
});
server.listen(port, '0.0.0.0', () => console.log(`DiceForge LIVE-ONLY at http://localhost:${port} | enabled=${liveEnabled}`));
