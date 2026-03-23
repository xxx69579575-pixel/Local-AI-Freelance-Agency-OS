# Phase 1.7 — n8n Workflow Output

**Completed**: 2026-03-22
**Status**: All 3 workflows written and validated as valid JSON

---

## Files Created

| File | Nodes | Validated |
|------|-------|-----------|
| `n8n/workflows/WF-01-lead-scraper.json` | 13 nodes | ✅ valid JSON |
| `n8n/workflows/WF-02-telegram-notifier.json` | 11 nodes | ✅ valid JSON |
| `n8n/workflows/WF-03-decision-handler.json` | 13 nodes | ✅ valid JSON |
| `n8n/workflows/README.md` | — | import + credential setup guide |

---

## WF-01: Lead Scraper

**Flow**: Schedule (0 * * * *, Asia/Taipei) → Code(emit 2 sources) → HTTP POST scraper:3001/scrape → IF success → Code(expand leads array, add source) → Postgres(check duplicate via COUNT) → IF is new → Postgres(INSERT ON CONFLICT DO NOTHING RETURNING id) → Postgres(log) → HTTP POST scorer:3002/score → Postgres(UPDATE score fields, status=pending_decision) → Redis(RPUSH queue:notify)

**Error path**: IF scrape fails → Postgres INSERT agent_logs(scrape_failed)
**Skip path**: IF duplicate → NoOp

---

## WF-02: Telegram Notifier

**Flow**: Schedule (every 5 min) → Redis(LRANGE queue:notify 0 4) → IF queue has items → Code(parse lead IDs from Redis value) → Postgres(SELECT lead WHERE status=pending_decision) → Code(format Telegram markdown + build inline_keyboard JSON) → HTTP POST Telegram sendMessage → Redis(LREM queue:notify) → Redis(SET telegram:session:{chat_id}) → Postgres(INSERT agent_logs)

**Empty path**: IF queue empty → NoOp

**Inline keyboard**: `action:quote:{id}` / `action:reject:{id}` / `action:later:{id}`

---

## WF-03: Decision Handler

**Flow**: Webhook POST /webhook/telegram-decision → Code(parse native Telegram callback_query OR internal format) → Switch on action:
- **quote** → Postgres(UPDATE status=pending_quote) → HTTP POST scorer:3002/quotation → Postgres(INSERT quotations draft) → HTTP Telegram(send draft + approve/edit buttons) → Postgres(log)
- **reject** → Postgres(UPDATE status=rejected) → HTTP Telegram(confirm message) → Postgres(log)
- **later** → Postgres(UPDATE status=pending_decision, refreshed status_updated_at) → HTTP Telegram(confirm message) → Postgres(log)

---

## Key Design Decisions

1. **scorer service hostname**: Uses `scorer:3002` (matches docker-compose service name), not `ollama-scorer:3002` as in spec text.
2. **Duplicate check**: Uses `SELECT COUNT(*) AS cnt` then IF(cnt == 0) to cleanly branch new vs duplicate, with INSERT ON CONFLICT DO NOTHING as safety net.
3. **Redis LRANGE return**: WF-02 Code node parses Redis `value` field which may be comma-separated; outputs one item per lead_id.
4. **Credential setup**: JSON uses placeholder IDs (`POSTGRES_CREDENTIAL_ID`, `REDIS_CREDENTIAL_ID`) — user must reassign credentials after import in n8n UI.
5. **Telegram token**: Accessed via `$env.TELEGRAM_BOT_TOKEN` and `$env.TELEGRAM_CHAT_ID` — must be set as env vars on n8n container.
6. **All workflows start inactive**: User activates in order WF-03 → WF-02 → WF-01 per README instructions.
