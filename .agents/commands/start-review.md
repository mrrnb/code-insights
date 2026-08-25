# /start-review — Triple-Layer Code Review Team

**PR**: $ARGUMENTS

You are setting up a triple-layer code review for PR `$ARGUMENTS`. This can be used standalone or as part of a `/start-feature` team workflow.

---

## Step 1: Get PR Details

Fetch the PR details:

```bash
# Get the correct owner from git remote
git remote get-url origin | sed 's/.*[:/]\([^/]*\)\/[^/]*\.git/\1/'
```

Use `gh pr view $ARGUMENTS` to get PR title, description, and diff stats.
Use `gh pr diff $ARGUMENTS` to get the diff.

Determine the PR scope:
- Count files changed and lines changed
- Identify if it touches schema concerns (types.ts, SQLite schema, server API)
- Decide if Wild Card reviewer is needed (see criteria below)

---

## Step 2: Determine Review Scope

**Invoke Wild Card (3rd reviewer) if ANY of these apply:**
- New feature with multiple files changed
- Complex business logic
- Schema impact (types.ts, SQLite migrations, server API changes)
- Architectural changes
- 200+ lines of changes

**Skip Wild Card if ALL of these apply:**
- Simple bug fix (< 50 lines)
- Single file change
- Straightforward UI/component change
- Config/CI changes only

**Invoke LLM Expert (4th reviewer) if ANY of these apply:**
- PR touches `server/src/llm/` (prompts, providers, export-prompts)
- PR adds or modifies LLM API calls
- PR changes structured output schemas or SSE streaming
- PR modifies token budgets or model selection logic
- PR adds new LLM-powered features

**Skip LLM Expert if ALL of these apply:**
- No LLM code touched
- Pure UI, CLI, or schema changes
- Provider (source tool) implementations only

---

## Step 3: Run Parallel Independent Reviews

**CRITICAL**: All reviews run in parallel. No reviewer sees another's comments. This prevents bias.

**Launch TA Insider Review:**
```
Task {
  name: "ta-reviewer",
  subagent_type: "technical-architect",
  prompt: "You are performing a Phase 1 INSIDER review of PR #$ARGUMENTS in the code-insights repo.

  Fetch the PR diff using: gh pr diff $ARGUMENTS
  Also fetch the PR details: gh pr view $ARGUMENTS

  Follow your Phase 1 review protocol:
  1. Read the PR description and any linked GitHub Issue
  2. Check if the change touches schema concerns (types.ts, SQLite schema)
  3. Review code against existing patterns in the codebase
  4. Check existing CLAUDE.md conventions compliance
  5. Verify data contract patterns are followed (if data flow changed)
  6. Check shadcn/ui and component conventions (if UI changes)

  Output your review in the structured format:
  ## TA Review (Phase 1 - Insider): [PR Title]
  ### Architecture Alignment
  ### Issues Found (with priority markers)
  ### Phase 1 Verdict

  DO NOT look at any other review comments. Your review must be independent.",
  mode: "bypassPermissions"
}
```

**Launch Outsider Review:**
```
Task {
  name: "outsider-reviewer",
  subagent_type: "superpowers:code-reviewer",
  prompt: "You are performing an independent OUTSIDER review of PR #$ARGUMENTS in the code-insights repo.

  Fetch the PR diff using: gh pr diff $ARGUMENTS

  Review for:
  - Security issues (XSS, injection, auth bypass)
  - Best practices (React, TypeScript, Node.js)
  - Logic bugs and edge cases
  - Performance concerns
  - Accessibility issues

  Output a structured review with findings categorized as blocking, suggestions, and notes.",
  mode: "bypassPermissions"
}
```

**Launch LLM Expert Review (if applicable):**
```
Task {
  name: "llm-expert-reviewer",
  subagent_type: "llm-expert",
  prompt: "You are performing an independent LLM EXPERT review of PR #$ARGUMENTS in the code-insights repo.

  Fetch the PR diff using: gh pr diff $ARGUMENTS
  Also fetch the PR details: gh pr view $ARGUMENTS

  Review all LLM-related code for:
  - Prompt quality: clarity, specificity, output format constraints
  - Token efficiency: redundant instructions, over-prompting, prompt stuffing
  - Output consistency: structured output schemas, JSON mode, enum enforcement
  - Model selection: is the chosen model appropriate for the task complexity?
  - Resilience: handling malformed LLM output, timeouts, retries, rate limits
  - Cross-model compatibility: prompts that only work with one model family
  - Cost implications: token budget estimates, unnecessary Opus/GPT-4 usage for simple tasks
  - Streaming patterns: SSE implementation, partial response handling

  Rate each prompt on: clarity (1-5), token efficiency (1-5), output consistency (1-5), resilience (1-5).

  Output your review in the structured format:
  ## LLM Expert Review: [PR Title]
  ### Prompt Quality Assessment
  ### Token Efficiency
  ### Model Selection
  ### Issues Found (with priority markers)
  ### Recommendations

  DO NOT look at any other review comments. Your review must be independent.",
  mode: "bypassPermissions"
}
```

**Launch Wild Card Review (if applicable):**
```
Task {
  name: "wildcard-reviewer",
  subagent_type: "superpowers:code-reviewer",
  prompt: "You are performing an independent WILD CARD review of PR #$ARGUMENTS in the code-insights repo.

  Fetch the PR diff using: gh pr diff $ARGUMENTS

  Your role is to provide a fresh perspective with NO constraints:
  - Challenge assumptions in the implementation
  - Look for edge cases others might miss
  - Question whether the approach is the simplest that could work
  - Check for hidden complexity or tech debt being introduced
  - Look at error handling from a user's perspective

  Output a structured review with findings categorized as blocking, suggestions, and notes.",
  mode: "bypassPermissions"
}
```

Wait for ALL reviews to complete before proceeding.

---

## Step 4: TA Synthesis

After all reviews are collected, launch the TA synthesis pass:

```
Task {
  name: "ta-synthesizer",
  subagent_type: "technical-architect",
  prompt: "You are performing Phase 2 SYNTHESIS for PR #$ARGUMENTS.

  The orchestrator will provide you with the independent review outputs (outsider, wild card if applicable, and LLM expert if applicable).

  Follow your Phase 2 synthesis protocol:
  1. Read all review comments (outsider, wild card, LLM expert)
  2. Re-review the PR with all reviews in context
  3. For each outsider/wild card/LLM expert comment, evaluate:
     - Does this conflict with project patterns or conventions?
     - Is this a valid point that should be applied?
     - Did you miss this in Phase 1?
  4. For each comment: AGREE or PUSHBACK WITH REASON
  5. Create the consolidated final list

  Output in the structured format:
  ## TA Synthesis (Phase 2): [PR Title]
  ### Review of Outsider Comments
  ### Second Pass Findings
  ### Consolidated Review (For Dev Agent)
  - FIX NOW items
  - NOT APPLICABLE items with technical rationale
  - ESCALATE TO FOUNDER items with reason
  ### Final Verdict",
  mode: "bypassPermissions"
}
```

---

## Step 5: Deliver Results

After synthesis is complete:

1. **If part of a /start-feature team**: Send the consolidated review to the dev-agent via SendMessage. Mark the review task as completed.

2. **If standalone**: Present the consolidated review to the user. Ask if they want to:
   - Have the review summary posted to the GitHub PR
   - Have fixes implemented automatically

3. **Post review summary to GitHub PR** using `gh pr comment`:

```bash
gh pr comment $ARGUMENTS --body "$(cat <<'EOF'
## Triple-Layer Code Review Summary

### Reviewers
| Role | Focus |
|------|-------|
| TA (Insider) | Pattern compliance, schema impact, architecture |
| Outsider | Security, best practices, logic bugs |
| LLM Expert | Prompt quality, token efficiency, model selection (if applicable) |
| Wild Card | Edge cases, fresh perspective |

### Issues Found & Resolution
#### FIX NOW
[List from synthesis]

#### NOT APPLICABLE
[List with technical rationale]

### Verification
[Status of fixes if any were applied]

**Review complete. [Ready for merge / Changes required].**
EOF
)"
```

---

## Important Rules

- **NEVER merge the PR** — founder-only
- **Reviews MUST be independent** — no reviewer sees another's output during Phase 1
- **TA synthesis is authoritative** — TA can mark outsider comments as "NOT APPLICABLE" with technical justification
- **Always post summary to GitHub PR** — this creates the audit trail
