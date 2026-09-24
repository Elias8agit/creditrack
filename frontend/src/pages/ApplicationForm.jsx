import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, money } from '../api';
import { ErrorBox, Field } from '../components/ui';

export default function ApplicationForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ productId: '', monto: '', plazoMeses: '', destino: '' });
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/products').then((p) => {
      setProducts(p);
      if (!id && p[0]) setForm((f) => ({ ...f, productId: String(p[0].id) }));
    }).catch(setError);
    if (id) {
      api(`/applications/${id}`).then((a) => setForm({
        productId: String(a.productId), monto: String(a.monto), plazoMeses: String(a.plazoMeses), destino: a.destino,
      })).catch(setError);
    }
  }, [id]);

  const selected = products.find((p) => String(p.id) === form.productId);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const body = {
      productId: Number(form.productId), monto: Number(form.monto), plazoMeses: Number(form.plazoMeses), destino: form.destino,
    };
    try {
      const saved = id
        ? await api(`/applications/${id}`, { method: 'PUT', body })
        : await api('/applications', { method: 'POST', body });
      navigate(`/solicitudes/${saved.id}`);
    } catch (err) {
      setError(err);
    }
  };

  return (
    <section className="card narrow">
      <h1>{id ? `Editar solicitud #${id}` : 'Nueva solicitud de crédito'}</h1>
      <ErrorBox error={error} />
      <form onSubmit={onSubmit}>
        <Field label="Producto">
          <select name="productId" value={form.productId} onChange={set('productId')}>
            {products.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </Field>
        <Field label="Monto (Q)" hint={selected && `Entre ${money(selected.montoMin)} y ${money(selected.montoMax)}`}>
          <input name="monto" type="number" step="0.01" value={form.monto} onChange={set('monto')} />
        </Field>
        <Field label="Plazo (meses)" hint={selected && `Entre ${selected.plazoMin} y ${selected.plazoMax} meses`}>
          <input name="plazoMeses" type="number" value={form.plazoMeses} onChange={set('plazoMeses')} />
        </Field>
        <Field label="Destino del crédito" hint="Entre 10 y 200 caracteres">
          <textarea name="destino" value={form.destino} onChange={set('destino')} rows={3} />
        </Field>
        <button className="btn" type="submit">Guardar borrador</button>
      </form>
    </section>
  );
}
