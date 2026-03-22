# Local AI Freelance Agency OS

AI-powered freelance agency operating system built and managed entirely through Claude Code using SDD (Spec-Driven Development).

## Live Demo

https://local-ai-agency-os.vercel.app

## Overview

This project implements an AI-driven freelance agency operating system with:

- **Intake Module** — accepts client project briefs and uses Claude AI to produce structured analysis reports
- **Dispatch Module** — creates and tracks background AI worker tasks with IPC-based question/answer flow
- **SDD Workflow** — spec-driven development pipeline with drift-check and spec gate validation

**Tech stack:** TypeScript + Node.js ESM, Anthropic Claude SDK, Vercel Serverless Functions, Jest

## Installation

```bash
npm install
```

Requires `ANTHROPIC_API_KEY` set in your environment (or `.env` file).

## Development

```bash
npm run dev        # run the local HTTP server (tsx)
npm run build      # compile TypeScript
npm test           # run Jest tests (118 test cases)
```

## API Endpoints

All endpoints return `application/json`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Health check |
| POST | `/api/intake` | Submit a client project brief |
| POST | `/api/dispatch` | Create and start a background task |
| GET | `/api/dispatch/tasks` | List all tasks (supports pagination/filter) |
| GET | `/api/dispatch/tasks/:task_id` | Get single task status |
| POST | `/api/dispatch/tasks/:task_id/answer` | Answer a task's pending question |
| DELETE | `/api/dispatch/tasks/:task_id` | Stop a running task |

See [docs/api.md](docs/api.md) for full request/response details.

## Deployment

Hosted on Vercel via serverless function at `api/index.ts`.

```bash
vercel --prod   # deploy to production
```

## Repository

https://github.com/xxx69579575-pixel/Local-AI-Freelance-Agency-OS

## Specs

| Spec | Description |
|------|-------------|
| [intake-module.md](docs/specs/intake-module.md) | Client intake form parsing and AI analysis |
| [dispatch-module.md](docs/specs/dispatch-module.md) | Task dispatch, tracking, and IPC |
| [sdd-workflow.md](docs/specs/sdd-workflow.md) | SDD pipeline, spec gates, drift-check |
