# Estrategia de ramas y control de cambios (E9)

## Ramas y ambientes

| Rama | Ambiente | Qué contiene | Despliegue |
|---|---|---|---|
| `feature/*`, `fix/*` | Ninguno (local) | Un cambio puntual (pruebas, corrección, pipeline) | No |
| `dev` | Desarrollo / integración | Cambios integrados y revisados | No (solo CI) |
| `qa` | QA | Versión candidata para pruebas | Sí, al ambiente QA |
| `main` | PROD | Versión en producción (Render) | Sí, a producción |

## Política de promoción

1. Todo cambio nace en una rama `feature/*` o `fix/*` creada desde `dev`.
2. Se integra a `dev` mediante Pull Request con revisión (comentarios sobre el contenido del cambio).
3. `dev` se promueve a `qa` mediante Pull Request. Requisito: el pipeline completo en verde
   (compilación, pruebas unitarias, SonarCloud con quality gate aprobado y pruebas de API).
4. `qa` se promueve a `main` mediante Pull Request con los mismos checks obligatorios.
5. No se hace push directo a `qa` ni a `main`: las reglas de protección de GitHub lo impiden.

## Reglas de protección configuradas en GitHub (qa y main)

- Require a pull request before merging.
- Require status checks to pass before merging, con los checks obligatorios:
  `1. Compilación`, `2. Pruebas unitarias`, `3. Análisis estático (SonarCloud)`, `4. Pruebas de API (Newman)`.
- Require branches to be up to date before merging.
- Do not allow bypassing the above settings.

Si cualquier etapa falla, GitHub bloquea el botón de merge del Pull Request.

## Despliegue

El job `5. Despliegue` solo corre en un `push` a `qa` o `main` (es decir, después de un merge aprobado).
Usa los *deploy hooks* de Render guardados como secretos del ambiente de GitHub (`qa` o `produccion`) y luego
verifica que `/api/health` responda. El auto-deploy de Render está desactivado (`autoDeploy: false`), por lo que
ninguna versión llega a producción sin pasar por el pipeline.
