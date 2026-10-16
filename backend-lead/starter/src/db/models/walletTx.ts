import { DataTypes, Model, Sequelize } from 'sequelize';

export class WalletTx extends Model {
  declare id: string;
  declare walletId: string;
  declare type: string;
  declare amount: string;
  declare fundingTxId: string | null;
  declare createdAt: Date;
}

export function initWalletTx(sequelize: Sequelize): void {
  WalletTx.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      walletId: { type: DataTypes.UUID, allowNull: false },
      type: { type: DataTypes.STRING, allowNull: false },
      amount: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
      fundingTxId: { type: DataTypes.UUID, allowNull: true },
    },
    { sequelize, tableName: 'wallet_txs', underscored: true, updatedAt: false },
  );
}
