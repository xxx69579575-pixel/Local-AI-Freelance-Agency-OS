# Restore Cron to Hourly — Output

## 結論

**無需修改** — Schedule Trigger 節點的 cron 設定已經是每小時觸發一次。

---

## 修改前後比較

| 欄位 | 修改前（已提交版本） | 修改後（工作目錄） |
|------|---------------------|-------------------|
| `field` | `cronExpression` | `cronExpression` |
| `expression` | `0 * * * *` | `0 * * * *` （未變動） |
| `timezone` | `Asia/Taipei` | `Asia/Taipei` |

### 節點原始設定（當前狀態）

```json
{
  "parameters": {
    "rule": {
      "interval": [
        {
          "field": "cronExpression",
          "expression": "0 * * * *"
        }
      ]
    },
    "timezone": "Asia/Taipei"
  },
  "id": "node-wf01-01",
  "name": "Schedule - Every Hour",
  "type": "n8n-nodes-base.scheduleTrigger",
  "typeVersion": 1.1,
  "position": [240, 304]
}
```

### Cron 說明

`0 * * * *` = 每小時第 0 分鐘觸發，即每整點執行一次（每 60 分鐘）。

---

## Git Diff 摘要

`git diff HEAD n8n/workflows/WF-01-lead-scraper.json` 顯示本次工作目錄的修改內容為：

- 節點 position 座標微調（如 `[240, 300]` → `[240, 304]`）
- `delay_max_ms` 從 10000 改為 6000
- `timeout` 移除 retry 設定
- IF 條件從 `$json.success == true` 改為 `$json.count > 0`
- `active` 從 `false` 改為 `true`
- `executionOrder` 從 `v1` 改為 `v0`

**以上均與 cron 設定無關。** cron 表達式 `0 * * * *` 在兩個版本中均相同，不需要額外修改。
