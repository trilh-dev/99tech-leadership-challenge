import { sequelize } from '../db/sequelize';
import { Member, Wallet } from '../db/models';

export async function createMember(username: string): Promise<{ member: Member; wallet: Wallet }> {
  return sequelize.transaction(async (t) => {
    const member = await Member.create({ username }, { transaction: t });
    const wallet = await Wallet.create(
      { memberId: member.id, balance: '0', turnoverRequired: '0', turnoverAccrued: '0' },
      { transaction: t },
    );
    return { member, wallet };
  });
}

export async function getWalletByMemberId(memberId: string): Promise<Wallet | null> {
  return Wallet.findOne({ where: { memberId } });
}
