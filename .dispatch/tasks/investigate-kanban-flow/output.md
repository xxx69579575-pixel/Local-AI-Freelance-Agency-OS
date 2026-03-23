# 診斷報告：20 Leads 未進入「待我決策」

**調查日期**: 2026-03-23
**結論**: 找到 2 個根本原因 + 1 個次要問題，全部可修復

---

## 一、DB 與 Redis 實際狀態

| 指標 | 數值 | 意義 |
|------|------|------|
| `leads` 最新 10 筆 status | 全部 `new` | scoring 從未執行 |
| `leads.fit_score` | 全為 NULL | 評分節點沒有更新 DB |
| `leads.risk_score` | 全為 NULL | 同上 |
| `leads.recommended_action` | 全為 NULL | 同上 |
| `Redis LLEN queue:notify` | **0** | 沒有任何 lead 進入通知佇列 |

---

## 二、根本原因分析

### Bug #1 ⚠️ 嚴重 — WF-01 Pipeline 資料上下文中斷（主因）

**位置**: `node-wf01-08b` → `node-wf01-09`
**節點鏈**: `Postgres - Insert Lead` → `Postgres - Log Insert Success` → `HTTP - Score Lead`

**問題說明**:

`Postgres - Log Insert Success` (node-wf01-08b) 的 SQL 是：
```sql
INSERT INTO agent_logs (agent_name, action, entity_type, entity_id, status, output_summary)
VALUES ('scraper', 'scrape_success', 'lead', {{ $json.id }}, ...)
```
**沒有 `RETURNING` 子句**。

在 n8n 中，`executeQuery` 沒有 RETURNING 時，輸出為空物件 `{}` 或 `{ success: true }`，**完全覆蓋前一節點（Insert Lead）傳下來的 lead 資料**。

當 `HTTP - Score Lead` (node-wf01-09) 執行時，`$json` 已是空物件：
- `$json.id` → `undefined`（scorer 收不到 lead_id）
- `$json.title` → `undefined`
- `$json.description` → `undefined`
- `$json.budget_raw` → `undefined`

Scorer 服務收到空資料後，要麼回傳錯誤、要麼回傳無效評分。無論哪種情況：
- `Postgres - Update Score` 無法更新（WHERE id = undefined），status 永遠停在 `'new'`
- `Redis - Push Notify Queue` 永遠不執行

**影響**: 所有新入庫的 leads 都無法進入 `pending_decision`，整條 WF-01 pipeline 事實上在 scoring 之前就已斷裂。

---

### Bug #2 ⚠️ 嚴重 — WF-02 停用（直接原因）

**位置**: `WF-02-telegram-notifier.json` → `"active": false`

即使 Bug #1 被修復，leads 成功進入 `pending_decision` 並推入 `queue:notify`，WF-02 的 scheduler 也不會執行，Telegram 永遠收不到通知。

---

### Bug #3 ⚠️ 次要 — WF-02 Redis LRANGE 解析邏輯有誤

**位置**: `node-wf02-04` (Code - Parse Lead IDs)

n8n Redis `lrange` 操作會為每個元素輸出**獨立的 execution item**，每個 item 的結構是 `{ value: "<single_id>" }`。

但 Parse Lead IDs 的程式碼假設所有 ID 合併在一個逗號分隔字串裡：
```js
const raw = String($json.value || '');
const ids = raw.split(',').map(...);
```

**問題**: 對單一 item 而言 `split(',')` 仍會返回 `['<id>']`，功能上勉強可用；但若 n8n Redis 節點版本不同，可能導致只處理第一個 item 或解析失敗。這個邏輯脆弱，應改為直接讀 `$json.value` 作為單一 ID。

---

## 三、修復建議（優先順序）

### Fix #1：將 Log Insert 移出 critical path（修復 Bug #1）

**方法**：在 WF-01 中，讓 `Postgres - Log Insert Success` 成為平行的 side branch，**不在** Insert → Score 的主線上。

修改 connections：
```
Postgres - Insert Lead
  ├── [main output 0] → HTTP - Score Lead   ← 主線直接到 scorer
  └── [main output 1] → Postgres - Log Insert Success  ← 側支記錄
```

或者更簡單的方式：在 Log Insert 節點加上 `RETURNING` 並 SELECT 回 lead 欄位：

雖然 agent_logs 不含 lead 欄位，所以**最乾淨的修法是改 connections**，讓 Insert Lead 直連 Score Lead，Log Insert 作為側支。

### Fix #2：啟用 WF-02（修復 Bug #2）

在 WF-02-telegram-notifier.json 中：
```json
"active": true
```
並在 n8n UI 重新 import 或直接更新 DB。

### Fix #3：強化 WF-02 Parse Lead IDs（修復 Bug #3）

將 `node-wf02-04` 的解析邏輯改為：
```js
// n8n Redis lrange returns each element as a separate item
const leadId = parseInt(String($json.value || ''), 10);
if (!leadId || isNaN(leadId)) return [];
return [{ json: { lead_id: leadId } }];
```

---

## 四、完整 Pipeline 流程圖（修復後預期）

```
Schedule → Set Sources → HTTP Scrape
  → IF count > 0
      YES → Expand Leads → Check Duplicate
                → IF cnt == 0 (new)
                    YES → Insert Lead ──→ HTTP Score Lead → Update Score (status=pending_decision)
                     │                                    → Redis Push queue:notify
                     └──→ Log Insert (side branch)
                    NO  → NoOp Skip Duplicate
      NO  → Log Scrape Failed

WF-02 (every 5 min):
  Redis LRANGE queue:notify → IF has items
    → Parse IDs → Get Lead Details (WHERE status='pending_decision')
    → Format Telegram → Send Telegram → Remove from queue → Log
```

---

## 五、快速驗證步驟（修復後）

1. 修復 connections（Fix #1）並 reload WF-01 到 n8n
2. 啟用 WF-02（Fix #2）
3. 手動觸發 WF-01 執行一次
4. 確認 DB：`SELECT status, fit_score FROM leads ORDER BY id DESC LIMIT 5` → 應出現 `pending_decision`
5. 確認 Redis：`LLEN queue:notify` → 應 > 0（或立即被 WF-02 消費）
6. 確認 Telegram：應收到通知訊息與 inline keyboard
