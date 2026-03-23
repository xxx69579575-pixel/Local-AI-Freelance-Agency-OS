# Phase 2.1 + 2.2 — Quotation Assistant + Telegram 審核流程

- [x] Read `docs/PRD.md`, `docs/n8n-workflow-spec.md`, `db/init.sql` for quotation flow and quotations table schema
- [x] Read `services/scorer/server.js` to understand existing POST /quotation stub (if any)
- [x] Read `services/telegram-bot/bot.js` and `formatter.js` to understand existing bot structure
- [x] Implement `services/scorer/quotation.js` — Ollama prompt that generates 報價草稿 given lead data: { title, description, budget_raw, tech_stack, client_name } → returns { subject, body, price_estimate, timeline_estimate, notes }
- [x] Update `services/scorer/server.js` POST /quotation to use quotation.js properly (format:json, structured response, client_name support)
- [x] Add quotation draft approval flow to `services/telegram-bot/bot.js`:
  - Phase 2.2: When lead status = pending_quote, fetch quotation draft from scorer POST /quotation
  - Send draft to Telegram with inline keyboard [✅ 確認送出, ✏️ 修改草稿, ❌ 取消]
  - Handle confirm callback → update leads.status = quoted, insert into quotations table, reply confirmation
  - Handle cancel callback → update leads.status = rejected
  - Also fixed query.callback_data bug → query.data; added queue:quote push on quote action
- [x] Add quote draft formatter to `services/telegram-bot/formatter.js` — formatQuoteDraft(draft) + buildQuoteKeyboard(leadId)
- [x] Write summary to `.dispatch/tasks/phase21-22-quotation/output.md`
