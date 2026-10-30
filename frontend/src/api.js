const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export class ApiError extends Error {
  constructor(status, message, detalles) {
    super(message);
    this.status = status;
    this.detalles = detalles;
  }
}

const SESSION_KEY = 'creditrack.session';
const ROLES = new Set(['ADMIN', 'ANALISTA', 'CLIENTE']);
// JWT: hasta 3 segmentos base64url separados por punto, sin otros caracteres
const TOKEN_RE = /^[\w-]{1,1024}(?:\.[\w-]{1,1024}){0,2}$/;
const texto = (v, max) => (typeof v === 'string' ? v.slice(0, max) : undefined);

// La respuesta del servidor no se guarda tal cual en localStorage (riesgo de "storage poisoning"):
// se reconstruye un objeto nuevo solo con los campos esperados, validados por tipo, formato y lista blanca.
export function sanitizeSession(session) {
  if (!session || typeof session.token !== 'string' || !TOKEN_RE.test(session.token)) return null;
  const u = session.usuario;
  const usuario = u && typeof u === 'object'
    ? {
        id: Number.isSafeInteger(u.id) ? u.id : undefined,
        nombre: texto(u.nombre, 100),
        email: texto(u.email, 150),
        rol: ROLES.has(u.rol) ? u.rol : undefined,
      }
    : undefined;
  return { token: session.token, usuario };
}

export function getSession() {
  try {
    return sanitizeSession(JSON.parse(localStorage.getItem(SESSION_KEY)));
  } catch {
    return null; // contenido corrupto o manipulado: se trata como sesión inexistente
  }
}

export function setSession(session) {
  const segura = sanitizeSession(session);
  if (segura) localStorage.setItem(SESSION_KEY, JSON.stringify(segura));
  else localStorage.removeItem(SESSION_KEY);
}

export async function api(path, { method = 'GET', body } = {}) {
  const session = getSession();
  const headers = { 'Content-Type': 'application/json' };
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && session) {
      setSession(null);
      window.location.href = '/login';
    }
    throw new ApiError(res.status, data.error || 'Error de comunicación con el servidor', data.detalles);
  }
  return data;
}

export const money = (n) =>
  `Q${Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const pct = (n) => `${(Number(n || 0) * 100).toFixed(2)} %`;

export const ESTADO_LABEL = {
  BORRADOR: 'Borrador',
  ENVIADA: 'Enviada',
  EN_REVISION: 'En revisión',
  DEVUELTA: 'Devuelta',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  CANCELADA: 'Cancelada',
  DESEMBOLSADA: 'Desembolsada',
  FINALIZADA: 'Finalizada',
};
