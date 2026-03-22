# Local AI Freelance Agency OS

Local-first AI operating system for freelance lead intake, qualification, quotation assistance, project bootstrapping, delivery coordination, and agent observability.

## Current Repo Contents

- `local-ai-freelance-agency-prd.md`: executable PRD and system architecture design

## Planned Stack

- `n8n` for scheduling and workflow orchestration
- `Ollama` for local LLM inference
- `Playwright` and `trafilatura` for public-page extraction
- `PostgreSQL` for system data
- `Redis` for queue/cache
- `Fastify + TypeScript` for backend API
- `React` for dashboard UI
- `Telegram Bot API` for operator notifications and approvals

## Product Vision

The system continuously monitors public freelance opportunities, scores them locally with AI, routes qualified leads to Telegram for human approval, and converts accepted work into structured local projects that can be executed by coding agents such as Claude Code and Codex.

## MVP Goals

- Crawl public freelance listing/detail pages on a schedule
- Deduplicate and store new leads
- Score leads with local Ollama models
- Notify operator on Telegram
- Support human decisioning for quote or skip
- Generate quote drafts with approval gate
- Bootstrap local project folders for won deals
- Track leads, projects, and agents in a Kanban dashboard

## Notes

- This project should be implemented conservatively and must respect platform rules.
- Public-page scraping only unless explicit permission is granted.
- Outbound customer-facing messages should require human approval in MVP.
