import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, money, pct } from '../api';
import { useAuth } from '../auth';
import { ErrorBox, Field, StatusBadge, SuccessBox } from '../components/ui';

const todayLocal = () => new Date().toISOString().slice(0, 10);

function EvaluatePanel({ app, onDone }) {
  const [decision, setDecision] = useState('APROBAR');
  const [comentario, setComentario] = useState('');
  const [error, setError] = useState(null);
  const send = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await api(`/applications/${app.id}/evaluate`, { method: 'POST', body: { decision, comentario } });
      onDone('Evaluación registrada');
    } catch (err) { setError(err); }
  };
  return (
    <form className="panel" onSubmit={send} data-testid="panel-evaluar">
      <h3>Evaluar solicitud</h3>
      <ErrorBox error={error} />
      <Field label="Decisión">
        <select name="decision" value={decision} onChange={(e) => setDecision(e.target.value)}>
          <option value="APROBAR">Aprobar</option>
          <option value="RECHAZAR">Rechazar</option>
          <option value="DEVOLVER">Devolver al cliente</option>
        </select>
      </Field>
      <Field label="Comentario" hint="Obligatorio (mínimo 10 caracteres) para rechazar o devolver">
        <textarea name="comentario" value={comentario} onChange={(e) => setComentario(e.target.value)} rows={2} />
      </Field>
      <button className="btn" type="submit">Registrar decisión</button>
    </form>
  );
}

function DisbursePanel({ app, onDone }) {
  const [fecha, setFecha] = useState(todayLocal());
  const [error, setError] = useState(null);
  const send = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await api(`/applications/${app.id}/disburse`, { method: 'POST', body: { fechaDesembolso: fecha } });
      onDone('Crédito desembolsado y plan de pagos generado');
    } catch (err) { setError(err); }
  };
  return (
    <form className="panel" onSubmit={send} data-testid="panel-desembolso">
      <h3>Desembolsar</h3>
      <ErrorBox error={error} />
      <Field label="Fecha de desembolso">
        <input name="fechaDesembolso" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </Field>
      <button className="btn" type="submit">Desembolsar {money(app.monto)}</button>
    </form>
  );
}

function PaymentPanel({ app, onDone }) {
  const [fecha, setFecha] = useState(todayLocal());
  const [quote, setQuote] = useState(null);
  const [monto, setMonto] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    api(`/applications/${app.id}/payments/quote?fechaPago=${fecha}`)
      .then((q) => { setQuote(q); setMonto(String(q.total)); })
      .catch(setError);
  }, [app.id, fecha]);

  const send = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const r = await api(`/applications/${app.id}/payments`, { method: 'POST', body: { fechaPago: fecha, monto: Number(monto) } });
      onDone(`Pago de cuota ${r.cuotaNumero} registrado por ${money(r.montoPagado)}`);
    } catch (err) { setError(err); }
  };

  return (
    <form className="panel" onSubmit={send} data-testid="panel-pago">
      <h3>Registrar pago</h3>
      <ErrorBox error={error} />
      {quote && (
        <p>
          Cuota {quote.cuotaNumero} con vencimiento {quote.fechaVencimiento}: {money(quote.cuota)}
          {quote.recargo > 0 && <> + recargo por mora {money(quote.recargo)} ({quote.diasAtraso} días de atraso)</>}
        </p>
      )}
      <Field label="Fecha de pago"><input name="fechaPago" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></Field>
      <Field label="Monto (Q)"><input name="monto" type="number" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} /></Field>
      <button className="btn" type="submit">Registrar pago</button>
    </form>
  );
}

export default function ApplicationDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [app, setApp] = useState(null);
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(null);

  const load = useCallback(() => api(`/applications/${id}`).then(setApp).catch(setError), [id]);
  useEffect(() => { load(); }, [load]);

  const action = async (path, msg) => {
    setError(null);
    setOk(null);
    try {
      await api(`/applications/${id}/${path}`, { method: 'POST' });
      setOk(msg);
      load();
    } catch (err) { setError(err); }
  };

  const done = (msg) => { setOk(msg); setError(null); load(); };

  if (!app) return <section className="card"><ErrorBox error={error} />{!error && <p>Cargando…</p>}</section>;

  const esCliente = user.rol === 'CLIENTE';
  const editable = ['BORRADOR', 'DEVUELTA'].includes(app.estado);

  return (
    <section className="card">
      <div className="row between">
        <h1>Solicitud #{app.id}</h1>
        <StatusBadge estado={app.estado} />
      </div>
      <SuccessBox message={ok} />
      <ErrorBox error={error} />

      <dl className="details">
        <dt>Cliente</dt><dd>{app.cliente}</dd>
        <dt>Producto</dt><dd>{app.producto}</dd>
        <dt>Monto</dt><dd>{money(app.monto)}</dd>
        <dt>Plazo</dt><dd>{app.plazoMeses} meses</dd>
        <dt>Tasa anual</dt><dd>{pct(app.tasaAnual)}</dd>
        <dt>Cuota mensual</dt><dd data-testid="detalle-cuota">{money(app.cuota)}</dd>
        <dt>Destino</dt><dd>{app.destino}</dd>
        {app.score !== null && (<><dt>Score de buró</dt><dd>{app.score}</dd></>)}
        {app.rdi !== null && (<><dt>Relación deuda/ingreso</dt><dd>{pct(app.rdi)}</dd></>)}
        {app.recomendacion && (<><dt>Recomendación</dt><dd data-testid="recomendacion">{app.recomendacion}</dd></>)}
        {app.motivoRechazo && (<><dt>Motivo de rechazo</dt><dd data-testid="motivo">{app.motivoRechazo}</dd></>)}
        {app.fechaDesembolso && (<><dt>Fecha de desembolso</dt><dd>{app.fechaDesembolso}</dd></>)}
      </dl>

      {esCliente && (
        <div className="actions">
          {editable && <Link className="btn btn-light" to={`/solicitudes/${app.id}/editar`}>Editar</Link>}
          {editable && <button className="btn" onClick={() => action('submit', 'Solicitud enviada')}>Enviar solicitud</button>}
          {editable && <button className="btn btn-danger" onClick={() => action('cancel', 'Solicitud cancelada')}>Cancelar solicitud</button>}
        </div>
      )}

      {!esCliente && app.estado === 'EN_REVISION' && <EvaluatePanel app={app} onDone={done} />}
      {user.rol === 'ADMIN' && app.estado === 'APROBADA' && <DisbursePanel app={app} onDone={done} />}
      {!esCliente && app.estado === 'DESEMBOLSADA' && <PaymentPanel app={app} onDone={done} />}

      {app.planPagos.length > 0 && (
        <>
          <h2>Plan de pagos</h2>
          <table className="table" data-testid="plan-pagos">
            <thead><tr><th>#</th><th>Vencimiento</th><th>Cuota</th><th>Saldo</th><th>Estado</th><th>Fecha pago</th><th>Recargo</th></tr></thead>
            <tbody>
              {app.planPagos.map((c) => (
                <tr key={c.id}>
                  <td>{c.numero}</td><td>{c.fechaVencimiento}</td><td>{money(c.cuota)}</td><td>{money(c.saldo)}</td>
                  <td>{c.estado}</td><td>{c.fechaPago || '-'}</td><td>{c.recargo ? money(c.recargo) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2>Historial</h2>
      <table className="table" data-testid="historial">
        <thead><tr><th>Fecha</th><th>De</th><th>A</th><th>Usuario</th><th>Comentario</th></tr></thead>
        <tbody>
          {app.historial.map((h, i) => (
            <tr key={i}>
              <td>{new Date(h.fecha).toLocaleString('es-GT')}</td><td>{h.estadoAnterior || '-'}</td><td>{h.estadoNuevo}</td>
              <td>{h.usuario || 'Sistema'}</td><td>{h.comentario}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
