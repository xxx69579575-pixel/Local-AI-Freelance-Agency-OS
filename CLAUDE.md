# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Local AI Freelance Agency OS** — an AI-powered freelance agency operating system built and managed entirely through Claude Code.

- GitHub: https://github.com/xxx69579575-pixel/Local-AI-Freelance-Agency-OS
- Development methodology: **SDD (Spec-Driven Development / 規格驅動開發)** — always read and follow specifications before writing code.

## New Project Initialization Checklist

When starting fresh in this repo, follow `新專案的啟動流程.md` in order:

1. **Environment init**: Run `/init` to generate `CLAUDE.md`.
2. **Mount MCP tools**: Copy `.mcp.json` from the reference project at `C:\Users\xx\Desktop\cc\toymarketpalce\claude_code_toy_marketplace-initial\.mcp.json`.
3. **Load commands**: Copy custom commands into `.claude/commands/` from:
   - `C:\Users\xx\Desktop\cc\claude_code_treasure_game-initial\.claude\commands\deploy_vercel.md`
   - `C:\Users\xx\Desktop\cc\claude_code_treasure_game-initial\.claude\commands\depoly_github_page.md`
   - `C:\Users\xx\Desktop\cc\claude_code_treasure_game-initial\.claude\commands\update.md`
4. **Load hooks**: Copy notification hook from `C:\Users\xx\Desktop\cc\claude_code_toy_marketplace-initial_hook\.claude\hooks\default-notification-hook-reminder.mp3`.
5. **Git init**: Initialize git, set `user.name = "dev"` and `user.email = "dev@example.com"` if not already configured.
6. **First commit**: Stage all files and commit as `first commit`.
7. **Dispatch tasks**: Run `/dispatch` with instructions referencing `CLAUDE.md` and project docs to build a task alias list scaled to complexity.

## Development Workflow (SDD)

- Read all specifications and `CLAUDE.md` before writing any code.
- Use `/dispatch` to delegate complex or multi-step tasks to background worker agents.
- Use `/update` to commit and push changes to GitHub (and sync to Vercel if configured).
- Use `/depoly_github_page` or `deploy_vercel` commands for deployments.
