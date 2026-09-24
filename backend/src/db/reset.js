const { reset } = require('./migrate');
const { pool } = require('./pool');

reset()
  .then(() => {
    console.log('Base de datos reiniciada con datos semilla.');
    return pool.end();
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
