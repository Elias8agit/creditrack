// Módulo crítico: cálculo de cuota y tabla de amortización (sistema francés)
const { addMonths } = require('../utils/dates');

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function monthlyPayment(principal, annualRate, months) {
  const i = annualRate / 12;
  if (i === 0) return round2(principal / months);
  return round2((principal * i) / (1 - Math.pow(1 + i, -months)));
}

function amortizationSchedule(principal, annualRate, months, startDate) {
  const i = annualRate / 12;
  const cuota = monthlyPayment(principal, annualRate, months);
  const rows = [];
  let saldo = principal;
  for (let k = 1; k <= months; k += 1) {
    const interes = round2(saldo * i);
    let capital = round2(cuota - interes);
    let cuotaK = cuota;
    if (k === months) {
      // Última cuota ajusta la diferencia por redondeo
      capital = round2(saldo);
      cuotaK = round2(capital + interes);
    }
    saldo = round2(saldo - capital);
    rows.push({
      numero: k,
      fechaVencimiento: startDate ? addMonths(startDate, k) : null,
      capital,
      interes,
      cuota: cuotaK,
      saldo,
    });
  }
  return rows;
}

function simulate(principal, annualRate, months) {
  const tabla = amortizationSchedule(principal, annualRate, months);
  const totalPagar = round2(tabla.reduce((acc, r) => acc + r.cuota, 0));
  return {
    cuota: tabla[0].cuota,
    totalPagar,
    totalIntereses: round2(totalPagar - principal),
    tabla,
  };
}

module.exports = { monthlyPayment, amortizationSchedule, simulate, round2 };
