const { canTransition, TRANSICIONES, ACTIVOS } = require('../src/services/stateMachine');

describe('stateMachine: ciclo de vida de la solicitud', () => {
  test.each([
    ['BORRADOR', 'ENVIADA'],
    ['ENVIADA', 'EN_REVISION'],
    ['EN_REVISION', 'DEVUELTA'],
    ['DEVUELTA', 'ENVIADA'],
    ['APROBADA', 'DESEMBOLSADA'],
    ['DESEMBOLSADA', 'FINALIZADA'],
  ])('permite la transición válida %s → %s', (de, a) => {
    expect(canTransition(de, a)).toBe(true);
  });

  test.each([
    ['BORRADOR', 'APROBADA'],
    ['EN_REVISION', 'DESEMBOLSADA'],
    ['EN_REVISION', 'CANCELADA'],
    ['RECHAZADA', 'ENVIADA'],
  ])('rechaza la transición inválida %s → %s', (de, a) => {
    expect(canTransition(de, a)).toBe(false);
  });

  test('los estados finales no tienen transiciones de salida', () => {
    ['RECHAZADA', 'CANCELADA', 'FINALIZADA'].forEach((e) => expect(TRANSICIONES[e]).toEqual([]));
  });

  test('un estado desconocido no permite ninguna transición', () => {
    expect(canTransition('INEXISTENTE', 'ENVIADA')).toBe(false);
  });

  test('DESEMBOLSADA no cuenta como solicitud activa', () => {
    expect(ACTIVOS).not.toContain('DESEMBOLSADA');
    expect(ACTIVOS).toContain('APROBADA');
  });
});
