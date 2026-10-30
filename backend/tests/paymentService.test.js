// Dobles de prueba: se reemplaza la capa de datos (pool de PostgreSQL) y el servicio de solicitudes.
// Justificación: el cálculo del recargo y la selección de la cuota son lógica pura del módulo de pagos;
// probarlos contra una base real haría la prueba lenta, dependiente de datos y no repetible.
jest.mock('../src/db/pool', () => ({ query: jest.fn(), withTransaction: jest.fn() }));
jest.mock('../src/services/applicationService', () => ({ findById: jest.fn(), changeState: jest.fn() }));

const { query, withTransaction } = require('../src/db/pool');
const apps = require('../src/services/applicationService');
const { computeLateFee, pay, quote } = require('../src/services/paymentService');

const USER = { id: 2, rol: 'ANALISTA' };
const CREDITO = { id: 10, estado: 'DESEMBOLSADA', fechaDesembolso: '2026-01-01' };

// Simula la conexión de la transacción: responde según la sentencia SQL recibida
function fakeTx({ pendientes }) {
  const c = {
    query: jest.fn(async (sql) => {
      if (sql.includes("estado = 'PENDIENTE'")) return { rows: pendientes.length ? [pendientes.shift()] : [] };
      if (sql.startsWith('INSERT INTO payments')) return { rows: [{ id: 99 }] };
      return { rows: [], rowCount: 1 };
    }),
  };
  withTransaction.mockImplementation((fn) => fn(c));
  return c;
}

beforeEach(() => jest.clearAllMocks());

describe('paymentService.computeLateFee (valores límite de mora)', () => {
  test('pago a tiempo: sin días de atraso ni recargo', () => {
    expect(computeLateFee(1000, '2026-07-01', '2026-06-28')).toEqual({ diasAtraso: 0, recargo: 0, total: 1000 });
  });

  test('5 días de atraso (último día de gracia): sin recargo', () => {
    expect(computeLateFee(1000, '2026-07-01', '2026-07-06')).toMatchObject({ diasAtraso: 5, recargo: 0 });
  });

  test('6 días de atraso: recargo del 5 % de la cuota', () => {
    expect(computeLateFee(1833.6, '2026-07-01', '2026-07-07')).toEqual({ diasAtraso: 6, recargo: 91.68, total: 1925.28 });
  });
});

describe('paymentService.pay (con dobles de prueba)', () => {
  test('aplica el pago a la cuota pendiente más antigua y la marca como PAGADA', async () => {
    apps.findById.mockResolvedValue({ ...CREDITO });
    const c = fakeTx({ pendientes: [{ id: 501, numero: 1, fechaVencimiento: '2026-02-01', cuota: 500 }, { id: 502, numero: 2 }] });

    const r = await pay(USER, 10, { fechaPago: '2026-02-01', monto: 500 });

    expect(r).toMatchObject({ pagoId: 99, cuotaNumero: 1, recargo: 0, montoPagado: 500 });
    expect(c.query).toHaveBeenCalledWith(expect.stringContaining("SET estado = 'PAGADA'"), [501]);
    expect(apps.changeState).not.toHaveBeenCalled();
  });

  test('al pagar la última cuota cambia la solicitud a FINALIZADA', async () => {
    apps.findById.mockResolvedValue({ ...CREDITO });
    fakeTx({ pendientes: [{ id: 503, numero: 3, fechaVencimiento: '2026-04-01', cuota: 500 }] });

    await pay(USER, 10, { fechaPago: '2026-04-01', monto: 500 });

    expect(apps.changeState).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'FINALIZADA', USER.id, expect.any(String));
  });

  test('rechaza un monto distinto a cuota + recargo e informa el total exigido', async () => {
    apps.findById.mockResolvedValue({ ...CREDITO });
    fakeTx({ pendientes: [{ id: 501, numero: 1, fechaVencimiento: '2026-02-01', cuota: 500 }] });

    await expect(pay(USER, 10, { fechaPago: '2026-02-01', monto: 499.99 })).rejects.toMatchObject({ status: 400, details: { total: 500 } });
  });

  test('no permite pagar un crédito que no está desembolsado', async () => {
    apps.findById.mockResolvedValue({ ...CREDITO, estado: 'APROBADA' });
    await expect(pay(USER, 10, { fechaPago: '2026-02-01', monto: 500 })).rejects.toMatchObject({ status: 409 });
    expect(withTransaction).not.toHaveBeenCalled();
  });

  test('valida la fecha y el monto antes de consultar la base de datos', async () => {
    await expect(pay(USER, 10, { fechaPago: '2026-02-30', monto: 500 })).rejects.toMatchObject({ status: 400 });
    await expect(pay(USER, 10, { fechaPago: '2026-02-01', monto: -1 })).rejects.toMatchObject({ status: 400 });
    expect(apps.findById).not.toHaveBeenCalled();
  });

  test('quote calcula el total con recargo para una fecha de pago dada', async () => {
    apps.findById.mockResolvedValue({ ...CREDITO });
    query.mockResolvedValue({ rows: [{ id: 501, numero: 1, fechaVencimiento: '2026-07-01', cuota: 1833.6 }] });
    await expect(quote(USER, 10, '2026-07-07')).resolves.toMatchObject({ cuotaNumero: 1, recargo: 91.68, total: 1925.28 });
  });
});
