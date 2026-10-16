'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('funding_txs', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      member_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'members', key: 'id' },
      },
      wallet_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'wallets', key: 'id' },
      },
      type: { type: Sequelize.ENUM('Deposit', 'Withdrawal'), allowNull: false },
      status: {
        type: Sequelize.ENUM('Pending', 'Completed', 'Failed'),
        allowNull: false,
        defaultValue: 'Pending',
      },
      amount: { type: Sequelize.DECIMAL(36, 18), allowNull: false },
      psp_ref: { type: Sequelize.STRING, allowNull: true, unique: true },
      turnover_multiplier: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('now()') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('now()') },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('funding_txs');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_funding_txs_type"; DROP TYPE IF EXISTS "enum_funding_txs_status";',
    );
  },
};
