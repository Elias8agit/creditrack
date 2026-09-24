// Cliente del servicio externo de buró de crédito (simulado).
// En producción consultaría un proveedor externo; aquí responde con datos fijos para
// DPIs de prueba y un valor determinístico para el resto.

const FIXTURES = {
  '1000000000101': { score: 780, moraActiva: false },
  '1000000000202': { score: 650, moraActiva: false },
  '1000000000303': { score: 560, moraActiva: false },
  '1000000000404': { score: 720, moraActiva: true },
  '1000000000505': { score: 700, moraActiva: false },
  '1000000000606': { score: 699, moraActiva: false },
  '1000000000707': { score: 600, moraActiva: false },
  '1000000000808': { score: 599, moraActiva: false },
};

async function consult(dpi) {
  if (FIXTURES[dpi]) return { ...FIXTURES[dpi] };
  const sum = dpi.split('').reduce((acc, c) => acc + Number(c), 0);
  return { score: 300 + ((sum * 37) % 551), moraActiva: false };
}

module.exports = { consult, FIXTURES };
