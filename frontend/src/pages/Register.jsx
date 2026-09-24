import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { ErrorBox, Field } from '../components/ui';

const EMPTY = {
  nombre: '', email: '', password: '', dpi: '', fechaNacimiento: '', ingresoMensual: '', deudasMensuales: '0', telefono: '',
};

export default function Register() {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const body = {
        ...form,
        ingresoMensual: Number(form.ingresoMensual),
        deudasMensuales: Number(form.deudasMensuales),
        telefono: form.telefono || undefined,
      };
      const session = await api('/auth/register', { method: 'POST', body });
      login(session);
      navigate('/solicitudes');
    } catch (err) {
      setError(err);
    }
  };

  return (
    <section className="card narrow">
      <h1>Registro de cliente</h1>
      <ErrorBox error={error} />
      <form onSubmit={onSubmit}>
        <Field label="Nombre completo"><input name="nombre" value={form.nombre} onChange={set('nombre')} /></Field>
        <Field label="Email"><input name="email" type="email" value={form.email} onChange={set('email')} /></Field>
        <Field label="Contraseña" hint="Mínimo 8 caracteres, con mayúscula, minúscula y dígito">
          <input name="password" type="password" value={form.password} onChange={set('password')} />
        </Field>
        <Field label="DPI" hint="13 dígitos"><input name="dpi" value={form.dpi} onChange={set('dpi')} /></Field>
        <Field label="Fecha de nacimiento"><input name="fechaNacimiento" type="date" value={form.fechaNacimiento} onChange={set('fechaNacimiento')} /></Field>
        <Field label="Ingreso mensual (Q)"><input name="ingresoMensual" type="number" value={form.ingresoMensual} onChange={set('ingresoMensual')} /></Field>
        <Field label="Deudas mensuales (Q)"><input name="deudasMensuales" type="number" value={form.deudasMensuales} onChange={set('deudasMensuales')} /></Field>
        <Field label="Teléfono (opcional)"><input name="telefono" value={form.telefono} onChange={set('telefono')} /></Field>
        <button className="btn" type="submit">Crear cuenta</button>
      </form>
    </section>
  );
}
