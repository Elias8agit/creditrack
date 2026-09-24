# CrediTrack

Sistema web de gestión de solicitudes de crédito (entidad financiera ficticia). Aplicación bajo evaluación del
Proyecto Final del curso Aseguramiento de la Calidad de Software, UMG, segundo semestre 2026.

- **Origen:** aplicación generada con inteligencia artificial (Claude, Anthropic). Especificación y prompt en
  [`docs/ia/prompt-especificacion.md`](docs/ia/prompt-especificacion.md).
- **Licencia:** MIT (permite copia, modificación y despliegue público).
- **Arquitectura:** monorepo con backend y frontend separados, cada uno con su propio proceso de construcción.

| Carpeta | Tecnología | Descripción |
|---|---|---|
| `backend/` | Node.js 22, Express 5, PostgreSQL 16, JWT, bcrypt | API REST (`/api/...`) |
| `frontend/` | React 19, Vite, React Router | SPA que consume la API |

## Línea base de pruebas

El proyecto de origen **no trae pruebas automatizadas**: 0 pruebas, cobertura 0 %.
`npm test` en `backend/` y `frontend/` solo imprime un mensaje y termina.

## Requisitos

- Node.js 20 o superior (probado con 22)
- PostgreSQL 16 (local, Docker o servicio cloud)

## Instalación y ejecución local

```bash
# 1. Base de datos (opción Docker)
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env
npm install
npm start            # crea tablas y carga datos semilla al primer arranque
# npm run db:reset   # reinicia la base con los datos semilla

# 3. Frontend (otra terminal)
cd frontend
cp .env.example .env
npm install
npm run dev          # http://localhost:5173
```

## Usuarios semilla

| Rol | Email | Contraseña |
|---|---|---|
| ADMIN | admin@creditrack.test | Admin123! |
| ANALISTA | analista@creditrack.test | Analista123! |
| CLIENTE | ana@creditrack.test, bruno@, carla@, diego@, elena@, fabio@ | Cliente123! |

El buró de crédito es un servicio simulado (`backend/src/services/buroClient.js`). Respuestas fijas por DPI:

| DPI | Cliente semilla | Score | Mora activa |
|---|---|---|---|
| 1000000000101 | Ana | 780 | No |
| 1000000000202 | Bruno | 650 | No |
| 1000000000303 | Carla | 560 | No |
| 1000000000404 | Diego | 720 | Sí |
| 1000000000505 | Elena (60 años) | 700 | No |
| 1000000000606 | Fabio | 699 | No |
| 1000000000707 | (registrar) | 600 | No |
| 1000000000808 | (registrar) | 599 | No |

## Endpoints principales

| Método | Ruta | Rol |
|---|---|---|
| GET | /api/health | Público |
| POST | /api/auth/register, /api/auth/login | Público |
| GET | /api/auth/me | Autenticado |
| GET | /api/products | Público |
| POST | /api/products/simulate | Público |
| PUT | /api/products/:id | ADMIN |
| GET/POST | /api/applications | Autenticado / CLIENTE |
| GET/PUT | /api/applications/:id | Autenticado / CLIENTE |
| POST | /api/applications/:id/submit, /cancel | CLIENTE |
| POST | /api/applications/:id/evaluate | ANALISTA, ADMIN |
| POST | /api/applications/:id/disburse | ADMIN |
| GET/POST | /api/applications/:id/payments(/quote) | ANALISTA, ADMIN |
| GET/POST/PATCH | /api/users | ADMIN |
| GET | /api/reports/summary | ANALISTA, ADMIN |

## Despliegue

Ver [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md) (Render + PostgreSQL en Neon, capa gratuita).

## Pruebas y pipeline

Se incorporan en la fase 2 del proyecto (pruebas unitarias, colección Postman con Newman, SonarCloud y pipeline CI/CD).
