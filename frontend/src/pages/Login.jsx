import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { ErrorBox, Field } from '../components/ui';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const session = await api('/auth/login', { method: 'POST', body: { email, password } });
      login(session);
      navigate('/solicitudes');
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card narrow">
      <h1>Iniciar sesión</h1>
      <ErrorBox error={error} />
      <form onSubmit={onSubmit}>
        <Field label="Email">
          <input name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Contraseña">
          <input name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <button className="btn" type="submit" disabled={loading}>{loading ? 'Ingresando…' : 'Ingresar'}</button>
      </form>
      <p>¿No tiene cuenta? <Link to="/registro">Regístrese</Link></p>
    </section>
  );
}
