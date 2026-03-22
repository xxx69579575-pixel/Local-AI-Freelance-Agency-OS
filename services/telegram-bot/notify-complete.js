'use strict';

const fs   = require('fs');
const path = require('path');
const { escMd } = require('./formatter');

// ─── Config ───────────────────────────────────────────────────────────────────

const REVISION_MANAGER_URL = process.env.REVISION_MANAGER_URL || 'http://revision-manager:3007';
const POLL_INTERVAL_MS     = 30000;

// ─── Startup migration ────────────────────────────────────────────────────────
// Adds `notified` column to agent_logs if it doesn't already exist.

const MIGRATION_SQL = `
  ALTER TABLE agent_logs
    ADD COLUMN IF NOT EXISTS notified BOOLEAN NOT NULL DEFAULT false;
`;

async function runMigration(db) {
  try {
    await db.query(MIGRATION_SQL);
    console.log('[notify-complete] Migration: agent_logs.notified column ensured');
  } catch (err) {
    console.error('[notify-complete] Migration failed:', err.message);
  }
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function fetchCompletedAgents(db) {
  const res = await db.query(
    `SELECT id, agent_name, entity_type, entity_id, output_summary, created_at
     FROM agent_logs
     WHERE status = 'completed' AND notified = false
     ORDER BY created_at ASC`
  );
  return res.rows;
}

async function markNotified(db, logId) {
  await db.query(
    `UPDATE agent_logs SET notified = true WHERE id = $1`,
    [logId]
  );
}

async function updateProjectKanban(db, projectId, kanbanStatus) {
  try {
    await db.query(
      `UPDATE projects SET kanban_status = $1, updated_at = NOW() WHERE id = $2`,
      [kanbanStatus, projectId]
    );
    console.log(`[notify-complete] Project ${projectId} kanban_status → ${kanbanStatus}`);
  } catch (err) {
    console.error(`[notify-complete] Failed to update kanban for project ${projectId}:`, err.message);
    throw err;
  }
}

// ─── Message helpers ──────────────────────────────────────────────────────────

/**
 * Try to read projects/{projectId}/output.md (first 200 chars).
 * Falls back to the output_summary stored in agent_logs.
 */
function readDeliverySummary(projectId, outputSummary) {
  try {
    // Projects directory is relative to the working directory of the service,
    // or the repo root mounted into the container.
    const candidates = [
      path.join('/workspace/projects', String(projectId), 'output.md'),
      path.join(process.cwd(), '..', '..', 'projects', String(projectId), 'output.md'),
    ];
    for (const filePath of candidates) {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        return content.slice(0, 200);
      }
    }
  } catch (_) {
    // ignore FS errors — fall through to DB summary
  }
  return (outputSummary || '（無交付摘要）').slice(0, 200);
}

function buildCompletionMessage(log) {
  const projectId = log.entity_id;
  const agentName = log.agent_name || 'Agent';
  const summary   = readDeliverySummary(projectId, log.output_summary);

  return [
    `✅ *Agent 任務完成*`,
    ``,
    `🤖 Agent: ${escMd(agentName)}`,
    `📁 專案 ID: ${escMd(String(projectId))}`,
    ``,
    `📋 *交付摘要*`,
    escMd(summary),
    ``,
    `\\-\\-\\-`,
    `請確認交付結果：`,
  ].join('\n');
}

function buildCompletionKeyboard(projectId) {
  return {
    inline_keyboard: [[
      { text: '✅ 確認交付', callback_data: `confirm_${projectId}` },
      { text: '✏️ 需要修改', callback_data: `revise_${projectId}` },
    ]],
  };
}

// ─── Poller ───────────────────────────────────────────────────────────────────

async function pollCompletedAgents(bot, db, chatId) {
  let rows;
  try {
    rows = await fetchCompletedAgents(db);
  } catch (err) {
    console.error('[notify-complete] DB poll error:', err.message);
    return;
  }

  for (const log of rows) {
    const projectId = log.entity_id;
    const text      = buildCompletionMessage(log);
    const keyboard  = buildCompletionKeyboard(projectId);

    try {
      await bot.sendMessage(chatId, text, {
        parse_mode:   'MarkdownV2',
        reply_markup: keyboard,
      });

      await markNotified(db, log.id);

      console.log(`[notify-complete] Sent completion notice for project ${projectId} (log ${log.id})`);
    } catch (err) {
      console.error(`[notify-complete] Failed to send notice for project ${projectId}:`, err.message);
      // Do not mark notified — will retry on next poll
    }
  }
}

// ─── Callback handler registration ───────────────────────────────────────────

/**
 * Register callback_query handlers for `confirm_{id}` and `revise_{id}`.
 * Must be called after the bot instance is created.
 */
function registerCompletionCallbacks(bot, db, chatId) {
  bot.on('callback_query', async (query) => {
    const data = query.data || '';

    const confirmMatch = data.match(/^confirm_(\d+)$/);
    const reviseMatch  = data.match(/^revise_(\d+)$/);

    if (!confirmMatch && !reviseMatch) return;  // not ours

    const messageId = query.message.message_id;
    const projectId = parseInt((confirmMatch || reviseMatch)[1], 10);

    // ── 確認交付 ────────────────────────────────────────────────────────────
    if (confirmMatch) {
      try {
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: chatId, message_id: messageId }
        ).catch(() => {});

        await updateProjectKanban(db, projectId, '待最終確認');
        await bot.answerCallbackQuery(query.id, { text: '已確認交付 ✓' });

        await bot.sendMessage(
          chatId,
          `✅ *交付已確認*\n專案 \\#${escMd(String(projectId))} 狀態更新為 *待最終確認*\\.`,
          {
            parse_mode:          'MarkdownV2',
            reply_to_message_id: messageId,
          }
        );

        console.log(`[notify-complete] Project ${projectId}: delivery confirmed → 待最終確認`);
      } catch (err) {
        console.error(`[notify-complete] Error confirming delivery for project ${projectId}:`, err.message);
        await bot.answerCallbackQuery(query.id, { text: '操作失敗，請稍後重試' }).catch(() => {});
      }
      return;
    }

    // ── 需要修改 ────────────────────────────────────────────────────────────
    if (reviseMatch) {
      try {
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: chatId, message_id: messageId }
        ).catch(() => {});

        // POST to revision-manager
        const revRes = await fetch(`${REVISION_MANAGER_URL}/revision`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ project_id: projectId }),
          signal:  AbortSignal.timeout(15000),
        });

        if (!revRes.ok) {
          const errText = await revRes.text();
          throw new Error(`revision-manager returned ${revRes.status}: ${errText}`);
        }

        await bot.answerCallbackQuery(query.id, { text: '已送出修改請求 ✓' });

        await bot.sendMessage(
          chatId,
          `✏️ *修改請求已送出*\n專案 \\#${escMd(String(projectId))} 的修改需求已傳送至 Revision Manager\\.`,
          {
            parse_mode:          'MarkdownV2',
            reply_to_message_id: messageId,
          }
        );

        console.log(`[notify-complete] Project ${projectId}: revision requested → revision-manager`);
      } catch (err) {
        console.error(`[notify-complete] Error sending revision for project ${projectId}:`, err.message);
        await bot.answerCallbackQuery(query.id, { text: '修改請求失敗，請稍後重試' }).catch(() => {});
      }
    }
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run the startup migration, register callback handlers, and start the DB poller.
 * @param {TelegramBot} bot
 * @param {pg.Pool}     db
 * @param {string}      chatId
 */
async function startCompletionPoller(bot, db, chatId) {
  await runMigration(db);
  registerCompletionCallbacks(bot, db, chatId);
  setInterval(() => pollCompletedAgents(bot, db, chatId), POLL_INTERVAL_MS);
  console.log(`[notify-complete] Completion poller started (interval ${POLL_INTERVAL_MS}ms)`);
}

module.exports = { startCompletionPoller };
