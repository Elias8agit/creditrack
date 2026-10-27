const { evaluate, computeRdi } = require('../src/services/evaluationEngine');

// Caso base que cumple todas las condiciones de preaprobación (R5)
const base = { score: 750, moraActiva: false, rdi: 0.2, edadActual: 35, plazoMeses: 24 };

describe('evaluationEngine: tabla de decisión de pre-evaluación', () => {
  test('computeRdi = (deudas + cuota) / ingreso', () => {
    expect(computeRdi(3653.25, 346.75, 10000)).toBe(0.4);
  });

  test('R1: mora activa rechaza aunque el score sea alto', () => {
    expect(evaluate({ ...base, moraActiva: true })).toEqual({ resultado: 'RECHAZADA', motivo: 'MORA_ACTIVA', regla: 'R1' });
  });

  test('R2: edad al vencimiento mayor a 70 rechaza (65 años + 61 meses)', () => {
    expect(evaluate({ ...base, edadActual: 65, plazoMeses: 61 }).motivo).toBe('EDAD');
  });

  test('R2 límite: exactamente 70 años al vencimiento no rechaza', () => {
    expect(evaluate({ ...base, edadActual: 65, plazoMeses: 60 }).resultado).toBe('EN_REVISION');
  });

  test.each([
    [599, 'RECHAZADA'],
    [600, 'EN_REVISION'],
  ])('R3 límite: score %i da %s', (score, resultado) => {
    expect(evaluate({ ...base, score }).resultado).toBe(resultado);
  });

  test('R4: RDI mayor a 40 % rechaza por capacidad de pago', () => {
    expect(evaluate({ ...base, rdi: 0.4001 }).motivo).toBe('CAPACIDAD_PAGO');
  });

  test('R4 límite: RDI exactamente 40 % pasa a revisión manual', () => {
    expect(evaluate({ ...base, rdi: 0.4 })).toMatchObject({ resultado: 'EN_REVISION', recomendacion: 'REVISION_MANUAL', regla: 'R6' });
  });

  test.each([
    [700, 0.3, 'PREAPROBADA'],
    [699, 0.3, 'REVISION_MANUAL'],
    [700, 0.3001, 'REVISION_MANUAL'],
  ])('R5/R6: score %i y RDI %f recomiendan %s', (score, rdi, recomendacion) => {
    expect(evaluate({ ...base, score, rdi }).recomendacion).toBe(recomendacion);
  });

  test('el orden de las reglas se respeta: mora tiene prioridad sobre score bajo', () => {
    expect(evaluate({ ...base, moraActiva: true, score: 400 }).regla).toBe('R1');
  });
});
