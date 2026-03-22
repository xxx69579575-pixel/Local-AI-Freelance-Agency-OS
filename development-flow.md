# Local AI Freelance Agency OS Development Flow

This document defines the recommended development flow for building the project in phases. It is intended for the project owner, Claude Code, Codex, and any future agents participating in implementation.

## 1. Development Flow Overview

```mermaid
flowchart TD
    A["Start Project"] --> B["Read PRD and Confirm MVP Scope"]
    B --> C["Set Up Monorepo and Tooling"]
    C --> D["Set Up Local Infrastructure"]
    D --> E["Design Database Schema"]
    E --> F["Build Core API Skeleton"]
    F --> G["Build Scraper Service"]
    G --> H["Build Lead Ingestion Workflow"]
    H --> I["Build Ollama Qualification Service"]
    I --> J["Build Telegram Notification and Decision Flow"]
    J --> K["Build Quote Draft and Approval Flow"]
    K --> L["Build Project Bootstrap Service"]
    L --> M["Build Dashboard UI"]
    M --> N["Build Agent Runtime Panel"]
    N --> O["Build Revision Workflow"]
    O --> P["Integration Testing"]
    P --> Q["Pilot Run with Manual Approval"]
    Q --> R["MVP Release"]
```

## 2. Engineering Workstream Flow

```mermaid
flowchart TD
    A["PRD / Requirements"] --> B["Architecture and Repo Scaffold"]
    B --> C["Infra Setup: Docker, PostgreSQL, Redis, n8n, Ollama"]
    C --> D["Backend API Foundation"]
    D --> E["Database Migrations and Seed Data"]
    E --> F["Scraper Adapters"]
    F --> G["Lead Normalization and Deduplication"]
    G --> H["AI Qualification Module"]
    H --> I["Telegram Bot Integration"]
    I --> J["Lead Kanban UI"]
    J --> K["Quote Drafting Module"]
    K --> L["Project Bootstrapper"]
    L --> M["Project Kanban UI"]
    M --> N["Agent Task and Heartbeat Tracking"]
    N --> O["Revision Intake and Markdown Generation"]
    O --> P["Logging, Audit, and Error Handling"]
    P --> Q["End-to-End QA"]
```

## 3. Runtime Product Flow

```mermaid
flowchart TD
    A["n8n Scheduled Trigger"] --> B["Fetch Public Lead Sources"]
    B --> C["Playwright / HTTP / Trafilatura Extraction"]
    C --> D["Normalize Lead Data"]
    D --> E{"Duplicate?"}
    E -- "Yes" --> F["Update Existing Record or Skip"]
    E -- "No" --> G["Store New Lead in PostgreSQL"]
    G --> H["Send Lead to Ollama Qualification Service"]
    H --> I{"Recommended?"}
    I -- "Skip" --> J["Mark Lead as Rejected"]
    I -- "Review / Hot" --> K["Send Telegram Notification"]
    K --> L{"User Decision"}
    L -- "放棄報價" --> M["Mark Lead as Lost or Skipped"]
    L -- "稍後處理" --> N["Keep in Waiting Human Queue"]
    L -- "聯絡報價" --> O["Generate Quote Draft"]
    O --> P{"Human Approves?"}
    P -- "No" --> Q["Edit or Hold Draft"]
    P -- "Yes" --> R["Send Approved Outbound Message"]
    R --> S{"Deal Won?"}
    S -- "No" --> T["Stay in Negotiation / Lost"]
    S -- "Yes" --> U["Create Project Record"]
    U --> V["Bootstrap Project Folder and Markdown Files"]
    V --> W["Dispatch Dev Task to Claude Code / Codex"]
    W --> X["Initial Delivery Complete"]
    X --> Y["Collect Client Feedback"]
    Y --> Z["Generate Revision Markdown"]
    Z --> AA["Dispatch Revision Task"]
    AA --> AB["Final Review and Confirmation"]
```

## 4. Recommended Implementation Phases

```mermaid
flowchart LR
    P0["Phase 0
Foundation"] --> P1["Phase 1
Lead Intake"]
    P1 --> P2["Phase 2
Qualification + Telegram"]
    P2 --> P3["Phase 3
Quote Approval"]
    P3 --> P4["Phase 4
Project Bootstrap"]
    P4 --> P5["Phase 5
Dashboard + Agent Status"]
    P5 --> P6["Phase 6
Revision Workflow"]
```

## 5. Agent Collaboration Flow

```mermaid
flowchart TD
    A["User / Operator"] --> B["n8n Orchestrator"]
    B --> C["Scraper Worker"]
    B --> D["Qualification Service"]
    D --> E["Ollama"]
    B --> F["Telegram Bot"]
    F --> A
    A --> G["Approval Decision"]
    G --> B
    B --> H["Project Bootstrapper"]
    H --> I["Claude Code Task"]
    H --> J["Codex Task"]
    I --> K["Project Output"]
    J --> K
    K --> L["Dashboard / Audit Log"]
    B --> L
```

## 6. Build Order for Claude Code

1. Scaffold monorepo and package layout.
2. Add Docker Compose with PostgreSQL, Redis, n8n, and Ollama.
3. Add Prisma schema and baseline migrations.
4. Implement API health routes and shared config.
5. Implement source config and lead ingestion.
6. Implement scraper adapters and normalization pipeline.
7. Implement Ollama qualification service with strict JSON validation.
8. Implement Telegram webhook and outbound notification flow.
9. Implement quote drafting and approval states.
10. Implement project bootstrapper and markdown templates.
11. Implement dashboard Kanban views.
12. Implement agent runtime panel and audit log views.
13. Implement revision intake and revision task generation.

## 7. Notes

- Human approval must remain in the loop for customer-facing outbound messages during MVP.
- Scraping behavior must stay within platform rules and should focus on public pages only.
- The dashboard should separate lead pipeline status from project delivery status.
- Agent observability should track current task, last heartbeat, and blocked state.
