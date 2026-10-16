require('dotenv/config');
const env = process.env.NODE_ENV ?? 'development';
module.exports = {
  [env]: {
    url:
      env === 'test'
        ? process.env.DATABASE_URL_TEST ?? 'postgres://wallet:wallet@localhost:5439/wallet_test'
        : process.env.DATABASE_URL ?? 'postgres://wallet:wallet@localhost:5439/wallet',
    dialect: 'postgres',
    logging: false,
  },
};
