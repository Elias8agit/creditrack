import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, money, ESTADO_LABEL } from '../api';
import { useAuth } from '../auth';
import { ErrorBox, StatusBadge } from '../components/ui';

export default function Applications() {
  const { user } = useAuth();
  const [estado, setEstado] = useState(user.rol === 'CLIENTE' ? '' : 'EN_REVISION');
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const qs = estado ? `?estado=${estado}` : '';
    api(`/applications${qs}`).then(setItems).catch(setError);
  }, [estado]);

  return (
    <section className="card">
      <div className="row between">
        <h1>{user.rol === 'CLIENTE' ? 'Mis solicitudes' : 'Bandeja de solicitudes'}</h1>
        {user.rol === 'CLIENTE' && <Link className="btn" to="/solicitudes/nueva">Nueva solicitud</Link>}
      </div>
      <label className="field inline">
        <span>Filtrar por estado</span>
        <select name="estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Todos</option>
          {Object.entries(ESTADO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <ErrorBox error={error} />
      {items.length === 0 ? (
        <p className="muted">No hay solicitudes para mostrar.</p>
      ) : (
        <table className="table" data-testid="tabla-solicitudes">
          <thead>
            <tr><th>#</th>{user.rol !== 'CLIENTE' && <th>Cliente</th>}<th>Producto</th><th>Monto</th><th>Plazo</th><th>Cuota</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id}>
                <td>{a.id}</td>
                {user.rol !== 'CLIENTE' && <td>{a.cliente}</td>}
                <td>{a.producto}</td>
                <td>{money(a.monto)}</td>
                <td>{a.plazoMeses} meses</td>
                <td>{money(a.cuota)}</td>
                <td><StatusBadge estado={a.estado} /></td>
                <td><Link to={`/solicitudes/${a.id}`}>Ver detalle</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
