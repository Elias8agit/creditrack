import { useEffect, useState } from 'react';
import { api, money, pct } from '../api';
import { ErrorBox, Field } from '../components/ui';

export function AmortizationTable({ rows }) {
  return (
    <table className="table" data-testid="tabla-amortizacion">
      <thead>
        <tr><th>#</th><th>Vencimiento</th><th>Capital</th><th>Interés</th><th>Cuota</th><th>Saldo</th></tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.numero}>
            <td>{r.numero}</td>
            <td>{r.fechaVencimiento || '-'}</td>
            <td>{money(r.capital)}</td>
            <td>{money(r.interes)}</td>
            <td>{money(r.cuota)}</td>
            <td>{money(r.saldo)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Simulator() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ productId: '', monto: '', plazoMeses: '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/products').then((p) => {
      setProducts(p);
      if (p[0]) setForm((f) => ({ ...f, productId: String(p[0].id) }));
    }).catch(setError);
  }, []);

  const selected = products.find((p) => String(p.id) === form.productId);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    try {
      const r = await api('/products/simulate', {
        method: 'POST',
        body: { productId: Number(form.productId), monto: Number(form.monto), plazoMeses: Number(form.plazoMeses) },
      });
      setResult(r);
    } catch (err) {
      setError(err);
    }
  };

  return (
    <section className="card">
      <h1>Simulador de crédito</h1>
      <form className="grid-form" onSubmit={onSubmit}>
        <Field label="Producto">
          <select name="productId" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
            {products.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </Field>
        <Field label="Monto (Q)" hint={selected && `Entre ${money(selected.montoMin)} y ${money(selected.montoMax)}`}>
          <input name="monto" type="number" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} />
        </Field>
        <Field label="Plazo (meses)" hint={selected && `Entre ${selected.plazoMin} y ${selected.plazoMax} meses`}>
          <input name="plazoMeses" type="number" value={form.plazoMeses} onChange={(e) => setForm({ ...form, plazoMeses: e.target.value })} />
        </Field>
        <button className="btn" type="submit">Calcular</button>
      </form>
      <ErrorBox error={error} />
      {result && (
        <div data-testid="resultado-simulacion">
          <div className="stats">
            <div><span>Tasa anual</span><strong>{pct(result.tasaAnual)}</strong></div>
            <div><span>Cuota mensual</span><strong data-testid="cuota">{money(result.cuota)}</strong></div>
            <div><span>Total a pagar</span><strong>{money(result.totalPagar)}</strong></div>
            <div><span>Total intereses</span><strong>{money(result.totalIntereses)}</strong></div>
          </div>
          <AmortizationTable rows={result.tabla} />
        </div>
      )}
    </section>
  );
}
