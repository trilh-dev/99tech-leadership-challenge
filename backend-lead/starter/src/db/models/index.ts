import { sequelize } from '../sequelize';
import { Member, initMember } from './member';
import { Wallet, initWallet } from './wallet';
import { FundingTx, initFundingTx } from './fundingTx';
import { WalletTx, initWalletTx } from './walletTx';
import { Wager, initWager } from './wager';

initMember(sequelize);
initWallet(sequelize);
initFundingTx(sequelize);
initWalletTx(sequelize);
initWager(sequelize);

Member.hasOne(Wallet, { foreignKey: 'memberId', as: 'wallet' });
Wallet.belongsTo(Member, { foreignKey: 'memberId', as: 'member' });
Wallet.hasMany(WalletTx, { foreignKey: 'walletId', as: 'txs' });
Wallet.hasMany(FundingTx, { foreignKey: 'walletId', as: 'fundingTxs' });
Wallet.hasMany(Wager, { foreignKey: 'walletId', as: 'wagers' });

export { Member, Wallet, FundingTx, WalletTx, Wager };
