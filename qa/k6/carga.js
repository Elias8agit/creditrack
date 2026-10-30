// Prueba de carga E14 (k6): rampa de 0 a 50 usuarios virtuales sostenida 5 minutos
// contra el ambiente desplegado en Render. Verifica RNF-01 (rendimiento) y RNF-02 (disponibilidad).
//
// Ejecución:
//   k6 run qa/k6/carga.js
//   k6 run -e API_URL=https://creditrack-api.onrender.com/api qa/k6/carga.js
//   k6 run --out json=reportes/k6.json qa/k6/carga.js   (además genera reportes/k6-resumen.html y .json)
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend } from 'k6/metrics';

const API = __ENV.API_URL || 'https://creditrack-api.onrender.com/api';

// Métricas propias por endpoint para reportar promedio y p95 de cada uno
const tProductos = new Trend('t_productos', true);
const tSimular = new Trend('t_simular', true);
const tSolicitudes = new Trend('t_solicitudes', true);
const tHealth = new Trend('t_health', true);

export const options = {
  scenarios: {
    rampa_50_vu: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 }, // rampa de 0 a 50 VU
        { duration: '5m', target: 50 }, // 50 VU sostenidos 5 minutos
        { duration: '30s', target: 0 }, // bajada
      ],
      gracefulRampDown: '10s',
    },
  },
  // Criterios de aceptación tomados de los RNF del E1
  thresholds: {
    http_req_failed: ['rate<0.01'], // RNF-02: tasa de error < 1 %
    http_req_duration: ['p(95)<1500'], // RNF-01: p95 <= 1,500 ms con 50 VU
    'http_req_duration{endpoint:productos}': ['p(95)<1500'],
    'http_req_duration{endpoint:simular}': ['p(95)<1500'],
    'http_req_duration{endpoint:solicitudes}': ['p(95)<1500'],
    checks: ['rate>0.99'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'max'],
};

// Se ejecuta una sola vez: despierta el servicio (capa gratuita de Render) y obtiene un token de analista
export function setup() {
  for (let i = 0; i < 10; i++) {
    const r = http.get(`${API}/health`, { timeout: '90s' });
    if (r.status === 200) break;
    sleep(5);
  }
  const login = http.post(
    `${API}/auth/login`,
    JSON.stringify({ email: 'analista@creditrack.test', password: __ENV.ANALISTA_PASSWORD || 'Analista123!' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(login, { 'login de analista 200': (r) => r.status === 200 });
  const productos = http.get(`${API}/products`).json();
  return { token: login.json('token'), productId: productos[0].id, montoMin: productos[0].montoMin };
}

export default function (data) {
  const json = { 'Content-Type': 'application/json' };

  group('Catálogo de productos', () => {
    const r = http.get(`${API}/products`, { tags: { endpoint: 'productos' } });
    tProductos.add(r.timings.duration);
    check(r, {
      'productos 200': (x) => x.status === 200,
      'productos devuelve arreglo': (x) => Array.isArray(x.json()),
    });
  });

  group('Simulación de crédito', () => {
    const body = { productId: data.productId, monto: data.montoMin * 2, plazoMeses: 12 };
    const r = http.post(`${API}/products/simulate`, JSON.stringify(body), { headers: json, tags: { endpoint: 'simular' } });
    tSimular.add(r.timings.duration);
    check(r, {
      'simulación 200': (x) => x.status === 200,
      'simulación trae cuota': (x) => x.json('cuota') > 0,
    });
  });

  group('Bandeja de solicitudes (autenticado)', () => {
    const r = http.get(`${API}/applications`, {
      headers: { Authorization: `Bearer ${data.token}` },
      tags: { endpoint: 'solicitudes' },
    });
    tSolicitudes.add(r.timings.duration);
    check(r, { 'solicitudes 200': (x) => x.status === 200 });
  });

  const h = http.get(`${API}/health`, { tags: { endpoint: 'health' } });
  tHealth.add(h.timings.duration);
  check(h, { 'health 200 ok': (x) => x.status === 200 && x.json('status') === 'ok' });

  sleep(1); // tiempo de "pensar" del usuario entre iteraciones
}

// Resumen en consola + archivos para la evidencia
export function handleSummary(data) {
  const m = data.metrics;
  const fila = (nombre, k) =>
    m[k] ? `| ${nombre} | ${m[k].values.avg.toFixed(0)} ms | ${m[k].values['p(95)'].toFixed(0)} ms | ${m[k].values.max.toFixed(0)} ms |` : '';
  const dur = data.state.testRunDurationMs / 1000;
  const reqs = m.http_reqs.values.count;
  const md = [
    '# Resultado prueba de carga CrediTrack (k6)',
    '',
    `Ambiente: ${API}  |  Duración: ${dur.toFixed(0)} s  |  VU máx: ${m.vus_max.values.max}`,
    '',
    '| Endpoint | Promedio | p95 | Máximo |',
    '|---|---|---|---|',
    fila('GET /products', 't_productos'),
    fila('POST /products/simulate', 't_simular'),
    fila('GET /applications', 't_solicitudes'),
    fila('GET /health', 't_health'),
    fila('Global (todas)', 'http_req_duration'),
    '',
    `Peticiones: ${reqs}  |  Throughput: ${(reqs / dur).toFixed(1)} req/s  |  Tasa de error: ${(m.http_req_failed.values.rate * 100).toFixed(2)} %`,
    `Checks aprobados: ${(m.checks.values.rate * 100).toFixed(2)} %`,
    '',
    'Umbrales: ' + Object.entries(data.metrics).filter(([, v]) => v.thresholds)
      .map(([k, v]) => `${k} ${Object.values(v.thresholds).every((t) => t.ok) ? 'CUMPLE' : 'NO CUMPLE'}`).join('; '),
  ].join('\n');
  return {
    stdout: md + '\n',
    'reportes/k6-resumen.md': md,
    'reportes/k6-resumen.json': JSON.stringify(data, null, 2),
  };
}
