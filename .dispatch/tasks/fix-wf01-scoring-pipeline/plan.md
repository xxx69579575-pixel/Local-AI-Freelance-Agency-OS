# Fix WF-01: Scoring Pipeline 無法執行

## 問題根因

### Bug：n8n Postgres `executeQuery` 不回傳行資料

`Postgres - Insert Lead`（node-wf01-08）使用 `executeQuery` 操作。
n8n Postgres 節點的 `executeQuery` 對 INSERT/UPDATE/DELETE **永遠只回傳 `{ success: true }`**，
不論 SQL 中有無 `RETURNING` 子句，或是否使用 CTE（WITH...SELECT）。

**影響路徑**：
```
Postgres - Insert Lead → { success: true }
HTTP - Score Lead      → $json.id = undefined, $json.title = undefined
Scorer service         → 收到空資料，回傳無效評分或錯誤
Postgres - Update Score → WHERE id = undefined，0 rows updated
```
→ leads.status 永遠停在 `new`，fit_score / risk_score 全為 NULL

**已嘗試但無效的方法**：
- INSERT ... RETURNING id, title, ... → 仍回傳 { success: true }
- WITH inserted AS (...) SELECT ... FROM leads INNER JOIN inserted → 仍回傳 { success: true }

---

## 修復計畫

### 方法：Insert 之後加 Code 節點 + Postgres SELECT 節點

**新節點 1：Code - Prepare Scoring Input（node-wf01-08d）**
位置：Insert Lead 之後
```js
// 從 pairedItem 追溯回 Expand Leads 的原始 lead 資料
const items = $input.all();
return items.map(item => {
  const orig = $('Expand Leads').item.json;
  return {
    json: {
      external_id: orig.external_id,
      source: orig.source,
      title: orig.title,
      description: orig.description,
      budget_raw: orig.budget_raw,
      tech_stack: orig.tech_stack
    }
  };
});
```

**新節點 2：Postgres - Get Lead ID（node-wf01-08e）**
位置：Code 節點之後
```sql
SELECT id, external_id, source, title, description, budget_raw, tech_stack
FROM leads
WHERE source = '{{ $json.source }}'
AND external_id = '{{ $json.external_id }}'
LIMIT 1
```

**新連線鏈**：
```
Insert Lead → Code - Prepare Scoring Input → Postgres - Get Lead ID → HTTP - Score Lead
```

### 步驟

- [ ] 在 WF-01 JSON 中加入 node-wf01-08d（Code 節點）
- [ ] 在 WF-01 JSON 中加入 node-wf01-08e（Postgres SELECT 節點）
- [ ] 更新 connections：Insert Lead → 08d → 08e → HTTP Score Lead
- [ ] 同步更新 DB（workflow_entity）
- [ ] 刪除 node-wf01-08c（Postgres - Fetch Inserted Lead，先前無效的嘗試）
- [ ] docker restart agency-n8n
- [ ] 刪除未 scored leads，等執行驗證
- [ ] 確認 scorer logs 出現新 lead_id
- [ ] 確認 DB: status = pending_decision, fit_score 有值
- [ ] 寫驗證結果到 output.md
