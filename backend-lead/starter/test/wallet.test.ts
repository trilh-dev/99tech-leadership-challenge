import request from 'supertest';
import { createApp } from '../src/app';
import { sequelize } from '../src/db/sequelize';
import '../src/db/models';

const app = createApp();

beforeAll(async () => {
  await sequelize.authenticate();
});

beforeEach(async () => {
  await sequelize.truncate({ cascade: true });
});

afterAll(async () => {
  await sequelize.close();
});

async function createMember(username: string) {
  const res = await request(app).post('/members').send({ username });
  expect(res.status).toBe(201);
  return res.body as { member: { id: string }; wallet: { id: string; balance: string } };
}

async function createDeposit(memberId: string, amount: string, turnoverMultiplier = 1) {
  const res = await request(app)
    .post('/deposits')
    .send({ memberId, amount, turnoverMultiplier });
  expect(res.status).toBe(201);
  return res.body as { id: string; pspRef: string };
}

async function completeDeposit(pspRef: string, amount: string) {
  const res = await request(app)
    .post('/psp/callbacks')
    .send({ pspRef, status: 'completed', amount });
  expect(res.status).toBe(200);
  return res.body as { outcome: string };
}

async function getWallet(memberId: string) {
  const res = await request(app).get(`/members/${memberId}/wallet`);
  expect(res.status).toBe(200);
  return res.body as { id: string; balance: string };
}

// ─── Deposit ────────────────────────────────────────────────────────────────

describe('Deposit flow', () => {
  it('creates deposit and credits wallet on completed callback', async () => {
    const { member } = await createMember('alice01');
    const { pspRef } = await createDeposit(member.id, '100.50');
    const result = await completeDeposit(pspRef, '100.50');
    expect(result.outcome).toBe('credited');
    const w = await getWallet(member.id);
    expect(w.balance).toBe('100.500000000000000000');
  });

  it('duplicate callback (sequential) does not double-credit', async () => {
    const { member } = await createMember('alice02');
    const { pspRef } = await createDeposit(member.id, '50.00');
    await completeDeposit(pspRef, '50.00');

    const res = await request(app)
      .post('/psp/callbacks')
      .send({ pspRef, status: 'completed', amount: '50.00' });
    expect(res.status).toBe(200);
    expect(res.body.outcome).toBe('already_processed');

    const w = await getWallet(member.id);
    expect(w.balance).toBe('50.000000000000000000');
  });

  it('concurrent duplicate callbacks do not double-credit', async () => {
    const { member } = await createMember('alice03');
    const { pspRef } = await createDeposit(member.id, '75.00');

    const [r1, r2] = await Promise.all([
      request(app).post('/psp/callbacks').send({ pspRef, status: 'completed', amount: '75.00' }),
      request(app).post('/psp/callbacks').send({ pspRef, status: 'completed', amount: '75.00' }),
    ]);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    const outcomes = [r1.body.outcome, r2.body.outcome].sort();
    expect(outcomes).toContain('credited');
    expect(outcomes).toContain('already_processed');

    const w = await getWallet(member.id);
    expect(w.balance).toBe('75.000000000000000000');
  });

  it('failed callback does not credit wallet', async () => {
    const { member } = await createMember('alice04');
    const { pspRef } = await createDeposit(member.id, '20.00');
    const res = await request(app)
      .post('/psp/callbacks')
      .send({ pspRef, status: 'failed', amount: '20.00' });
    expect(res.body.outcome).toBe('failed');
    const w = await getWallet(member.id);
    expect(w.balance).toBe('0.000000000000000000');
  });

  it('unknown pspRef returns unknown_ref', async () => {
    const res = await request(app)
      .post('/psp/callbacks')
      .send({ pspRef: 'no-such-ref', status: 'completed', amount: '10.00' });
    expect(res.status).toBe(200);
    expect(res.body.outcome).toBe('unknown_ref');
  });
});

// ─── Wager ──────────────────────────────────────────────────────────────────

describe('Wager flow', () => {
  it('deducts balance and returns new balance', async () => {
    const { member, wallet } = await createMember('bob01');
    const { pspRef } = await createDeposit(member.id, '100.00', 1);
    await completeDeposit(pspRef, '100.00');

    const res = await request(app)
      .post(`/wallets/${wallet.id}/wagers`)
      .send({ amount: '30.00' });
    expect(res.status).toBe(201);
    const w = await getWallet(member.id);
    expect(w.balance).toBe('70.000000000000000000');
  });

  it('rejects wager when balance insufficient', async () => {
    const { member, wallet } = await createMember('bob02');
    const { pspRef } = await createDeposit(member.id, '10.00');
    await completeDeposit(pspRef, '10.00');

    const res = await request(app)
      .post(`/wallets/${wallet.id}/wagers`)
      .send({ amount: '20.00' });
    expect(res.status).toBe(422);
  });

  it('concurrent wagers cannot overdraw a wallet', async () => {
    const { member, wallet } = await createMember('bob03');
    const { pspRef } = await createDeposit(member.id, '100.00');
    await completeDeposit(pspRef, '100.00');

    const [r1, r2] = await Promise.all([
      request(app).post(`/wallets/${wallet.id}/wagers`).send({ amount: '80.00' }),
      request(app).post(`/wallets/${wallet.id}/wagers`).send({ amount: '80.00' }),
    ]);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([201, 422]);

    const w = await getWallet(member.id);
    expect(w.balance).toBe('20.000000000000000000');
  });
});

// ─── Withdrawal / turnover ───────────────────────────────────────────────────

describe('Withdrawal with turnover lock', () => {
  it('blocks withdrawal when turnover not met', async () => {
    const { member } = await createMember('carol01');
    const { pspRef } = await createDeposit(member.id, '100.00', 1);
    await completeDeposit(pspRef, '100.00');

    const res = await request(app)
      .post('/withdrawals')
      .send({ memberId: member.id, amount: '50.00' });
    expect(res.status).toBe(422);
    expect(res.body.outstandingTurnover).toBeDefined();
  });

  it('allows withdrawal after turnover met', async () => {
    const { member, wallet } = await createMember('carol02');
    // Deposit 100 with multiplier 1 → requires 100 turnover
    const { pspRef } = await createDeposit(member.id, '100.00', 1);
    await completeDeposit(pspRef, '100.00');

    // Wager entire balance to meet turnover
    await request(app).post(`/wallets/${wallet.id}/wagers`).send({ amount: '100.00' });

    // Top up balance with a no-turnover deposit so we have funds to withdraw
    const { pspRef: psp2 } = await createDeposit(member.id, '50.00', 0);
    await completeDeposit(psp2, '50.00');

    const res = await request(app)
      .post('/withdrawals')
      .send({ memberId: member.id, amount: '50.00' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  it('turnover lock blocks then unblocks correctly', async () => {
    const { member, wallet } = await createMember('carol03');
    // Deposit 100 with multiplier 2 → requires 200 turnover
    const { pspRef } = await createDeposit(member.id, '100.00', 2);
    await completeDeposit(pspRef, '100.00');

    // Not enough turnover yet
    let res = await request(app)
      .post('/withdrawals')
      .send({ memberId: member.id, amount: '10.00' });
    expect(res.status).toBe(422);
    expect(res.body.outstandingTurnover).toBeDefined();

    // Wager 100 (balance is now 0, turnover accrued = 100, still 100 short)
    await request(app).post(`/wallets/${wallet.id}/wagers`).send({ amount: '100.00' });

    // Add more balance (no turnover req) to keep wagering
    const { pspRef: psp2 } = await createDeposit(member.id, '200.00', 0);
    await completeDeposit(psp2, '200.00');

    // Wager 100 more to hit 200 total accrued
    await request(app).post(`/wallets/${wallet.id}/wagers`).send({ amount: '100.00' });

    // Now turnover satisfied — should succeed
    res = await request(app)
      .post('/withdrawals')
      .send({ memberId: member.id, amount: '50.00' });
    expect(res.status).toBe(201);
  });
});
