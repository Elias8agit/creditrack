// Módulo crítico: pre-evaluación automática (tabla de decisión)

const LIMITE_EDAD = 70;
const SCORE_MINIMO = 600;
const SCORE_PREAPROBADO = 700;
const RDI_MAXIMO = 0.4;
const RDI_PREAPROBADO = 0.3;

function computeRdi(deudasMensuales, cuota, ingresoMensual) {
  return (deudasMensuales + cuota) / ingresoMensual;
}

/**
 * @param {{score:number, moraActiva:boolean, rdi:number, edadActual:number, plazoMeses:number}} input
 * @returns {{resultado:'RECHAZADA'|'EN_REVISION', motivo?:string, recomendacion?:string, regla:string}}
 */
function evaluate({ score, moraActiva, rdi, edadActual, plazoMeses }) {
  const edadVencimiento = edadActual + plazoMeses / 12;

  if (moraActiva) return { resultado: 'RECHAZADA', motivo: 'MORA_ACTIVA', regla: 'R1' };
  if (edadVencimiento > LIMITE_EDAD) return { resultado: 'RECHAZADA', motivo: 'EDAD', regla: 'R2' };
  if (score < SCORE_MINIMO) return { resultado: 'RECHAZADA', motivo: 'SCORE_INSUFICIENTE', regla: 'R3' };
  if (rdi > RDI_MAXIMO) return { resultado: 'RECHAZADA', motivo: 'CAPACIDAD_PAGO', regla: 'R4' };
  if (score >= SCORE_PREAPROBADO && rdi <= RDI_PREAPROBADO) {
    return { resultado: 'EN_REVISION', recomendacion: 'PREAPROBADA', regla: 'R5' };
  }
  return { resultado: 'EN_REVISION', recomendacion: 'REVISION_MANUAL', regla: 'R6' };
}

module.exports = { evaluate, computeRdi, LIMITE_EDAD, SCORE_MINIMO, SCORE_PREAPROBADO, RDI_MAXIMO, RDI_PREAPROBADO };
