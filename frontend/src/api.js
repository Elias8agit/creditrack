const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export class ApiError extends Error {
  constructor(status, message, detalles) {
    super(message);
    this.status = status;
    this.detalles = detalles;
  }
}

export function getSession() {
  const raw = localStorage.getItem('creditrack.session');
  return raw ? JSON.parse(raw) : null;
}

export function setSession(session) {
  if (session) localStorage.setItem('creditrack.session', JSON.stringify(session));
  else localStorage.removeItem('creditrack.session');
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
