'use strict';

require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const express    = require('express');
const { Pool }   = require('pg');
const Redis      = require('ioredis');

const { formatLeadMessage, buildLeadKeyboard, escMd } = require('./formatter');

// ─── Configuration ────────────────────────────────────────────────────────────

const BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID    = process.env.TELEGRAM_CHAT_ID;
const PORT       = parseInt(process.env.PORT || '3003', 10);
const POLL_INTERVAL_MS = parseInt(process.env.NOTIFY_POLL_INTERVAL_MS || '30000', 10);

if (!BOT_TOKEN) {
  console.error('[telegram-bot] TELEGRAM_BOT_TOKEN is required');
  process.exit(1);
}
if (!CHAT_ID) {
  console.error('[telegram-bot] TELEGRAM_CHAT_ID is required');
  process.exit(1);
}

// ─── Clients ──────────────────────────────────────────────────────────────────

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const db = new Pool({
  connectionString: process.env.DB_URL,
  // fallback to individual vars if DB_URL not set
  host:     process.env.POSTGRES_HOST     || 'postgres',
  port:     parseInt(process.env.POSTGRES_PORT || '5432', 10),
  database: process.env.POSTGRES_DB       || 'agency_os',
  user:     process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  max: 5,
});

const redis = new Redis({
  host:     process.env.REDIS_HOST     || 'redis',
  port:     parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  lazyConnect: true,
});

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function fetchLead(leadId) {
  const res = await db.query(
    `SELECT id, title, source, url,
            budget_estimate, budget_raw, deadline,
            tech_stack, risk_score, fit_score,
            expected_profit_score, reason_summary, status
     FROM leads WHERE id = $1`,
    [leadId]
  );
  return res.rows[0] || null;
}

async function updateLeadStatus(leadId, newStatus) {
  await db.query(
    `UPDATE leads
     SET status = $1, status_updated_at = NOW()
     WHERE id = $2`,
    [newStatus, leadId]
  );
}

async function logAgentAction({ action, entityId, status, outputSummary = null, errorMessage = null }) {
  try {
    await db.query(
      `INSERT INTO agent_logs
         (agent_name, action, entity_type, entity_id, status, output_summary, error_message)
       VALUES ('telegram', $1, 'lead', $2, $3, $4, $5)`,
      [action, entityId, status, outputSummary, errorMessage]
    );
  } catch (err) {
    console.error('[telegram-bot] Failed to write agent_log:', err.message);
  }
}

// ─── Phase 1.8 — sendLeadNotification ────────────────────────────────────────

/**
 * Fetch a lead and send a Telegram notification with inline keyboard.
 */
async function sendLeadNotification(leadId) {
  const lead = await fetchLead(leadId);

  if (!lead) {
    console.warn(`[telegram-bot] Lead ${leadId} not found — skipping`);
    return;
  }

  if (lead.status !== 'pending_decision') {
    console.warn(`[telegram-bot] Lead ${leadId} has status '${lead.status}' — skipping notify`);
    return;
  }

  const text     = formatLeadMessage(lead);
  const keyboard = buildLeadKeyboard(lead.id);

  try {
    const msg = await bot.sendMessage(CHAT_ID, text, {
      parse_mode: 'MarkdownV2',
      reply_markup: keyboard,
    });

    // Store session: chat → lead mapping so callback can resolve lead_id
    await redis.set(
      `telegram:session:${CHAT_ID}:msg:${msg.message_id}`,
      String(lead.id),
      'EX', 86400  // expires in 24 hours
    );

    await logAgentAction({
      action: 'notify_sent',
      entityId: lead.id,
      status: 'success',
      outputSummary: `message_id=${msg.message_id}`,
    });

    console.log(`[telegram-bot] Sent notification for lead ${lead.id} (msg ${msg.message_id})`);
  } catch (err) {
    console.error(`[telegram-bot] Failed to send notification for lead ${leadId}:`, err.message);
    await logAgentAction({
      action: 'notify_sent',
      entityId: lead.id,
      status: 'failed',
      errorMessage: err.message,
    });
    throw err;
  }
}

// ─── Redis queue poller ────────────────────────────────────────────────────────

async function pollNotifyQueue() {
  let leadIdStr;
  try {
    leadIdStr = await redis.lpop('queue:notify');
  } catch (err) {
    console.error('[telegram-bot] Redis lpop error:', err.message);
    return;
  }

  if (!leadIdStr) return;

  const leadId = parseInt(leadIdStr, 10);
  if (isNaN(leadId)) {
    console.warn(`[telegram-bot] Invalid lead_id in queue: ${leadIdStr}`);
    return;
  }

  try {
    await sendLeadNotification(leadId);
  } catch (err) {
    // On failure, push back to queue tail for retry
    await redis.rpush('queue:notify', leadIdStr).catch(() => {});
    console.error(`[telegram-bot] Re-queued lead ${leadId} after send failure`);
  }
}

// ─── Phase 1.9 — callback_query handler ──────────────────────────────────────

const ACTION_STATUS_MAP = {
  quote:  'pending_quote',
  reject: 'rejected',
  later:  'pending_decision',
};

const ACTION_CONFIRM_MSG = {
  quote:  '✅ 已標記為*聯絡報價*，報價流程即將啟動\\.',
  reject: '❌ 已將案件標記為*放棄報價* ✓',
  later:  '⏰ 已標記為*稍後處理*，明天會再提醒你\\.',
};

bot.on('callback_query', async (query) => {
  const chatId    = String(query.message.chat.id);
  const messageId = query.message.message_id;
  const data      = query.callback_data || '';

  // Expected format: "action:<action>:<lead_id>"
  const parts = data.split(':');
  if (parts.length !== 3 || parts[0] !== 'action') {
    console.warn(`[telegram-bot] Unexpected callback_data: ${data}`);
    await bot.answerCallbackQuery(query.id, { text: '無效操作' });
    return;
  }

  const [, action, leadIdStr] = parts;
  const leadId = parseInt(leadIdStr, 10);

  if (!ACTION_STATUS_MAP[action] || isNaN(leadId)) {
    console.warn(`[telegram-bot] Unknown action '${action}' or invalid lead_id '${leadIdStr}'`);
    await bot.answerCallbackQuery(query.id, { text: '無效操作' });
    return;
  }

  const newStatus = ACTION_STATUS_MAP[action];

  try {
    // 1. Update lead status in Postgres
    await updateLeadStatus(leadId, newStatus);

    // 2. Answer callback (removes loading spinner from button)
    await bot.answerCallbackQuery(query.id, { text: '已更新 ✓' });

    // 3. Edit the original message to remove keyboard and add status note
    const confirmText = ACTION_CONFIRM_MSG[action];
    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      { chat_id: chatId, message_id: messageId }
    ).catch(() => {});

    // 4. Send confirmation reply
    await bot.sendMessage(chatId, confirmText, {
      parse_mode: 'MarkdownV2',
      reply_to_message_id: messageId,
    });

    // 5. Log to agent_logs
    await logAgentAction({
      action: 'decision_received',
      entityId: leadId,
      status: 'success',
      outputSummary: `action=${action} new_status=${newStatus}`,
    });

    console.log(`[telegram-bot] Lead ${leadId}: ${action} → ${newStatus}`);
  } catch (err) {
    console.error(`[telegram-bot] Error handling callback for lead ${leadId}:`, err.message);
    await bot.answerCallbackQuery(query.id, { text: '操作失敗，請稍後重試' }).catch(() => {});
    await logAgentAction({
      action: 'decision_received',
      entityId: leadId,
      status: 'failed',
      errorMessage: err.message,
    }).catch(() => {});
  }
});

// ─── Express health endpoint ──────────────────────────────────────────────────

const app = express();
app.use(express.json());

app.get('/health', async (req, res) => {
  let dbOk    = false;
  let redisOk = false;

  try {
    await db.query('SELECT 1');
    dbOk = true;
  } catch (_) {}

  try {
    await redis.ping();
    redisOk = true;
  } catch (_) {}

  const status = dbOk && redisOk ? 'ok' : 'degraded';
  res.status(status === 'ok' ? 200 : 503).json({
    status,
    postgres: dbOk    ? 'connected' : 'disconnected',
    redis:    redisOk ? 'connected' : 'disconnected',
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

async function start() {
  // Connect Redis
  try {
    await redis.connect();
    console.log('[telegram-bot] Redis connected');
  } catch (err) {
    console.error('[telegram-bot] Redis connection error:', err.message);
    process.exit(1);
  }

  // Verify Postgres
  try {
    await db.query('SELECT 1');
    console.log('[telegram-bot] Postgres connected');
  } catch (err) {
    console.error('[telegram-bot] Postgres connection error:', err.message);
    process.exit(1);
  }

  // Start queue poller
  setInterval(pollNotifyQueue, POLL_INTERVAL_MS);
  console.log(`[telegram-bot] Queue poller started (interval ${POLL_INTERVAL_MS}ms)`);

  // Start HTTP server
  app.listen(PORT, () => {
    console.log(`[telegram-bot] Health endpoint listening on :${PORT}/health`);
  });

  console.log('[telegram-bot] Bot is running (polling mode)');
}

start().catch((err) => {
  console.error('[telegram-bot] Fatal startup error:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[telegram-bot] SIGTERM received, shutting down...');
  await redis.quit().catch(() => {});
  await db.end().catch(() => {});
  process.exit(0);
});
