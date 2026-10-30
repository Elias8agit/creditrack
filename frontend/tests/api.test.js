import { describe, test, expect, vi, beforeEach } from 'vitest';
import { api, ApiError, money, pct, getSession, setSession, sanitizeSession, ESTADO_LABEL } from '../src/api';

describe('api.js: utilidades de formato', () => {
  test('money formatea quetzales con separador de miles y 2 decimales', () => {
    expect(money(25000)).toBe('Q25,000.00');
    expect(money(945.6)).toBe('Q945.60');
    expect(money(null)).toBe('Q0.00');
  });

  test('pct convierte una proporción a porcentaje con 2 decimales', () => {
    expect(pct(0.2361)).toBe('23.61 %');
  });

  test('cada estado de la máquina de estados tiene etiqueta en español', () => {
    expect(Object.keys(ESTADO_LABEL)).toHaveLength(9);
    expect(ESTADO_LABEL.EN_REVISION).toBe('En revisión');
  });
});

describe('api.js: sesión y llamadas HTTP (fetch simulado)', () => {
  // fetch es una dependencia externa (red); se reemplaza por un mock para controlar la respuesta del servidor
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  test('setSession guarda y getSession recupera la sesión; null la elimina', () => {
    setSession({ token: 't1', usuario: { rol: 'ADMIN' } });
    expect(getSession().usuario.rol).toBe('ADMIN');
    setSession(null);
    expect(getSession()).toBeNull();
  });

  test('sanitizeSession solo conserva campos esperados y descarta valores fuera de la lista blanca', () => {
    const s = sanitizeSession({ token: 'a.b.c', usuario: { id: 7, nombre: 'Ana', rol: 'SUPERADMIN', extra: '<script>' }, otro: 1 });
    expect(s).toEqual({ token: 'a.b.c', usuario: { id: 7, nombre: 'Ana', email: undefined, rol: undefined } });
    expect(sanitizeSession({ token: 'abc<script>' })).toBeNull();
    expect(sanitizeSession({ usuario: { rol: 'ADMIN' } })).toBeNull();
  });

  test('getSession ignora contenido manipulado o corrupto en localStorage', () => {
    localStorage.setItem('creditrack.session', '{no es json');
    expect(getSession()).toBeNull();
    localStorage.setItem('creditrack.session', JSON.stringify({ token: 'x y', usuario: { rol: 'ADMIN' } }));
    expect(getSession()).toBeNull();
  });

  test('api envía el token como Bearer y devuelve el JSON de la respuesta', async () => {
    setSession({ token: 'abc123' });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ ok: 1 }) });

    await expect(api('/products')).resolves.toEqual({ ok: 1 });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer abc123');
  });

  test('una respuesta de error se convierte en ApiError con estado, mensaje y detalles', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'Datos inválidos', detalles: ['monto'] }) });

    const err = await api('/applications', { method: 'POST', body: {} }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 400, message: 'Datos inválidos', detalles: ['monto'] });
  });
});
