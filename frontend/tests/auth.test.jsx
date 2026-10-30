import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../src/auth';
import { SuccessBox } from '../src/components/ui';

function Sesion() {
  const { user, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="usuario">{user ? `${user.nombre} (${user.rol})` : 'sin sesión'}</span>
      <button onClick={() => login({ token: 't', usuario: { nombre: 'Ana', rol: 'CLIENTE' } })}>entrar</button>
      <button onClick={logout}>salir</button>
    </div>
  );
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('AuthProvider (contexto de sesión)', () => {
  test('login guarda la sesión en localStorage y expone el usuario', () => {
    render(<AuthProvider><Sesion /></AuthProvider>);
    expect(screen.getByTestId('usuario')).toHaveTextContent('sin sesión');
    act(() => screen.getByText('entrar').click());
    expect(screen.getByTestId('usuario')).toHaveTextContent('Ana (CLIENTE)');
    expect(JSON.parse(localStorage.getItem('creditrack.session')).token).toBe('t');
  });

  test('logout elimina la sesión', () => {
    localStorage.setItem('creditrack.session', JSON.stringify({ token: 'x', usuario: { nombre: 'Bruno', rol: 'ANALISTA' } }));
    render(<AuthProvider><Sesion /></AuthProvider>);
    expect(screen.getByTestId('usuario')).toHaveTextContent('Bruno (ANALISTA)');
    act(() => screen.getByText('salir').click());
    expect(screen.getByTestId('usuario')).toHaveTextContent('sin sesión');
    expect(localStorage.getItem('creditrack.session')).toBeNull();
  });
});

describe('SuccessBox', () => {
  test('muestra el mensaje de éxito en un elemento output accesible', () => {
    render(<SuccessBox message="Pago registrado" />);
    const box = screen.getByTestId('success');
    expect(box.tagName).toBe('OUTPUT');
    expect(box).toHaveTextContent('Pago registrado');
  });
});
