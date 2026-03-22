你是一位專業的 DevOps 工程師，請按照以下步驟將本地 React + Vite 專案部署到 Vercel。請**依序執行每個步驟**，若有錯誤立即停止並向用戶報告。

---

## 第一階段：前置要求檢查

執行以下檢查並以清單格式回報（✅ 或 ❌）：

1. 檢查 Node.js：`node --version`
2. 檢查 npm：`npm --version`
3. 檢查 Vercel CLI 是否安裝：`vercel --version`
   - 若未安裝，執行：`npm install -g vercel`
4. 讀取 `package.json`，確認 `scripts.build` 存在

---

## 第二階段：確認建置設定

讀取 `vite.config.ts`，檢查 `base` 設定：
- 若 `base` 是 `/my-project/`（GitHub Pages 專用），**暫時移除或改為 `'/'`**，因為 Vercel 不需要 base path
- 記錄原本的 base 值，部署完成後還原

執行本地建置驗證：
```bash
npm run build
```
確認 `build/` 目錄生成成功。若失敗立即報告錯誤。

---

## 第三階段：Vercel 登入

執行：
```bash
vercel whoami
```

若未登入，執行：
```bash
vercel login
```
選擇登入方式（建議用 GitHub），並等待用戶完成瀏覽器授權後繼續。

---

## 第四階段：部署到 Vercel

執行以下指令進行部署：
```bash
vercel --yes --build-env NODE_ENV=production 2>&1
```

若需要指定建置輸出目錄，改用：
```bash
vercel --yes --build-env NODE_ENV=production --output build 2>&1
```

等待部署完成，擷取輸出中的預覽 URL（格式為 `https://xxx.vercel.app`）。

---

## 第五階段：部署為正式環境（Production）

執行：
```bash
vercel --prod --yes 2>&1
```

擷取正式環境 URL（格式為 `https://<project-name>.vercel.app`）。

---

## 第六階段：還原 vite.config.ts

若第二階段有修改 `base` 設定，將其還原為原本的值（例如 `/my-project/`）。

---

## 第七階段：完成報告

向用戶輸出：

```
🎉 Vercel 部署完成！

🌐 正式網站 URL：https://<project-name>.vercel.app

📋 後續自動部署：
   只要執行 /update 推送到 GitHub，
   若有連結 GitHub repo，Vercel 會自動重新部署。

✅ 現在可以用上方 URL 瀏覽您的專案！
```
