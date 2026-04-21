---
name: debug-flow
description: "Systematic debugging playbook. Use when a build fails, a test is red, the preview shows a blank screen, an API call errors, or the user reports a bug. Prevents hypothesis-hopping and random fixes."
when-to-use: "Any time something is broken and the fix isn't obvious in 10 seconds. Especially after you tried one fix and it didn't work."
context: inline
---

# Debug Flow

When something is broken, follow this sequence. Do not skip steps. Do not guess.

## 1. Read the signal, not your assumption

- Get the actual error text. Run `get_dev_server_logs`, open the browser console mentally via `bash` + `curl`, run the failing command via `bash`.
- Read the **whole** error including stack trace. The first line is rarely the root cause.
- If you think you know what's wrong before reading logs, **read them anyway**. Most wrong guesses start with "I think I know what's wrong."

## 2. Reproduce reliably

- Find the exact command or user action that triggers the failure.
- If you can't reproduce, stop — you don't have a bug, you have a hypothesis. Ask the user for the exact steps.
- Minimal repro: the smallest input that still triggers the bug.

## 3. Localize

- From the stack trace, identify the file + line. Read ~30 lines around it with the `read` tool.
- Check what changed recently: `bash` → `git log --oneline -10` and `git diff HEAD~1 <file>` to see the last edits.
- If it worked before, what changed? Narrow to the diff.

## 4. Form ONE hypothesis

- Write it as a single sentence: *"The X is failing because Y, and fixing Z will resolve it."*
- If you can't write that sentence confidently, you need more signal — go back to step 1.
- Don't fix multiple things at once. One hypothesis, one fix.

## 5. Verify the hypothesis before fixing

- Add a strategic log or `console.log` to confirm Y is actually happening.
- Or: write a failing test that captures the bug. (Makes the fix provable.)
- If the evidence contradicts your hypothesis, **abandon it**. Don't contort the fix to justify the guess.

## 6. Fix the root cause, not the symptom

- Patching the surface (wrapping in try/catch, adding a nullish check, suppressing the error) is rarely the right fix.
- Ask: *"Why did this value become undefined?"* not *"How do I make undefined stop crashing?"*
- Exception: you're fixing a critical prod bug and need to ship a band-aid — mark it with a `// TODO: root-cause` comment.

## 7. Prove the fix

- Re-run the exact reproduction steps. The error must be gone.
- Run `typecheck` + `run_tests` (or at minimum `typecheck`). A fix that introduces 3 new type errors is not a fix.
- Check adjacent features you might have broken — if you touched a shared util, spot-check its other callers.

## 8. Common classes (check these first, in order)

1. **Typos** — mis-cased imports, wrong prop names, `=` vs `===`.
2. **Stale state** — React re-renders using old closure values; check `useEffect` dep arrays and `useState` setter calls.
3. **Async ordering** — the thing you're reading isn't populated yet. Check if you're inside a `useEffect` without proper loading guards.
4. **Environment** — missing env var, wrong URL, wrong database, port collision.
5. **Schema mismatch** — the DB/API returns shape A, the code expects shape B. Common after a migration.
6. **Case-sensitivity** — filesystems differ; `Header.tsx` vs `header.tsx` imports work on macOS but not Linux.
7. **Supabase RLS** — row reads return empty despite data existing → RLS policy is blocking. Check with an elevated role.

## Anti-patterns (do NOT do these)

- Restarting the dev server "just in case" — it won't fix bugs, it just hides them.
- Adding `try/catch` around code you haven't read. You're silencing the error, not fixing it.
- Wrapping in `useMemo` / `useCallback` "to fix the re-render" without confirming which render is problematic.
- Downgrading dependencies because "the old version worked." Solve the actual incompat.
- Guessing at types (`as any`). If TypeScript is complaining, it probably found a real bug.

## When to escalate to the user

- The bug is in env/config you can't inspect (production Supabase, external API).
- The fix requires a decision between two legit approaches.
- Three consecutive fixes haven't worked — stop and report what you've tried.

Report the root cause in one sentence when you're done. Not "fixed the issue" — *"the user list was empty because the RLS policy on `users` required `auth.uid()` and we were querying before sign-in."* That's a debug report.
