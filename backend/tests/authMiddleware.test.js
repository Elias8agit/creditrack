const jwt = require('jsonwebtoken');
const config = require('../src/config');
const { authenticate, authorize } = require('../src/middleware/auth');

// Las dependencias de Express (req, res, next) se sustituyen por objetos simples y una función espía
const run = (mw, req) => { const next = jest.fn(); mw(req, {}, next); return next; };

describe('middleware de autenticación y autorización', () => {
  test('token válido: agrega el usuario a la petición y continúa', () => {
    const token = jwt.sign({ sub: 3, rol: 'CLIENTE', nombre: 'Ana' }, config.jwtSecret);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const next = run(authenticate, req);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual({ id: 3, rol: 'CLIENTE', nombre: 'Ana' });
  });

  test.each([
    ['sin encabezado', {}],
    ['esquema distinto a Bearer', { authorization: 'Basic abc' }],
    ['firma alterada', { authorization: `Bearer ${jwt.sign({ sub: 1 }, 'otro-secreto')}` }],
  ])('rechaza con 401: %s', (_d, headers) => {
    const next = run(authenticate, { headers });
    expect(next.mock.calls[0][0]).toMatchObject({ status: 401 });
  });

  test('authorize permite el rol incluido y bloquea los demás con 403', () => {
    expect(run(authorize('ADMIN'), { user: { rol: 'ADMIN' } })).toHaveBeenCalledWith();
    expect(run(authorize('ADMIN'), { user: { rol: 'ANALISTA' } }).mock.calls[0][0]).toMatchObject({ status: 403 });
  });
});
