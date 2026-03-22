# Fix — 加入 HTTP API 層讓 Vercel 可服務

- [x] 確認 docs/specs/intake-module.md 與 dispatch-module.md 中的 API 端點定義（src/modules/intake/api.ts、src/modules/dispatch/api.ts 已存在）<!-- intake exports createIntakeServer() + will add handleIntakeRequest(); dispatch exports handleDispatchRequest(req,res):Promise<boolean> -->
- [x] 建立 `src/server.ts`：用 Node.js http 或輕量框架（如 express）掛載 intake 與 dispatch 的 API 路由，監聽 PORT 環境變數（預設 3000）<!-- created src/server.ts; also added handleIntakeRequest export to intake/api.ts -->
- [x] 建立 `api/index.ts`（Vercel Serverless Function 入口），引入 server 邏輯，讓 Vercel 能作為 serverless function 執行
- [x] 更新 `vercel.json`：設定 routes 指向 `api/index.ts`，build 輸出使用 `@vercel/node`
- [x] 更新 `package.json`：確認 `start` script 可本地啟動 server<!-- changed start from dist/index.js to dist/server.js -->
- [x] 執行 `tsc --noEmit` 確認無型別錯誤<!-- clean, no errors -->
- [x] 重新部署 `npx vercel --prod`，確認首頁（`GET /`）返回健康狀態 JSON<!-- GET / returns {"status":"ok","service":"Local AI Freelance Agency OS","version":"1.0.0"} -->
- [x] 將新部署 URL 寫入 `.dispatch/tasks/fix-vercel-server/output.md`
