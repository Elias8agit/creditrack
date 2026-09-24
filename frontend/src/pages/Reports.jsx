import { useEffect, useState } from 'react';
import { api, money, ESTADO_LABEL } from '../api';
import { ErrorBox } from '../components/ui';

export default function Reports() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { api('/reports/summary').then(setData).catch(setError); }, []);

  if (!data) return <section className="card"><ErrorBox error={error} />{!error && <p>Cargando…</p>}</section>;

  return (
    <section className="card">
      <h1>Reporte de cartera</h1>
      <div className="stats">
        <div><span>Monto aprobado</span><strong>{money(data.montoAprobado)}</strong></div>
        <div><span>Monto desembolsado</span><strong>{money(data.montoDesembolsado)}</strong></div>
        <div><span>Tasa de aprobación</span><strong data-testid="tasa-aprobacion">{data.tasaAprobacion} %</strong></div>
        <div><span>Cuotas vencidas</span><strong>{data.cuotasVencidas.cantidad} ({money(data.cuotasVencidas.monto)})</strong></div>
      </div>
      <table className="table" data-testid="tabla-reporte">
        <thead><tr><th>Estado</th><th>Cantidad</th><th>Monto</th></tr></thead>
        <tbody>
          {data.porEstado.map((r) => (
            <tr key={r.estado}><td>{ESTADO_LABEL[r.estado] || r.estado}</td><td>{r.cantidad}</td><td>{money(r.monto)}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
