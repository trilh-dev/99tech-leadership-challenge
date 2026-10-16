import { DataTypes, Model, Sequelize } from 'sequelize';

export class Wallet extends Model {
  declare id: string;
  declare memberId: string;
  declare balance: string;
  declare turnoverRequired: string;
  declare turnoverAccrued: string;
}

export function initWallet(sequelize: Sequelize): void {
  Wallet.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      memberId: { type: DataTypes.UUID, allowNull: false },
      balance: { type: DataTypes.DECIMAL(36, 18), allowNull: false, defaultValue: '0' },
      turnoverRequired: { type: DataTypes.DECIMAL(36, 18), allowNull: false, defaultValue: '0' },
      turnoverAccrued: { type: DataTypes.DECIMAL(36, 18), allowNull: false, defaultValue: '0' },
    },
    { sequelize, tableName: 'wallets', underscored: true },
  );
}
