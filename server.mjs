import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const apiBase = process.env.CG_API_BASE || 'https://api.crypto.games/v1';
const apiKey = process.env.CG_API_KEY || '';
const liveEnabled = process.env.ENABLE_LIVE_BETTING === 'true';
const maxLiveBet = Number(process.env.MAX_LIVE_BET || 0);
const maxSessionLoss = Number(process.env.MAX_SESSION_LOSS || 0);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };
let liveSession = { armed: false, coin: 'PLAY', startedBalance: null, loss: 0, rolls: 0 };

function json(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); }
function body(req) { return new Promise((resolve, reject) => { let data = ''; req.on('data', c => { data += c; if (data.length > 100_000) req.destroy(); }); req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } }); req.on('error', reject); }); }
async function cg(pathname, options = {}) { const response = await fetch(`${apiBase}${pathname}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } }); const text = await response.text(); let data; try { data = JSON.parse(text); } catch { data = { raw: text }; } if (!response.ok) throw new Error(`Crypto.Games HTTP ${response.status}`); return data; }
function requireLive(res) { if (!apiKey) { json(res, 503, { error: 'CG_API_KEY belum dikonfigurasi di server.' }); return false; } if (!liveEnabled) { json(res, 403, { error: 'Live betting dinonaktifkan. Set ENABLE_LIVE_BETTING=true setelah meninjau batas risiko.' }); return false; } return true; }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  try {
    if (req.method === 'GET' && url.pathname === '/api/status') return json(res, 200, { configured: Boolean(apiKey), liveEnabled, armed: liveSession.armed, coin: liveSession.coin, maxLiveBet: maxLiveBet || null, maxSessionLoss: maxSessionLoss || null });
    if (req.method === 'POST' && url.pathname === '/api/account') {
      if (!requireLive(res)) return;
      const { coin = 'PLAY' } = await body(req); const settings = await cg(`/settings/${encodeURIComponent(coin)}`); const balance = await cg(`/balance/${encodeURIComponent(coin)}/${encodeURIComponent(apiKey)}`); liveSession = { armed: false, coin, startedBalance: Number(balance.Balance), loss: 0, rolls: 0 }; return json(res, 200, { settings, balance, coin });
    }
    if (req.method === 'POST' && url.pathname === '/api/live/arm') {
      if (!requireLive(res)) return;
      const input = await body(req); if (input.confirmation !== 'I UNDERSTAND REAL MONEY') return json(res, 400, { error: 'Konfirmasi tidak valid.' }); if (!liveSession.startedBalance) return json(res, 400, { error: 'Hubungkan akun dan pilih coin terlebih dahulu.' }); liveSession.armed = true; return json(res, 200, { armed: true, coin: liveSession.coin });
    }
    if (req.method === 'POST' && url.pathname === '/api/live/bet') {
      if (!requireLive(res)) return; if (!liveSession.armed) return json(res, 409, { error: 'Live session belum di-arm dengan konfirmasi eksplisit.' });
      const input = await body(req); const bet = Number(input.Bet); const payout = Number(input.Payout); if (!Number.isFinite(bet) || !Number.isFinite(payout) || bet <= 0 || payout < 1.01) return json(res, 400, { error: 'Bet atau payout tidak valid.' }); if (maxLiveBet > 0 && bet > maxLiveBet) return json(res, 400, { error: `Bet melebihi MAX_LIVE_BET (${maxLiveBet}).` }); if (maxSessionLoss > 0 && liveSession.loss >= maxSessionLoss) return json(res, 409, { error: 'Batas kerugian sesi tercapai. Session dikunci.' });
      const result = await cg(`/placebet/${encodeURIComponent(liveSession.coin)}/${encodeURIComponent(apiKey)}`, { method: 'POST', body: JSON.stringify({ Bet: Number(bet.toFixed(8)), Payout: payout, UnderOver: Boolean(input.UnderOver), ClientSeed: crypto.randomBytes(16).toString('hex') }) }); const profit = Number(result.Profit || 0); liveSession.loss += Math.max(0, -profit); liveSession.rolls += 1; if (maxSessionLoss > 0 && liveSession.loss >= maxSessionLoss) liveSession.armed = false; return json(res, 200, { result, risk: { sessionLoss: liveSession.loss, rolls: liveSession.rolls, armed: liveSession.armed } });
    }
    const requested = decodeURIComponent(url.pathname); const relative = requested === '/' ? '/index.html' : requested; const file = path.normalize(path.join(root, relative)); if (!file.startsWith(root)) { res.writeHead(403); return res.end('Forbidden'); } fs.readFile(file, (err, data) => { if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); } res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(data); });
  } catch (error) { console.error(error); json(res, 502, { error: error.message || 'Upstream request failed' }); }
});
server.listen(port, '0.0.0.0', () => console.log(`DiceForge Studio running at http://localhost:${port} | live=${liveEnabled} configured=${Boolean(apiKey)}`));
