import { useEffect, useState } from 'react';
import { api } from '../api';
import { ErrorBox, Field, SuccessBox } from '../components/ui';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'ANALISTA' });
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(null);

  const load = () => api('/users').then(setUsers).catch(setError);
  useEffect(() => { load(); }, []);

  const run = async (fn, msg) => {
    setError(null); setOk(null);
    try { await fn(); setOk(msg); load(); } catch (err) { setError(err); }
  };

  const create = (e) => {
    e.preventDefault();
    run(async () => {
      await api('/users', { method: 'POST', body: form });
      setForm({ nombre: '', email: '', password: '', rol: 'ANALISTA' });
    }, 'Usuario creado');
  };

  const bloqueado = (u) => u.bloqueadoHasta && new Date(u.bloqueadoHasta) > new Date();

  return (
    <section className="card">
      <h1>Administración de usuarios</h1>
      <SuccessBox message={ok} />
      <ErrorBox error={error} />
      <form className="grid-form" onSubmit={create}>
        <Field label="Nombre"><input name="nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></Field>
        <Field label="Email"><input name="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Contraseña"><input name="password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
        <Field label="Rol">
          <select name="rol" value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
            <option value="ANALISTA">Analista</option>
            <option value="ADMIN">Administrador</option>
          </select>
        </Field>
        <button className="btn" type="submit">Crear usuario</button>
      </form>
      <table className="table" data-testid="tabla-usuarios">
        <thead><tr><th>#</th><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.id}</td><td>{u.nombre}</td><td>{u.email}</td><td>{u.rol}</td>
              <td>{u.activo ? 'Activo' : 'Inactivo'}{bloqueado(u) && ' (bloqueado)'}</td>
              <td className="actions">
                <button className="btn btn-light" onClick={() => run(() => api(`/users/${u.id}/active`, { method: 'PATCH', body: { activo: !u.activo } }), 'Estado actualizado')}>
                  {u.activo ? 'Desactivar' : 'Activar'}
                </button>
                {bloqueado(u) && (
                  <button className="btn btn-light" onClick={() => run(() => api(`/users/${u.id}/unlock`, { method: 'POST' }), 'Usuario desbloqueado')}>Desbloquear</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
