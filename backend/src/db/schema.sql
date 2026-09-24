CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  nombre          VARCHAR(100) NOT NULL,
  email           VARCHAR(150) NOT NULL UNIQUE,
  password_hash   VARCHAR(100) NOT NULL,
  rol             VARCHAR(20)  NOT NULL CHECK (rol IN ('CLIENTE','ANALISTA','ADMIN')),
  activo          BOOLEAN      NOT NULL DEFAULT TRUE,
  intentos_fallidos INTEGER    NOT NULL DEFAULT 0,
  bloqueado_hasta TIMESTAMPTZ,
  creado_en       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clients (
  user_id          INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  dpi              CHAR(13)      NOT NULL UNIQUE,
  fecha_nacimiento DATE          NOT NULL,
  ingreso_mensual  NUMERIC(12,2) NOT NULL,
  deudas_mensuales NUMERIC(12,2) NOT NULL DEFAULT 0,
  telefono         VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS products (
  id          SERIAL PRIMARY KEY,
  codigo      VARCHAR(20)  NOT NULL UNIQUE,
  nombre      VARCHAR(100) NOT NULL,
  monto_min   NUMERIC(12,2) NOT NULL,
  monto_max   NUMERIC(12,2) NOT NULL,
  plazo_min   INTEGER NOT NULL,
  plazo_max   INTEGER NOT NULL,
  tasa_anual  NUMERIC(6,4) NOT NULL,
  activo      BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS applications (
  id              SERIAL PRIMARY KEY,
  client_id       INTEGER NOT NULL REFERENCES users(id),
  product_id      INTEGER NOT NULL REFERENCES products(id),
  monto           NUMERIC(12,2) NOT NULL,
  plazo_meses     INTEGER NOT NULL,
  tasa_anual      NUMERIC(6,4) NOT NULL,
  cuota           NUMERIC(12,2) NOT NULL,
  destino         VARCHAR(200) NOT NULL,
  estado          VARCHAR(20) NOT NULL,
  score           INTEGER,
  mora_activa     BOOLEAN,
  rdi             NUMERIC(6,4),
  recomendacion   VARCHAR(30),
  motivo_rechazo  VARCHAR(40),
  fecha_desembolso DATE,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS application_history (
  id              SERIAL PRIMARY KEY,
  application_id  INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  estado_anterior VARCHAR(20),
  estado_nuevo    VARCHAR(20) NOT NULL,
  usuario_id      INTEGER REFERENCES users(id),
  comentario      VARCHAR(500),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS installments (
  id                SERIAL PRIMARY KEY,
  application_id    INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  numero            INTEGER NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  capital           NUMERIC(12,2) NOT NULL,
  interes           NUMERIC(12,2) NOT NULL,
  cuota             NUMERIC(12,2) NOT NULL,
  saldo             NUMERIC(12,2) NOT NULL,
  estado            VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
  UNIQUE (application_id, numero)
);

CREATE TABLE IF NOT EXISTS payments (
  id              SERIAL PRIMARY KEY,
  installment_id  INTEGER NOT NULL REFERENCES installments(id),
  fecha_pago      DATE NOT NULL,
  dias_atraso     INTEGER NOT NULL,
  recargo         NUMERIC(12,2) NOT NULL,
  monto           NUMERIC(12,2) NOT NULL,
  registrado_por  INTEGER REFERENCES users(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_client ON applications(client_id);
CREATE INDEX IF NOT EXISTS idx_app_estado ON applications(estado);
CREATE INDEX IF NOT EXISTS idx_inst_app ON installments(application_id);
