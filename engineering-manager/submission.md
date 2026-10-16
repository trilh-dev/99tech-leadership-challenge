# Engineering Manager Challenge – Submission

**Candidate:** Le Huu Tri  
**Date:** 2026-10-16

---

## Part A – 90-Day Plan

### 1. Diagnosis: Root Patterns

The incidents and delivery slippage share three underlying causes, not six separate problems:

**a) Knowledge concentration is the systemic risk.**  
S. is the single point of truth for the wallet engine. T. is the single point of truth for the data pipeline. Two incidents (#10–11) trace directly to T.'s absence; incidents #3, #5–9 (payment-adjacent code that passed review) trace to S. approving code he understands but others cannot safely maintain. This is not a personality issue — it's an org design failure: critical systems have no second owner.

**b) No quality gate before production.**  
There is no incident process, no post-mortems (region-3 launch), no release checklist, and no definition of "done" that includes safety properties. QA reviews late because that's the only gate. The result: float arithmetic (#4), missing idempotency (#1), and config copy-paste (#3) all reached prod. These are not hard bugs to catch — they are bugs that a checklist would have caught before merge.

**c) The org is not wired for a regulated product.**  
On a money-correct platform, correctness properties (idempotency, atomicity, decimal handling) should be first-class review criteria. They are not. S. approved code (see PR #482 review below) with money-correctness failures. "LGTM, nice and simple" is a software-startup approval culture on financial infrastructure.

The open headcount and QA bottleneck are symptoms. The delivery slippage is a symptom. The pattern is: **no redundancy, no safety gate, wrong review culture for the domain.**

---

### 2. Priorities and Trade-offs

**This quarter's non-negotiables from the CEO:** region 4 in 10 weeks, zero money-impacting incidents.

These two goals are in tension. I cannot run a full process overhaul while launching a new region. Here is my ordering:

| # | Priority | Rationale |
|---|---|---|
| 1 | Fix the one structural risk that can kill both goals at once | S. being hit by a bus stops region 4. Fix knowledge concentration on the wallet engine first, this week. |
| 2 | Install one lightweight safety gate on payment-adjacent merges | Stops the incident bleeding without slowing delivery. |
| 3 | Drive region 4 launch | This is the business priority. Org improvement runs in parallel, not before. |
| 4 | Address QA bottleneck | Unlock velocity after region 4 ships. |

**What I explicitly do NOT do this quarter:**
- Full process overhaul for all squads — I target payment-adjacent code only
- Hire and onboard two senior BEs — pipeline too long to impact Q4
- Post-mortems on the 11 past incidents — looking backward costs time; I extract only what's needed for the safety gate
- Performance management on S. — the review culture fix comes through structure, not confrontation this quarter
- Rebuild delivery metrics infrastructure — I use one proxy metric (deploy frequency) until I have a proper baseline

---

### 3. Process Changes (Three, Concrete)

**P1 — Payment-safe merge checklist (week 1)**  
_Problem it attacks:_ Incidents #1, #4, #5–9 — money bugs passing review.  
_What it is:_ A four-item checklist in the PR template for the `Payments & Platform` squad only: (a) decimal arithmetic uses approved library, not native floats; (b) idempotency guard named for every external callback; (c) state machine transitions are explicit and invalid ones are rejected; (d) any balance mutation runs in a single DB transaction.  
_How I know it's working:_ Zero money-impacting incidents in 30 days; review comments referencing checklist items appear in PRs.

**P2 — On-call rotation with a backup (week 2)**  
_Problem it attacks:_ Incidents #10–11 (T. on leave), and the implicit risk that S. being unavailable stops production fixes.  
_What it is:_ Each system (wallet engine, data pipeline) must have a primary owner and a designated backup who has shadowed at least two incidents or done one pair-session on the code. I assign D. as S.'s backup on the wallet engine; S. owns the knowledge transfer (one 2h pairing session per week for four weeks). T. gets a backup from the CRM squad within two weeks.  
_How I know it's working:_ The next incident or on-call rotation is handled without the primary being paged.

**P3 — Region 4 launch checklist derived from region 3 failure (week 1)**  
_Problem it attacks:_ Incident #3 (wrong credentials copy-paste caused 6h outage).  
_What it is:_ A single-page runbook for new region launches: config variables are environment-specific and reviewed by a second engineer before go-live; smoke tests run against the new region's PSP in staging before the launch window opens. Not a general process framework — just the three things that went wrong in region 3.  
_How I know it's working:_ Region 4 goes live without a launch-day outage.

---

### 4. Metrics

**M1 — Money-impacting incidents per month** (target: 0)  
The board saw incident #1. This is the metric the CEO cares about. Everything else is secondary. I track it weekly.

**M2 — Wallet engine incident handled without S. present** (leading indicator)  
Measuring knowledge-redundancy progress. First time D. or another engineer handles a wallet incident independently is the milestone. Binary, not a chart.

**M3 — Deploy frequency for Payments squad** (target: back to weekly within 8 weeks)  
A proxy for "is the safety gate adding friction?" If frequency drops further after P1, the checklist is too heavy. If it stays weekly, we have safety without slowdown.

I deliberately do not track: story points, sprint burndown, bug backlog absolute count. Burndown nobody trusts (#handover) is worse than no metric. I will establish baselines before committing to trend targets.

---

### 5. People

**S. (staff, wallet engine):**  
S. is the most valuable and the highest risk person on the roster simultaneously. He does not have a people problem — he has never been asked to develop one because no one needed him to until now. My ask of him this quarter is specific: pair with D. on the wallet engine for 2h/week; I will frame this as "making sure you're not the only one who can be paged at 2am," not as a performance issue. I protect his deep-work time; I do not put him in sync-heavy ceremonies.

**D. (mid, Payments):**  
D. needs scope expansion. I give D. ownership of a wallet-adjacent module (e.g., the callback idempotency layer) with explicit success criteria. This grows D.'s authority and reduces the bus-factor on S. simultaneously.

**T. (tech lead, CRM & Data):**  
T. is stretched and knows it. I have an explicit conversation in week 1: what would unblocking feel like? I look at the pipeline backlog for work I can defer or reassign. T. also needs a backup trained before going on leave again — this is P2 above.

**L. (web/backoffice lead):**  
L. is the org's best people-manager and is already mentoring cross-squad. I lean on L. for feedback on team morale — L. sees things I won't see as the new EM. I protect L.'s capacity; L. is not the person I pull for region 4 heroics.

**The three juniors in Payments:**  
Not the right people to be touching payment-adjacent code unsupervised right now. I ensure every PR they open has a second reviewer who is not S. (to avoid the "makes juniors cry" dynamic) — D. is the right reviewer for this.

**Two open BE headcount:**  
I will not fill them this quarter if filling them means hiring mid-level BEs without domain context. I will open one senior BE role spec for someone with fintech/payments experience and be honest internally that onboarding takes 6–8 weeks, so they will not impact region 4. If region 4 is in 10 weeks, the hire impacts Q1 next year. I do not hire to fill a number.

**QA bottleneck:**  
Two QA for 20 engineers is structurally broken. Short-term fix: shift some E2E coverage to the squads (automated regression tests owned by engineers, not QA). QA focuses on payment-critical flows and new PSP integrations for region 4. Longer term: budget for a third QA hire in Q1.

---

## Part B – PR Review

### Review of PR #482 – cashback-payout

**Priority 1 — BLOCKING: Money arithmetic uses native float, not BigNumber**

`cashbackService.ts` lines 25–27 and 30:
```
netLoss += parseFloat(bet.amount) - parseFloat(bet.payout);
const cashback = netLoss * CASHBACK_RATE;
wallet.balance = String(parseFloat(wallet.balance) + cashback);
```
This is a correctness bug. The codebase's stated invariant (`src/lib/money.ts`) is that all money arithmetic goes through `bignumber.js`. `parseFloat` will silently lose precision on the DECIMAL(36,18) values we store. I can construct a bet sequence where the float-computed cashback differs from the correct result. On a real-money platform this is an incident, not a lint warning. Needs to use `dec()` throughout before this merges.

**Priority 2 — BLOCKING: Missing `accountId` scope on `Member.findAll()`**

`cashbackService.ts` line 13:
```
const members = await Member.findAll();
```
The PR description itself says "all queries in this codebase are expected to be scoped by `accountId`." This will run cashback for all members across all brands when called for one brand. If brand A calls `POST /admin/cashback/run` with their `accountId`, they will accidentally credit members of brand B. The endpoint accepts `accountId` but it is never passed to `findAll`. This is both a money bug (wrong recipients) and a multi-tenancy isolation failure.

**Priority 3 — BLOCKING: No idempotency guard — cashback can be paid twice**

There is a `cashback_payouts` table and a `week_start` column, but no check before inserting whether a payout for `(memberId, weekStart)` already exists. If ops runs the cron twice, or the endpoint is hit twice, every member gets paid twice. For a weekly cron on a prod system this will eventually happen. Add a unique constraint on `(member_id, week_start)` and a pre-insert check (or handle the unique violation) before merging.

**Priority 4 — BLOCKING: Each member's payout is not atomic**

The wallet credit (`wallet.save()`), the `CashbackPayout` record, and the `WalletTx` ledger entry are three separate writes with no transaction wrapping. If the process crashes between any two of them, the wallet is credited but has no ledger entry, or the ledger entry exists but the payout record does not. Per the codebase convention (`memberService.createMember`), any operation writing more than one row runs in a single DB transaction. This must be fixed.

**Priority 5 — Concern (non-blocking for merge, blocking for scale): Silent error swallowing**

```
} catch (err) {
  console.log('cashback failed for member', member.id, err);
}
```
The loop continues silently on any member failure. This means a partial cashback run (e.g., DB error halfway through) will return `{ processed: N, paid: M }` with no indication that some members were skipped due to errors. The `paid` count will undercount silently. At minimum, the error should be differentiated from "member has no wallet" (expected, skip) vs. "DB error" (unexpected, should surface).

**On the tests:**
The tests mock the entire model layer. They test that the service calls the right mock functions, not that money math is correct or that idempotency holds under concurrency. The concurrent-duplicate test required by the broader codebase conventions is absent. I would not count these tests as coverage of the risks that matter.

---

**My verdict: Do not merge.** Issues 1–4 are each independently a money-safety failure. S.'s approval does not change that.

---

### The Conversation

**With D.:**  
I find D. before the standup, not in a PR comment thread. I say: "I looked at the cashback PR — there are some money-safety issues I want to walk through with you before it merges. None of this is a reflection on your ability; this domain has specific correctness patterns that aren't obvious unless someone has shown them to you. Let's pair for an hour — I want to show you the invariants, not just tell you the list." I make the review comments visible and detailed so D. can learn from them, but I deliver the blocking verdict privately first.

**With S.:**  
I have a one-on-one with S. the same day — not a confrontation, an inquiry: "I noticed a few things in the cashback PR that concern me from a money-correctness standpoint — float arithmetic, missing accountId scope. Walk me through your review: what were you looking for?" My goal is to understand whether S. missed these or applied a different risk model. If S. missed the float issue, that tells me the review culture assumption ("S. will catch money bugs") is not reliable, and I need P1 (the checklist) more urgently. If S. deprioritized them as "cleanup items," I need to recalibrate what "blocking" means for payment-adjacent code on this team — and that is a conversation I have explicitly, not as feedback but as a standard-setting discussion.

**What changes structurally:**  
The payment-safe merge checklist (P1 above) is the structural fix. If those four items had been on the PR template, item 1 (no float arithmetic), item 3 (idempotency guard), and item 4 (single transaction) would have been explicit requirements, not judgment calls. A checklist does not replace engineering judgment, but it makes "did we check for this?" a yes/no question at review time rather than something that depends on the reviewer's mood and attention.

---

## Part C – Two Situations

### C1 – Saturday 01:40, balances moving

**First 60 seconds:**  
Reply to the CEO: "Investigating now. Will update you in 15 minutes with what we know." Do not speculate. Do not say "yes" or "no" to "are we losing money" until I know.

**First 15 minutes:**  
Wake S. — S. knows the wallet engine. My job is not to debug the code; it is to run the incident. While S. is spinning up: pull the last 30 minutes of production logs for region 2 wallet writes. Look for duplicated transaction IDs, balance mutations without matching ledger entries, or callback processing that fired twice. Identify the scope: how many members, which time window.

**Decision at 15 minutes:**  
If the balance increases are traced to a specific transaction type (e.g., a cashback run, a PSP callback replay), take the lowest-blast-radius containment action first. Options in order of reversibility: (a) disable the endpoint or cron job causing the crediting; (b) put the region into read-only mode if the crediting is ongoing; (c) involve the PSP if the cause is on their side.

Update the CEO: "We have identified [X] as the likely cause. [Y] members affected. We have [taken action / are evaluating action]. Money may [not be leaving the platform / be at risk of withdrawal]. Next update in 30 minutes."

**Money leaving the platform:**  
The immediate question is whether affected members can withdraw the incorrect balance. If yes, withdrawals for affected members in region 2 need to be paused (manually or by feature flag) while we assess. This is the most consequential call and I make it with S.'s input, not alone.

**First 2 hours:**  
S. identifies root cause. If it is a double-credit scenario similar to incident #1 (duplicate callback), the fix is to identify affected wallet IDs, compute the incorrectly credited amount per member, and create correcting ledger entries — no balance field updates, append-only correction per the ledger model. This is a data fix, not a code deploy; it can be done without a release.

Document the timeline in a shared incident doc as it happens. At 6h, send a written update to the CEO with: what happened, impact quantified, fix applied or in progress, when we expect full resolution.

**T. being on leave:**  
T. is not needed here — this is wallet, not pipeline. I do not page T.

---

### C2 – Week 6 sprint planning, L.'s challenge

**In the next 60 seconds:**

"L., I hear you — and that's exactly the kind of feedback I need. Let's not resolve this in the middle of planning." I pause. "For now, let's keep today's sprint focused on region 4. After this meeting, L. and I will sit down, and if the checklist needs to change, we'll change it together before next sprint. If you think there's something on the checklist that's slowing the launch — name it now and we'll look at it."

I do not argue. I do not apologize for the checklist. I do not let the room see me rattled.

**After the meeting:**

I have a private conversation with L. within two hours. I come with genuine curiosity, not defensiveness: "Walk me through what you're seeing. Which specific items feel like theater?" If L. has a concrete case — for example, a checklist item that's redundant with an existing review step, or one that's slowing a non-payment flow — I take it seriously and may cut it. L. is the most experienced people-manager on the team; their judgment on friction is probably right.

If L.'s objection is to the idea of a checklist itself ("we should trust engineers, not make checklists"), I share the actual incident data: three of the last five incidents trace to payment-adjacent changes that passed review without these checks. The checklist is not process theater — it is the direct response to a pattern of money failures. I am happy to hear how L. would solve the same problem differently.

**What I will not do:**  
Abandon the checklist in the room to win L.'s support in the moment. That would tell the team that visible social pressure overrides engineering safety decisions, which is exactly the wrong norm to set on a money platform.

**The longer-term signal:**  
L. has credibility and a following. If L. is publicly opposed, the checklist will quietly be ignored regardless of what I say. The goal of the private conversation is not to win the argument — it is to genuinely engage with L.'s concern, update the checklist if the concern has merit, and bring L. into ownership of the safety standard. L. being the person who holds engineers to the checklist is a better outcome than L. being the person who undermines it.

---

## Disclosure

I used Claude (Anthropic) to help structure and draft sections of this submission. All analysis, priorities, and recommendations are my own. I own every judgment here and can defend each decision in an interview.
