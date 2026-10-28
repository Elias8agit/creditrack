const { consult, FIXTURES } = require('../src/services/buroClient');

describe('buroClient (servicio de buró simulado)', () => {
  test('devuelve la respuesta fija de los DPI de prueba', async () => {
    await expect(consult('1000000000404')).resolves.toEqual({ score: 720, moraActiva: true });
  });

  test('devuelve una copia: modificar la respuesta no altera los datos fijos', async () => {
    const r = await consult('1000000000101');
    r.score = 1;
    expect(FIXTURES['1000000000101'].score).toBe(780);
  });

  test('para otros DPI el score es determinístico y está entre 300 y 850', async () => {
    const a = await consult('2000000000019');
    const b = await consult('2000000000019');
    expect(a).toEqual(b);
    expect(a.score).toBeGreaterThanOrEqual(300);
    expect(a.score).toBeLessThanOrEqual(850);
  });
});
