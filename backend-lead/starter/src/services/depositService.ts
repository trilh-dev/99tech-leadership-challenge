import { randomUUID } from 'crypto';
import { Transaction } from 'sequelize';
import { sequelize } from '../db/sequelize';
import { FundingTx, Wallet, WalletTx } from '../db/models';
import { dec } from '../lib/money';

export interface CreateDepositResult {
  id: string;
  pspRef: string;
}

export async function createDeposit(
  memberId: string,
  amount: string,
  turnoverMultiplier: number,
): Promise<CreateDepositResult> {
  const amountBn = dec(amount);
  if (amountBn.lte(0)) throw Object.assign(new Error('amount must be positive'), { status: 422 });

  return sequelize.transaction(async (t) => {
    const wallet = await Wallet.findOne({ where: { memberId }, transaction: t });
    if (!wallet) throw Object.assign(new Error('wallet not found'), { status: 404 });

    const pspRef = randomUUID();
    const tx = await FundingTx.create(
      {
        memberId,
        walletId: wallet.id,
        type: 'Deposit',
        status: 'Pending',
        amount: amountBn.toFixed(18),
        pspRef,
        turnoverMultiplier,
      },
      { transaction: t },
    );

    return { id: tx.id, pspRef: tx.pspRef as string };
  });
}

export type PspCallbackStatus = 'completed' | 'failed';

export interface PspCallbackResult {
  outcome: 'credited' | 'failed' | 'already_processed' | 'unknown_ref';
}

export async function handlePspCallback(
  pspRef: string,
  status: PspCallbackStatus,
  callbackAmount: string,
): Promise<PspCallbackResult> {
  return sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
    async (t) => {
      // Row-level lock serializes concurrent callbacks for the same pspRef
      const tx = await FundingTx.findOne({
        where: { pspRef },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      if (!tx) return { outcome: 'unknown_ref' };

      // Idempotency guard: already transitioned, nothing to do
      if (tx.status !== 'Pending') return { outcome: 'already_processed' };

      if (status === 'failed') {
        tx.status = 'Failed';
        await tx.save({ transaction: t });
        return { outcome: 'failed' };
      }

      // completed — use the deposit's own amount as authoritative; log mismatches
      const depositAmount = dec(tx.amount);
      const cbAmount = dec(callbackAmount);
      if (!depositAmount.eq(cbAmount)) {
        console.warn(
          `PSP amount mismatch: pspRef=${pspRef} deposit=${depositAmount.toFixed()} callback=${cbAmount.toFixed()}`,
        );
      }

      const wallet = await Wallet.findOne({
        where: { id: tx.walletId },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if (!wallet) throw new Error(`wallet ${tx.walletId} not found`);

      wallet.balance = dec(wallet.balance).plus(depositAmount).toFixed(18);
      wallet.turnoverRequired = dec(wallet.turnoverRequired)
        .plus(depositAmount.multipliedBy(tx.turnoverMultiplier))
        .toFixed(18);
      await wallet.save({ transaction: t });

      tx.status = 'Completed';
      await tx.save({ transaction: t });

      await WalletTx.create(
        {
          walletId: wallet.id,
          type: 'DepositCredit',
          amount: depositAmount.toFixed(18),
          fundingTxId: tx.id,
        },
        { transaction: t },
      );

      return { outcome: 'credited' };
    },
  );
}
