# Completion Verification Protocol

## MANDATORY: Before declaring ANY task "done" or "completed"

Every time you are about to tell the user that a task is finished, you MUST follow this protocol. No exceptions.

---

## Phase 1: Self-Check (Claude)

### Step 1: Trace back to the original request
- Re-read the user's original message/request that started this task
- List EVERY item/sub-task the user asked for (numbered list)
- If the request was vague, list what you committed to doing

### Step 2: Evidence-based verification for each item
For EACH item from Step 1, provide:
- **What was requested**: exact description
- **What was done**: specific file + line changed, or specific action taken
- **Verification**: how you confirmed it works (TypeScript compile, visual check, code read, etc.)
- **Status**: DONE / PARTIAL / NOT DONE

### Step 3: Honest summary
- Count: X of Y items fully completed
- If anything is PARTIAL or NOT DONE — say so explicitly, explain why, and ask the user if they want you to continue
- Do NOT say "done" if even one item is incomplete — say "X of Y done, remaining: ..."

### Step 4: For agent-delegated work
When a sub-agent reports completion:
- Do NOT blindly trust the agent's summary
- Read at least 2-3 of the changed files to spot-check the work
- Verify the agent actually pushed to git (check `git log --oneline -3`)
- If the agent said it did 6 things, verify at least 3 of them in the actual code

---

## Phase 2: PM Agent Independent Verification

After Phase 1 is complete and BEFORE telling the user "done", launch the Elite Project Manager agent with the following prompt template:

```
You are the Project Manager performing an independent completion verification.

ORIGINAL USER REQUEST:
[paste the user's original request here]

ITEMS THAT WERE SUPPOSED TO BE DONE:
[paste the numbered list from Phase 1 Step 1]

CLAUDE'S SELF-REPORT:
[paste the completion table from Phase 1]

YOUR TASK:
1. Independently verify EACH item by reading the actual source code files
2. For UI changes: navigate to the page with Playwright and take a screenshot
3. For code changes: read the file and confirm the change exists
4. Run `npx tsc --noEmit` to verify TypeScript compiles
5. Check `git log --oneline -5` to verify commits were pushed
6. Compare what was requested vs what was actually done — flag any gaps
7. Rate overall completion: FULL / MOSTLY / PARTIAL / FAILED

Return a verification report in this format:
| # | Item | Claude said | PM verified | Match? |
|---|------|------------|-------------|--------|

If any item does NOT match, explain what's missing.
```

### When to use Phase 2:
- **ALWAYS** for tasks with 3+ items
- **ALWAYS** when sub-agents were used
- **ALWAYS** when the user explicitly asked to "do everything" or "fix all"
- **SKIP** only for single-item trivial changes (e.g., "change this color to blue")

### What happens if PM finds gaps:
- Do NOT tell the user "done" — fix the gaps first
- If gaps cannot be fixed, tell the user exactly what's missing and why
- Re-run Phase 2 after fixing (but only once — don't loop forever)

---

## Anti-patterns to avoid
- "All done!" without listing what was done
- Trusting agent output without spot-checking
- Saying "deployed" without verifying git push
- Marking items as done when they were skipped
- Summarizing 20 changes without evidence for any of them
- Skipping Phase 2 because "I'm pretty sure it's fine"

## Format for final completion report (shown to user)
```
## Completion Report

Original request: [quote or summary]

### Self-Check (Phase 1)
| # | Requested | Done? | Evidence |
|---|-----------|-------|----------|
| 1 | ...       | YES   | file.tsx:42 changed X to Y |
| 2 | ...       | YES   | verified via tsc --noEmit |

### PM Verification (Phase 2)
| # | Item | Verified? | Notes |
|---|------|-----------|-------|
| 1 | ...  | YES       | confirmed in code |
| 2 | ...  | NO        | change not found in file |

**Result: X/Y verified by PM. [All clear / Gaps found — fixing...]**
```
