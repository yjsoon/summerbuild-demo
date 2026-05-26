# Agent Instructions

- Use `tmux` for commands that are interactive or do not return, such as `pnpm dev`.
- Keep commits atomic: commit only the files you touched and list each path explicitly.
- Prefix commit messages with `feat:`, `fix:`, `docs:`, and other Conventional Commit types.
- Use `trash` on macOS instead of `rm`. Recover deleted files from `~/.Trash` if needed.
- Prefer British spelling in user-facing copy.
- For Supabase work, use the Supabase skill and connector tools first. Do not ask the user to run SQL manually when the available Supabase tooling can apply migrations, inspect schema, or execute the required database change directly.

## Workflow defaults

- Treat `AGENTS.md` as a map, not an encyclopaedia: keep it concise and point to source-of-truth docs.
- Keep durable knowledge in-repo and versioned in `docs/`, architecture notes, plans, or decision logs. If context only exists in chat or elsewhere, encode it into markdown before relying on it.
- Prefer progressive disclosure: start with short task context, then open only the most relevant referenced docs.
- For non-trivial work, maintain an executable plan with clear status updates. For larger tasks, persist plans under repo docs when appropriate.
- Convert repeated review feedback into mechanical checks such as linters, structural tests, or CI guards rather than re-explaining it in prompts.
- Optimise for agent legibility over stylistic preference when trade-offs appear, as long as correctness, maintainability, and reliability hold.
- Keep PRs small and short-lived. Prefer fast follow-up fixes over long-lived blocked branches when risk is low.
- Treat drift and AI slop as routine maintenance: run regular clean-up passes and targeted refactors on a steady cadence.
- Prefer explicit boundary validation and typed contracts at system edges. Avoid inferred or guessed data shapes in production paths.

## Future large-project notes

- For particularly large repos, enforce architectural boundaries and invariants centrally, while keeping local implementation autonomy.
- For particularly large repos, invest in agent-legible runtime signals such as tests, logs, metrics, traces, and screenshots so validation is evidence-driven.
- For very high-throughput large repos, consider lighter blocking merge gates only when strong guardrails and rapid follow-up fix loops are in place.

@/Users/yingjie/.codex/RTK.md
