import { ESTADO_LABEL } from '../api';

export function StatusBadge({ estado }) {
  return <span className={`badge badge-${estado.toLowerCase()}`} data-testid="estado">{ESTADO_LABEL[estado] || estado}</span>;
}

export function ErrorBox({ error }) {
  if (!error) return null;
  return (
    <div className="alert alert-error" role="alert" data-testid="error">
      <strong>{error.message}</strong>
      {Array.isArray(error.detalles) && (
        <ul>
          {error.detalles.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SuccessBox({ message }) {
  if (!message) return null;
  return <div className="alert alert-success" role="status" data-testid="success">{message}</div>;
}

export function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
