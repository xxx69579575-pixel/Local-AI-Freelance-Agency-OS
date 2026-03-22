# Local AI Freelance Agency OS

## 1. Document Info

- Version: `v0.1`
- Status: `Draft for implementation`
- Owner: `User`
- Primary Builder: `Claude Code`
- Last Updated: `2026-03-22`

## 2. Product Summary

Build a self-hosted local AI operating system for freelance lead intake, project qualification, quotation assistance, project bootstrapping, delivery coordination, and agent observability.

The system monitors public freelance case pages, extracts structured lead data, evaluates whether a case is worth pursuing using local Ollama models, notifies the operator through Telegram, and coordinates follow-up actions through n8n workflows. After a project is won, the system bootstraps a local project workspace and hands implementation tasks to coding agents such as Claude Code and Codex. A Kanban-style control panel tracks leads, projects, and agent runtime status.

## 3. Problem Statement

Freelance opportunity intake and project follow-up are repetitive and fragmented:

- Public leads appear on multiple platforms.
- Initial screening takes time and is inconsistent.
- Quotations are repetitive but still need judgment.
- Project handoff from sales to delivery is often manual.
- Multiple AI agents can be running at the same time without a unified control plane.

The goal is to reduce repetitive operational work while keeping high-risk actions under explicit human approval.

## 4. Product Goals

### 4.1 Primary Goals

- Automatically collect public freelance cases from selected platforms on a schedule.
- Convert raw lead pages into structured records.
- Use a local LLM via Ollama to score, summarize, and prioritize leads.
- Notify the operator on Telegram with actionable choices.
- Support a human-in-the-loop decision flow for quotation and negotiation.
- Automatically bootstrap project folders and core documentation after deal confirmation.
- Dispatch delivery tasks to coding agents.
- Provide a Kanban dashboard and runtime panel for all agents and workflows.

### 4.2 Non-Goals for MVP

- Fully autonomous deal closure without human approval.
- Fully autonomous messaging inside platforms that prohibit automation.
- Fully autonomous contract acceptance or legal commitment.
- Autonomous payment, invoicing, or accounting.
- Full CRM replacement.

## 5. Critical Constraints

### 5.1 Compliance and Platform Risk

This system must be designed conservatively.

- Only scrape publicly accessible case listing/detail pages unless explicit written permission is obtained.
- Do not automate login, hidden member pages, or quote submission on platforms that disallow automation.
- Do not let AI send binding promises about scope, timeline, or price without human approval.
- Preserve full audit history for every outbound message and decision.

### 5.2 Human Approval Policy

The following actions require explicit human approval in MVP:

- Sending any quotation or customer-facing outbound message
- Marking a case as accepted
- Starting a development project from a won deal
- Sending revision-complete confirmations to customers

### 5.3 Runtime Constraints

- Must run locally first on Windows.
- Core LLM inference must support local Ollama deployment.
- System orchestration must remain operational if cloud APIs are unavailable.
- All core data must be stored locally in PostgreSQL.

## 6. Target Users

### 6.1 Primary User

- Solo freelancer or small agency owner
- Wants AI-assisted lead intake, triage, and delivery operations
- Comfortable running local tools such as Docker, n8n, Ollama, VS Code, Claude Code

### 6.2 Secondary User

- Future assistant/operator reviewing dashboards, approvals, and negotiation status

## 7. Success Metrics

### 7.1 MVP Metrics

- New public cases ingested per day
- Percentage of ingested cases successfully parsed
- AI-scored cases with valid structured output
- Telegram notification delivery success rate
- Human decision response time
- Number of approved quotations drafted
- Number of won projects successfully bootstrapped

### 7.2 Business Metrics

- Quote conversion rate
- Average lead quality score
- Average time from lead ingestion to operator decision
- Average time from project win to project workspace creation
- Number of active projects in delivery

## 8. User Stories

### 8.1 Lead Intake

- As an operator, I want the system to scan selected public freelance case pages every N minutes so I do not manually refresh sites.
- As an operator, I want duplicate cases to be recognized so I do not review the same lead multiple times.
- As an operator, I want structured lead summaries so I can decide quickly.

### 8.2 Qualification

- As an operator, I want Ollama to score fit, risk, and profit potential for each lead.
- As an operator, I want the system to explain why a case is recommended or rejected.

### 8.3 Decisioning

- As an operator, I want Telegram buttons or reply commands so I can decide from my phone.
- As an operator, I want every decision recorded in a database and visible on the dashboard.

### 8.4 Quotation

- As an operator, I want a draft quote message generated from project context so I save time.
- As an operator, I want to edit or approve that message before anything is sent.

### 8.5 Project Delivery

- As an operator, I want a won case to automatically create a project folder with README, brief, scope, and todo files.
- As an operator, I want coding agents to receive structured tasks instead of raw chat context.

### 8.6 Revision Handling

- As an operator, I want incoming customer feedback summarized into revision markdown files.
- As an operator, I want coding agents to read those revision files and execute changes.

### 8.7 Observability

- As an operator, I want to see which agents are running, blocked, waiting for approval, or completed.
- As an operator, I want a Kanban board that reflects the status of every lead and project.

## 9. MVP Scope

### 9.1 Included in MVP

- Source monitoring for configurable public listing/detail pages
- Scheduled scraping through n8n
- Extraction using Playwright and/or HTTP plus trafilatura
- PostgreSQL storage for leads, actions, projects, agents, and logs
- Ollama-based lead scoring and summary generation
- Telegram notifications for lead review
- Human decision handling through Telegram replies or commands
- Draft quote generation with approval gate
- Project bootstrap on confirmed deal
- Kanban dashboard
- Agent runtime status panel

### 9.2 Deferred to Phase 2+

- Customer chat portal similar to official messaging apps
- Automated multi-turn negotiation
- Automated follow-up sequencing
- Cost analytics by token and project margin
- Native Paperclip integration
- Multi-user role permissions

## 10. End-to-End Workflow

### 10.1 Lead Discovery

1. n8n scheduled workflow triggers.
2. Scraper fetches source pages.
3. Lead extractor normalizes listing data.
4. Deduplication checks whether this lead already exists.
5. New leads are inserted with status `NEW`.

### 10.2 AI Qualification

1. n8n sends lead content to a local qualification service.
2. Qualification service calls Ollama.
3. Ollama returns structured JSON:
   - fit score
   - urgency score
   - value score
   - risk score
   - recommended action
   - reasoning summary
4. Lead status moves to `QUALIFIED` or `REJECTED_BY_RULE`.

### 10.3 Operator Decision

1. Telegram notification is sent for qualified leads.
2. Operator replies:
   - `聯絡報價`
   - `放棄報價`
   - `稍後處理`
3. n8n receives the Telegram event and updates lead status.

### 10.4 Quote Drafting

1. If operator selects `聯絡報價`, the system generates a quote draft.
2. Draft is stored in the database and shown in Telegram/dashboard.
3. Operator approves or edits.
4. Only after approval can outbound send be executed.

### 10.5 Deal Confirmation

1. Operator marks lead as won.
2. System creates a `project` record.
3. Filesystem bootstrapper creates local project folder and starter docs.
4. Development task is queued for coding agents.

### 10.6 Delivery and Revision

1. Coding agent completes first delivery pass.
2. Operator sends or reviews customer delivery message.
3. Customer feedback is captured manually or via an approved messaging bridge.
4. AI summarizes requested changes into `revision-xxx.md`.
5. Coding agent executes revision tasks.
6. Operator approves final confirmation.

## 11. Functional Requirements

### 11.1 Source Configuration

- Admin can configure one or more source definitions.
- Each source definition includes:
  - source name
  - source type
  - list URL
  - detail URL pattern if applicable
  - extraction mode: `playwright`, `http`, `hybrid`
  - crawl interval
  - active flag

### 11.2 Scraping and Extraction

- System must support:
  - static HTML fetch
  - dynamic browser rendering via Playwright
  - HTML-to-text extraction via trafilatura
- Extracted lead fields:
  - external id
  - source
  - title
  - url
  - published at
  - raw html snapshot
  - cleaned text
  - budget text
  - category
  - location
  - deadline text
  - contact visibility flag if public

### 11.3 Deduplication

- Deduplicate by source plus external id when available.
- Fallback deduplicate by normalized URL hash.
- Secondary fuzzy deduplicate by title plus posted date plus source.

### 11.4 Qualification Service

- Must send a standard prompt to Ollama.
- Must require structured JSON output.
- Must store prompt version and model version.
- Must reject invalid JSON and retry with repair prompt once.

### 11.5 Scoring Logic

- Scoring dimensions:
  - technical fit
  - budget attractiveness
  - urgency
  - client clarity
  - delivery risk
  - strategic value
- Final recommendation categories:
  - `HOT`
  - `REVIEW`
  - `SKIP`

### 11.6 Telegram Integration

- Send rich lead summary messages.
- Support commands or callback actions:
  - `/quote <lead_id>`
  - `/skip <lead_id>`
  - `/later <lead_id>`
  - `/win <lead_id>`
  - `/lose <lead_id>`
- Store inbound and outbound Telegram events in log tables.

### 11.7 Quote Drafting

- Quote draft must include:
  - greeting
  - concise capability intro
  - understanding of requirement
  - rough delivery approach
  - estimated timeline range
  - estimated price range
  - CTA for further discussion
- Draft must be labeled `AI_DRAFT`.
- Final sendable version must be labeled `APPROVED`.

### 11.8 Project Bootstrap

- On project win, create folder:
  - `projects/{YYYY}/{project_slug}/`
- Generate files:
  - `README.md`
  - `brief.md`
  - `scope.md`
  - `todo.md`
  - `client-log.md`
  - `delivery-plan.md`

### 11.9 Agent Task Dispatch

- System must support creating tasks for:
  - Claude Code
  - Codex
  - future agents
- Each task must contain:
  - project id
  - task title
  - task description
  - source document paths
  - status
  - assigned agent

### 11.10 Dashboard

- Dashboard must show:
  - Kanban by lead/project stage
  - agent runtime statuses
  - pending approvals
  - recent errors
  - key counts

## 12. Non-Functional Requirements

### 12.1 Reliability

- All workflow runs must be logged.
- Scrape failures must not crash the whole system.
- Retry policies must be configurable.

### 12.2 Auditability

- Every AI decision must be traceable to:
  - input snapshot
  - prompt version
  - model version
  - output JSON
  - human action if any

### 12.3 Security

- Secrets stored in `.env` or secret manager abstraction.
- Telegram bot token and database credentials must never be embedded in source code.
- Sensitive outbound actions must require approval.

### 12.4 Performance

- Lead scoring latency target: under 30 seconds per lead on local hardware.
- Scheduled ingestion should complete within configured interval.

### 12.5 Portability

- Local-first deployment via Docker Compose.
- Windows-friendly setup.
- Ability to later move to Linux host.

## 13. System Architecture

### 13.1 High-Level Components

1. `n8n`
   - workflow scheduler
   - orchestration engine
   - approval routing
   - Telegram event handling
2. `Scraper Service`
   - Playwright browser worker
   - HTTP fetcher
   - trafilatura extractor
3. `Qualification Service`
   - prompt builder
   - Ollama client
   - JSON validator
4. `Core API`
   - lead/project/task CRUD
   - dashboard backend
   - agent status endpoints
5. `PostgreSQL`
   - system of record
6. `Redis`
   - optional queue/cache/event bus
7. `Telegram Bot`
   - notification and operator input channel
8. `Dashboard UI`
   - kanban
   - metrics
   - runtime panel
9. `Project Bootstrapper`
   - file/folder generation
10. `Agent Bridge`
   - Claude Code / Codex task handoff

### 13.2 Recommended Tech Stack

- Backend API: `Node.js + TypeScript + Fastify`
- Dashboard UI: `Next.js` or `React + Vite`
- ORM: `Prisma`
- DB: `PostgreSQL`
- Queue/cache: `Redis`
- Workflow engine: `n8n`
- LLM runtime: `Ollama`
- Scraping: `Playwright`, `undici`, `trafilatura`
- Deployment: `Docker Compose`

### 13.3 Suggested Repo Structure

```text
local-ai-freelance-os/
  apps/
    api/
    dashboard/
    worker/
  packages/
    db/
    prompts/
    shared/
    scraper/
    bootstrapper/
  infra/
    docker/
    n8n/
  projects/
  docs/
  .env.example
  docker-compose.yml
  pnpm-workspace.yaml
  README.md
```

## 14. Data Model

### 14.1 Core Entities

#### `sources`

- `id`
- `name`
- `type`
- `base_url`
- `list_url`
- `detail_pattern`
- `mode`
- `interval_minutes`
- `is_active`
- `created_at`
- `updated_at`

#### `leads`

- `id`
- `source_id`
- `external_id`
- `title`
- `url`
- `status`
- `raw_budget_text`
- `normalized_budget_min`
- `normalized_budget_max`
- `location_text`
- `category`
- `published_at`
- `clean_text`
- `raw_html_path`
- `hash`
- `created_at`
- `updated_at`

#### `lead_scores`

- `id`
- `lead_id`
- `model_name`
- `prompt_version`
- `fit_score`
- `value_score`
- `urgency_score`
- `risk_score`
- `recommendation`
- `reason_summary`
- `json_payload`
- `created_at`

#### `lead_actions`

- `id`
- `lead_id`
- `action_type`
- `actor_type`
- `actor_id`
- `payload`
- `created_at`

#### `quotes`

- `id`
- `lead_id`
- `status`
- `draft_text`
- `approved_text`
- `price_min`
- `price_max`
- `timeline_text`
- `created_at`
- `updated_at`

#### `projects`

- `id`
- `lead_id`
- `name`
- `slug`
- `status`
- `root_path`
- `won_at`
- `created_at`
- `updated_at`

#### `project_tasks`

- `id`
- `project_id`
- `title`
- `description`
- `agent_type`
- `status`
- `input_paths`
- `output_paths`
- `created_at`
- `updated_at`

#### `agents`

- `id`
- `name`
- `agent_type`
- `runtime`
- `status`
- `last_heartbeat_at`
- `current_task_id`
- `metadata`
- `created_at`
- `updated_at`

#### `workflow_runs`

- `id`
- `workflow_name`
- `status`
- `started_at`
- `finished_at`
- `error_text`
- `payload`

#### `messages`

- `id`
- `channel`
- `direction`
- `external_message_id`
- `lead_id`
- `project_id`
- `content`
- `status`
- `created_at`

## 15. State Machines

### 15.1 Lead Statuses

```text
NEW
SCRAPED
QUALIFYING
QUALIFIED
REJECTED_BY_RULE
WAITING_HUMAN
QUOTE_DRAFTED
QUOTE_APPROVED
QUOTE_SENT
NEGOTIATING
WON
LOST
ARCHIVED
```

### 15.2 Project Statuses

```text
BOOTSTRAPPING
READY_FOR_DEV
IN_DEVELOPMENT
WAITING_REVIEW
WAITING_CLIENT_FEEDBACK
REVISION_REQUESTED
REVISION_IN_PROGRESS
FINAL_CONFIRMATION
COMPLETED
ON_HOLD
```

### 15.3 Agent Statuses

```text
IDLE
RUNNING
WAITING_APPROVAL
BLOCKED
ERROR
OFFLINE
```

## 16. Dashboard Design

### 16.1 Main Views

#### View A: Lead Kanban

Columns:

- `New`
- `Qualified`
- `Waiting Human`
- `Quote Drafted`
- `Quote Sent`
- `Negotiating`
- `Won`
- `Lost`

#### View B: Project Kanban

Columns:

- `Bootstrapping`
- `Ready for Dev`
- `In Development`
- `Waiting Review`
- `Waiting Client Feedback`
- `Revision In Progress`
- `Final Confirmation`
- `Completed`

#### View C: Agent Runtime Panel

Cards per agent showing:

- name
- runtime type
- current task
- last heartbeat
- status
- error count

#### View D: Approval Inbox

- pending quote approvals
- pending outbound client messages
- pending project bootstrap approvals
- pending completion confirmations

### 16.2 KPI Widgets

- today new leads
- today qualified leads
- today skipped leads
- active negotiations
- won this month
- active projects
- agents running
- approvals pending

## 17. n8n Workflow Design

### 17.1 Workflow A: Scheduled Lead Crawl

Trigger:

- Cron every 15 minutes

Steps:

1. Load active sources from API/DB
2. For each source, invoke scraper
3. Normalize and validate lead records
4. Deduplicate
5. Save new leads
6. Queue qualification jobs
7. Write workflow run log

### 17.2 Workflow B: Lead Qualification

Trigger:

- new lead event

Steps:

1. Fetch lead details
2. Build qualification prompt
3. Call Ollama through local API
4. Validate JSON
5. Store score
6. If recommendation is `HOT` or `REVIEW`, send Telegram notification
7. Set status `WAITING_HUMAN`

### 17.3 Workflow C: Telegram Decision Intake

Trigger:

- Telegram webhook

Steps:

1. Parse operator command
2. Map command to lead action
3. Update lead status
4. If `聯絡報價`, generate quote draft
5. Notify operator with preview

### 17.4 Workflow D: Quote Approval

Trigger:

- operator approves quote

Steps:

1. Persist approved text
2. Mark quote `APPROVED`
3. Mark lead `QUOTE_APPROVED`
4. If allowed channel exists, send outbound message
5. Log send event

### 17.5 Workflow E: Won Project Bootstrap

Trigger:

- operator marks lead won

Steps:

1. Create project DB record
2. Generate folder and starter markdown files
3. Create initial development tasks
4. Notify operator and dashboard

### 17.6 Workflow F: Revision Intake

Trigger:

- operator pastes customer feedback or approved message bridge event

Steps:

1. Store raw feedback
2. Send to Ollama summarizer
3. Generate `revision-001.md`
4. Create development task for coding agent
5. Update project status

## 18. AI Prompt Contracts

### 18.1 Qualification Prompt Output Contract

The model must output JSON only:

```json
{
  "fit_score": 0,
  "value_score": 0,
  "urgency_score": 0,
  "risk_score": 0,
  "recommendation": "HOT",
  "budget_assessment": "string",
  "reason_summary": "string",
  "suggested_quote_strategy": "string",
  "tech_stack_guess": ["string"]
}
```

### 18.2 Quote Draft Prompt Output Contract

```json
{
  "subject": "string",
  "message": "string",
  "price_min": 0,
  "price_max": 0,
  "timeline_text": "string",
  "assumptions": ["string"]
}
```

### 18.3 Revision Summary Prompt Output Contract

```json
{
  "summary": "string",
  "change_requests": ["string"],
  "priority_items": ["string"],
  "open_questions": ["string"]
}
```

## 19. Filesystem Bootstrap Templates

### 19.1 Project README Template

Must include:

- project name
- source lead link
- business summary
- current phase
- delivery goals
- constraints
- key files

### 19.2 `brief.md`

Must include:

- client need summary
- inferred business context
- target users
- required features
- non-goals

### 19.3 `scope.md`

Must include:

- in scope
- out of scope
- assumptions
- risks
- acceptance criteria

### 19.4 `todo.md`

Must include:

- milestone checklist
- blocking questions
- revision history section

## 20. Agent Integration Design

### 20.1 Claude Code Integration

Approach:

- Generate structured task markdown in project folder.
- Human opens project in VS Code and runs Claude Code.
- Future enhancement: local wrapper command to auto-open folder and inject task prompt.

### 20.2 Codex Integration

Approach:

- Generate task packet with:
  - project path
  - task objective
  - referenced docs
  - expected outputs
- Human approves execution.

### 20.3 Paperclip Integration Strategy

Paperclip should be treated as an optional orchestration/observability layer for multi-agent management, not as the replacement for n8n.

Recommended use later:

- agent org chart
- ticket routing
- heartbeat monitoring
- governance and approval visibility

## 21. API Design

### 21.1 Core Endpoints

- `GET /api/leads`
- `GET /api/leads/:id`
- `POST /api/leads/:id/actions`
- `GET /api/projects`
- `GET /api/projects/:id`
- `POST /api/projects/:id/tasks`
- `GET /api/agents`
- `GET /api/dashboard/summary`
- `GET /api/dashboard/kanban`
- `POST /api/telegram/webhook`
- `POST /api/internal/qualify-lead`
- `POST /api/internal/bootstrap-project`

### 21.2 Internal Service Contracts

- Scraper returns normalized lead DTO
- Qualification service returns validated score DTO
- Bootstrap service returns created paths and project metadata

## 22. Error Handling

- Scraper timeout:
  - mark source run failed
  - retry once
  - alert in dashboard
- Ollama malformed output:
  - retry with repair prompt
  - if still invalid, mark for manual review
- Telegram delivery failure:
  - retry and log error
- Bootstrap filesystem failure:
  - roll back DB project creation or mark `BOOTSTRAP_FAILED`

## 23. Logging and Observability

- Structured JSON logs for all services
- Correlation ID per workflow run
- Full audit row for outbound customer messages
- Dashboard error feed for last 50 failures
- Heartbeat endpoint for all workers

## 24. Security and Governance

- Outbound messages require approval flag in MVP
- Destructive agent actions require approval flag
- Store local snapshots of lead content for later audit
- Maintain prompt versioning for AI decisions

## 25. Implementation Plan

### Phase 0: Foundation

- Create monorepo
- Set up Docker Compose
- Set up PostgreSQL, Redis, n8n, Ollama
- Create base schema and migrations
- Create API skeleton and dashboard skeleton

### Phase 1: Lead Intake MVP

- Implement source config
- Build scraper service
- Build deduplication
- Save leads to DB
- Implement qualification service with Ollama
- Implement Telegram notifications

### Phase 2: Human Decision and Quote Drafting

- Build Telegram command intake
- Build quote draft generation
- Add approval inbox
- Add lead Kanban

### Phase 3: Project Bootstrap and Delivery Ops

- Build project bootstrapper
- Create starter docs/templates
- Create project task model
- Add project Kanban

### Phase 4: Agent Runtime Panel

- Track Claude Code, Codex, Ollama, n8n statuses
- Add agent heartbeats
- Add current task visibility

### Phase 5: Revision Workflow

- Build feedback intake
- Build revision markdown generation
- Build revision task creation

## 26. Definition of Done

The MVP is considered done when:

- A public source can be crawled on schedule
- New leads are saved without duplication
- Ollama scores leads and stores structured results
- Telegram notifies the operator successfully
- Operator can mark a lead as quote or skip
- Approved quote drafts can be generated and stored
- Won leads can create project folders with starter docs
- Dashboard shows Kanban and agent statuses
- All key actions are audit logged

## 27. Open Questions

- Which exact public fields are consistently available per source?
- What outbound messaging channels are legally and technically allowed per platform?
- Should the dashboard be a custom app first or later replaced/enhanced by Paperclip?
- How should Claude Code and Codex heartbeat updates be captured in practice?
- Should project bootstrapping also initialize git repo and issue templates?

## 28. Recommended Build Order for Claude Code

Claude Code should implement in this exact order:

1. Monorepo scaffold
2. Docker Compose with PostgreSQL, Redis, n8n, Ollama
3. Prisma schema and migrations
4. Fastify API with health routes
5. Scraper service abstraction
6. Lead ingestion and deduplication
7. Ollama qualification service
8. Telegram integration
9. Lead Kanban UI
10. Quote draft workflow
11. Project bootstrapper
12. Project Kanban
13. Agent runtime panel

## 29. Claude Code Kickoff Prompt

Use the following prompt to start implementation:

```text
Build the MVP for a local-first "Local AI Freelance Agency OS" using TypeScript.

Requirements:
- Monorepo structure with apps/api, apps/dashboard, apps/worker, packages/db, packages/shared, packages/scraper, packages/bootstrapper
- Docker Compose for PostgreSQL, Redis, n8n, Ollama
- Fastify API
- Prisma ORM
- React dashboard
- Lead ingestion pipeline
- Ollama qualification service with strict JSON output validation
- Telegram webhook integration
- Project bootstrap service that creates markdown files under /projects
- Kanban dashboard for leads and projects
- Agent runtime panel

Constraints:
- Local-first on Windows
- Human approval required for outbound messaging
- Public-page scraping only
- Full audit logging

Implement in small working increments. Start by scaffolding the repo, docker-compose, Prisma schema, and healthcheck endpoints. Then proceed to lead ingestion.
```

## 30. Future Extensions

- Multi-tenant agency mode
- Native Paperclip control plane adapter
- CRM sync
- Proposal PDF generation
- Automatic margin estimation
- Customer portal
- Contract checklist and invoice workflow
