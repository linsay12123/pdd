# PDD Production Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the deployed 拼代代PDD Next.js shell into a production-ready product without changing the approved frontend look and feel.

**Architecture:** Keep the current Next.js app as the single source of truth for frontend, APIs, and admin. Replace demo auth, wallet, and task placeholders with real Supabase-backed flows, then complete the writing pipeline behind the existing UI. Preserve current route structure and visual components while moving all identity, quota, and file ownership checks to the server.

**Tech Stack:** Next.js 16, React, TypeScript, Supabase Auth/DB/Storage, OpenAI API, StealthGPT API, python-docx, reportlab, Vitest, Playwright.

---

### Task 1: Lock The Project Boundary And Document The Current Truth

**Files:**
- Modify: `README.md`
- Modify: `docs/runbooks/launch-checklist.md`
- Create: `docs/runbooks/current-scope.md`
- Test: `tests/smoke/homepage.test.ts`

**Step 1: Write the failing doc expectation**

Add a smoke assertion in `tests/smoke/homepage.test.ts` that the documented project name is `拼代代PDD` and the project no longer claims online payments are active.

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/smoke/homepage.test.ts`
Expected: FAIL because README/runbook wording still overstates current readiness.

**Step 3: Write minimal documentation fixes**

Update docs so they explicitly state:

- `.worktrees/bootstrap-shell` is the only active product codebase
- online payments are disabled
- login, wallet, task pipeline hardening is the next production milestone

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/smoke/homepage.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add README.md docs/runbooks/launch-checklist.md docs/runbooks/current-scope.md tests/smoke/homepage.test.ts
git commit -m "docs: align project scope with deployed pdd app"
```

### Task 2: Add Real Session Helpers For The Current User

**Files:**
- Create: `src/lib/auth/current-user.ts`
- Modify: `src/lib/supabase/server.ts`
- Modify: `proxy.ts`
- Test: `tests/unit/current-user.test.ts`
- Test: `tests/unit/middleware.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/current-user.test.ts` covering:

- returns `null` when no auth session exists
- returns `{ id, email, role }` when a signed-in user exists
- rejects frozen users

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/current-user.test.ts`
Expected: FAIL because `src/lib/auth/current-user.ts` does not exist.

**Step 3: Write minimal implementation**

Create a helper that:

- creates the Supabase server client
- reads the current auth session
- loads `profiles` for the current `auth.users.id`
- returns normalized current-user data

Also update `proxy.ts` so protected pages still redirect unauthenticated users, but admin paths rely on real role lookup later instead of the `aw-role` shortcut.

**Step 4: Run tests to verify they pass**

Run: `pnpm test tests/unit/current-user.test.ts tests/unit/middleware.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/auth/current-user.ts src/lib/supabase/server.ts proxy.ts tests/unit/current-user.test.ts tests/unit/middleware.test.ts
git commit -m "feat: add current user session helpers"
```

### Task 3: Auto-Bootstrap Profile And Wallet Rows For New Users

**Files:**
- Create: `supabase/migrations/202603030005_profile_bootstrap.sql`
- Modify: `tests/sql/initial_schema_smoke.sql`
- Create: `tests/unit/profile-bootstrap.test.ts`
- Modify: `docs/runbooks/supabase-persistence-quickstart.md`

**Step 1: Write the failing test**

Create `tests/unit/profile-bootstrap.test.ts` to assert the migration SQL includes:

- a function that inserts `profiles`
- a function that inserts `quota_wallets`
- a trigger on `auth.users`

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/profile-bootstrap.test.ts`
Expected: FAIL because the bootstrap migration does not exist.

**Step 3: Write minimal implementation**

Create a migration that:

- inserts `profiles(id, email, display_name, role)`
- inserts `quota_wallets(user_id, recharge_quota, subscription_quota, frozen_quota)`
- uses `on conflict do nothing` for idempotency
- attaches an `after insert on auth.users` trigger

Update the Supabase quickstart doc with the new migration requirement.

**Step 4: Run tests to verify they pass**

Run: `pnpm test tests/unit/profile-bootstrap.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add supabase/migrations/202603030005_profile_bootstrap.sql tests/unit/profile-bootstrap.test.ts tests/sql/initial_schema_smoke.sql docs/runbooks/supabase-persistence-quickstart.md
git commit -m "feat: auto bootstrap profile and wallet rows"
```

### Task 4: Replace Demo Login And Register With Real Supabase Auth

**Files:**
- Modify: `app/login/page.tsx`
- Modify: `app/register/page.tsx`
- Create: `src/components/auth/login-form.tsx`
- Create: `src/components/auth/register-form.tsx`
- Modify: `src/lib/supabase/client.ts`
- Test: `tests/unit/auth-pages.test.tsx`
- Test: `tests/e2e/auth-shell.spec.ts`

**Step 1: Write the failing test**

Expand `tests/unit/auth-pages.test.tsx` to assert:

- login form has controlled fields and submit feedback
- register form includes password confirmation validation copy
- forms call real submit handlers instead of plain redirect buttons

Add an e2e case in `tests/e2e/auth-shell.spec.ts` for “login page shows error on invalid credentials”.

**Step 2: Run tests to verify they fail**

Run: `pnpm test tests/unit/auth-pages.test.tsx`
Expected: FAIL because forms still use placeholder submit handlers.

**Step 3: Write minimal implementation**

Implement client-side auth forms that:

- call Supabase `signInWithPassword`
- call Supabase `signUp`
- handle loading and readable error messages
- redirect to `/workspace` or requested `redirect`
- keep current visual layout unchanged

**Step 4: Run tests to verify they pass**

Run: `pnpm test tests/unit/auth-pages.test.tsx`
Expected: PASS

Run: `pnpm test:e2e tests/e2e/auth-shell.spec.ts`
Expected: PASS for redirect and invalid-login handling.

**Step 5: Commit**

```bash
git add app/login/page.tsx app/register/page.tsx src/components/auth/login-form.tsx src/components/auth/register-form.tsx src/lib/supabase/client.ts tests/unit/auth-pages.test.tsx tests/e2e/auth-shell.spec.ts
git commit -m "feat: connect login and register to supabase auth"
```

### Task 5: Secure Wallet And Activation-Code APIs Around The Session User

**Files:**
- Modify: `app/api/quota/wallet/route.ts`
- Modify: `app/api/quota/redeem-code/route.ts`
- Modify: `src/lib/auth/request-user.ts`
- Modify: `src/lib/activation-codes/supabase-repository.ts`
- Test: `tests/unit/quota-wallet-route.test.ts`
- Create: `tests/unit/redeem-code-route.test.ts`

**Step 1: Write the failing test**

Add tests that assert:

- wallet route returns 401 when session user missing
- wallet route ignores `x-user-id`
- redeem route accepts only `code`
- redeem route credits the current session user

**Step 2: Run tests to verify they fail**

Run: `pnpm test tests/unit/quota-wallet-route.test.ts tests/unit/redeem-code-route.test.ts`
Expected: FAIL because routes still expect user IDs from the request.

**Step 3: Write minimal implementation**

Refactor routes to:

- resolve the current session user from server auth
- reject requests without session
- ignore front-end supplied `userId`
- return normalized wallet payload and friendly errors

Turn `src/lib/auth/request-user.ts` into a deprecated compatibility wrapper or remove its remaining API usage.

**Step 4: Run tests to verify they pass**

Run: `pnpm test tests/unit/quota-wallet-route.test.ts tests/unit/redeem-code-route.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/api/quota/wallet/route.ts app/api/quota/redeem-code/route.ts src/lib/auth/request-user.ts src/lib/activation-codes/supabase-repository.ts tests/unit/quota-wallet-route.test.ts tests/unit/redeem-code-route.test.ts
git commit -m "feat: secure wallet and redeem routes with session auth"
```

### Task 6: Replace Static Quota UI With Live Wallet Data

**Files:**
- Modify: `app/(app)/workspace/page.tsx`
- Modify: `app/(app)/billing/page.tsx`
- Modify: `app/(app)/tasks/page.tsx`
- Modify: `src/components/billing/recharge-card.tsx`
- Create: `src/components/app/quota-badge.tsx`
- Test: `tests/unit/workspace-page.test.tsx`
- Test: `tests/unit/billing-page.test.tsx`

**Step 1: Write the failing test**

Expand page tests to assert:

- static `1,500` no longer appears as a hardcoded default
- authenticated wallet summary renders server-provided quota
- recharge success updates current quota display

**Step 2: Run tests to verify they fail**

Run: `pnpm test tests/unit/workspace-page.test.tsx tests/unit/billing-page.test.tsx`
Expected: FAIL because pages still contain static quota numbers.

**Step 3: Write minimal implementation**

Server-render the current user and wallet snapshot into the page.

Keep the current UI design, but:

- feed real quota into workspace header
- feed real quota into billing cards
- show friendly empty-state text when quota is zero

**Step 4: Run tests to verify they pass**

Run: `pnpm test tests/unit/workspace-page.test.tsx tests/unit/billing-page.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add app/(app)/workspace/page.tsx app/(app)/billing/page.tsx app/(app)/tasks/page.tsx src/components/billing/recharge-card.tsx src/components/app/quota-badge.tsx tests/unit/workspace-page.test.tsx tests/unit/billing-page.test.tsx
git commit -m "feat: show live wallet data in app pages"
```

### Task 7: Replace Fake Admin Permission Checks With Database Roles

**Files:**
- Modify: `src/lib/auth/admin-guard.ts`
- Modify: `app/(app)/admin/layout.tsx`
- Modify: `app/api/admin/activation-codes/create/route.ts`
- Modify: `app/api/admin/activation-codes/list/route.ts`
- Modify: `app/api/admin/activation-codes/export/route.ts`
- Test: `tests/unit/admin-access.test.ts`
- Test: `tests/e2e/admin-shell.spec.ts`

**Step 1: Write the failing test**

Add or expand tests to assert:

- admin routes reject plain session users
- admin routes no longer trust `aw-role`
- admin page redirects non-admins using profile role

**Step 2: Run tests to verify they fail**

Run: `pnpm test tests/unit/admin-access.test.ts`
Expected: FAIL because current guard still trusts cookies.

**Step 3: Write minimal implementation**

Refactor admin checks so they:

- resolve current user via session
- query `profiles.role`
- permit only `admin`

Remove `aw-role` as an authorization source.

**Step 4: Run tests to verify they pass**

Run: `pnpm test tests/unit/admin-access.test.ts`
Expected: PASS

Run: `pnpm test:e2e tests/e2e/admin-shell.spec.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/auth/admin-guard.ts app/(app)/admin/layout.tsx app/api/admin/activation-codes/create/route.ts app/api/admin/activation-codes/list/route.ts app/api/admin/activation-codes/export/route.ts tests/unit/admin-access.test.ts tests/e2e/admin-shell.spec.ts
git commit -m "feat: enforce real admin roles for console access"
```

### Task 8: Build Real Task Creation With Quota Freeze

**Files:**
- Modify: `app/api/tasks/create/route.ts`
- Create: `src/lib/tasks/create-task.ts`
- Create: `src/lib/tasks/task-cost.ts`
- Create: `src/lib/tasks/session-task.ts`
- Modify: `src/lib/payments/supabase-wallet.ts`
- Test: `tests/unit/task-create-route.test.ts`

**Step 1: Write the failing test**

Create tests for:

- task create rejects unauthenticated users
- task create rejects users with insufficient quota
- task create freezes 500 quota and creates a `writing_tasks` row
- task create stores `special_requirements`

**Step 2: Run tests to verify they fail**

Run: `pnpm test tests/unit/task-create-route.test.ts`
Expected: FAIL because the route is currently a 501 stub.

**Step 3: Write minimal implementation**

Implement a server-side task creation service that:

- resolves current user
- validates user not frozen
- validates available quota
- freezes 500 quota
- inserts `writing_tasks`
- returns task ID and initial status

**Step 4: Run tests to verify they pass**

Run: `pnpm test tests/unit/task-create-route.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/api/tasks/create/route.ts src/lib/tasks/create-task.ts src/lib/tasks/task-cost.ts src/lib/tasks/session-task.ts src/lib/payments/supabase-wallet.ts tests/unit/task-create-route.test.ts
git commit -m "feat: create tasks with quota freeze"
```

### Task 9: Support Real File Upload Storage And Text Extraction

**Files:**
- Modify: `src/lib/files/extract-text.ts`
- Create: `src/lib/files/extract-docx.ts`
- Create: `src/lib/files/extract-pdf.ts`
- Create: `src/lib/files/extract-pptx.ts`
- Modify: `src/lib/storage/upload.ts`
- Create: `tests/unit/extract-binary-files.test.ts`
- Modify: `tests/unit/extract-text.test.ts`

**Step 1: Write the failing test**

Add tests that assert:

- `docx`, `pdf`, `pptx` return extracted body text instead of `[extraction pending ...]`
- unsupported file types still error

**Step 2: Run tests to verify they fail**

Run: `pnpm test tests/unit/extract-text.test.ts tests/unit/extract-binary-files.test.ts`
Expected: FAIL because extraction is only implemented for txt/md.

**Step 3: Write minimal implementation**

Implement extraction adapters for supported binary files and route them through `extractTextFromUpload`.

Keep the interface simple:

- return trimmed plain text
- throw readable errors on extraction failure

**Step 4: Run tests to verify they pass**

Run: `pnpm test tests/unit/extract-text.test.ts tests/unit/extract-binary-files.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/files/extract-text.ts src/lib/files/extract-docx.ts src/lib/files/extract-pdf.ts src/lib/files/extract-pptx.ts src/lib/storage/upload.ts tests/unit/extract-text.test.ts tests/unit/extract-binary-files.test.ts
git commit -m "feat: extract text from supported upload formats"
```

### Task 10: Persist Uploaded Files And Primary File Classification

**Files:**
- Modify: `trigger/jobs/process-uploaded-task.ts`
- Modify: `src/lib/ai/services/classify-files.ts`
- Create: `src/lib/tasks/save-task-files.ts`
- Modify: `app/api/tasks/[taskId]/files/confirm-primary/route.ts`
- Test: `tests/unit/classify-files-persistence.test.ts`

**Step 1: Write the failing test**

Create tests that assert:

- uploaded files are persisted to `task_files`
- one strong requirement file is auto-selected
- multiple strong candidates require explicit user confirmation
- confirm-primary route marks the chosen file as primary and advances task status

**Step 2: Run tests to verify they fail**

Run: `pnpm test tests/unit/classify-files-persistence.test.ts`
Expected: FAIL because persistence and confirm-primary are not implemented.

**Step 3: Write minimal implementation**

Implement:

- saving uploaded files and extracted text
- heuristic classification with persisted roles
- confirmation route that updates `primary_requirement_file_id`

**Step 4: Run tests to verify they pass**

Run: `pnpm test tests/unit/classify-files-persistence.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add trigger/jobs/process-uploaded-task.ts src/lib/ai/services/classify-files.ts src/lib/tasks/save-task-files.ts app/api/tasks/[taskId]/files/confirm-primary/route.ts tests/unit/classify-files-persistence.test.ts
git commit -m "feat: persist task files and confirm primary file"
```

### Task 11: Build Rule Cards And Persist Outline Versions

**Files:**
- Create: `src/lib/tasks/build-rule-card.ts`
- Create: `src/lib/tasks/save-outline-version.ts`
- Modify: `trigger/jobs/generate-outline.ts`
- Modify: `app/api/tasks/[taskId]/outline/feedback/route.ts`
- Modify: `app/api/tasks/[taskId]/outline/approve/route.ts`
- Test: `tests/unit/outline-rules.test.ts`
- Create: `tests/unit/outline-approval-routes.test.ts`

**Step 1: Write the failing test**

Add tests for:

- explicit word count from primary task file overrides defaults
- citation style defaults to APA 7 only when no explicit value exists
- user special requirements are included on first outline generation
- outline feedback creates a new version and increments revision count
- outline approval locks the approved version

**Step 2: Run tests to verify they fail**

Run: `pnpm test tests/unit/outline-rules.test.ts tests/unit/outline-approval-routes.test.ts`
Expected: FAIL because persistence routes are currently 501 stubs.

**Step 3: Write minimal implementation**

Implement:

- rule-card assembly from primary hints, background hints, and user requirements
- persisted `outline_versions`
- approve route to mark one version approved
- feedback route to append a new version and enforce max revision count

**Step 4: Run tests to verify they pass**

Run: `pnpm test tests/unit/outline-rules.test.ts tests/unit/outline-approval-routes.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/tasks/build-rule-card.ts src/lib/tasks/save-outline-version.ts trigger/jobs/generate-outline.ts app/api/tasks/[taskId]/outline/feedback/route.ts app/api/tasks/[taskId]/outline/approve/route.ts tests/unit/outline-rules.test.ts tests/unit/outline-approval-routes.test.ts
git commit -m "feat: persist and approve outline versions"
```

### Task 12: Generate Drafts, Adjust Word Count, And Store Reference Checks

**Files:**
- Modify: `trigger/jobs/generate-draft.ts`
- Modify: `trigger/jobs/adjust-word-count.ts`
- Modify: `trigger/jobs/verify-references.ts`
- Create: `src/lib/tasks/save-draft-version.ts`
- Create: `src/lib/tasks/save-reference-checks.ts`
- Test: `tests/unit/word-count-adjustment.test.ts`
- Test: `tests/unit/reference-verification.test.ts`
- Create: `tests/unit/draft-persistence.test.ts`

**Step 1: Write the failing test**

Add tests that assert:

- draft generation stores title, sections, references
- word count logic excludes `References`
- candidate draft and adopted draft counts are distinct
- reference checks persist simple verdicts and explanations

**Step 2: Run tests to verify they fail**

Run: `pnpm test tests/unit/word-count-adjustment.test.ts tests/unit/reference-verification.test.ts tests/unit/draft-persistence.test.ts`
Expected: FAIL because draft/reference persistence is incomplete.

**Step 3: Write minimal implementation**

Implement:

- active/candidate draft version persistence
- body-only word counts
- saved reference check rows
- task status updates through drafting, adjusting, verifying

**Step 4: Run tests to verify they pass**

Run: `pnpm test tests/unit/word-count-adjustment.test.ts tests/unit/reference-verification.test.ts tests/unit/draft-persistence.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add trigger/jobs/generate-draft.ts trigger/jobs/adjust-word-count.ts trigger/jobs/verify-references.ts src/lib/tasks/save-draft-version.ts src/lib/tasks/save-reference-checks.ts tests/unit/word-count-adjustment.test.ts tests/unit/reference-verification.test.ts tests/unit/draft-persistence.test.ts
git commit -m "feat: persist drafts word counts and reference checks"
```

### Task 13: Secure Exports, Downloads, And Expiry Cleanup

**Files:**
- Modify: `src/lib/deliverables/export-docx.ts`
- Modify: `src/lib/deliverables/export-report.ts`
- Modify: `src/lib/storage/signed-url.ts`
- Modify: `app/api/tasks/[taskId]/downloads/[outputId]/route.ts`
- Modify: `trigger/jobs/expire-task-assets.ts`
- Test: `tests/unit/deliverables-contract.test.ts`
- Test: `tests/unit/expiry-rules.test.ts`

**Step 1: Write the failing test**

Add tests for:

- output records use user-scoped storage paths
- signed URLs cannot be created for another user
- expired files cannot be downloaded
- task history survives output expiry

**Step 2: Run tests to verify they fail**

Run: `pnpm test tests/unit/deliverables-contract.test.ts tests/unit/expiry-rules.test.ts`
Expected: FAIL because exports/downloads are not fully user-scoped yet.

**Step 3: Write minimal implementation**

Update exports and downloads so they:

- write output records with real `user_id`
- verify ownership using current session user
- mark outputs expired after 3 days
- keep task summaries available after cleanup

**Step 4: Run tests to verify they pass**

Run: `pnpm test tests/unit/deliverables-contract.test.ts tests/unit/expiry-rules.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/deliverables/export-docx.ts src/lib/deliverables/export-report.ts src/lib/storage/signed-url.ts app/api/tasks/[taskId]/downloads/[outputId]/route.ts trigger/jobs/expire-task-assets.ts tests/unit/deliverables-contract.test.ts tests/unit/expiry-rules.test.ts
git commit -m "feat: secure downloads and expiry cleanup"
```

### Task 14: Connect Auto-Humanize To Real Task Ownership And Billing

**Files:**
- Modify: `app/api/tasks/[taskId]/humanize/route.ts`
- Modify: `trigger/jobs/humanize-draft.ts`
- Create: `src/lib/tasks/freeze-humanize-quota.ts`
- Modify: `src/lib/humanize/stealthgpt-client.ts`
- Test: `tests/unit/humanize-panel.test.tsx`
- Test: `tests/unit/stealthgpt-client.test.ts`

**Step 1: Write the failing test**

Add tests that assert:

- only the task owner can start auto-humanize
- humanize freezes 500 quota before queueing
- references are preserved unmodified
- output record kind is `humanized_docx`

**Step 2: Run tests to verify they fail**

Run: `pnpm test tests/unit/humanize-panel.test.tsx tests/unit/stealthgpt-client.test.ts`
Expected: FAIL because billing/ownership checks are incomplete.

**Step 3: Write minimal implementation**

Implement:

- task ownership validation
- fixed 500 quota freeze/deduct path for humanize
- humanized output registration
- preserved references section

**Step 4: Run tests to verify they pass**

Run: `pnpm test tests/unit/humanize-panel.test.tsx tests/unit/stealthgpt-client.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/api/tasks/[taskId]/humanize/route.ts trigger/jobs/humanize-draft.ts src/lib/tasks/freeze-humanize-quota.ts src/lib/humanize/stealthgpt-client.ts tests/unit/humanize-panel.test.tsx tests/unit/stealthgpt-client.test.ts
git commit -m "feat: secure and bill auto humanize flow"
```

### Task 15: Replace Admin Mock Data With Real Queries And Manual Actions

**Files:**
- Modify: `src/lib/admin/mock-data.ts`
- Create: `src/lib/admin/repository.ts`
- Modify: `src/components/admin/user-table.tsx`
- Modify: `src/components/admin/task-table.tsx`
- Modify: `src/components/admin/file-table.tsx`
- Modify: `src/components/admin/finance-summary.tsx`
- Modify: `src/components/admin/order-table.tsx`
- Create: `app/api/admin/users/[userId]/adjust-quota/route.ts`
- Create: `app/api/admin/users/[userId]/freeze/route.ts`
- Create: `tests/unit/admin-repository.test.ts`

**Step 1: Write the failing test**

Add tests that assert:

- admin lists are loaded from real repositories
- user freeze/unfreeze endpoints enforce admin role
- manual quota adjustment writes ledger and audit rows

**Step 2: Run tests to verify they fail**

Run: `pnpm test tests/unit/admin-repository.test.ts`
Expected: FAIL because admin pages still rely on mock data and endpoints do not exist.

**Step 3: Write minimal implementation**

Build admin repositories that query Supabase for:

- profiles
- wallet balances
- writing tasks
- outputs
- activation codes
- ledger summaries

Add manual admin actions for:

- adjust quota
- freeze/unfreeze user

Write admin audit rows for each action.

**Step 4: Run tests to verify they pass**

Run: `pnpm test tests/unit/admin-repository.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/admin/mock-data.ts src/lib/admin/repository.ts src/components/admin/user-table.tsx src/components/admin/task-table.tsx src/components/admin/file-table.tsx src/components/admin/finance-summary.tsx src/components/admin/order-table.tsx app/api/admin/users/[userId]/adjust-quota/route.ts app/api/admin/users/[userId]/freeze/route.ts tests/unit/admin-repository.test.ts
git commit -m "feat: back admin console with real data and actions"
```

### Task 16: Add End-To-End Happy Path Coverage And Final Verification

**Files:**
- Modify: `tests/e2e/full-happy-path.spec.ts`
- Modify: `tests/e2e/auth-shell.spec.ts`
- Modify: `docs/runbooks/launch-checklist.md`
- Modify: `README.md`

**Step 1: Write the failing e2e expectation**

Expand the happy-path spec to cover:

- register or login
- see live quota
- redeem activation code
- create a task
- review outline state
- see generated deliverables placeholder or ready state

**Step 2: Run test to verify it fails**

Run: `pnpm test:e2e tests/e2e/full-happy-path.spec.ts`
Expected: FAIL because the integrated flow is not complete yet.

**Step 3: Write minimal implementation or test fixtures**

Add the smallest missing fixtures, seeding helpers, and page hooks needed so the e2e happy path can run against the real app shell without changing the approved UI.

**Step 4: Run the full verification suite**

Run: `pnpm lint`
Expected: PASS

Run: `pnpm test`
Expected: PASS

Run: `pnpm build`
Expected: PASS

Run: `pnpm test:e2e`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/e2e/full-happy-path.spec.ts tests/e2e/auth-shell.spec.ts docs/runbooks/launch-checklist.md README.md
git commit -m "test: cover the pdd production happy path"
```

### Task 17: Archive Or Remove Confusing Legacy Material

**Files:**
- Modify: `.gitignore`
- Create: `docs/runbooks/legacy-artifacts.md`
- Move or archive: `../拼代代-pdd` reference note only, no active development
- Test: none

**Step 1: Confirm the active project boundary**

Record in `docs/runbooks/legacy-artifacts.md` that the legacy Vite folder is a historical source only and must not be used for new implementation work.

**Step 2: Update ignore and workflow notes**

Adjust ignore/workflow notes so local artifacts, exports, and legacy references do not confuse future development.

**Step 3: Verify no code paths still rely on the legacy folder**

Run: `rg -n "拼代代-pdd|react-router-dom|vite" .`
Expected: only historical references remain where intentionally documented.

**Step 4: Commit**

```bash
git add .gitignore docs/runbooks/legacy-artifacts.md
git commit -m "chore: document legacy frontend boundary"
```

Plan complete and saved to `docs/plans/2026-03-03-pdd-production-hardening-implementation.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
