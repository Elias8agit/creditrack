const { monthlyPayment, amortizationSchedule, simulate, round2 } = require('../src/services/creditCalculator');

describe('creditCalculator (sistema francés)', () => {
  test('calcula la cuota de un microcrédito de Q10,000 a 12 meses al 24 %', () => {
    expect(monthlyPayment(10000, 0.24, 12)).toBe(945.6);
  });

  test('con tasa 0 la cuota es el capital dividido entre el plazo', () => {
    expect(monthlyPayment(1200, 0, 12)).toBe(100);
  });

  test('round2 redondea a 2 decimales sin error de punto flotante', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.675)).toBe(2.68);
  });

  test('la tabla tiene tantas filas como meses y el saldo final es 0', () => {
    const tabla = amortizationSchedule(5000, 0.18, 6);
    expect(tabla).toHaveLength(6);
    expect(tabla[5].saldo).toBe(0);
  });

  test('la suma del capital amortizado es igual al monto prestado', () => {
    const tabla = amortizationSchedule(25000, 0.24, 24);
    const capital = round2(tabla.reduce((a, r) => a + r.capital, 0));
    expect(capital).toBe(25000);
  });

  test('genera fechas de vencimiento mensuales a partir del desembolso', () => {
    const tabla = amortizationSchedule(3000, 0.24, 3, '2026-01-31');
    expect(tabla.map((r) => r.fechaVencimiento)).toEqual(['2026-02-28', '2026-03-31', '2026-04-30']);
  });

  test('simulate devuelve total a pagar e intereses consistentes', () => {
    const r = simulate(10000, 0.24, 12);
    expect(r.cuota).toBe(945.6);
    expect(r.totalIntereses).toBe(round2(r.totalPagar - 10000));
    expect(r.tabla).toHaveLength(12);
  });
});
