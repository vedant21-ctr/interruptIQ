import { buildApp } from './app';
import { env } from './config/env';

const app = buildApp();

const start = async () => {
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

const signals = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    app.log.info(`Received ${signal}, shutting down gracefully...`);
    try {
      await app.close();
      app.log.info('Server closed successfully');
      process.exit(0);
    } catch (err) {
      app.log.error(err);
      process.exit(1);
    }
  });
});

start();
