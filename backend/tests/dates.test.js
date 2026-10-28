const { parseDate, addMonths, daysBetween, ageOn } = require('../src/utils/dates');

describe('utils/dates', () => {
  test('parseDate rechaza fechas inexistentes y formatos inválidos', () => {
    expect(parseDate('2026-02-30')).toBeNull();
    expect(parseDate('30/09/2026')).toBeNull();
    expect(parseDate(20260930)).toBeNull();
    expect(parseDate('2026-09-30')).toBeInstanceOf(Date);
  });

  test('addMonths ajusta al último día del mes cuando el día no existe', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
  });

  test('daysBetween cuenta días calendario (positivos y negativos)', () => {
    expect(daysBetween('2026-07-01', '2026-07-06')).toBe(5);
    expect(daysBetween('2026-07-06', '2026-07-01')).toBe(-5);
  });

  test('ageOn: cumple años el mismo día, no el día anterior', () => {
    expect(ageOn('2008-09-25', '2026-09-25')).toBe(18);
    expect(ageOn('2008-09-26', '2026-09-25')).toBe(17);
  });
});
