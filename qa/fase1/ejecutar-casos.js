// Ejecución de casos de prueba de la Fase 1 contra CrediTrack (API + UI)
const fs = require('fs');
const { chromium } = require('playwright');

const API = process.env.API || 'http://localhost:3000/api';
const WEB = process.env.WEB || 'http://localhost:5173';
const EVID = 'evidencias';
fs.mkdirSync(EVID, { recursive: true });

// ---------- utilidades ----------
const TZ = 'America/Guatemala';
const localDate = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
const shift = (str, { y = 0, m = 0, d = 0 }) => {
  const [Y, M, D] = str.split('-').map(Number);
  const dt = new Date(Date.UTC(Y + y, M - 1 + m, 1));
  const last = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
  dt.setUTCDate(Math.min(D, last));
  dt.setUTCDate(dt.getUTCDate() + d);
  return dt.toISOString().slice(0, 10);
};
const HOY = localDate();

async function call(method, path, { token, body, raw } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const t0 = Date.now();
  const res = await fetch(`${API}${path}`, { method, headers, body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined });
  const ms = Date.now() - t0;
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, ms, headers: Object.fromEntries(res.headers.entries()), req: { method, path, body } };
}
const login = async (email, password) => (await call('POST', '/auth/login', { body: { email, password } })).data.token;
let seq = 0;
async function newClient(over = {}) {
  seq += 1;
  const body = {
    nombre: `Cliente Prueba ${seq}`, email: `qa${seq}.${Date.now()}@test.com`, password: 'Prueba123!',
    dpi: over.dpi || `3${String(Date.now()).slice(-8)}${String(seq).padStart(4, '0')}`,
    fechaNacimiento: '1990-01-01', ingresoMensual: 20000, deudasMensuales: 0, ...over,
  };
  const r = await call('POST', '/auth/register', { body });
  if (r.status !== 201) throw new Error(`registro falló: ${JSON.stringify(r.data)}`);
  return { token: r.data.token, id: r.data.usuario.id, body };
}
const createApp = (token, productId, monto, plazoMeses, destino = 'Capital de trabajo para negocio') =>
  call('POST', '/applications', { token, body: { productId, monto, plazoMeses, destino } });
const submit = (token, id) => call('POST', `/applications/${id}/submit`, { token });
const evaluate = (token, id, decision, comentario) => call('POST', `/applications/${id}/evaluate`, { token, body: { decision, comentario } });
const disburse = (token, id, fechaDesembolso) => call('POST', `/applications/${id}/disburse`, { token, body: { fechaDesembolso } });
const pay = (token, id, fechaPago, monto) => call('POST', `/applications/${id}/payments`, { token, body: { fechaPago, monto } });
const quote = (token, id, fechaPago) => call('GET', `/applications/${id}/payments/quote?fechaPago=${fechaPago}`, { token });

// cálculo independiente (oráculo) de la cuota francesa
const oracleCuota = (P, tasa, n) => { const i = tasa / 12; return Math.round((P * i / (1 - (1 + i) ** -n)) * 100) / 100; };

// ---------- registro de resultados ----------
const results = [];
function makeCase(id) {
  const steps = [];
  const evidence = [];
  return {
    check(desc, expected, obtained, ok) { steps.push({ desc, expected, obtained: String(obtained), ok: !!ok }); },
    ev(r) { evidence.push(r); return r; },
    done() {
      const ok = steps.every((s) => s.ok);
      results.push({ id, resultado: ok ? 'Aprobado' : 'Fallido', steps });
      fs.writeFileSync(`${EVID}/${id}.json`, JSON.stringify({ id, fechaEjecucion: new Date().toISOString(), steps, evidence }, null, 2));
      console.log(`${id}: ${ok ? 'APROBADO' : 'FALLIDO'}${ok ? '' : ' -> ' + steps.filter((s) => !s.ok).map((s) => s.desc + ' | obtenido: ' + s.obtained).join(' ; ')}`);
    },
  };
}
async function tc(id, fn) {
  const c = makeCase(id);
  try { await fn(c); } catch (e) { c.check('Ejecución sin excepción', 'sin error', e.message, false); }
  c.done();
}

(async () => {
  const ADMIN = await login('admin@creditrack.test', 'Admin123!');
  const ANALISTA = await login('analista@creditrack.test', 'Analista123!');
  const ANA = await login('ana@creditrack.test', 'Cliente123!');
  const BRUNO = await login('bruno@creditrack.test', 'Cliente123!');
  const CARLA = await login('carla@creditrack.test', 'Cliente123!');
  const DIEGO = await login('diego@creditrack.test', 'Cliente123!');
  const ELENA = await login('elena@creditrack.test', 'Cliente123!');
  const FABIO = await login('fabio@creditrack.test', 'Cliente123!');

  // ================= AUTENTICACIÓN =================
  await tc('CP-01', async (c) => {
    const r = c.ev(await call('POST', '/auth/register', { body: { nombre: 'María Gómez', email: `maria.${Date.now()}@test.com`, password: 'Segura123', dpi: '2000000000019', fechaNacimiento: '1994-06-15', ingresoMensual: 9500, deudasMensuales: 1200, telefono: '55512345' } }));
    c.check('Registro con datos válidos', '201 con token y rol CLIENTE', `${r.status} rol=${r.data.usuario?.rol} token=${!!r.data.token}`, r.status === 201 && r.data.usuario?.rol === 'CLIENTE' && r.data.token);
  });
  await tc('CP-02', async (c) => {
    const r = c.ev(await call('POST', '/auth/register', { body: { nombre: 'Pedro Luna', email: 'pedro.test.com', password: 'Segura123', dpi: '2000000000028', fechaNacimiento: '1990-01-01', ingresoMensual: 8000 } }));
    c.check('Email sin @', '400 "El email no tiene un formato válido"', `${r.status} ${JSON.stringify(r.data.detalles)}`, r.status === 400 && r.data.detalles?.includes('El email no tiene un formato válido'));
  });
  await tc('CP-03', async (c) => {
    const r = c.ev(await call('POST', '/auth/register', { body: { nombre: 'Pedro Luna', email: `p3.${Date.now()}@test.com`, password: 'segura123', dpi: '2000000000028', fechaNacimiento: '1990-01-01', ingresoMensual: 8000 } }));
    c.check('Contraseña sin mayúscula', '400 con mensaje de política de contraseña', `${r.status} ${JSON.stringify(r.data.detalles)}`, r.status === 400 && JSON.stringify(r.data.detalles).includes('mayúscula'));
  });
  await tc('CP-04', async (c) => {
    const r = c.ev(await call('POST', '/auth/register', { body: { nombre: 'Pedro Luna', email: `p4.${Date.now()}@test.com`, password: 'Segura123', dpi: '12345ABC67890', fechaNacimiento: '1990-01-01', ingresoMensual: 8000 } }));
    c.check('DPI con letras', '400 "El DPI debe tener exactamente 13 dígitos"', `${r.status} ${JSON.stringify(r.data.detalles)}`, r.status === 400 && JSON.stringify(r.data.detalles).includes('13 dígitos'));
  });
  await tc('CP-05', async (c) => {
    const r = c.ev(await call('POST', '/auth/register', { body: { nombre: 'Ana Copia', email: 'ANA@creditrack.test', password: 'Segura123', dpi: '2000000000029', fechaNacimiento: '1990-01-01', ingresoMensual: 8000 } }));
    c.check('Email ya registrado (en mayúsculas)', '409 "El email ya está registrado"', `${r.status} ${r.data.error}`, r.status === 409);
  });
  await tc('CP-06', async (c) => {
    const base = { nombre: 'Luis Borde', dpi: '2000000000037', fechaNacimiento: '1990-01-01', ingresoMensual: 8000 };
    const r7 = c.ev(await call('POST', '/auth/register', { body: { ...base, email: `b7.${Date.now()}@test.com`, password: 'Abcde12' } }));
    c.check('Contraseña de 7 caracteres', '400', r7.status, r7.status === 400);
    const r8 = c.ev(await call('POST', '/auth/register', { body: { ...base, email: `b8.${Date.now()}@test.com`, password: 'Abcdef12' } }));
    c.check('Contraseña de 8 caracteres', '201', r8.status, r8.status === 201);
  });
  await tc('CP-07', async (c) => {
    const cumpleHoy = shift(HOY, { y: -18 });
    const cumpleManana = shift(HOY, { y: -18, d: 1 });
    const a = c.ev(await call('POST', '/auth/register', { body: { nombre: 'Joven Hoy', email: `e18a.${Date.now()}@test.com`, password: 'Segura123', dpi: '2000000000038', fechaNacimiento: cumpleHoy, ingresoMensual: 4000 } }));
    c.check(`Cumple 18 años hoy (${cumpleHoy}, fecha local Guatemala ${HOY})`, '201', a.status, a.status === 201);
    const b = c.ev(await call('POST', '/auth/register', { body: { nombre: 'Joven Mañana', email: `e18b.${Date.now()}@test.com`, password: 'Segura123', dpi: '2000000000039', fechaNacimiento: cumpleManana, ingresoMensual: 4000 } }));
    c.check(`Cumple 18 años mañana (${cumpleManana})`, '400 "El cliente debe ser mayor de edad"', `${b.status} ${JSON.stringify(b.data.detalles || b.data.usuario)}`, b.status === 400);
  });
  await tc('CP-08', async (c) => {
    const r = c.ev(await call('POST', '/auth/login', { body: { email: 'analista@creditrack.test', password: 'Analista123!' } }));
    c.check('Login válido', '200 con token y rol ANALISTA', `${r.status} rol=${r.data.usuario?.rol}`, r.status === 200 && r.data.usuario?.rol === 'ANALISTA' && r.data.token);
  });
  await tc('CP-09', async (c) => {
    const r = c.ev(await call('POST', '/auth/login', { body: { email: 'bruno@creditrack.test', password: 'Incorrecta1' } }));
    c.check('Contraseña incorrecta', '401 "Credenciales inválidas"', `${r.status} ${r.data.error}`, r.status === 401 && r.data.error === 'Credenciales inválidas');
    const r2 = c.ev(await call('POST', '/auth/login', { body: { email: 'noexiste@creditrack.test', password: 'Incorrecta1' } }));
    c.check('Email inexistente', '401 "Credenciales inválidas" (mismo mensaje)', `${r2.status} ${r2.data.error}`, r2.status === 401 && r2.data.error === 'Credenciales inválidas');
  });
  await tc('CP-10', async (c) => {
    const u = await newClient();
    for (let i = 1; i <= 4; i += 1) {
      const r = c.ev(await call('POST', '/auth/login', { body: { email: u.body.email, password: 'Mala1234' } }));
      if (i === 4) c.check('4.º intento fallido', '401 (aún no bloquea)', r.status, r.status === 401);
    }
    const r5 = c.ev(await call('POST', '/auth/login', { body: { email: u.body.email, password: 'Mala1234' } }));
    c.check('5.º intento fallido', '423 cuenta bloqueada', r5.status, r5.status === 423);
    const ok = c.ev(await call('POST', '/auth/login', { body: { email: u.body.email, password: 'Prueba123!' } }));
    c.check('Contraseña correcta durante bloqueo', '423', ok.status, ok.status === 423);
  });
  await tc('CP-11', async (c) => {
    const u = await newClient();
    const d = c.ev(await call('PATCH', `/users/${u.id}/active`, { token: ADMIN, body: { activo: false } }));
    c.check('Admin desactiva usuario', '200', d.status, d.status === 200);
    const r = c.ev(await call('POST', '/auth/login', { body: { email: u.body.email, password: 'ClaveFalsa9' } }));
    c.check('Usuario desactivado + contraseña incorrecta', '401 "Credenciales inválidas" (no revela estado de la cuenta)', `${r.status} ${r.data.error}`, r.status === 401);
    const r2 = c.ev(await call('POST', '/auth/login', { body: { email: u.body.email, password: 'Prueba123!' } }));
    c.check('Usuario desactivado + contraseña correcta', '403 "El usuario está desactivado"', `${r2.status} ${r2.data.error}`, r2.status === 403);
  });

  // ================= SIMULADOR =================
  await tc('CP-12', async (c) => {
    const r = c.ev(await call('POST', '/products/simulate', { body: { productId: 1, monto: 10000, plazoMeses: 12 } }));
    const esperado = oracleCuota(10000, 0.24, 12);
    const sumCap = Math.round(r.data.tabla.reduce((a, x) => a + x.capital, 0) * 100) / 100;
    c.check('Cuota MICRO Q10,000 a 12 meses', `Q${esperado}`, r.data.cuota, r.data.cuota === esperado);
    c.check('Tabla con 12 filas y saldo final 0', '12 filas, saldo 0', `${r.data.tabla.length} filas, saldo ${r.data.tabla.at(-1).saldo}`, r.data.tabla.length === 12 && r.data.tabla.at(-1).saldo === 0);
    c.check('Suma de capital = monto', '10000', sumCap, sumCap === 10000);
  });
  await tc('CP-13', async (c) => {
    for (const [m, exp] of [[999.99, 400], [1000, 200], [25000, 200], [25000.01, 400]]) {
      const r = c.ev(await call('POST', '/products/simulate', { body: { productId: 1, monto: m, plazoMeses: 12 } }));
      c.check(`MICRO monto ${m}`, exp, r.status, r.status === exp);
    }
  });
  await tc('CP-14', async (c) => {
    for (const [p, exp] of [[2, 400], [3, 200], [24, 200], [25, 400]]) {
      const r = c.ev(await call('POST', '/products/simulate', { body: { productId: 1, monto: 5000, plazoMeses: p } }));
      c.check(`MICRO plazo ${p} meses`, exp, r.status, r.status === exp);
    }
  });

  // ================= SOLICITUDES =================
  await tc('CP-15', async (c) => {
    const u = await newClient();
    for (const [len, exp] of [[9, 400], [10, 201], [200, 201], [201, 400]]) {
      const r = c.ev(await createApp(u.token, 1, 5000, 12, 'x'.repeat(len)));
      c.check(`Destino de ${len} caracteres`, exp, r.status, r.status === exp);
      if (r.status === 201) await call('POST', `/applications/${r.data.id}/cancel`, { token: u.token });
    }
  });
  let appAnaFlujo;
  await tc('CP-16', async (c) => {
    const r = c.ev(await createApp(ANA, 1, 3000, 3, 'Compra de mercadería para tienda'));
    appAnaFlujo = r.data.id;
    c.check('Crear solicitud MICRO Q3,000 / 3 meses', `201 BORRADOR cuota ${oracleCuota(3000, 0.24, 3)}`, `${r.status} ${r.data.estado} cuota ${r.data.cuota}`, r.status === 201 && r.data.estado === 'BORRADOR' && r.data.cuota === oracleCuota(3000, 0.24, 3));
  });
  await tc('CP-17', async (c) => {
    const u = await newClient();
    for (let i = 1; i <= 3; i += 1) {
      const r = c.ev(await createApp(u.token, 1, 2000, 6));
      c.check(`Solicitud activa n.º ${i}`, 201, r.status, r.status === 201);
    }
    const r4 = c.ev(await createApp(u.token, 1, 2000, 6));
    c.check('Solicitud activa n.º 4', '409 máximo 3 activas', `${r4.status} ${r4.data.error}`, r4.status === 409);
  });
  await tc('CP-18', async (c) => {
    const r = c.ev(await call('GET', `/applications/${appAnaFlujo}`, { token: BRUNO }));
    c.check('Bruno consulta solicitud de Ana', '404 (no revela existencia)', r.status, r.status === 404);
    const l = c.ev(await call('GET', '/applications', { token: BRUNO }));
    c.check('Listado de Bruno no contiene solicitudes de Ana', 'ninguna de Ana', l.data.filter((a) => a.cliente === 'Ana López').length, l.data.every((a) => a.cliente !== 'Ana López'));
  });
  await tc('CP-19', async (c) => {
    const r = c.ev(await createApp(ANALISTA, 1, 5000, 12));
    c.check('Analista intenta crear solicitud', '403', r.status, r.status === 403);
    const r2 = c.ev(await call('GET', '/users', { token: ANALISTA }));
    c.check('Analista intenta listar usuarios', '403', r2.status, r2.status === 403);
  });
  await tc('CP-20', async (c) => {
    const r = c.ev(await call('GET', '/applications'));
    c.check('Sin token', '401', r.status, r.status === 401);
    const r2 = c.ev(await call('GET', '/applications', { token: ANA.slice(0, -3) + 'abc' }));
    c.check('Token con firma alterada', '401', r2.status, r2.status === 401);
  });

  // ================= PRE-EVALUACIÓN (tabla de decisión) =================
  await tc('CP-21', async (c) => {
    const a = await createApp(DIEGO, 1, 5000, 12);
    const r = c.ev(await submit(DIEGO, a.data.id));
    c.check('R1: cliente con mora activa (score 720)', 'RECHAZADA / MORA_ACTIVA', `${r.data.estado} / ${r.data.motivoRechazo}`, r.data.estado === 'RECHAZADA' && r.data.motivoRechazo === 'MORA_ACTIVA');
  });
  let appCarla;
  await tc('CP-22', async (c) => {
    const a = await createApp(CARLA, 1, 5000, 12);
    appCarla = a.data.id;
    const r = c.ev(await submit(CARLA, a.data.id));
    c.check('R3: score 560', 'RECHAZADA / SCORE_INSUFICIENTE', `${r.data.estado} / ${r.data.motivoRechazo}`, r.data.estado === 'RECHAZADA' && r.data.motivoRechazo === 'SCORE_INSUFICIENTE');
  });
  await tc('CP-23', async (c) => {
    const a = await createApp(BRUNO, 2, 150000, 60);
    const r = c.ev(await submit(BRUNO, a.data.id));
    c.check('R4: RDI > 40 % (Bruno, Q150,000 / 60 meses)', 'RECHAZADA / CAPACIDAD_PAGO', `${r.data.estado} / ${r.data.motivoRechazo} RDI=${r.data.rdi}`, r.data.estado === 'RECHAZADA' && r.data.motivoRechazo === 'CAPACIDAD_PAGO');
  });
  await tc('CP-24', async (c) => {
    const r = c.ev(await submit(ANA, appAnaFlujo));
    c.check('R5: score 780 y RDI ≤ 30 %', 'EN_REVISION / PREAPROBADA', `${r.data.estado} / ${r.data.recomendacion} RDI=${r.data.rdi}`, r.data.estado === 'EN_REVISION' && r.data.recomendacion === 'PREAPROBADA');
  });
  let appBrunoMicro;
  await tc('CP-25', async (c) => {
    const a = await createApp(BRUNO, 1, 5000, 12);
    appBrunoMicro = a.data.id;
    const r = c.ev(await submit(BRUNO, a.data.id));
    c.check('R6: score 650 y RDI 12 %', 'EN_REVISION / REVISION_MANUAL', `${r.data.estado} / ${r.data.recomendacion}`, r.data.estado === 'EN_REVISION' && r.data.recomendacion === 'REVISION_MANUAL');
  });
  await tc('CP-26', async (c) => {
    const a = await createApp(ELENA, 2, 100000, 36);
    const r = c.ev(await submit(ELENA, a.data.id));
    c.check('R6: score 700 con RDI entre 30 % y 40 %', 'EN_REVISION / REVISION_MANUAL', `${r.data.estado} / ${r.data.recomendacion} RDI=${r.data.rdi}`, r.data.estado === 'EN_REVISION' && r.data.recomendacion === 'REVISION_MANUAL' && r.data.rdi > 0.3 && r.data.rdi <= 0.4);
  });
  await tc('CP-27', async (c) => {
    const u600 = await newClient({ dpi: '1000000000707' });
    const u599 = await newClient({ dpi: '1000000000808' });
    const a = await createApp(u600.token, 1, 5000, 12);
    const r = c.ev(await submit(u600.token, a.data.id));
    c.check('Score 600 (límite inferior aceptado)', 'EN_REVISION', `${r.data.estado} score=${r.data.score}`, r.data.estado === 'EN_REVISION');
    const b = await createApp(u599.token, 1, 5000, 12);
    const r2 = c.ev(await submit(u599.token, b.data.id));
    c.check('Score 599', 'RECHAZADA / SCORE_INSUFICIENTE', `${r2.data.estado} score=${r2.data.score}`, r2.data.estado === 'RECHAZADA' && r2.data.motivoRechazo === 'SCORE_INSUFICIENTE');
  });
  await tc('CP-28', async (c) => {
    const a = await createApp(ELENA, 1, 5000, 12);
    const r = c.ev(await submit(ELENA, a.data.id));
    c.check('Score 700 y RDI bajo', 'PREAPROBADA', `${r.data.recomendacion} score=${r.data.score}`, r.data.recomendacion === 'PREAPROBADA');
    const b = await createApp(FABIO, 1, 5000, 12);
    const r2 = c.ev(await submit(FABIO, b.data.id));
    c.check('Score 699 y RDI bajo', 'REVISION_MANUAL', `${r2.data.recomendacion} score=${r2.data.score}`, r2.data.recomendacion === 'REVISION_MANUAL');
  });
  await tc('CP-29', async (c) => {
    // cuota MICRO 1000/3 = 346.75 ; ingreso 10000
    const u40 = await newClient({ dpi: '2000000000046', ingresoMensual: 10000, deudasMensuales: 3653.25 });
    const u41 = await newClient({ dpi: '2000000000047', ingresoMensual: 10000, deudasMensuales: 3653.26 });
    const a = await createApp(u40.token, 1, 1000, 3);
    const r = c.ev(await submit(u40.token, a.data.id));
    c.check('RDI = 40.00 %', 'EN_REVISION / REVISION_MANUAL', `${r.data.estado} RDI=${r.data.rdi}`, r.data.estado === 'EN_REVISION');
    const b = await createApp(u41.token, 1, 1000, 3);
    const r2 = c.ev(await submit(u41.token, b.data.id));
    c.check('RDI = 40.0001 %', 'RECHAZADA / CAPACIDAD_PAGO', `${r2.data.estado} ${r2.data.motivoRechazo}`, r2.data.estado === 'RECHAZADA' && r2.data.motivoRechazo === 'CAPACIDAD_PAGO');
  });
  await tc('CP-30', async (c) => {
    const nac = shift(HOY, { y: -65, m: -2 }); // 65 años cumplidos
    const u = await newClient({ dpi: '2000000000048', fechaNacimiento: nac, ingresoMensual: 30000 });
    const a = await createApp(u.token, 3, 30000, 60);
    const r = c.ev(await submit(u.token, a.data.id));
    c.check('65 años + 60 meses = 70 años al vencimiento', 'EN_REVISION', `${r.data.estado} ${r.data.motivoRechazo || ''}`, r.data.estado === 'EN_REVISION');
    const b = await createApp(u.token, 3, 30000, 61);
    const r2 = c.ev(await submit(u.token, b.data.id));
    c.check('65 años + 61 meses = 70.08 años', 'RECHAZADA / EDAD', `${r2.data.estado} ${r2.data.motivoRechazo}`, r2.data.estado === 'RECHAZADA' && r2.data.motivoRechazo === 'EDAD');
  });

  // ================= EVALUACIÓN =================
  await tc('CP-31', async (c) => {
    const f = (await call('GET', '/applications?estado=EN_REVISION', { token: FABIO })).data[0];
    const r = c.ev(await evaluate(ANALISTA, f.id, 'RECHAZAR', 'corto'));
    c.check('Rechazar con comentario de 5 caracteres', '400', r.status, r.status === 400);
    const r2 = c.ev(await evaluate(ANALISTA, f.id, 'RECHAZAR', 'Historial laboral insuficiente'));
    c.check('Rechazar con comentario válido', '200 RECHAZADA / DECISION_ANALISTA', `${r2.status} ${r2.data.estado} ${r2.data.motivoRechazo}`, r2.status === 200 && r2.data.estado === 'RECHAZADA');
  });
  await tc('CP-32', async (c) => {
    const u = await newClient({ dpi: '2000000000055', ingresoMensual: 60000 });
    const a1 = await createApp(u.token, 2, 100000, 60); await submit(u.token, a1.data.id);
    const a2 = await createApp(u.token, 2, 100000.01, 60); await submit(u.token, a2.data.id);
    const r1 = c.ev(await evaluate(ANALISTA, a1.data.id, 'APROBAR'));
    c.check('Analista aprueba Q100,000.00', '200 APROBADA', `${r1.status} ${r1.data.estado}`, r1.status === 200 && r1.data.estado === 'APROBADA');
    const r2 = c.ev(await evaluate(ANALISTA, a2.data.id, 'APROBAR'));
    c.check('Analista aprueba Q100,000.01', '403', `${r2.status} ${r2.data.error}`, r2.status === 403);
    const r3 = c.ev(await evaluate(ADMIN, a2.data.id, 'APROBAR'));
    c.check('Administrador aprueba Q100,000.01', '200 APROBADA', `${r3.status} ${r3.data.estado}`, r3.status === 200 && r3.data.estado === 'APROBADA');
  });

  // ================= TRANSICIÓN DE ESTADOS =================
  await tc('CP-33', async (c) => {
    const id = appAnaFlujo; // EN_REVISION desde CP-24
    const e = c.ev(await evaluate(ANALISTA, id, 'APROBAR'));
    c.check('EN_REVISION → APROBADA', 'APROBADA', e.data.estado, e.data.estado === 'APROBADA');
    const fd = shift(HOY, { m: -3 });
    const d = c.ev(await disburse(ADMIN, id, fd));
    c.check('APROBADA → DESEMBOLSADA con plan de 3 cuotas', 'DESEMBOLSADA, 3 cuotas', `${d.data.estado}, ${d.data.planPagos?.length} cuotas`, d.data.estado === 'DESEMBOLSADA' && d.data.planPagos?.length === 3);
    let last;
    for (const cuota of d.data.planPagos) {
      last = c.ev(await pay(ANALISTA, id, cuota.fechaVencimiento, cuota.cuota));
    }
    c.check('Pago de la última cuota → FINALIZADA', 'FINALIZADA', `${last.status} ${last.data.estadoSolicitud}`, last.data.estadoSolicitud === 'FINALIZADA');
    const det = c.ev(await call('GET', `/applications/${id}`, { token: ANA }));
    const seqEst = det.data.historial.map((h) => h.estadoNuevo).join('>');
    c.check('Historial con la secuencia completa', 'BORRADOR>ENVIADA>EN_REVISION>APROBADA>DESEMBOLSADA>FINALIZADA', seqEst, seqEst === 'BORRADOR>ENVIADA>EN_REVISION>APROBADA>DESEMBOLSADA>FINALIZADA');
  });
  await tc('CP-34', async (c) => {
    const id = appBrunoMicro;
    const d = c.ev(await evaluate(ANALISTA, id, 'DEVOLVER', 'Adjuntar constancia de ingresos'));
    c.check('EN_REVISION → DEVUELTA', 'DEVUELTA', d.data.estado, d.data.estado === 'DEVUELTA');
    const u = c.ev(await call('PUT', `/applications/${id}`, { token: BRUNO, body: { monto: 4000 } }));
    c.check('Cliente edita solicitud devuelta', '200 monto 4000', `${u.status} ${u.data.monto}`, u.status === 200 && u.data.monto === 4000);
    const s = c.ev(await submit(BRUNO, id));
    c.check('DEVUELTA → ENVIADA → EN_REVISION', 'EN_REVISION', s.data.estado, s.data.estado === 'EN_REVISION');
  });
  await tc('CP-35', async (c) => {
    const a = await createApp(ANA, 1, 2000, 6);
    const r = c.ev(await call('POST', `/applications/${a.data.id}/cancel`, { token: ANA }));
    c.check('BORRADOR → CANCELADA', 'CANCELADA', r.data.estado, r.data.estado === 'CANCELADA');
    const s = c.ev(await submit(ANA, a.data.id));
    c.check('Enviar solicitud CANCELADA', '409', s.status, s.status === 409);
  });
  await tc('CP-36', async (c) => {
    const b = await createApp(ANA, 1, 2000, 6);
    const r1 = c.ev(await evaluate(ANALISTA, b.data.id, 'APROBAR'));
    c.check('Evaluar solicitud en BORRADOR', '409', r1.status, r1.status === 409);
    const r2 = c.ev(await disburse(ADMIN, appBrunoMicro, HOY));
    c.check('Desembolsar solicitud EN_REVISION', '409', r2.status, r2.status === 409);
    const r3 = c.ev(await call('POST', `/applications/${appBrunoMicro}/cancel`, { token: BRUNO }));
    c.check('Cancelar solicitud EN_REVISION', '409', r3.status, r3.status === 409);
    const r4 = c.ev(await submit(CARLA, appCarla));
    c.check('Enviar solicitud RECHAZADA', '409', r4.status, r4.status === 409);
    const r5 = c.ev(await call('PUT', `/applications/${appBrunoMicro}`, { token: BRUNO, body: { monto: 3000 } }));
    c.check('Editar solicitud EN_REVISION', '409', r5.status, r5.status === 409);
    await call('POST', `/applications/${b.data.id}/cancel`, { token: ANA });
  });

  // ================= DESEMBOLSO Y PAGOS =================
  await tc('CP-37', async (c) => {
    const u = await newClient({ dpi: '2000000000056', ingresoMensual: 40000 });
    const a1 = await createApp(u.token, 1, 5000, 6); await submit(u.token, a1.data.id); await evaluate(ANALISTA, a1.data.id, 'APROBAR');
    const a2 = await createApp(u.token, 1, 5000, 6); await submit(u.token, a2.data.id); await evaluate(ANALISTA, a2.data.id, 'APROBAR');
    const manana = shift(HOY, { d: 1 });
    const r2 = c.ev(await disburse(ADMIN, a2.data.id, manana));
    c.check(`Desembolso con fecha de mañana (${manana}, hora local ${new Date().toLocaleTimeString('es-GT', { timeZone: TZ })})`, '400 "no puede ser futura"', `${r2.status} ${r2.data.error || r2.data.estado}`, r2.status === 400);
    const r1 = c.ev(await disburse(ADMIN, a1.data.id, HOY));
    c.check(`Desembolso con fecha de hoy (${HOY})`, '200 DESEMBOLSADA', `${r1.status} ${r1.data.estado}`, r1.status === 200);
  });
  let appPagos;
  await tc('CP-38', async (c) => {
    const u = await newClient({ dpi: '2000000000057', ingresoMensual: 40000 });
    const a = await createApp(u.token, 2, 12000, 12); await submit(u.token, a.data.id); await evaluate(ANALISTA, a.data.id, 'APROBAR');
    appPagos = a.data.id;
    const fd = shift(HOY, { m: -2, d: -10 });
    const d = await disburse(ADMIN, a.data.id, fd);
    const [c1, c2] = d.data.planPagos;
    const f5 = shift(c1.fechaVencimiento, { d: 5 });
    const p1 = c.ev(await pay(ANALISTA, a.data.id, f5, c1.cuota));
    c.check(`Cuota 1 pagada 5 días después del vencimiento (${f5})`, `201 recargo 0, monto ${c1.cuota}`, `${p1.status} recargo ${p1.data.recargo}`, p1.status === 201 && p1.data.recargo === 0);
    const f6 = shift(c2.fechaVencimiento, { d: 6 });
    const q = c.ev(await quote(ANALISTA, a.data.id, f6));
    const esperado = Math.round(c2.cuota * 0.05 * 100) / 100;
    c.check(`Cuota 2 con 6 días de atraso (${f6}): cotización`, `recargo ${esperado}`, q.data.recargo, q.data.recargo === esperado);
    const p2 = c.ev(await pay(ANALISTA, a.data.id, f6, q.data.total));
    c.check('Cuota 2 pagada con recargo', `201 recargo ${esperado}`, `${p2.status} recargo ${p2.data.recargo}`, p2.status === 201 && p2.data.recargo === esperado);
  });
  await tc('CP-39', async (c) => {
    const q = await quote(ANALISTA, appPagos, HOY);
    const r = c.ev(await pay(ANALISTA, appPagos, HOY, Math.round((q.data.total - 0.01) * 100) / 100));
    c.check('Pago con Q0.01 menos del total exigido', '400', r.status, r.status === 400);
    const r2 = c.ev(await pay(ANALISTA, appPagos, HOY, q.data.total + 0.004));
    c.check(`Pago con 3 decimales (${(q.data.total + 0.004).toFixed(3)})`, '400 (monto debe ser exactamente cuota + recargo)', `${r2.status} ${r2.data.error || 'pago registrado cuota ' + r2.data.cuotaNumero}`, r2.status === 400);
  });
  await tc('CP-40', async (c) => {
    const q = await quote(ANALISTA, appPagos, HOY);
    const rs = await Promise.all(Array.from({ length: 6 }, () => pay(ANALISTA, appPagos, HOY, q.data.total)));
    rs.forEach((r) => c.ev(r));
    const dup = require('child_process').execSync(`psql -h localhost -U postgres -d creditrack -tAc "SELECT i.numero || ':' || COUNT(p.id) FROM installments i JOIN payments p ON p.installment_id = i.id WHERE i.application_id = ${appPagos} GROUP BY i.numero HAVING COUNT(p.id) > 1"`).toString().trim();
    c.check('Seis solicitudes simultáneas de pago (doble clic / reintentos)', 'cada cuota recibe como máximo un pago', `respuestas: ${rs.map((r) => r.status + '→cuota ' + (r.data.cuotaNumero || r.data.error)).join(', ')}; cuotas con pagos duplicados: ${dup || 'ninguna'}`, dup === '');
  });
  await tc('CP-41', async (c) => {
    const r = c.ev(await pay(ANALISTA, appAnaFlujo, HOY, 100));
    c.check('Registrar pago en solicitud FINALIZADA', '409', r.status, r.status === 409);
  });

  // ================= ADMINISTRACIÓN =================
  await tc('CP-42', async (c) => {
    const base = (await call('GET', '/products/admin/all', { token: ADMIN })).data.find((p) => p.codigo === 'MICRO');
    for (const [t, exp] of [[0.0099, 400], [0.01, 200], [0.6, 200], [0.6001, 400]]) {
      const r = c.ev(await call('PUT', '/products/1', { token: ADMIN, body: { tasaAnual: t } }));
      c.check(`Tasa anual ${(t * 100).toFixed(2)} %`, exp, r.status, r.status === exp);
    }
    await call('PUT', '/products/1', { token: ADMIN, body: { tasaAnual: base.tasaAnual } });
  });
  await tc('CP-43', async (c) => {
    const email = `analista2.${Date.now()}@creditrack.test`;
    const r = c.ev(await call('POST', '/users', { token: ADMIN, body: { nombre: 'Mario Analista', email, password: 'Analista2026', rol: 'ANALISTA' } }));
    c.check('Crear analista', '201 rol ANALISTA', `${r.status} ${r.data.rol}`, r.status === 201 && r.data.rol === 'ANALISTA');
    const l = c.ev(await call('POST', '/auth/login', { body: { email, password: 'Analista2026' } }));
    c.check('Login del nuevo analista', '200', l.status, l.status === 200);
  });
  await tc('CP-44', async (c) => {
    const u = await newClient();
    const d = c.ev(await call('PATCH', `/users/${u.id}/active`, { token: ADMIN, body: { activo: false } }));
    c.check('Admin desactiva al cliente', '200 activo=false', `${d.status} ${d.data.activo}`, d.status === 200 && d.data.activo === false);
    const r = c.ev(await createApp(u.token, 1, 5000, 12));
    c.check('Cliente desactivado usa su token vigente para crear solicitud', '401/403 (acceso revocado)', `${r.status} ${r.data.estado || r.data.error}`, r.status === 401 || r.status === 403);
  });
  await tc('CP-45', async (c) => {
    const me = (await call('GET', '/auth/me', { token: ADMIN })).data;
    const r = c.ev(await call('PATCH', `/users/${me.id}/active`, { token: ADMIN, body: { activo: false } }));
    c.check('Administrador intenta desactivar su propia cuenta', '400/409 (no permitido: el sistema quedaría sin administrador activo)', `${r.status} activo=${r.data.activo}`, r.status === 400 || r.status === 409);
    await call('POST', '/auth/login', { body: {} });
    // restaurar directamente en BD si quedó desactivado
    if (r.status === 200) require('child_process').execSync(`psql -h localhost -U postgres -d creditrack -c "UPDATE users SET activo=true WHERE id=${me.id}"`);
  });
  await tc('CP-46', async (c) => {
    const rep = c.ev(await call('GET', '/reports/summary', { token: ADMIN }));
    const all = (await call('GET', '/applications', { token: ADMIN })).data;
    const apr = all.filter((a) => ['APROBADA', 'DESEMBOLSADA', 'FINALIZADA'].includes(a.estado)).length;
    const rec = all.filter((a) => a.estado === 'RECHAZADA').length;
    const esperado = Math.round((apr / (apr + rec)) * 10000) / 100;
    c.check('Tasa de aprobación = aprobadas / (aprobadas + rechazadas)', `${esperado} % (${apr}/${apr + rec})`, `${rep.data.tasaAprobacion} %`, rep.data.tasaAprobacion === esperado);
    const suma = rep.data.porEstado.reduce((a, x) => a + x.cantidad, 0);
    c.check('Total por estado = total de solicitudes', all.length, suma, suma === all.length);
  });
  await tc('CP-47', async (c) => {
    const det = c.ev(await call('GET', `/applications/${appBrunoMicro}`, { token: ANALISTA }));
    const dev = det.data.historial.find((h) => h.estadoNuevo === 'DEVUELTA');
    c.check('Historial registra usuario y comentario de la devolución', 'usuario "Laura Analista", comentario, fecha', `${dev?.usuario} | ${dev?.comentario} | ${dev?.fecha}`, dev && dev.usuario === 'Laura Analista' && dev.comentario && dev.fecha);
    const auto = det.data.historial.find((h) => h.estadoAnterior === 'ENVIADA');
    c.check('Transición automática registrada como Sistema con regla aplicada', 'usuario null y comentario con regla', `${auto?.usuario} | ${auto?.comentario}`, auto && auto.usuario === null && /R\d/.test(auto.comentario));
  });

  // ================= NO FUNCIONALES =================
  await tc('CP-48', async (c) => {
    const r = c.ev(await call('GET', '/applications/abc', { token: ADMIN }));
    c.check('GET /applications/abc', '400/404 con mensaje en español', `${r.status} ${r.data.error}`, r.status === 400 || r.status === 404);
    const r2 = c.ev(await call('POST', '/auth/login', { raw: '{"email":' }));
    c.check('JSON mal formado', '400', `${r2.status} ${r2.data.error}`, r2.status === 400);
    const r3 = c.ev(await call('PATCH', '/users/xyz/active', { token: ADMIN, body: { activo: true } }));
    c.check('PATCH /users/xyz/active', '400/404', `${r3.status} ${r3.data.error}`, r3.status === 400 || r3.status === 404);
  });
  await tc('CP-49', async (c) => {
    const r = c.ev(await call('GET', '/health'));
    const h = r.headers;
    c.check('X-Content-Type-Options', 'nosniff', h['x-content-type-options'], h['x-content-type-options'] === 'nosniff');
    c.check('Strict-Transport-Security', 'presente', h['strict-transport-security'], !!h['strict-transport-security']);
    c.check('Content-Security-Policy', 'presente', !!h['content-security-policy'], !!h['content-security-policy']);
    c.check('X-Powered-By oculto', 'ausente', h['x-powered-by'], !h['x-powered-by']);
  });
  await tc('CP-50', async (c) => {
    const me = c.ev(await call('GET', '/auth/me', { token: ANA }));
    const users = c.ev(await call('GET', '/users', { token: ADMIN }));
    const txt = JSON.stringify(me.data) + JSON.stringify(users.data);
    c.check('Respuestas no exponen contraseña ni hash', 'sin password/password_hash', /password/i.test(txt) ? 'expuesto' : 'no expuesto', !/password/i.test(txt));
    const hash = require('child_process').execSync(`psql -h localhost -U postgres -d creditrack -tAc "SELECT password_hash FROM users WHERE email='ana@creditrack.test'"`).toString().trim();
    c.check('Hash almacenado con bcrypt costo ≥ 10', '$2x$10$...', hash.slice(0, 7), /^\$2[aby]\$1\d\$/.test(hash));
  });
  await tc('CP-52', async (c) => {
    const eps = [['GET', '/products'], ['POST', '/products/simulate', { productId: 2, monto: 50000, plazoMeses: 36 }], ['GET', '/applications']];
    for (const [m, p, body] of eps) {
      const times = [];
      for (let i = 0; i < 20; i += 1) times.push((await call(m, p, { token: ADMIN, body })).ms);
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      c.check(`${m} ${p}: promedio de 20 peticiones secuenciales`, '≤ 500 ms', `${avg.toFixed(1)} ms (máx ${Math.max(...times)} ms)`, avg <= 500);
    }
  });

  await tc('CP-56', async (c) => {
    const r = c.ev(await call('GET', '/health'));
    c.check('GET /api/health', '200 {"status":"ok"} en ≤ 500 ms', `${r.status} ${r.data.status} ${r.ms} ms`, r.status === 200 && r.data.status === 'ok' && r.ms <= 500);
  });

  // ================= UI (Playwright) =================
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ timezoneId: TZ, locale: 'es-GT', viewport: { width: 1280, height: 850 } });
  const page = await ctx.newPage();
  const uiLogin = async (email, pw) => {
    await page.goto(`${WEB}/login`);
    await page.fill('input[name=email]', email); await page.fill('input[name=password]', pw);
    await page.click('button[type=submit]'); await page.waitForURL('**/solicitudes');
  };
  await tc('CP-51', async (c) => {
    const mob = await browser.newContext({ timezoneId: TZ, viewport: { width: 375, height: 812 } });
    const p = await mob.newPage();
    await p.goto(`${WEB}/login`);
    await p.fill('input[name=email]', 'ana@creditrack.test'); await p.fill('input[name=password]', 'Cliente123!');
    await p.click('button[type=submit]'); await p.waitForURL('**/solicitudes');
    for (const [name, path] of [['Simulador', '/simulador'], ['Mis solicitudes', '/solicitudes'], ['Detalle de solicitud', `/solicitudes/${appAnaFlujo}`]]) {
      await p.goto(`${WEB}${path}`); await p.waitForTimeout(700);
      if (path === '/simulador') { await p.fill('input[name=monto]', '10000'); await p.fill('input[name=plazoMeses]', '12'); await p.click('text=Calcular'); await p.waitForSelector('[data-testid=cuota]'); }
      const w = await p.evaluate(() => document.documentElement.scrollWidth);
      await p.screenshot({ path: `${EVID}/CP-51-${path.replace(/\W+/g, '_')}.png`, fullPage: true });
      c.check(`${name} a 375 px`, 'ancho de página ≤ 375 px (sin scroll horizontal)', `${w} px`, w <= 375);
    }
    await mob.close();
  });
  await tc('CP-53', async (c) => {
    // crear un crédito aprobado para ver el formulario de desembolso
    const u = await newClient({ dpi: '2000000000065', ingresoMensual: 40000 });
    const a = await createApp(u.token, 1, 5000, 6); await submit(u.token, a.data.id); await evaluate(ANALISTA, a.data.id, 'APROBAR');
    await uiLogin('admin@creditrack.test', 'Admin123!');
    await page.goto(`${WEB}/solicitudes/${a.data.id}`);
    await page.waitForSelector('[data-testid=panel-desembolso]');
    const val = await page.inputValue('input[name=fechaDesembolso]');
    await page.screenshot({ path: `${EVID}/CP-53-desembolso.png` });
    c.check(`Fecha propuesta por defecto en desembolso (hora local ${new Date().toLocaleTimeString('es-GT', { timeZone: TZ })})`, `fecha local ${HOY}`, val, val === HOY);
  });
  await tc('CP-54', async (c) => {
    await page.goto(`${WEB}/login`);
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${WEB}/login`);
    await page.fill('input[name=email]', 'carla@creditrack.test'); await page.fill('input[name=password]', 'Equivocada1');
    await page.click('button[type=submit]');
    const err = await page.waitForSelector('[data-testid=error]');
    const txt = await err.innerText();
    await page.screenshot({ path: `${EVID}/CP-54-login-error.png` });
    c.check('Login UI con contraseña incorrecta', 'mensaje "Credenciales inválidas" y permanece en /login', `${txt} | ${new URL(page.url()).pathname}`, txt.includes('Credenciales inválidas') && page.url().endsWith('/login'));
    await page.fill('input[name=password]', 'Cliente123!'); await page.click('button[type=submit]');
    await page.waitForURL('**/solicitudes');
    c.check('Login UI correcto', 'redirige a /solicitudes y muestra usuario', await page.innerText('[data-testid=usuario-actual]'), (await page.innerText('[data-testid=usuario-actual]')).includes('Carla'));
  });
  await tc('CP-55', async (c) => {
    // Cliente envía una solicitud que el sistema rechaza automáticamente: el mensaje debe reflejar el resultado
    await page.goto(`${WEB}/solicitudes/nueva`);
    await page.fill('input[name=monto]', '5000'); await page.fill('input[name=plazoMeses]', '12');
    await page.fill('textarea[name=destino]', 'Compra de equipo de cómputo');
    await page.click('button[type=submit]');
    await page.waitForSelector('text=Enviar solicitud');
    await page.click('text=Enviar solicitud');
    await page.waitForSelector('[data-testid=success]');
    await page.waitForTimeout(500);
    const msg = await page.innerText('[data-testid=success]');
    const estado = await page.innerText('[data-testid=estado]');
    await page.screenshot({ path: `${EVID}/CP-55-envio-rechazado.png`, fullPage: true });
    c.check('Mensaje tras enviar solicitud rechazada automáticamente', 'mensaje informa el resultado (rechazo y motivo), no solo "Solicitud enviada"', `mensaje "${msg}" / estado "${estado}"`, !/^Solicitud enviada$/.test(msg.trim()));
  });
  await browser.close();

  fs.writeFileSync('resultados.json', JSON.stringify({ fecha: new Date().toISOString(), horaLocal: new Date().toLocaleString('es-GT', { timeZone: TZ }), results }, null, 2));
  const ap = results.filter((r) => r.resultado === 'Aprobado').length;
  console.log(`\nTotal ${results.length} | Aprobados ${ap} | Fallidos ${results.length - ap}`);
})();
