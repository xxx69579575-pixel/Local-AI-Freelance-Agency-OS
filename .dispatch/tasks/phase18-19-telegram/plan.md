# Phase 1.8 + 1.9 — Telegram Bot（通知 + 回覆處理）

- [x] Read `docs/PRD.md` and `docs/n8n-workflow-spec.md` for Telegram bot spec and message format
- [x] Read `db/init.sql` to confirm leads table fields and status values used by the bot
- [x] Create `services/telegram-bot/` directory structure
- [x] Write `services/telegram-bot/package.json` — deps: node-telegram-bot-api, express, pg, dotenv
- [x] Write `services/telegram-bot/Dockerfile` — node:20-slim
- [x] Write `services/telegram-bot/bot.js`:
  - Phase 1.8: sendLeadNotification(lead) — formats lead summary (title, budget, scores, source URL) + inline keyboard buttons [聯絡報價, 放棄報價, 稍後處理]
  - Phase 1.9: handle callback_query — maps button press to status update, updates DB directly, replies to user confirming action
  - Redis queue consumer: polls queue:notify, fetches lead from DB, sends notification
  - GET /health endpoint via express
- [x] Write `services/telegram-bot/formatter.js` — lead summary message formatter (繁體中文, MarkdownV2)
- [x] Update `docker-compose.yml` for telegram-bot service (depends_on postgres, redis) — port 3004 (3003 taken by dashboard)
- [x] Write summary to `.dispatch/tasks/phase18-19-telegram/output.md`
