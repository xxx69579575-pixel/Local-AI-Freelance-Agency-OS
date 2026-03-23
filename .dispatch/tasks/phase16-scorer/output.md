# Phase 1.6 — Ollama 評分服務 — 完成報告

## 實作摘要

**服務路徑**: `services/scorer/`
**Docker 服務名稱**: `ollama-scorer`（與 n8n-workflow-spec.md 中 `http://ollama-scorer:3002/score` 一致）
**對外 Port**: 3002

---

## 建立的檔案

| 檔案 | 說明 |
|------|------|
| `services/scorer/package.json` | Node.js 依賴：express, node-fetch, dotenv |
| `services/scorer/Dockerfile` | node:20-slim 基礎映像，EXPOSE 3002 |
| `services/scorer/prompt.js` | 評分提示詞模板，強制 Ollama 輸出 JSON |
| `services/scorer/server.js` | 主程式：GET /health + POST /score + POST /quotation |

---

## API 端點

### GET /health
```json
{ "status": "ok", "ollama": "reachable", "model": "llama3.2" }
```

### POST /score
**Request:**
```json
{
  "lead_id": 42,
  "title": "案件標題",
  "description": "描述...",
  "budget_raw": "NT$5000",
  "tech_stack": ["React", "Node.js"]
}
```

**Response:**
```json
{
  "lead_id": 42,
  "risk_score": 4,
  "fit_score": 8,
  "expected_profit_score": 7,
  "recommended_action": "quote",
  "reason_summary": "技術棧符合，預算合理，風險低。",
  "budget_estimate": "NT$5000-8000",
  "deadline": "2026-04-15",
  "ollama_model": "llama3.2",
  "latency_ms": 1250
}
```

### POST /quotation
**Request:** `{ "lead_id", "title", "description", "budget_raw", "tech_stack", "reason_summary" }`
**Response:** `{ "lead_id", "draft", "ollama_model", "latency_ms" }`

---

## docker-compose.yml 更新

- 將舊 `scorer` 服務重新命名為 `ollama-scorer`（服務 DNS 名稱對應 n8n workflow）
- container_name: `agency-ollama-scorer`
- 新增 `ports: - "3002:3002"`
- `OLLAMA_BASE_URL` 支援 env 覆寫（預設 `http://ollama:11434`）
- `depends_on: ollama`（service_started）

---

## Prompt 設計重點

- System prompt 強制 Ollama 只輸出純 JSON，不帶 markdown
- 使用 Ollama `/api/chat` endpoint，加上 `"format": "json"` 參數確保 JSON 輸出
- 回應包含 fallback JSON 解析（嘗試從 markdown code block 提取）
- 分數 clamp 至 1-10，`recommended_action` 白名單驗證

---

## 環境變數

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `PORT` | 3002 | 服務監聽 port |
| `OLLAMA_BASE_URL` | `http://ollama:11434` | Ollama 服務位址 |
| `OLLAMA_MODEL` | `llama3.2` | 使用的模型名稱 |
