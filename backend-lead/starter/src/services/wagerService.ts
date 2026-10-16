import { Transaction } from 'sequelize';
import { sequelize } from '../db/sequelize';
import { Wallet, WalletTx, Wager } from '../db/models';
import { dec } from '../lib/money';

export interface CreateWagerResult {
  wagerId: string;
  newBalance: string;
}

export async function createWager(walletId: string, amount: string): Promise<CreateWagerResult> {
  const amountBn = dec(amount);
  if (amountBn.lte(0)) throw Object.assign(new Error('amount must be positive'), { status: 422 });

  return sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
    async (t) => {
      // Row-level lock prevents concurrent overdraw
      const wallet = await Wallet.findOne({
        where: { id: walletId },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if (!wallet) throw Object.assign(new Error('wallet not found'), { status: 404 });

      const balance = dec(wallet.balance);
      if (balance.lt(amountBn)) {
        throw Object.assign(new Error('insufficient balance'), { status: 422 });
      }

      wallet.balance = balance.minus(amountBn).toFixed(18);
      wallet.turnoverAccrued = dec(wallet.turnoverAccrued).plus(amountBn).toFixed(18);
      await wallet.save({ transaction: t });

      const wager = await Wager.create(
        { walletId, memberId: wallet.memberId, amount: amountBn.toFixed(18) },
        { transaction: t },
      );

      await WalletTx.create(
        { walletId, type: 'WagerDebit', amount: amountBn.toFixed(18), fundingTxId: null },
        { transaction: t },
      );

      return { wagerId: wager.id, newBalance: wallet.balance };
    },
  );
}
