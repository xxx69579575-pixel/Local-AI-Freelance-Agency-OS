# API Reference — Local AI Freelance Agency OS

Base URL: `https://local-ai-agency-os.vercel.app`

All requests and responses use `Content-Type: application/json`.

---

## Health Check

### `GET /`

Returns service status.

**Response 200**
```json
{
  "status": "ok",
  "service": "Local AI Freelance Agency OS",
  "version": "1.0.0"
}
```

---

## Intake

### `POST /api/intake`

Submit a client project brief. Claude AI parses the brief and produces a structured analysis report saved to disk.

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `project_name` | string | yes | Short project identifier |
| `description` | string | yes | Full client brief / requirements |
| `deadline` | string | no | Target delivery date |
| `budget` | string | no | Budget range or amount |
| `tech_constraints` | string[] | no | Technology restrictions |

**Example request**
```json
{
  "project_name": "e-commerce-mvp",
  "description": "Build a minimal e-commerce store with product listing, cart, and checkout.",
  "deadline": "2026-05-01",
  "budget": "USD 5000",
  "tech_constraints": ["Next.js", "Stripe"]
}
```

**Response 200 — success**
```json
{
  "status": "success",
  "output_path": ".dispatch/intake/e-commerce-mvp/output.md",
  "summary": "<AI-generated structured analysis>"
}
```

**Response 400 — validation error**
```json
{
  "status": "error",
  "message": "project_name and description are required"
}
```

**Response 500 — processing error**
```json
{
  "status": "error",
  "message": "<error detail>"
}
```

---

## Dispatch

### `POST /api/dispatch`

Create and immediately start a background AI worker task.

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `alias` | string | yes | Task alias (defined in alias registry) |
| `context` | string | no | Additional context passed to the worker |
| `model` | string | no | Override model: `opus`, `sonnet`, or `haiku` |

**Example request**
```json
{
  "alias": "review",
  "context": "review the intake module for edge cases",
  "model": "sonnet"
}
```

**Response 201 — task created**
```json
{
  "task_id": "abc123",
  "slug": "review-intake-module",
  "status": "running",
  "plan_path": ".dispatch/tasks/review-intake-module/plan.md"
}
```

**Response 400 — invalid alias**
```json
{
  "status": "error",
  "message": "Unknown alias: review"
}
```

---

### `GET /api/dispatch/tasks`

List all tasks with optional filtering and pagination.

**Query parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | string | — | Filter by status: `running`, `done`, `failed`, `timed_out`, `waiting_input`, `pending` |
| `limit` | integer | 20 | Max results to return |
| `offset` | integer | 0 | Number of results to skip |

**Response 200**
```json
{
  "tasks": [ /* TaskRecord[] */ ],
  "total": 42,
  "running": 3,
  "done": 35,
  "failed": 2,
  "timed_out": 1,
  "waiting_input": 1,
  "pending": 0
}
```

---

### `GET /api/dispatch/tasks/:task_id`

Get the status and details of a single task.

**Path parameter:** `task_id` — unique task identifier returned by `POST /api/dispatch`.

**Response 200**
```json
{
  "task_id": "abc123",
  "id": "abc123",
  "slug": "review-intake-module",
  "alias": "review",
  "status": "waiting_input",
  "plan_path": ".dispatch/tasks/review-intake-module/plan.md",
  "created_at": "2026-03-22T10:00:00.000Z",
  "pending_question": {
    "sequence": 1,
    "question": "Which edge case should be prioritised?",
    "deadline": "2026-03-22T10:03:00.000Z"
  }
}
```

`pending_question` is `null` when no question is waiting.

**Response 404**
```json
{
  "status": "error",
  "message": "Task not found: abc123"
}
```

---

### `POST /api/dispatch/tasks/:task_id/answer`

Provide an answer to a task's pending IPC question.

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sequence` | integer | yes | Question sequence number (from `pending_question.sequence`) |
| `answer` | string | yes | The answer text |

**Example request**
```json
{
  "sequence": 1,
  "answer": "Focus on the empty description edge case first."
}
```

**Response 200**
```json
{
  "status": "ok",
  "task_status": "running"
}
```

**Response 400**
```json
{
  "status": "error",
  "message": "answer cannot be empty"
}
```

---

### `DELETE /api/dispatch/tasks/:task_id`

Stop a running task.

**Response 200**
```json
{
  "status": "stopped",
  "task_id": "abc123"
}
```

**Response 404**
```json
{
  "status": "error",
  "message": "Task not found: abc123"
}
```

---

## Task Status Values

| Status | Meaning |
|--------|---------|
| `pending` | Created but not yet started |
| `running` | Worker is actively executing |
| `waiting_input` | Worker posted a question and is waiting for an answer |
| `done` | Worker completed successfully |
| `failed` | Worker encountered an unresolvable error |
| `timed_out` | Question answer deadline passed without a response |
