# Fix WF-02: Parse Lead IDs Logic

- [x] 讀取 WF-02 JSON，找出 node-wf02-04（Code - Parse Lead IDs）節點的 jsCode 內容
- [x] 將 split(',') 邏輯替換為直接讀 $json.value 作為單一 ID：const leadId = parseInt(String($json.value || ''), 10); if (!leadId || isNaN(leadId)) return []; return [{ json: { lead_id: leadId } }];
- [x] 確認修改後 JSON 格式正確（valid JSON）
