# Ejecución de referencia de la Fase 1

- `ejecutar-casos.js`: ejecuta los 56 casos de prueba (CP-01 a CP-56) contra un ambiente local recién iniciado
  (`npm run db:reset` en `backend/`, API en :3000 y frontend en :5173). Requiere Playwright y `psql` local
  (CP-40, CP-45 y CP-50 consultan la base). Genera `resultados.json` y la carpeta `evidencias/`.
  `NODE_PATH=$(npm root -g) node ejecutar-casos.js`
- `repro-pagos-concurrentes.js`: reproduce DEF-05 en cualquier ambiente (local o desplegado).

Estas pruebas son de sistema (API y UI); no son pruebas unitarias y no forman parte de la cobertura de la fase 2.
