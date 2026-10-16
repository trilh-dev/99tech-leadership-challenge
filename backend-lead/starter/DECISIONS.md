# DECISIONS.md

## AI Disclosure
Claude Sonnet was used to accelerate initial scaffolding and review idempotency logic. Every design decision below is my own and I can defend each one.

---

## Schema choices

### `funding_txs` (single table for deposits and withdrawals)
Both deposits and withdrawals are funding events with a state machine. A single table with a `type` discriminator avoids the fan-out problem when querying a member's full funding history. The `psp_ref` column is NULL for withdrawals (no PSP involved at creation time).

### Turnover on `wallets` (denormalized)
`turnover_required` and `turnover_accrued` are stored on the wallet row rather than recomputed from ledger entries. Trade-off: a single locked row update is cheaper than an aggregate query under concurrent load, and the invariant (accrued ≤ required until lock lifted) is enforced atomically at the point of change. Downside: if we ever replay the ledger to reconstruct wallet state, we also need these two fields in the replay logic.

### `wallet_txs` (append-only ledger)
No `updated_at` — rows are written once and never modified. This is intentional: the ledger is the source of truth for auditing. The wallet `balance` is a cached materialized value reconstructible from `wallet_txs`.

### `wagers` table
A separate table for wager records (not reusing `bets` from the challenge description's schema) because this service doesn't own game results — it owns wallet debits. The `wagers` table records what was debited and how much turnover was accrued; a game engine table with `payout` is a separate concern.

---

## Locking strategy

### PSP callback idempotency (`SELECT FOR UPDATE` on `funding_txs`)
Concurrent callbacks for the same `psp_ref` will both acquire the same row lock. The second one blocks until the first commits, then reads the updated status (`Completed` or `Failed`) and returns `already_processed`. This is the minimal correct approach: a unique constraint on `psp_ref` alone would cause one of the concurrent callbacks to throw a constraint error rather than returning a clean idempotency response.

Alternative considered: optimistic locking (version column + retry on conflict). Rejected because: (a) callback retry storms are exactly when optimistic locks are worst, and (b) the lock window here is tiny (two small updates), so contention is not a concern.

### Wager concurrency (`SELECT FOR UPDATE` on `wallets`)
Concurrent wager requests for the same wallet both lock the same row. The second request sees the updated balance after the first commits, and either succeeds or returns `insufficient balance`. This prevents overdraw without any application-level retry.

### Isolation level: `READ_COMMITTED`
Sufficient for our pattern. We always acquire row locks before reading the values we care about, so non-repeatable read is not a risk.

---

## PSP callback amount mismatch
If the callback `amount` differs from the deposit `amount`, we **use the deposit amount** (the value we agreed with the member at deposit time) and log a warning. Rationale: the authoritative amount for the member's wallet is what they were promised, not what the PSP claims retroactively. In production this would also trigger an alert and a reconciliation workflow.

Alternative: reject the deposit (fail the transaction) if amounts differ. This is stricter but could unfairly block legitimate deposits where a PSP rounds amounts. Current behavior is documented and auditable via the ledger.

---

## What I'd do with more time

1. **Webhook signature verification** — real PSPs send an HMAC signature header. The PSP adapter layer (see DESIGN-PSP.md) is where verification belongs.
2. **Withdrawal approval flow** — the spec says "assume a human approves it later". I'd add a `POST /withdrawals/:id/approve` endpoint and a `PSP callback` path for withdrawals symmetrical to deposits.
3. **Idempotency keys on deposit creation** — clients should be able to retry `POST /deposits` safely. Add a client-supplied idempotency key with a unique constraint.
4. **Read replica for balance queries** — the `GET /members/:id/wallet` path hits the primary. For high-read scenarios, route balance reads to a replica.
5. **Dead-letter for failed callbacks** — unknown `psp_ref` could mean the callback arrived before the deposit row was committed (race at creation time). A short retry queue would handle this edge case.
6. **Migration for existing wallets** — the `turnover_required/accrued` columns default to 0, so existing wallets are grandfathered in as turnover-satisfied. In a real migration this needs a backfill decision.
