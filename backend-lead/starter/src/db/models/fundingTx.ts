import { DataTypes, Model, Sequelize } from 'sequelize';

export type FundingTxType = 'Deposit' | 'Withdrawal';
export type FundingTxStatus = 'Pending' | 'Completed' | 'Failed';

export class FundingTx extends Model {
  declare id: string;
  declare memberId: string;
  declare walletId: string;
  declare type: FundingTxType;
  declare status: FundingTxStatus;
  declare amount: string;
  declare pspRef: string | null;
  declare turnoverMultiplier: number;
}

export function initFundingTx(sequelize: Sequelize): void {
  FundingTx.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      memberId: { type: DataTypes.UUID, allowNull: false },
      walletId: { type: DataTypes.UUID, allowNull: false },
      type: { type: DataTypes.ENUM('Deposit', 'Withdrawal'), allowNull: false },
      status: {
        type: DataTypes.ENUM('Pending', 'Completed', 'Failed'),
        allowNull: false,
        defaultValue: 'Pending',
      },
      amount: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
      pspRef: { type: DataTypes.STRING, allowNull: true },
      turnoverMultiplier: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    },
    { sequelize, tableName: 'funding_txs', underscored: true },
  );
}
