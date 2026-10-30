// Dobles de prueba: se reemplazan el servicio externo de buró de crédito y el pool de PostgreSQL.
// Justificación: el buró es una dependencia externa (en producción sería un tercero con latencia y
// datos variables); con un stub fijamos score y mora para recorrer cada regla de la tabla de decisión.
// La base de datos se simula para verificar qué transiciones se registran sin depender de datos reales.
jest.mock('../src/db/pool', () => ({ query: jest.fn(), withTransaction: jest.fn() }));
jest.mock('../src/services/buroClient', () => ({ consult: jest.fn() }));

const { query, withTransaction } = require('../src/db/pool');
const buro = require('../src/services/buroClient');
const apps = require('../src/services/applicationService');

const CLIENTE = { id: 3, rol: 'CLIENTE' };
const SOLICITUD = { id: 7, clientId: 3, estado: 'BORRADOR', monto: 5000, plazoMeses: 12, cuota: 472.8 };
const PERFIL = { dpi: '1000000000101', fecha_nacimiento: '1990-05-10', ingreso_mensual: 12000, deudas_mensuales: 1000 };

// Base de datos simulada: guarda las transiciones registradas en el historial
function fakeDb(solicitud) {
  const historial = [];
  const db = {
    query: jest.fn(async (sql, params) => {
      if (sql.includes('FROM applications a')) return { rows: [{ ...solicitud }] };
      if (sql.includes('FROM clients')) return { rows: [PERFIL] };
      if (sql.startsWith('INSERT INTO application_history') || sql.includes('INSERT INTO application_history')) {
        historial.push(`${params[1]}>${params[2]}`);
      }
      return { rows: [], rowCount: 1 };
    }),
  };
  query.mockImplementation(db.query);
  withTransaction.mockImplementation((fn) => fn(db));
  return historial;
}

beforeEach(() => jest.clearAllMocks());

describe('applicationService.submit (pre-evaluación con buró simulado)', () => {
  test('score alto sin mora: registra BORRADOR>ENVIADA y ENVIADA>EN_REVISION', async () => {
    buro.consult.mockResolvedValue({ score: 780, moraActiva: false });
    const historial = fakeDb(SOLICITUD);

    await apps.submit(CLIENTE, 7);

    expect(buro.consult).toHaveBeenCalledWith('1000000000101');
    expect(historial).toEqual(['BORRADOR>ENVIADA', 'ENVIADA>EN_REVISION']);
  });

  test('mora activa: la solicitud termina RECHAZADA (regla R1)', async () => {
    buro.consult.mockResolvedValue({ score: 800, moraActiva: true });
    const historial = fakeDb(SOLICITUD);

    await apps.submit(CLIENTE, 7);

    expect(historial).toEqual(['BORRADOR>ENVIADA', 'ENVIADA>RECHAZADA']);
  });

  test('una solicitud ya rechazada no se puede reenviar (409) y no consulta al buró', async () => {
    fakeDb({ ...SOLICITUD, estado: 'RECHAZADA' });
    await expect(apps.submit(CLIENTE, 7)).rejects.toMatchObject({ status: 409 });
    expect(buro.consult).not.toHaveBeenCalled();
  });

  test('un cliente no puede enviar la solicitud de otro cliente', async () => {
    fakeDb({ ...SOLICITUD, clientId: 99 });
    await expect(apps.submit(CLIENTE, 7)).rejects.toMatchObject({ status: 404 });
  });
});

describe('applicationService.evaluate', () => {
  test('rechazar sin comentario de 10 caracteres responde 400', async () => {
    await expect(apps.evaluate({ id: 2, rol: 'ANALISTA' }, 7, { decision: 'RECHAZAR', comentario: 'corto' })).rejects.toMatchObject({ status: 400 });
  });

  test('un analista no puede aprobar montos mayores a Q100,000', async () => {
    fakeDb({ ...SOLICITUD, estado: 'EN_REVISION', monto: 100000.01 });
    await expect(apps.evaluate({ id: 2, rol: 'ANALISTA' }, 7, { decision: 'APROBAR' })).rejects.toMatchObject({ status: 403 });
  });
});
