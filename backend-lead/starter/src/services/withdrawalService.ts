import { Transaction } from 'sequelize';
import { sequelize } from '../db/sequelize';
import { Wallet, WalletTx, FundingTx } from '../db/models';
import { dec } from '../lib/money';

export interface CreateWithdrawalResult {
  id: string;
}

export interface TurnoverError extends Error {
  status: number;
  outstandingTurnover: string;
}

export async function createWithdrawal(
  memberId: string,
  amount: string,
): Promise<CreateWithdrawalResult> {
  const amountBn = dec(amount);
  if (amountBn.lte(0)) throw Object.assign(new Error('amount must be positive'), { status: 422 });

  return sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
    async (t) => {
      const wallet = await Wallet.findOne({
        where: { memberId },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if (!wallet) throw Object.assign(new Error('wallet not found'), { status: 404 });

      const balance = dec(wallet.balance);
      if (balance.lt(amountBn)) {
        throw Object.assign(new Error('insufficient balance'), { status: 422 });
      }

      const outstanding = dec(wallet.turnoverRequired).minus(dec(wallet.turnoverAccrued));
      if (outstanding.gt(0)) {
        const err = new Error('turnover requirement not met') as TurnoverError;
        err.status = 422;
        err.outstandingTurnover = outstanding.toFixed(18);
        throw err;
      }

      wallet.balance = balance.minus(amountBn).toFixed(18);
      await wallet.save({ transaction: t });

      const tx = await FundingTx.create(
        {
          memberId,
          walletId: wallet.id,
          type: 'Withdrawal',
          status: 'Pending',
          amount: amountBn.toFixed(18),
          pspRef: null,
          turnoverMultiplier: 0,
        },
        { transaction: t },
      );

      await WalletTx.create(
        {
          walletId: wallet.id,
          type: 'WithdrawalDebit',
          amount: amountBn.toFixed(18),
          fundingTxId: tx.id,
        },
        { transaction: t },
      );

      return { id: tx.id };
    },
  );
}
