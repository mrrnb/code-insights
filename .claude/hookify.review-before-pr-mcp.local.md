---
name: review-before-pr-mcp
enabled: true
event: all
action: warn
tool_matcher: mcp__plugin_github_github__create_pull_request
---

**Code Review Required Before PR Creation**

You are about to create a pull request via GitHub MCP. Before proceeding, confirm:

**Per-task reviews (subagent-driven development):**
- [ ] Each task had a **spec compliance review** (spec-reviewer subagent)
- [ ] Each task had a **code quality review** (code-quality-reviewer subagent)
- [ ] All review issues were fixed and re-reviewed

**If you skipped per-task reviews:**
STOP. Go back and dispatch review subagents for each completed task before creating this PR.

**If reviews were completed:**
Proceed with PR creation. Include review outcomes in the PR description.

This is the development ceremony — reviews are NOT optional, even for "simple" tasks.
