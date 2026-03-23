# Check Ollama Model Availability

- [x] 讀取 .env 確認 OLLAMA_MODEL 的實際值 — qwen2.5:7b-instruct-q4_0
- [x] 執行 docker exec 或直接呼叫 Ollama API 列出已安裝的模型（ollama list） — API 回傳 2 個模型
- [x] 判斷 OLLAMA_MODEL 是否已在已安裝清單中 — ✅ 已安裝
- [x] 將結果（已安裝 ✅ / 未安裝 ❌ + 需執行的 pull 指令）寫入 .dispatch/tasks/check-ollama-model/output.md
