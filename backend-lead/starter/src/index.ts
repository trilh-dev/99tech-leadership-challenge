import { config } from './config';
import { createApp } from './app';
import { sequelize } from './db/sequelize';
import './db/models';

async function main() {
  await sequelize.authenticate();
  const app = createApp();
  app.listen(config.port, () => {
    console.log(`Listening on :${config.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
