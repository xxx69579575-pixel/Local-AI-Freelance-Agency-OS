'use strict';

require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const express    = require('express');
const { Pool }   = require('pg');
const Redis      = require('ioredis');

const { formatLeadMessage, buildLeadKeyboard, formatQuoteDraft, buildQuoteKeyboard, escMd } = require('./formatter');
const { startCompletionPoller } = require('./notify-complete');

// ─── Configuration ────────────────────────────────────────────────────────────

const BOT_TOKEN    = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID      = process.env.TELEGRAM_CHAT_ID;
const PORT         = parseInt(process.env.PORT || '3003', 10);
const POLL_INTERVAL_MS = parseInt(process.env.NOTIFY_POLL_INTERVAL_MS || '30000', 10);
const SCORER_URL   = process.env.SCORER_URL || 'http://scorer:3002';

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
            budget_estimate, budget_raw, deadline, description,
            tech_stack, client_name, risk_score, fit_score,
            expected_profit_score, reason_summary, status
     FROM leads WHERE id = $1`,
    [leadId]
  );
  return res.rows[0] || null;
}

async function insertQuotation(leadId, draftJson) {
  const res = await db.query(
    `INSERT INTO quotations (lead_id, draft_content, generated_at)
     VALUES ($1, $2, NOW())
     RETURNING id`,
    [leadId, JSON.stringify(draftJson)]
  );
  return res.rows[0].id;
}

async function approveQuotation(quotationId) {
  await db.query(
    `UPDATE quotations
     SET approved_at = NOW(), final_content = draft_content
     WHERE id = $1`,
    [quotationId]
  );
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

// ─── Phase 2.1 + 2.2 — sendQuoteDraftNotification ────────────────────────────

/**
 * Fetch a lead in pending_quote status, call scorer /quotation,
 * store draft in quotations table, and send Telegram approval message.
 */
async function sendQuoteDraftNotification(leadId) {
  const lead = await fetchLead(leadId);

  if (!lead) {
    console.warn(`[telegram-bot] Lead ${leadId} not found — skipping quote draft`);
    return;
  }

  if (lead.status !== 'pending_quote') {
    console.warn(`[telegram-bot] Lead ${leadId} has status '${lead.status}' — skipping quote draft`);
    return;
  }

  // 1. Call scorer /quotation to generate AI draft
  let draft;
  try {
    const scorerRes = await fetch(`${SCORER_URL}/quotation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_id:       lead.id,
        title:         lead.title,
        description:   lead.description,
        budget_raw:    lead.budget_raw,
        tech_stack:    lead.tech_stack,
        client_name:   lead.client_name,
        reason_summary: lead.reason_summary,
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!scorerRes.ok) {
      const text = await scorerRes.text();
      throw new Error(`Scorer returned ${scorerRes.status}: ${text}`);
    }

    draft = await scorerRes.json();
  } catch (err) {
    console.error(`[telegram-bot] Failed to generate quotation for lead ${leadId}:`, err.message);
    await logAgentAction({
      action: 'quote_draft_generated',
      entityId: leadId,
      status: 'failed',
      errorMessage: err.message,
    });
    throw err;
  }

  // 2. Persist draft in quotations table
  let quotationId;
  try {
    quotationId = await insertQuotation(leadId, draft);
  } catch (err) {
    console.error(`[telegram-bot] Failed to insert quotation for lead ${leadId}:`, err.message);
    throw err;
  }

  // 3. Send draft to Telegram with approval keyboard
  const text     = formatQuoteDraft(draft, lead);
  const keyboard = buildQuoteKeyboard(lead.id);

  try {
    const msg = await bot.sendMessage(CHAT_ID, text, {
      parse_mode: 'MarkdownV2',
      reply_markup: keyboard,
    });

    // Store session: message → { lead_id, quotation_id }
    await redis.set(
      `telegram:quote:session:${CHAT_ID}:msg:${msg.message_id}`,
      JSON.stringify({ lead_id: lead.id, quotation_id: quotationId }),
      'EX', 86400
    );

    await logAgentAction({
      action: 'quote_draft_sent',
      entityId: lead.id,
      status: 'success',
      outputSummary: `quotation_id=${quotationId} message_id=${msg.message_id}`,
    });

    console.log(`[telegram-bot] Sent quote draft for lead ${lead.id} (quotation ${quotationId}, msg ${msg.message_id})`);
  } catch (err) {
    console.error(`[telegram-bot] Failed to send quote draft for lead ${leadId}:`, err.message);
    await logAgentAction({
      action: 'quote_draft_sent',
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

async function pollQuoteQueue() {
  let leadIdStr;
  try {
    leadIdStr = await redis.lpop('queue:quote');
  } catch (err) {
    console.error('[telegram-bot] Redis lpop (queue:quote) error:', err.message);
    return;
  }

  if (!leadIdStr) return;

  const leadId = parseInt(leadIdStr, 10);
  if (isNaN(leadId)) {
    console.warn(`[telegram-bot] Invalid lead_id in queue:quote: ${leadIdStr}`);
    return;
  }

  try {
    await sendQuoteDraftNotification(leadId);
  } catch (err) {
    await redis.rpush('queue:quote', leadIdStr).catch(() => {});
    console.error(`[telegram-bot] Re-queued lead ${leadId} after quote draft failure`);
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
  const data      = query.data || '';  // node-telegram-bot-api uses query.data, not query.callback_data

  // Phase 3.4 completion callbacks are handled by notify-complete.js
  if (/^(confirm|revise)_\d+$/.test(data)) return;

  const parts = data.split(':');
  if (parts.length !== 3) {
    console.warn(`[telegram-bot] Unexpected callback_data: ${data}`);
    await bot.answerCallbackQuery(query.id, { text: '無效操作' });
    return;
  }

  const [namespace, action, leadIdStr] = parts;
  const leadId = parseInt(leadIdStr, 10);

  if (isNaN(leadId)) {
    console.warn(`[telegram-bot] Invalid lead_id in callback: ${leadIdStr}`);
    await bot.answerCallbackQuery(query.id, { text: '無效操作' });
    return;
  }

  // ── Phase 1.9: action:<action>:<lead_id> ─────────────────────────────────
  if (namespace === 'action') {
    if (!ACTION_STATUS_MAP[action]) {
      console.warn(`[telegram-bot] Unknown action '${action}'`);
      await bot.answerCallbackQuery(query.id, { text: '無效操作' });
      return;
    }

    const newStatus = ACTION_STATUS_MAP[action];

    try {
      await updateLeadStatus(leadId, newStatus);
      await bot.answerCallbackQuery(query.id, { text: '已更新 ✓' });

      await bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        { chat_id: chatId, message_id: messageId }
      ).catch(() => {});

      await bot.sendMessage(chatId, ACTION_CONFIRM_MSG[action], {
        parse_mode: 'MarkdownV2',
        reply_to_message_id: messageId,
      });

      // If user chose to quote, push to queue:quote for Phase 2.2
      if (action === 'quote') {
        await redis.rpush('queue:quote', String(leadId));
        console.log(`[telegram-bot] Lead ${leadId} pushed to queue:quote`);
      }

      await logAgentAction({
        action: 'decision_received',
        entityId: leadId,
        status: 'success',
        outputSummary: `action=${action} new_status=${newStatus}`,
      });

      console.log(`[telegram-bot] Lead ${leadId}: ${action} → ${newStatus}`);
    } catch (err) {
      console.error(`[telegram-bot] Error handling action callback for lead ${leadId}:`, err.message);
      await bot.answerCallbackQuery(query.id, { text: '操作失敗，請稍後重試' }).catch(() => {});
      await logAgentAction({
        action: 'decision_received',
        entityId: leadId,
        status: 'failed',
        errorMessage: err.message,
      }).catch(() => {});
    }
    return;
  }

  // ── Phase 2.2: quote:<action>:<lead_id> ──────────────────────────────────
  if (namespace === 'quote') {
    // Resolve quotation_id from Redis session
    const sessionKey = `telegram:quote:session:${chatId}:msg:${messageId}`;
    let quotationId = null;
    try {
      const sessionJson = await redis.get(sessionKey);
      if (sessionJson) {
        const session = JSON.parse(sessionJson);
        quotationId = session.quotation_id;
      }
    } catch (err) {
      console.warn(`[telegram-bot] Could not read quote session for msg ${messageId}:`, err.message);
    }

    if (action === 'confirm') {
      try {
        // 1. Remove keyboard so it can't be double-clicked
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: chatId, message_id: messageId }
        ).catch(() => {});

        // 2. Update lead status → quoted
        await updateLeadStatus(leadId, 'quoted');

        // 3. Approve quotation record (mark approved_at, copy draft → final)
        if (quotationId) {
          await approveQuotation(quotationId);
        }

        // 4. Answer callback
        await bot.answerCallbackQuery(query.id, { text: '報價已確認 ✓' });

        // 5. Send confirmation
        await bot.sendMessage(
          chatId,
          `✅ *報價已確認*\n案件 \\#${escMd(String(leadId))} 狀態已更新為 *quoted*\\.\n草稿已存入報價記錄\\.\n⚠️ 請記得手動將報價信發送給客戶\\.`,
          {
            parse_mode: 'MarkdownV2',
            reply_to_message_id: messageId,
          }
        );

        await logAgentAction({
          action: 'quote_confirmed',
          entityId: leadId,
          status: 'success',
          outputSummary: `quotation_id=${quotationId}`,
        });

        console.log(`[telegram-bot] Lead ${leadId}: quote confirmed → quoted (quotation ${quotationId})`);
      } catch (err) {
        console.error(`[telegram-bot] Error confirming quote for lead ${leadId}:`, err.message);
        await bot.answerCallbackQuery(query.id, { text: '操作失敗，請稍後重試' }).catch(() => {});
        await logAgentAction({
          action: 'quote_confirmed',
          entityId: leadId,
          status: 'failed',
          errorMessage: err.message,
        }).catch(() => {});
      }
      return;
    }

    if (action === 'revise') {
      // No status change — just prompt user to copy and edit the draft
      try {
        await bot.answerCallbackQuery(query.id, { text: '請複製草稿後修改' });
        await bot.sendMessage(
          chatId,
          `✏️ *修改草稿*\n\n請從上方訊息複製草稿內容，修改後請再按 *確認送出*\\.\n\n如需重新生成草稿，請忽略此訊息並聯絡系統管理員\\.`,
          {
            parse_mode: 'MarkdownV2',
            reply_to_message_id: messageId,
          }
        );
      } catch (err) {
        console.error(`[telegram-bot] Error handling quote revise for lead ${leadId}:`, err.message);
        await bot.answerCallbackQuery(query.id, { text: '操作失敗' }).catch(() => {});
      }
      return;
    }

    if (action === 'cancel') {
      try {
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: chatId, message_id: messageId }
        ).catch(() => {});

        await updateLeadStatus(leadId, 'rejected');
        await bot.answerCallbackQuery(query.id, { text: '已取消報價 ✓' });

        await bot.sendMessage(
          chatId,
          `❌ *報價已取消*\n案件 \\#${escMd(String(leadId))} 狀態已更新為 *rejected*\\.`,
          {
            parse_mode: 'MarkdownV2',
            reply_to_message_id: messageId,
          }
        );

        await logAgentAction({
          action: 'quote_cancelled',
          entityId: leadId,
          status: 'success',
          outputSummary: `quotation_id=${quotationId}`,
        });

        console.log(`[telegram-bot] Lead ${leadId}: quote cancelled → rejected`);
      } catch (err) {
        console.error(`[telegram-bot] Error cancelling quote for lead ${leadId}:`, err.message);
        await bot.answerCallbackQuery(query.id, { text: '操作失敗，請稍後重試' }).catch(() => {});
        await logAgentAction({
          action: 'quote_cancelled',
          entityId: leadId,
          status: 'failed',
          errorMessage: err.message,
        }).catch(() => {});
      }
      return;
    }

    console.warn(`[telegram-bot] Unknown quote action '${action}'`);
    await bot.answerCallbackQuery(query.id, { text: '無效操作' });
    return;
  }

  console.warn(`[telegram-bot] Unknown callback namespace '${namespace}' in: ${data}`);
  await bot.answerCallbackQuery(query.id, { text: '無效操作' });
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

  // Start queue pollers
  setInterval(pollNotifyQueue, POLL_INTERVAL_MS);
  setInterval(pollQuoteQueue,  POLL_INTERVAL_MS);
  console.log(`[telegram-bot] Queue pollers started (interval ${POLL_INTERVAL_MS}ms)`);

  // Phase 3.4 — completion notification poller
  await startCompletionPoller(bot, db, CHAT_ID);

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
