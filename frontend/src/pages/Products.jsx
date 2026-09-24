import { useEffect, useState } from 'react';
import { api } from '../api';
import { ErrorBox, SuccessBox } from '../components/ui';

function ProductRow({ product, onSaved, onError }) {
  const [p, setP] = useState({ ...product, tasaPct: String(product.tasaAnual * 100) });
  const set = (k) => (e) => setP({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const save = async () => {
    try {
      await api(`/products/${p.id}`, {
        method: 'PUT',
        body: {
          nombre: p.nombre,
          montoMin: Number(p.montoMin),
          montoMax: Number(p.montoMax),
          plazoMin: Number(p.plazoMin),
          plazoMax: Number(p.plazoMax),
          tasaAnual: Number(p.tasaPct) / 100,
          activo: p.activo,
        },
      });
      onSaved(`Producto ${p.codigo} actualizado`);
    } catch (err) { onError(err); }
  };

  return (
    <tr>
      <td>{p.codigo}</td>
      <td><input value={p.nombre} onChange={set('nombre')} /></td>
      <td><input type="number" value={p.montoMin} onChange={set('montoMin')} /></td>
      <td><input type="number" value={p.montoMax} onChange={set('montoMax')} /></td>
      <td><input type="number" value={p.plazoMin} onChange={set('plazoMin')} /></td>
      <td><input type="number" value={p.plazoMax} onChange={set('plazoMax')} /></td>
      <td><input type="number" step="0.01" value={p.tasaPct} onChange={set('tasaPct')} /></td>
      <td><input type="checkbox" checked={p.activo} onChange={set('activo')} /></td>
      <td><button className="btn" onClick={save}>Guardar</button></td>
    </tr>
  );
}

export default function Products() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(null);

  const load = () => api('/products/admin/all').then(setItems).catch(setError);
  useEffect(() => { load(); }, []);

  return (
    <section className="card">
      <h1>Productos crediticios</h1>
      <SuccessBox message={ok} />
      <ErrorBox error={error} />
      <table className="table compact" data-testid="tabla-productos">
        <thead><tr><th>Código</th><th>Nombre</th><th>Monto mín.</th><th>Monto máx.</th><th>Plazo mín.</th><th>Plazo máx.</th><th>Tasa (%)</th><th>Activo</th><th></th></tr></thead>
        <tbody>
          {items.map((p) => (
            <ProductRow key={p.id} product={p} onSaved={(m) => { setOk(m); setError(null); load(); }} onError={(e) => { setError(e); setOk(null); }} />
          ))}
        </tbody>
      </table>
    </section>
  );
}
