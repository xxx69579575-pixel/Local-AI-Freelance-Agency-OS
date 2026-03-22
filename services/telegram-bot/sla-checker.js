'use strict';

/**
 * sla-checker.js — hourly SLA scanner with daily digest
 *
 * Behaviour:
 *   - Runs every hour via setInterval
 *   - Queries /api/sla-status on the dashboard service
 *   - Tracks last_notified per project in process memory to avoid spam
 *   - Sends individual alerts only when a project first crosses the 48-h threshold
 *   - Once per day (first run after 09:00 local time) sends a full digest
 */

const http = require('http');

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://dashboard:3003';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID   = process.env.TELEGRAM_CHAT_ID;
const CHECK_INTERVAL_MS  = 60 * 60 * 1000; // 1 hour
const DIGEST_HOUR        = 9; // 09:xx local time triggers daily digest

// Process-memory state
const lastNotified = {};   // projectId -> ISO timestamp of last individual alert
let lastDigestDate = null; // 'YYYY-MM-DD' string of last digest day

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
function httpGet(urlStr) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method: 'GET',
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

function telegramSend(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn('[sla-checker] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — skipping send');
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'HTML' });
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = require('https').request(options, (res) => {
      res.resume();
      resolve();
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('telegram timeout')); });
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Formatter helpers
// ---------------------------------------------------------------------------
function fmtHours(h) {
  const hours = Math.abs(Math.round(h));
  if (hours < 1) return '< 1 小時';
  if (hours < 24) return `${hours} 小時`;
  return `${Math.round(hours / 24)} 天`;
}

function fmtProject(p) {
  const hr = parseFloat(p.hours_remaining);
  if (hr <= 0) {
    return `⛔ <b>${p.title}</b>（${p.client_name || '—'}）已逾期 ${fmtHours(hr)}`;
  }
  return `⚠️ <b>${p.title}</b>（${p.client_name || '—'}）剩餘 ${fmtHours(hr)}`;
}

// ---------------------------------------------------------------------------
// Core check logic
// ---------------------------------------------------------------------------
async function runCheck() {
  let data;
  try {
    data = await httpGet(`${DASHBOARD_URL}/api/sla-status`);
  } catch (err) {
    console.error('[sla-checker] Failed to fetch sla-status:', err.message);
    return;
  }

  if (!data) return;

  const now      = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const isDigestTime = now.getHours() >= DIGEST_HOUR && lastDigestDate !== todayStr;

  const allAtRisk = [...(data.overdue || []), ...(data.warning || [])];

  // ── Individual alerts (fire once per project crossing the threshold) ──
  for (const project of allAtRisk) {
    const pid = project.id;
    if (!lastNotified[pid]) {
      try {
        await telegramSend(
          `🔔 <b>SLA 警示</b>\n${fmtProject(project)}\n版本：${project.version || '1.0.0'}`
        );
        lastNotified[pid] = now.toISOString();
        console.log(`[sla-checker] Sent alert for project ${pid}`);
      } catch (err) {
        console.error(`[sla-checker] Telegram send failed for project ${pid}:`, err.message);
      }
    }
  }

  // ── Daily digest ──
  if (isDigestTime) {
    if (allAtRisk.length === 0) {
      await telegramSend('📋 <b>SLA 每日彙整</b>\n目前無即將逾期或已逾期專案 ✅').catch(console.error);
    } else {
      const lines = allAtRisk.map(fmtProject).join('\n');
      await telegramSend(
        `📋 <b>SLA 每日彙整</b>（${todayStr}）\n\n${lines}\n\n共 ${allAtRisk.length} 個專案需注意`
      ).catch(console.error);
    }
    lastDigestDate = todayStr;
    console.log('[sla-checker] Daily digest sent for', todayStr);
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
console.log('[sla-checker] Starting — interval every', CHECK_INTERVAL_MS / 60000, 'min');
runCheck(); // immediate first run
setInterval(runCheck, CHECK_INTERVAL_MS);
