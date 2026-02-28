# Agent Prompt Alignment for Local-First Architecture

**Date:** 2026-02-28
**Status:** Approved

---

## Purpose

Align all agent definitions and CLAUDE.md with:
1. The local-first single-repo architecture (migration plan Phase 1+)
2. The correct product vision: a free, open-source, local-first tool helping developers analyze AI coding sessions, collect insights, and build knowledge over time
3. Technical accuracy (paths, ports, LLM location)

## Vision Correction

**Old framing:** "OSS portfolio project — no monetization"
**Correct framing:** Code Insights helps developers who use multiple AI coding tools analyze their sessions, collect insights, track decisions and learnings, and build knowledge over time. Free, open-source, local-first.

This is a personal learning tool. No team/org features. No surveillance framing.

## Changes

### A. Vision Alignment (all agents + CLAUDE.md)

- Replace "OSS portfolio project" with genuine purpose statement
- Remove "Team Lead Taylor" persona (ux-engineer.md)
- Remove team-persona references from PM priority framework
- Update devtools-cofounder: teams are "not the vision" not "not yet"

### B. Technical Fixes

- `engineer.md`: LLM provider paths -> server-side
- `technical-architect.md`: localhost:3000 -> 7890, LLM path fix
- `product-manager.md`: Add context sources, migration awareness, fix collaborator names
- `journey-chronicler.md`: Genericization update, add migration arc
- `CLAUDE.md`: Sync agent suite, vision, path consistency

### Not Changing

- Agent personalities, philosophies, voice
- Ceremony steps
- Team mode sections
- Git discipline rules
- Agent file structure
