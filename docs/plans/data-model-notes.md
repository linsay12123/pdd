# Data Model Notes

## Core split: content vs billing

- Writing content is short-lived and should expire after 3 days.
- Billing and operational records are long-lived and must remain for audit and support work.

## Wallet design

The wallet uses three balances:

- `recharge_quota`: user-paid balance that never resets automatically
- `subscription_quota`: monthly subscription balance that resets each cycle
- `frozen_quota`: temporarily held quota while a task or de-AI job is running

This split prevents monthly subscription resets from accidentally deleting paid recharge balance.

## Task records

`writing_tasks` is the central record for a writing job.

It links to:

- uploaded files
- outline versions
- draft versions
- final outputs
- reference checks

## Output records

`task_outputs` keeps only metadata and storage paths.

Actual files live in storage and are removed after expiry, but the row remains so the UI can show that a task existed and has expired.

## Subscription follow-up

Subscriptions are intentionally not in the initial schema.

They will be added in the dedicated follow-up migration so the base schema stays aligned with the current implementation order.
