const app = require('./app');
const config = require('./config');
const { migrate, seed } = require('./db/migrate');

async function start() {
  await migrate();
  if (config.seedOnStart) {
    const seeded = await seed();
    if (seeded) console.log('Datos semilla cargados');
  }
  app.listen(config.port, () => console.log(`CrediTrack API escuchando en puerto ${config.port}`));
}

start().catch((err) => {
  console.error('No se pudo iniciar el servidor:', err);
  process.exit(1);
});
