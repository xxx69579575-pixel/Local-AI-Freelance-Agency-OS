# Clear Duplicate Leads — 操作記錄

**執行時間**: 2026-03-23

## 連線資訊
- Container: `agency-postgres`
- DB: `agency_os`
- User: `agency_user`

---

## Step 1: 刪除前 SELECT 確認

```sql
SELECT source, COUNT(*) FROM leads GROUP BY source ORDER BY source;
```

| source        | count |
|---------------|-------|
| freelancer-tw | 3     |
| pro360        | 20    |
| tasker        | 3     |

**總計**: 26 筆

---

## Step 2: 識別保留範圍

所有 pro360 leads 的 `created_at` 相同（2026-03-23 09:37:08），以 `id DESC` 排序保留最後 3 筆（id: 384, 385, 386），刪除其餘 17 筆（id: 367–383）。

---

## Step 3: 執行 DELETE

```sql
DELETE FROM leads
WHERE source = 'pro360'
  AND id NOT IN (
    SELECT id FROM leads WHERE source = 'pro360' ORDER BY id DESC LIMIT 3
  );
```

**結果**: `DELETE 17`

---

## Step 4: 刪除後 SELECT 確認

```sql
SELECT source, COUNT(*) FROM leads GROUP BY source ORDER BY source;
```

| source        | count |
|---------------|-------|
| freelancer-tw | 3     |
| pro360        | 3     |
| tasker        | 3     |

**總計**: 9 筆（刪除 17 筆，符合預期）

### 保留的 pro360 leads

| id  | title        |
|-----|--------------|
| 384 | AI顧問       |
| 385 | 網路佈線工程 |
| 386 | 網路佈線工程 |

---

## 結論

Pipeline 下次執行時，scraper 抓到的 pro360 leads 若 URL/title 不同即為新資料，可走完整 scoring + Telegram 通知流程。
