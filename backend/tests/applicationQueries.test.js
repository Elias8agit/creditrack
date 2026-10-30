// Doble de prueba: el pool de PostgreSQL se reemplaza por un stub que devuelve filas fijas.
// Justificación: se verifica cómo el servicio arma las consultas (filtros por rol y estado) y cómo
// genera el plan de pagos al desembolsar, sin depender de una base de datos real.
jest.mock('../src/db/pool', () => ({ query: jest.fn(), withTransaction: jest.fn() }));

const { query, withTransaction } = require('../src/db/pool');
const apps = require('../src/services/applicationService');

const SOLICITUD = { id: 7, clientId: 3, estado: 'APROBADA', monto: 3000, plazoMeses: 3, tasaAnual: 0.24 };

beforeEach(() => jest.clearAllMocks());

describe('applicationService.list (filtros por rol y estado)', () => {
  test('un cliente solo consulta sus propias solicitudes', async () => {
    query.mockResolvedValue({ rows: [] });
    await apps.list({ id: 3, rol: 'CLIENTE' });
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('WHERE a.client_id = $1');
    expect(params).toEqual([3]);
  });

  test('un analista filtra por estado sin restricción de cliente', async () => {
    query.mockResolvedValue({ rows: [{ id: 1 }, { id: 2 }] });
    const r = await apps.list({ id: 2, rol: 'ANALISTA' }, { estado: 'EN_REVISION' });
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('WHERE a.estado = $1');
    expect(sql).not.toContain('client_id = $');
    expect(params).toEqual(['EN_REVISION']);
    expect(r).toHaveLength(2);
  });

  test('cliente con filtro de estado combina ambas condiciones', async () => {
    query.mockResolvedValue({ rows: [] });
    await apps.list({ id: 3, rol: 'CLIENTE' }, { estado: 'BORRADOR' });
    expect(query.mock.calls[0][0]).toContain('WHERE a.client_id = $1 AND a.estado = $2');
  });

  test('sin filtros no agrega cláusula WHERE', async () => {
    query.mockResolvedValue({ rows: [] });
    await apps.list({ id: 1, rol: 'ADMIN' });
    expect(query.mock.calls[0][0]).not.toContain('WHERE');
  });
});

describe('applicationService.getDetail', () => {
  test('devuelve la solicitud con historial y plan de pagos', async () => {
    query
      .mockResolvedValueOnce({ rows: [SOLICITUD] })
      .mockResolvedValueOnce({ rows: [{ id: 1, estadoNuevo: 'BORRADOR' }] })
      .mockResolvedValueOnce({ rows: [{ numero: 1 }, { numero: 2 }, { numero: 3 }] });
    const r = await apps.getDetail({ id: 3, rol: 'CLIENTE' }, 7);
    expect(r.historial).toHaveLength(1);
    expect(r.planPagos).toHaveLength(3);
  });

  test('un cliente no puede ver la solicitud de otro (404)', async () => {
    query.mockResolvedValueOnce({ rows: [{ ...SOLICITUD, clientId: 99 }] });
    await expect(apps.getDetail({ id: 3, rol: 'CLIENTE' }, 7)).rejects.toMatchObject({ status: 404 });
  });
});

describe('applicationService.disburse', () => {
  test('genera una cuota por mes de plazo con vencimientos mensuales', async () => {
    const inserts = [];
    const c = {
      query: jest.fn(async (sql, params) => {
        if (sql.includes('INSERT INTO installments')) inserts.push(params);
        return { rows: [], rowCount: 1 };
      }),
    };
    withTransaction.mockImplementation((fn) => fn(c));
    query.mockResolvedValue({ rows: [SOLICITUD] });

    await apps.disburse({ id: 1, rol: 'ADMIN' }, 7, { fechaDesembolso: '2026-01-31' });

    expect(inserts.map((p) => p[2])).toEqual(['2026-02-28', '2026-03-31', '2026-04-30']);
    expect(inserts.at(-1)[6]).toBe(0);
  });

  test('rechaza una fecha de desembolso inválida antes de tocar la base', async () => {
    await expect(apps.disburse({ id: 1, rol: 'ADMIN' }, 7, { fechaDesembolso: '2026-02-30' })).rejects.toMatchObject({ status: 400 });
    expect(query).not.toHaveBeenCalled();
  });

  test('una solicitud que no está APROBADA no se puede desembolsar (409)', async () => {
    withTransaction.mockImplementation((fn) => fn({ query: jest.fn() }));
    query.mockResolvedValue({ rows: [{ ...SOLICITUD, estado: 'EN_REVISION' }] });
    await expect(apps.disburse({ id: 1, rol: 'ADMIN' }, 7, { fechaDesembolso: '2026-01-31' })).rejects.toMatchObject({ status: 409 });
  });
});
