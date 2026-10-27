// Dobles de prueba: se reemplaza el pool de PostgreSQL.
// Justificación: login y registro dependen de la tabla users; con un stub controlamos exactamente
// el estado de la cuenta (intentos fallidos, bloqueo, activo) sin preparar ni limpiar una base real.
jest.mock('../src/db/pool', () => ({ query: jest.fn(), withTransaction: jest.fn() }));

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../src/db/pool');
const config = require('../src/config');
const { login, validateRegistration } = require('../src/services/authService');

const HASH = bcrypt.hashSync('Cliente123!', 4); // costo bajo solo para velocidad de la prueba
const usuario = (over = {}) => ({
  id: 3, nombre: 'Ana López', email: 'ana@creditrack.test', rol: 'CLIENTE', password_hash: HASH,
  activo: true, intentos_fallidos: 0, bloqueado_hasta: null, ...over,
});

beforeEach(() => jest.clearAllMocks());

describe('authService.validateRegistration (partición de equivalencia)', () => {
  const valido = {
    nombre: 'María Gómez', email: 'maria@test.com', password: 'Segura123', dpi: '2000000000019',
    fechaNacimiento: '1994-06-15', ingresoMensual: 9500, deudasMensuales: 1200, telefono: '55512345',
  };

  test('datos válidos no generan errores', () => {
    expect(validateRegistration(valido)).toEqual([]);
  });

  test.each([
    ['email sin @', { email: 'maria.test.com' }, 'email'],
    ['contraseña sin mayúscula', { password: 'segura123' }, 'contraseña'],
    ['contraseña de 7 caracteres', { password: 'Abcde12' }, 'contraseña'],
    ['DPI con letras', { dpi: '12345ABC67890' }, 'DPI'],
    ['ingreso en cero', { ingresoMensual: 0 }, 'ingreso'],
    ['teléfono de 7 dígitos', { telefono: '5551234' }, 'teléfono'],
  ])('%s produce un error de validación', (_desc, cambio, palabra) => {
    const errores = validateRegistration({ ...valido, ...cambio });
    expect(errores).toHaveLength(1);
    expect(errores[0].toLowerCase()).toContain(palabra.toLowerCase());
  });
});

describe('authService.login (con stub de base de datos)', () => {
  test('credenciales correctas: emite JWT con el rol y reinicia intentos fallidos', async () => {
    query.mockResolvedValueOnce({ rows: [usuario({ intentos_fallidos: 2 })] }).mockResolvedValue({ rows: [] });

    const r = await login({ email: 'ANA@creditrack.test', password: 'Cliente123!' });

    expect(jwt.verify(r.token, config.jwtSecret)).toMatchObject({ sub: 3, rol: 'CLIENTE' });
    expect(query).toHaveBeenNthCalledWith(1, expect.any(String), ['ana@creditrack.test']);
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining('intentos_fallidos = 0'), [3]);
  });

  test('contraseña incorrecta: responde 401 genérico y suma un intento', async () => {
    query.mockResolvedValueOnce({ rows: [usuario({ intentos_fallidos: 1 })] }).mockResolvedValue({ rows: [] });

    await expect(login({ email: 'ana@creditrack.test', password: 'Mala1234' })).rejects.toMatchObject({ status: 401, message: 'Credenciales inválidas' });
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining('intentos_fallidos = $2'), [3, 2]);
  });

  test('quinto intento fallido: bloquea la cuenta (423)', async () => {
    query.mockResolvedValueOnce({ rows: [usuario({ intentos_fallidos: 4 })] }).mockResolvedValue({ rows: [] });

    await expect(login({ email: 'ana@creditrack.test', password: 'Mala1234' })).rejects.toMatchObject({ status: 423 });
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining('bloqueado_hasta'), [3, '15']);
  });

  test('cuenta bloqueada: rechaza incluso la contraseña correcta', async () => {
    const enDiezMin = new Date(Date.now() + 10 * 60000).toISOString();
    query.mockResolvedValueOnce({ rows: [usuario({ bloqueado_hasta: enDiezMin })] });
    await expect(login({ email: 'ana@creditrack.test', password: 'Cliente123!' })).rejects.toMatchObject({ status: 423 });
  });

  test('email inexistente: mismo 401 genérico que una contraseña incorrecta', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await expect(login({ email: 'noexiste@creditrack.test', password: 'X1234567' })).rejects.toMatchObject({ status: 401, message: 'Credenciales inválidas' });
  });
});
