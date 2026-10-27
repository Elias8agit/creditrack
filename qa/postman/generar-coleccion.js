// Genera la colección de Postman de CrediTrack (formato v2.1) y los ambientes.
// Uso: node qa/postman/generar-coleccion.js
const fs = require('node:fs');
const path = require('node:path');

const json = { key: 'Content-Type', value: 'application/json' };
const auth = (v) => ({ key: 'Authorization', value: `Bearer {{${v}}}` });

function req(name, method, url, { token, body, tests, pre } = {}) {
  const header = [json];
  if (token) header.push(auth(token));
  const item = {
    name,
    request: {
      method,
      header,
      url: { raw: `{{baseUrl}}${url}`, host: ['{{baseUrl}}'], path: url.split('?')[0].split('/').filter(Boolean) },
    },
    event: [],
  };
  if (url.includes('?')) {
    item.request.url.query = url.split('?')[1].split('&').map((q) => { const [key, value] = q.split('='); return { key, value }; });
  }
  if (body) {
    // Las variables numéricas ({{microId}}, {{montoPago}}) se envían sin comillas para que lleguen como número
    const raw = JSON.stringify(body, null, 2).replace(/"\{\{(microId|montoPago)\}\}"/g, '{{$1}}');
    item.request.body = { mode: 'raw', raw, options: { raw: { language: 'json' } } };
  }
  if (pre) item.event.push({ listen: 'prerequest', script: { type: 'text/javascript', exec: pre.split('\n') } });
  if (tests) item.event.push({ listen: 'test', script: { type: 'text/javascript', exec: tests.split('\n') } });
  return item;
}

const schemaApp = `const esquemaSolicitud = {
  type: 'object',
  required: ['id', 'estado', 'monto', 'plazoMeses', 'cuota', 'tasaAnual', 'producto'],
  properties: {
    id: { type: 'integer' }, estado: { type: 'string' }, monto: { type: 'number' },
    plazoMeses: { type: 'integer' }, cuota: { type: 'number' }, tasaAnual: { type: 'number' }, producto: { type: 'string' }
  }
};`;

const items = [
  {
    name: '1. Salud y catálogo',
    item: [
      req('Health check', 'GET', '/health', {
        tests: `pm.test('200 OK', () => pm.response.to.have.status(200));
pm.test('Esquema del health check', () => pm.response.to.have.jsonSchema({ type: 'object', required: ['status', 'servicio', 'fecha'], properties: { status: { type: 'string' }, servicio: { type: 'string' }, fecha: { type: 'string' } } }));
pm.test('El servicio reporta status ok', () => pm.expect(pm.response.json().status).to.eql('ok'));
pm.test('Responde en menos de 1500 ms', () => pm.expect(pm.response.responseTime).to.be.below(1500));`,
      }),
      req('Listar productos activos', 'GET', '/products', {
        tests: `pm.test('200 OK', () => pm.response.to.have.status(200));
pm.test('Esquema: arreglo de productos', () => pm.response.to.have.jsonSchema({ type: 'array', minItems: 1, items: { type: 'object', required: ['id', 'codigo', 'montoMin', 'montoMax', 'plazoMin', 'plazoMax', 'tasaAnual'] } }));
const micro = pm.response.json().find((p) => p.codigo === 'MICRO');
pm.test('Microcrédito con límites Q1,000 a Q25,000 y 3 a 24 meses', () => {
  pm.expect(micro).to.include({ montoMin: 1000, montoMax: 25000, plazoMin: 3, plazoMax: 24 });
});
pm.collectionVariables.set('microId', micro.id);`,
      }),
      req('Simular crédito (sistema francés)', 'POST', '/products/simulate', {
        body: { productId: '{{microId}}', monto: 10000, plazoMeses: 12 },
        tests: `pm.test('200 OK', () => pm.response.to.have.status(200));
pm.test('Esquema de la simulación', () => pm.response.to.have.jsonSchema({ type: 'object', required: ['cuota', 'totalPagar', 'totalIntereses', 'tabla'], properties: { tabla: { type: 'array' } } }));
const r = pm.response.json();
pm.test('Cuota de Q10,000 a 12 meses al 24 % = Q945.60', () => pm.expect(r.cuota).to.eql(945.6));
pm.test('Tabla de 12 cuotas con saldo final 0', () => { pm.expect(r.tabla).to.have.length(12); pm.expect(r.tabla[11].saldo).to.eql(0); });`,
      }),
      req('Simular con monto fuera de rango', 'POST', '/products/simulate', {
        body: { productId: '{{microId}}', monto: 999.99, plazoMeses: 12 },
        tests: `pm.test('400 Bad Request', () => pm.response.to.have.status(400));
pm.test('Esquema de error con detalles', () => pm.response.to.have.jsonSchema({ type: 'object', required: ['error', 'detalles'], properties: { error: { type: 'string' }, detalles: { type: 'array' } } }));
pm.test('Indica el rango permitido', () => pm.expect(pm.response.json().detalles[0]).to.include('El monto debe estar entre'));`,
      }),
    ],
  },
  {
    name: '2. Autenticación y acceso',
    item: [
      req('Registrar cliente nuevo', 'POST', '/auth/register', {
        pre: `// Genera un email único y un DPI cuyo score en el buró simulado sea >= 700 (preaprobación)
const score = (d) => 300 + ((d.split('').reduce((a, c) => a + Number(c), 0) * 37) % 551);
let dpi;
do { dpi = '4' + String(Math.floor(Math.random() * 1e12)).padStart(12, '0'); } while (score(dpi) < 700);
pm.collectionVariables.set('clienteDpi', dpi);
pm.collectionVariables.set('clienteEmail', 'newman.' + Date.now() + '@test.com');`,
        body: { nombre: 'Cliente Newman', email: '{{clienteEmail}}', password: 'Newman2026', dpi: '{{clienteDpi}}', fechaNacimiento: '1990-01-15', ingresoMensual: 20000, deudasMensuales: 500 },
        tests: `pm.test('201 Created', () => pm.response.to.have.status(201));
pm.test('Esquema: token y usuario', () => pm.response.to.have.jsonSchema({ type: 'object', required: ['token', 'usuario'], properties: { token: { type: 'string' }, usuario: { type: 'object', required: ['id', 'email', 'rol'] } } }));
pm.test('El usuario se crea con rol CLIENTE', () => pm.expect(pm.response.json().usuario.rol).to.eql('CLIENTE'));
pm.collectionVariables.set('clienteToken', pm.response.json().token);`,
      }),
      req('Registrar email duplicado', 'POST', '/auth/register', {
        body: { nombre: 'Cliente Duplicado', email: '{{clienteEmail}}', password: 'Newman2026', dpi: '4999999999999', fechaNacimiento: '1990-01-15', ingresoMensual: 20000 },
        tests: `pm.test('409 Conflict', () => pm.response.to.have.status(409));
pm.test('Mensaje de email ya registrado', () => pm.expect(pm.response.json().error).to.eql('El email ya está registrado'));`,
      }),
      req('Login analista', 'POST', '/auth/login', {
        body: { email: 'analista@creditrack.test', password: 'Analista123!' },
        tests: `pm.test('200 OK', () => pm.response.to.have.status(200));
pm.test('Rol ANALISTA', () => pm.expect(pm.response.json().usuario.rol).to.eql('ANALISTA'));
pm.collectionVariables.set('analistaToken', pm.response.json().token);`,
      }),
      req('Login administrador', 'POST', '/auth/login', {
        body: { email: 'admin@creditrack.test', password: 'Admin123!' },
        tests: `pm.test('200 OK', () => pm.response.to.have.status(200));
pm.test('Rol ADMIN', () => pm.expect(pm.response.json().usuario.rol).to.eql('ADMIN'));
pm.collectionVariables.set('adminToken', pm.response.json().token);`,
      }),
      req('Login con contraseña incorrecta', 'POST', '/auth/login', {
        body: { email: '{{clienteEmail}}', password: 'Incorrecta1' }, // cliente recién creado: el contador de intentos no se acumula entre ejecuciones
        tests: `pm.test('401 Unauthorized', () => pm.response.to.have.status(401));
pm.test('Mensaje genérico', () => pm.expect(pm.response.json().error).to.eql('Credenciales inválidas'));`,
      }),
      req('Perfil del cliente (me)', 'GET', '/auth/me', {
        token: 'clienteToken',
        tests: `pm.test('200 OK', () => pm.response.to.have.status(200));
pm.test('Esquema del perfil', () => pm.response.to.have.jsonSchema({ type: 'object', required: ['id', 'email', 'rol', 'dpi', 'ingresoMensual'] }));
pm.test('No expone la contraseña ni su hash', () => pm.expect(pm.response.text()).to.not.match(/password/i));`,
      }),
      req('Listar solicitudes sin token', 'GET', '/applications', {
        tests: `pm.test('401 Unauthorized', () => pm.response.to.have.status(401));`,
      }),
      req('Cliente intenta listar usuarios', 'GET', '/users', {
        token: 'clienteToken',
        tests: `pm.test('403 Forbidden', () => pm.response.to.have.status(403));`,
      }),
    ],
  },
  {
    name: '3. Flujo de negocio: solicitud hasta crédito finalizado',
    item: [
      req('Crear solicitud (BORRADOR)', 'POST', '/applications', {
        token: 'clienteToken',
        body: { productId: '{{microId}}', monto: 3000, plazoMeses: 3, destino: 'Compra de mercadería para tienda' },
        tests: `${schemaApp}
pm.test('201 Created', () => pm.response.to.have.status(201));
pm.test('Esquema de la solicitud', () => pm.response.to.have.jsonSchema(esquemaSolicitud));
const r = pm.response.json();
pm.test('Estado BORRADOR y cuota Q1,040.26', () => { pm.expect(r.estado).to.eql('BORRADOR'); pm.expect(r.cuota).to.eql(1040.26); });
pm.collectionVariables.set('appId', r.id);`,
      }),
      req('Enviar solicitud (pre-evaluación)', 'POST', '/applications/{{appId}}/submit', {
        token: 'clienteToken',
        tests: `pm.test('200 OK', () => pm.response.to.have.status(200));
const r = pm.response.json();
pm.test('Queda EN_REVISION con recomendación PREAPROBADA (regla R5)', () => { pm.expect(r.estado).to.eql('EN_REVISION'); pm.expect(r.recomendacion).to.eql('PREAPROBADA'); });
pm.test('Registra score del buró y relación deuda/ingreso', () => { pm.expect(r.score).to.be.at.least(700); pm.expect(r.rdi).to.be.below(0.3); });`,
      }),
      req('Bandeja del analista (EN_REVISION)', 'GET', '/applications?estado=EN_REVISION', {
        token: 'analistaToken',
        tests: `pm.test('200 OK', () => pm.response.to.have.status(200));
pm.test('Esquema: arreglo de solicitudes', () => pm.response.to.have.jsonSchema({ type: 'array', items: { type: 'object', required: ['id', 'estado', 'cliente'] } }));
pm.test('Contiene la solicitud enviada', () => pm.expect(pm.response.json().map((a) => a.id)).to.include(Number(pm.collectionVariables.get('appId'))));`,
      }),
      req('Analista aprueba', 'POST', '/applications/{{appId}}/evaluate', {
        token: 'analistaToken',
        body: { decision: 'APROBAR' },
        tests: `pm.test('200 OK', () => pm.response.to.have.status(200));
pm.test('Estado APROBADA', () => pm.expect(pm.response.json().estado).to.eql('APROBADA'));`,
      }),
      req('Administrador desembolsa', 'POST', '/applications/{{appId}}/disburse', {
        token: 'adminToken',
        pre: `// Fecha de desembolso tres meses atrás para poder pagar las tres cuotas ya vencidas
const d = new Date(); d.setUTCMonth(d.getUTCMonth() - 3);
pm.collectionVariables.set('fechaDesembolso', d.toISOString().slice(0, 10));`,
        body: { fechaDesembolso: '{{fechaDesembolso}}' },
        tests: `pm.test('200 OK', () => pm.response.to.have.status(200));
const r = pm.response.json();
pm.test('Estado DESEMBOLSADA con plan de 3 cuotas', () => { pm.expect(r.estado).to.eql('DESEMBOLSADA'); pm.expect(r.planPagos).to.have.length(3); });
pm.test('Esquema del plan de pagos', () => pm.expect(r.planPagos[0]).to.include.all.keys('numero', 'fechaVencimiento', 'cuota', 'saldo', 'estado'));
pm.collectionVariables.set('planPagos', JSON.stringify(r.planPagos));`,
      }),
      req('Cotizar cuota 1 en su vencimiento', 'GET', '/applications/{{appId}}/payments/quote?fechaPago={{fechaPago}}', {
        token: 'analistaToken',
        pre: `const plan = JSON.parse(pm.collectionVariables.get('planPagos'));
pm.collectionVariables.set('fechaPago', plan[0].fechaVencimiento);`,
        tests: `pm.test('200 OK', () => pm.response.to.have.status(200));
const r = pm.response.json();
pm.test('Sin atraso no hay recargo y el total es la cuota', () => { pm.expect(r.recargo).to.eql(0); pm.expect(r.total).to.eql(r.cuota); });`,
      }),
      ...[1, 2, 3].map((n) => req(`Registrar pago de la cuota ${n}`, 'POST', '/applications/{{appId}}/payments', {
        token: 'analistaToken',
        pre: `const c = JSON.parse(pm.collectionVariables.get('planPagos'))[${n - 1}];
pm.collectionVariables.set('fechaPago', c.fechaVencimiento);
pm.collectionVariables.set('montoPago', c.cuota);`,
        body: { fechaPago: '{{fechaPago}}', monto: '{{montoPago}}' },
        tests: `pm.test('201 Created', () => pm.response.to.have.status(201));
pm.test('Se aplica a la cuota ${n}', () => pm.expect(pm.response.json().cuotaNumero).to.eql(${n}));
pm.test('Estado del crédito: ${n === 3 ? 'FINALIZADA' : 'DESEMBOLSADA'}', () => pm.expect(pm.response.json().estadoSolicitud).to.eql('${n === 3 ? 'FINALIZADA' : 'DESEMBOLSADA'}'));`,
      })),
      req('Cliente consulta su crédito finalizado', 'GET', '/applications/{{appId}}', {
        token: 'clienteToken',
        tests: `${schemaApp}
pm.test('200 OK', () => pm.response.to.have.status(200));
pm.test('Esquema de la solicitud', () => pm.response.to.have.jsonSchema(esquemaSolicitud));
const r = pm.response.json();
pm.test('Historial completo del ciclo de vida', () => pm.expect(r.historial.map((h) => h.estadoNuevo).join('>')).to.eql('BORRADOR>ENVIADA>EN_REVISION>APROBADA>DESEMBOLSADA>FINALIZADA'));
pm.test('Las 3 cuotas quedan PAGADA', () => pm.expect(r.planPagos.every((c) => c.estado === 'PAGADA')).to.be.true);`,
      }),
      req('Pago sobre crédito finalizado', 'POST', '/applications/{{appId}}/payments', {
        token: 'analistaToken',
        body: { fechaPago: '{{fechaPago}}', monto: 100 },
        tests: `pm.test('409 Conflict', () => pm.response.to.have.status(409));`,
      }),
    ],
  },
  {
    name: '4. Reportes',
    item: [
      req('Reporte de cartera', 'GET', '/reports/summary', {
        token: 'adminToken',
        tests: `pm.test('200 OK', () => pm.response.to.have.status(200));
pm.test('Esquema del reporte', () => pm.response.to.have.jsonSchema({ type: 'object', required: ['porEstado', 'montoAprobado', 'montoDesembolsado', 'tasaAprobacion', 'cuotasVencidas'] }));
pm.test('Incluye al menos un crédito FINALIZADO', () => pm.expect(pm.response.json().porEstado.map((e) => e.estado)).to.include('FINALIZADA'));`,
      }),
    ],
  },
];

const collection = {
  info: {
    name: 'CrediTrack API',
    description: 'Pruebas de API de CrediTrack (Fase 2, E11). Incluye el flujo de negocio completo: registro, solicitud, pre-evaluación, aprobación, desembolso, pagos y finalización. Se ejecuta con Newman en el pipeline.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  item: items,
  variable: [{ key: 'microId', value: '1' }],
};

const env = (name, baseUrl) => ({ name, values: [{ key: 'baseUrl', value: baseUrl, enabled: true }], _postman_variable_scope: 'environment' });

const dir = __dirname;
fs.writeFileSync(path.join(dir, 'CrediTrack.postman_collection.json'), JSON.stringify(collection, null, 2) + '\n');
fs.writeFileSync(path.join(dir, 'local.postman_environment.json'), JSON.stringify(env('CrediTrack local / CI', 'http://localhost:3000/api'), null, 2) + '\n');
fs.writeFileSync(path.join(dir, 'render.postman_environment.json'), JSON.stringify(env('CrediTrack Render', 'https://creditrack-api.onrender.com/api'), null, 2) + '\n');
const count = items.reduce((a, f) => a + f.item.length, 0);
console.log(`Colección generada: ${count} solicitudes`);
