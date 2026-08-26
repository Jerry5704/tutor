# Working agreements

- Always work in small, reversible steps.
- Never implement more than one feature area at a time.
- Always explain the next step before editing files.
- Stop after each step and wait for confirmation, unless the user explicitly asks for autonomous continuation.
- Prefer AWS-native services.
- Keep the code simple and production-oriented.
- Add or update automated tests for behavioral changes and bug fixes when practical.
- Run all deterministic unit and integration tests after code changes; also run typecheck, lint, and build when relevant.
- Do not run paid API evaluations or paid simulations unless the user explicitly authorizes them.
- Run database-writing tests only against a dedicated disposable test database, never against the normal development or production database.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
