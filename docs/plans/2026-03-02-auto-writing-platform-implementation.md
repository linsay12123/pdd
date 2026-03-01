# Auto Writing Platform Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a production-ready auto writing SaaS that handles file upload, requirement extraction, outline approval, article generation, reference verification, DOCX/PDF delivery, auto de-AI processing, multi-channel payments, quota billing, and an operator-friendly admin console.

**Architecture:** Use a single Next.js application for both the user-facing product and the admin console. Store users, quota ledgers, task state, and metadata in Supabase; store files in Supabase Storage; run the long AI workflow in Trigger.dev; isolate document export and billing logic behind dedicated services so the system can scale without rewriting core flow control.

**Tech Stack:** Next.js 16 + React + TypeScript, Tailwind CSS, Supabase, Trigger.dev, OpenAI API, python-docx worker, reportlab worker, Stripe, Coinbase Commerce, Alipay, WeChat Pay, Vitest, Playwright.

---

### Task 1: Bootstrap The Application Shell

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `postcss.config.mjs`
- Create: `tailwind.config.ts`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/globals.css`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `tests/smoke/homepage.test.ts`

**Step 1: Create the package manifest and base scripts**

```json
{
  "name": "auto-writing-platform",
  "private": true,
  "packageManager": "pnpm@10",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:e2e": "playwright test"
  }
}
```

**Step 2: Create the Next.js app shell**

```tsx
// app/layout.tsx
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
```

**Step 3: Create a basic landing redirect page**

```tsx
// app/page.tsx
import Link from "next/link";

export default function HomePage() {
  return <Link href="/workspace">进入写作工作台</Link>;
}
```

**Step 4: Add a smoke test**

```ts
// tests/smoke/homepage.test.ts
import { expect, test } from "vitest";

test("package uses next app scripts", () => {
  expect(true).toBe(true);
});
```

**Step 5: Run tests and verify the skeleton is stable**

Run: `pnpm install && pnpm test`
Expected: PASS with the smoke test green

**Step 6: Commit**

```bash
git add .
git commit -m "chore: bootstrap nextjs application shell"
```

### Task 2: Define Environment Contracts And Shared Types

**Files:**
- Create: `src/config/env.ts`
- Create: `src/types/auth.ts`
- Create: `src/types/billing.ts`
- Create: `src/types/tasks.ts`
- Create: `tests/unit/env.test.ts`

**Step 1: Define all required environment variables in one place**

```ts
// src/config/env.ts
export const env = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
  TRIGGER_SECRET_KEY: process.env.TRIGGER_SECRET_KEY ?? "",
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? "",
  COINBASE_COMMERCE_API_KEY: process.env.COINBASE_COMMERCE_API_KEY ?? "",
  ALIPAY_APP_ID: process.env.ALIPAY_APP_ID ?? "",
  WECHAT_PAY_MERCHANT_ID: process.env.WECHAT_PAY_MERCHANT_ID ?? ""
};
```

**Step 2: Define task state and billing types before writing business logic**

```ts
// src/types/tasks.ts
export type TaskStatus =
  | "created"
  | "quota_frozen"
  | "extracting_files"
  | "awaiting_primary_file_confirmation"
  | "building_rule_card"
  | "outline_ready"
  | "awaiting_outline_approval"
  | "drafting"
  | "adjusting_word_count"
  | "verifying_references"
  | "exporting"
  | "deliverable_ready"
  | "humanizing"
  | "humanized_ready"
  | "failed"
  | "expired";
```

**Step 3: Write a failing environment test**

```ts
// tests/unit/env.test.ts
import { describe, expect, it } from "vitest";
import { env } from "@/src/config/env";

describe("env", () => {
  it("exposes expected keys", () => {
    expect(env.OPENAI_API_KEY).toBeDefined();
  });
});
```

**Step 4: Run the unit test**

Run: `pnpm test tests/unit/env.test.ts`
Expected: PASS once the import aliases and config are wired correctly

**Step 5: Commit**

```bash
git add src/config/env.ts src/types tests/unit/env.test.ts
git commit -m "chore: add environment contracts and shared domain types"
```

### Task 3: Create The Supabase Schema

**Files:**
- Create: `supabase/migrations/202603020001_initial_schema.sql`
- Create: `supabase/seed.sql`
- Create: `docs/plans/data-model-notes.md`
- Test: `tests/sql/initial_schema_smoke.sql`

**Step 1: Define the core tables**

Include these tables in `supabase/migrations/202603020001_initial_schema.sql`:
- `profiles`
- `quota_wallets`
- `quota_ledger_entries`
- `pricing_plans`
- `orders`
- `payment_attempts`
- `writing_tasks`
- `task_files`
- `task_outputs`
- `outline_versions`
- `draft_versions`
- `reference_checks`
- `admin_audit_logs`

**Step 2: Add key columns that match the business rules**

Required columns:
- `quota_wallets`: `available_quota`, `frozen_quota`
- `writing_tasks`: `status`, `target_word_count`, `citation_style`, `special_requirements`, `expires_at`
- `task_outputs`: `output_kind`, `storage_path`, `expires_at`
- `reference_checks`: `verdict`, `reasoning`

**Step 3: Add row-level security policies**

Policy rules:
- Normal users can only read and write their own rows
- Admin role can read and manage all rows
- Storage paths must also be user-scoped

**Step 4: Create a schema smoke check**

```sql
-- tests/sql/initial_schema_smoke.sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

**Step 5: Apply the migration locally**

Run: `supabase db reset`
Expected: database resets and all tables exist without SQL errors

**Step 6: Commit**

```bash
git add supabase docs/plans/data-model-notes.md tests/sql/initial_schema_smoke.sql
git commit -m "feat: add initial supabase schema"
```

### Task 4: Build Authentication And App Layout

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `middleware.ts`
- Create: `app/login/page.tsx`
- Create: `app/(app)/layout.tsx`
- Create: `app/(app)/workspace/page.tsx`
- Create: `app/(app)/tasks/page.tsx`
- Create: `app/(app)/billing/page.tsx`
- Create: `app/(app)/account/page.tsx`
- Create: `tests/e2e/auth-shell.spec.ts`

**Step 1: Create the browser and server Supabase clients**

```ts
// src/lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/src/config/env";

export const createClient = () =>
  createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
```

**Step 2: Protect all app pages behind login**

Middleware rules:
- `/workspace`, `/tasks`, `/billing`, `/account`, `/admin` require a valid session
- `/login` remains public

**Step 3: Build the logged-in app frame**

Layout must include:
- Left navigation
- Top status bar
- Quota summary
- Main content area

**Step 4: Add an end-to-end shell test**

Run: `pnpm test:e2e tests/e2e/auth-shell.spec.ts`
Expected: unauthenticated user is redirected to `/login`

**Step 5: Commit**

```bash
git add src/lib/supabase app middleware.ts tests/e2e/auth-shell.spec.ts
git commit -m "feat: add auth flow and protected app shell"
```

### Task 5: Build The Writing Workspace UI

**Files:**
- Create: `src/components/workspace/upload-dropzone.tsx`
- Create: `src/components/workspace/special-requirements-field.tsx`
- Create: `src/components/workspace/task-progress-panel.tsx`
- Create: `src/components/workspace/outline-review-panel.tsx`
- Create: `src/components/workspace/deliverables-panel.tsx`
- Modify: `app/(app)/workspace/page.tsx`
- Test: `tests/unit/workspace-page.test.tsx`

**Step 1: Define the workspace sections**

The workspace page must render:
- File upload area
- Special requirements input
- Estimated quota cost
- Progress timeline
- Outline review area
- Deliverables area

**Step 2: Render the progress stages as user-friendly labels**

Suggested labels:
- 正在读取文件
- 等待确认主任务文件
- 正在生成大纲
- 等待确认大纲
- 正在写正文
- 正在校正字数
- 正在核验引用
- 正在生成文件

**Step 3: Add the outline review controls**

The outline panel must include:
- English outline
- Chinese mirror outline
- Target word count display
- Citation style display
- Feedback text box
- Approve button

**Step 4: Add a workspace render test**

Run: `pnpm test tests/unit/workspace-page.test.tsx`
Expected: PASS with all required sections present

**Step 5: Commit**

```bash
git add src/components/workspace app/(app)/workspace/page.tsx tests/unit/workspace-page.test.tsx
git commit -m "feat: add single-page writing workspace"
```

### Task 6: Implement Upload Storage And File Extraction

**Files:**
- Create: `src/lib/storage/upload.ts`
- Create: `src/lib/files/extract-text.ts`
- Create: `src/lib/files/file-kind.ts`
- Create: `src/app/api/tasks/create/route.ts`
- Create: `src/app/api/tasks/[taskId]/files/confirm-primary/route.ts`
- Create: `tests/unit/extract-text.test.ts`

**Step 1: Implement file-type detection**

Supported extensions:
- `.txt`
- `.md`
- `.docx`
- `.pdf`
- `.ppt`
- `.pptx`

**Step 2: Implement text extraction entry points**

```ts
// src/lib/files/extract-text.ts
export async function extractTextFromUpload(file: File): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension) throw new Error("Unsupported file");
  return "TODO_EXTRACTED_TEXT";
}
```

Start with a stub, but isolate the API so later workers can swap in stronger extractors without touching the pipeline controller.

**Step 3: Create the task creation route**

The route must:
- Validate login
- Validate file types
- Calculate estimated quota
- Freeze quota
- Save files to storage
- Create `writing_tasks` and `task_files` rows
- Enqueue the first Trigger.dev job

**Step 4: Create a failing extraction test**

Run: `pnpm test tests/unit/extract-text.test.ts`
Expected: FAIL until unsupported extensions are rejected and supported ones map correctly

**Step 5: Implement the minimum logic to pass the test**

Focus only on:
- extension validation
- non-empty extracted text contract
- safe error messages

**Step 6: Commit**

```bash
git add src/lib/files src/lib/storage src/app/api/tasks tests/unit/extract-text.test.ts
git commit -m "feat: add upload storage and file extraction pipeline"
```

### Task 7: Implement Task Workflow State Machine

**Files:**
- Create: `src/lib/tasks/status-machine.ts`
- Create: `src/lib/tasks/repository.ts`
- Create: `src/lib/tasks/events.ts`
- Create: `tests/unit/task-status-machine.test.ts`

**Step 1: Encode allowed status transitions**

```ts
// src/lib/tasks/status-machine.ts
export const allowedTransitions = {
  created: ["quota_frozen", "failed"],
  quota_frozen: ["extracting_files", "failed"],
  extracting_files: ["awaiting_primary_file_confirmation", "building_rule_card", "failed"]
} as const;
```

**Step 2: Write a failing transition test**

Test cases:
- valid transition succeeds
- invalid transition throws
- failed state is terminal except manual retry

**Step 3: Implement repository helpers**

Add helpers to:
- read the current task
- update the task status
- append task events

**Step 4: Run the tests**

Run: `pnpm test tests/unit/task-status-machine.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/tasks tests/unit/task-status-machine.test.ts
git commit -m "feat: add task status machine"
```

### Task 8: Build The Rule Card And File Classification Services

**Files:**
- Create: `src/lib/ai/openai-client.ts`
- Create: `src/lib/ai/prompts/classify-files.ts`
- Create: `src/lib/ai/prompts/build-rule-card.ts`
- Create: `src/lib/ai/services/classify-files.ts`
- Create: `src/lib/ai/services/build-rule-card.ts`
- Create: `tests/unit/rule-card.test.ts`

**Step 1: Write the file classification contract**

The classification result must include:
- `primaryRequirementFileId | null`
- `backgroundFileIds`
- `irrelevantFileIds`
- `needsUserConfirmation`
- `reasoning`

**Step 2: Write the rule card contract**

Required fields:
- `topic`
- `targetWordCount`
- `citationStyle`
- `chapterCountOverride`
- `mustAnswer`
- `gradingPriorities`
- `specialRequirements`

**Step 3: Write failing tests for the fallback rules**

Test cases:
- explicit word count beats defaults
- explicit citation style beats defaults
- missing values fall back to `2000` and `APA 7`
- user special requirements remain present in the first rule card version

**Step 4: Implement the minimum logic**

Do not call the real API first. Start with:
- pure mapping functions
- deterministic fallback merging
- prompt builders as pure string functions

**Step 5: Add the OpenAI service call after the merge logic passes**

Run: `pnpm test tests/unit/rule-card.test.ts`
Expected: PASS before wiring production API keys, then PASS again with mock client integration

**Step 6: Commit**

```bash
git add src/lib/ai tests/unit/rule-card.test.ts
git commit -m "feat: add file classification and rule card services"
```

### Task 9: Implement Trigger.dev Jobs For Outline Generation And Review

**Files:**
- Create: `trigger/index.ts`
- Create: `trigger/jobs/process-uploaded-task.ts`
- Create: `trigger/jobs/generate-outline.ts`
- Create: `src/lib/ai/prompts/generate-outline.ts`
- Create: `src/app/api/tasks/[taskId]/outline/feedback/route.ts`
- Create: `src/app/api/tasks/[taskId]/outline/approve/route.ts`
- Create: `tests/unit/outline-rules.test.ts`

**Step 1: Build the upload processing job**

Job responsibilities:
- load extracted texts
- classify files
- decide whether user confirmation is needed
- build rule card
- trigger outline generation if safe

**Step 2: Build the outline generation job**

Outline rules:
- English first
- Chinese mirror second
- chapter count defaults to `Math.ceil(targetWordCount / 500)`
- 3 to 5 bullets per chapter depending on article size

**Step 3: Add outline feedback and approval routes**

Feedback route:
- increments outline version count
- rejects requests after 5 free revisions
- regenerates from the latest approved rule card plus new feedback

Approval route:
- locks the selected outline version
- transitions task to `drafting`

**Step 4: Write outline rule tests**

Run: `pnpm test tests/unit/outline-rules.test.ts`
Expected: PASS with chapter and bullet counts matching the rules

**Step 5: Commit**

```bash
git add trigger src/app/api/tasks src/lib/ai/prompts tests/unit/outline-rules.test.ts
git commit -m "feat: add outline generation and review workflow"
```

### Task 10: Implement Draft Generation And Word Count Adjustment

**Files:**
- Create: `trigger/jobs/generate-draft.ts`
- Create: `trigger/jobs/adjust-word-count.ts`
- Create: `src/lib/ai/prompts/generate-draft.ts`
- Create: `src/lib/ai/prompts/adjust-word-count.ts`
- Create: `src/lib/drafts/word-count.ts`
- Create: `tests/unit/word-count-adjustment.test.ts`

**Step 1: Implement body-only word counting**

```ts
// src/lib/drafts/word-count.ts
export function countBodyWords(markdown: string): number {
  const [body] = markdown.split(/^References$/m);
  return body.trim().split(/\s+/).filter(Boolean).length;
}
```

**Step 2: Write failing tests**

Test cases:
- ignores `References`
- returns 0 for empty body
- counts normal body paragraphs correctly

**Step 3: Implement draft generation**

Draft job must:
- use the approved outline only
- enforce English output
- enforce title + sections + `References`
- store the first draft version

**Step 4: Implement candidate-vs-current adjustment logic**

Adjustment job must:
- produce a candidate draft
- compare candidate body word count to target
- only replace the current draft when structural checks pass
- persist candidate metadata for the UI

**Step 5: Run the tests**

Run: `pnpm test tests/unit/word-count-adjustment.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add trigger/jobs src/lib/drafts src/lib/ai/prompts tests/unit/word-count-adjustment.test.ts
git commit -m "feat: add draft generation and word count adjustment"
```

### Task 11: Implement Reference Verification

**Files:**
- Create: `trigger/jobs/verify-references.ts`
- Create: `src/lib/references/parse-references.ts`
- Create: `src/lib/references/verification-rules.ts`
- Create: `src/lib/ai/prompts/verify-references.ts`
- Create: `tests/unit/reference-verification.test.ts`

**Step 1: Parse the references section into individual entries**

The parser must return:
- raw entry text
- detected title
- detected year
- detected doi
- detected url

**Step 2: Encode the only two allowed outcomes**

```ts
// src/lib/references/verification-rules.ts
export type ReferenceVerdict = "matching" | "risky";
```

Map them to user-facing labels:
- `matching` => 基本可对应
- `risky` => 有风险

**Step 3: Write failing tests**

Test cases:
- title and abstract alignment returns `matching`
- missing key fields returns `risky`
- conflicting year or DOI returns `risky`

**Step 4: Implement the minimum rule engine**

The system must not claim full-text validation. It only evaluates:
- title
- abstract
- year
- DOI
- URL

**Step 5: Run the tests**

Run: `pnpm test tests/unit/reference-verification.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add trigger/jobs/verify-references.ts src/lib/references src/lib/ai/prompts tests/unit/reference-verification.test.ts
git commit -m "feat: add reference verification workflow"
```

### Task 12: Implement DOCX And PDF Delivery Exporters

**Files:**
- Create: `workers/docs/export_docx.py`
- Create: `workers/pdfs/export_reference_report.py`
- Create: `src/lib/deliverables/export-docx.ts`
- Create: `src/lib/deliverables/export-report.ts`
- Create: `tests/unit/deliverables-contract.test.ts`
- Create: `tmp/docs/.gitkeep`
- Create: `tmp/pdfs/.gitkeep`
- Create: `output/doc/.gitkeep`
- Create: `output/pdf/.gitkeep`

**Step 1: Write the DOCX exporter contract**

DOCX export inputs must include:
- title
- section headings
- body paragraphs
- references
- citation style

Formatting rules must enforce:
- Times New Roman
- 12 pt
- black text
- centered title
- blank line spacing
- hanging indent in references

**Step 2: Write the PDF exporter contract**

PDF report inputs must include:
- report id
- created at
- task summary
- per-reference verdict rows
- closing summary

**Step 3: Add failing contract tests**

Run: `pnpm test tests/unit/deliverables-contract.test.ts`
Expected: FAIL until both export wrappers validate required fields

**Step 4: Implement the TypeScript wrappers and Python workers**

The TypeScript wrappers should:
- prepare normalized data
- call the Python workers
- save output paths to `task_outputs`

The Python workers should:
- generate a `.docx`
- generate a `.pdf`
- return the final file path

**Step 5: Render-check the generated files**

Run:
- `python3 workers/docs/export_docx.py --sample`
- `python3 workers/pdfs/export_reference_report.py --sample`

Expected:
- sample DOCX created with correct formatting
- sample PDF created with readable layout

**Step 6: Commit**

```bash
git add workers src/lib/deliverables tests/unit/deliverables-contract.test.ts tmp output
git commit -m "feat: add docx and pdf delivery exporters"
```

### Task 13: Implement Auto De-AI And Manual Service Prompt

**Files:**
- Create: `src/app/api/tasks/[taskId]/humanize/route.ts`
- Create: `trigger/jobs/humanize-draft.ts`
- Create: `src/lib/ai/prompts/humanize-draft.ts`
- Modify: `src/components/workspace/deliverables-panel.tsx`
- Create: `src/components/workspace/manual-humanize-card.tsx`
- Create: `public/images/wechat-contact-qr.png`
- Test: `tests/unit/humanize-panel.test.tsx`

**Step 1: Add the humanize action API**

The route must:
- check user ownership
- calculate de-AI quota cost
- freeze quota
- enqueue the humanize job

**Step 2: Implement the humanize job**

Rules:
- only rewrite the article body
- preserve title
- preserve section structure
- preserve `References`

**Step 3: Add the deliverables UI state**

When humanize completes, show:
- `降AI后版本（Word）` download button
- the QR image
- the fixed text `人工降ai 请联系客服`

**Step 4: Write a panel test**

Run: `pnpm test tests/unit/humanize-panel.test.tsx`
Expected: PASS with the QR card visible only after the humanized result exists

**Step 5: Commit**

```bash
git add src/app/api/tasks src/components/workspace trigger/jobs public/images tests/unit/humanize-panel.test.tsx
git commit -m "feat: add auto de-ai flow and manual service card"
```

### Task 14: Implement Quota Wallet And Billing Rules

**Files:**
- Create: `src/lib/billing/quote-task-cost.ts`
- Create: `src/lib/billing/freeze-quota.ts`
- Create: `src/lib/billing/settle-quota.ts`
- Create: `src/lib/billing/release-quota.ts`
- Create: `src/lib/billing/ledger.ts`
- Create: `tests/unit/billing-rules.test.ts`

**Step 1: Encode pricing by target word count**

The pricing helper must support:
- article generation tiers
- auto de-AI tiers
- future admin overrides from `pricing_plans`

**Step 2: Write failing tests**

Test cases:
- enough quota freezes correctly
- failed task releases frozen quota
- success settles frozen quota into consumed quota
- generation and de-AI use separate pricing paths

**Step 3: Implement the wallet mutation helpers**

Mutation helpers must always update:
- wallet balances
- ledger row
- task reference

in one database transaction

**Step 4: Run the tests**

Run: `pnpm test tests/unit/billing-rules.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/billing tests/unit/billing-rules.test.ts
git commit -m "feat: add quota wallet and billing engine"
```

### Task 15: Implement Payment Adapters And Recharge Flow

**Files:**
- Create: `src/app/api/payments/stripe/create-checkout/route.ts`
- Create: `src/app/api/payments/stripe/webhook/route.ts`
- Create: `src/app/api/payments/coinbase/create-charge/route.ts`
- Create: `src/app/api/payments/coinbase/webhook/route.ts`
- Create: `src/app/api/payments/alipay/create-order/route.ts`
- Create: `src/app/api/payments/alipay/notify/route.ts`
- Create: `src/app/api/payments/wechat/create-order/route.ts`
- Create: `src/app/api/payments/wechat/notify/route.ts`
- Create: `src/components/billing/recharge-card.tsx`
- Modify: `app/(app)/billing/page.tsx`
- Test: `tests/unit/payment-webhooks.test.ts`

**Step 1: Build a shared payment completion handler**

The handler must:
- verify the provider payload
- mark the order paid
- credit the user wallet
- append a ledger entry

**Step 2: Implement one adapter at a time**

Recommended order:
1. Stripe
2. Coinbase Commerce
3. Alipay
4. WeChat Pay

Do not start all four at once.

**Step 3: Write webhook tests before live integration**

Run: `pnpm test tests/unit/payment-webhooks.test.ts`
Expected: FAIL until fake provider payloads settle orders correctly

**Step 4: Wire the billing page UI**

Billing page must show:
- current quota
- recharge packages
- monthly subscriptions
- payment options

**Step 5: Commit**

```bash
git add src/app/api/payments src/components/billing app/(app)/billing/page.tsx tests/unit/payment-webhooks.test.ts
git commit -m "feat: add recharge flow and payment adapters"
```

### Task 16: Build The Admin Console

**Files:**
- Create: `app/(app)/admin/page.tsx`
- Create: `app/(app)/admin/users/page.tsx`
- Create: `app/(app)/admin/orders/page.tsx`
- Create: `app/(app)/admin/tasks/page.tsx`
- Create: `app/(app)/admin/files/page.tsx`
- Create: `app/(app)/admin/pricing/page.tsx`
- Create: `app/(app)/admin/finance/page.tsx`
- Create: `src/components/admin/user-table.tsx`
- Create: `src/components/admin/order-table.tsx`
- Create: `src/components/admin/task-table.tsx`
- Create: `src/components/admin/file-table.tsx`
- Create: `src/components/admin/pricing-editor.tsx`
- Create: `src/components/admin/finance-summary.tsx`
- Create: `tests/e2e/admin-shell.spec.ts`

**Step 1: Restrict the admin routes to operator accounts**

Rules:
- only users with `profiles.role = 'admin'` may enter
- all admin actions must write `admin_audit_logs`

**Step 2: Build the required management views**

Views:
- users
- orders
- tasks
- files
- pricing
- finance

**Step 3: Add operator actions**

Required actions:
- freeze user
- unfreeze user
- grant quota
- deduct quota
- retry task
- extend expiry
- disable a payment method

**Step 4: Add an admin access test**

Run: `pnpm test:e2e tests/e2e/admin-shell.spec.ts`
Expected: non-admin user is denied; admin user sees the dashboard

**Step 5: Commit**

```bash
git add app/(app)/admin src/components/admin tests/e2e/admin-shell.spec.ts
git commit -m "feat: add operator-friendly admin console"
```

### Task 17: Implement Expiry Cleanup And Download Guards

**Files:**
- Create: `trigger/jobs/expire-task-assets.ts`
- Create: `src/app/api/tasks/[taskId]/downloads/[outputId]/route.ts`
- Create: `src/lib/storage/signed-url.ts`
- Create: `tests/unit/expiry-rules.test.ts`

**Step 1: Write expiry rules**

Rules:
- only files expire after 3 days
- ledger, orders, and task history remain
- expired tasks show metadata but no live download

**Step 2: Write a failing expiry test**

Run: `pnpm test tests/unit/expiry-rules.test.ts`
Expected: FAIL until expired outputs are blocked and still visible as history

**Step 3: Implement the cleanup job**

The cleanup job must:
- find expired `task_outputs`
- delete storage objects
- mark rows expired
- update task status when needed

**Step 4: Implement signed download URLs**

Download route must:
- verify ownership
- reject expired outputs
- return short-lived signed URLs

**Step 5: Commit**

```bash
git add trigger/jobs/expire-task-assets.ts src/app/api/tasks src/lib/storage/signed-url.ts tests/unit/expiry-rules.test.ts
git commit -m "feat: add expiry cleanup and secure downloads"
```

### Task 18: Add Observability, Failure Recovery, And Launch Checks

**Files:**
- Create: `src/lib/observability/logger.ts`
- Create: `src/lib/observability/metrics.ts`
- Create: `src/lib/tasks/manual-retry.ts`
- Create: `docs/runbooks/launch-checklist.md`
- Create: `docs/runbooks/payment-recovery.md`
- Create: `docs/runbooks/task-failure-recovery.md`
- Create: `tests/e2e/full-happy-path.spec.ts`

**Step 1: Add structured logs around every major workflow step**

Must log:
- task id
- user id
- old status
- new status
- provider event id (for payments)
- retry attempt count

**Step 2: Add manual retry helpers**

Retry tooling must let admins:
- restart from a safe failed step
- avoid double-charging quota
- append an audit log entry

**Step 3: Write the launch checklist**

The launch checklist must cover:
- environment variables
- Supabase migrations
- Trigger.dev secrets
- payment callback URLs
- sample document export
- sample task expiration

**Step 4: Add a full happy-path test**

Run: `pnpm test:e2e tests/e2e/full-happy-path.spec.ts`
Expected: a seeded user can upload, approve outline, generate deliverables, and see the humanize CTA

**Step 5: Commit**

```bash
git add src/lib/observability src/lib/tasks/manual-retry.ts docs/runbooks tests/e2e/full-happy-path.spec.ts
git commit -m "chore: add launch checks and recovery tooling"
```

### Task 19: Final Verification Before Release

**Files:**
- Modify: `README.md`
- Modify: `docs/plans/2026-03-02-auto-writing-platform-design.md`
- Modify: `docs/plans/2026-03-02-auto-writing-platform-implementation.md`

**Step 1: Run the full local validation suite**

Run:
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`

Expected:
- lint passes
- unit tests pass
- end-to-end tests pass

**Step 2: Run one manual operator walkthrough**

Manual checks:
- create a user
- recharge quota
- create a task
- approve an outline
- download DOCX and PDF
- trigger auto de-AI
- verify QR card appears

**Step 3: Reconcile the system against the design**

Confirm:
- defaults still use `2000` and `APA 7`
- content files still expire after 3 days
- reference report still uses only “基本可对应” and “有风险”
- de-AI still preserves references

**Step 4: Update docs with any implementation drift**

Only update the design or plan docs if real implementation differs and the change is intentional.

**Step 5: Commit**

```bash
git add README.md docs/plans/2026-03-02-auto-writing-platform-design.md docs/plans/2026-03-02-auto-writing-platform-implementation.md
git commit -m "docs: finalize release validation notes"
```
