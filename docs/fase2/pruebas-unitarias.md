# Pruebas unitarias: Fase 2 (E10)

## Cómo ejecutarlas

```bash
cd backend && npm test     # Jest, con cobertura (coverage/lcov.info)
cd frontend && npm test    # Vitest + Testing Library, con cobertura (coverage/lcov.info)
```

## Resumen

| Paquete | Framework | Archivos de prueba | Pruebas ejecutadas |
|---|---|---|---|
| backend | Jest 30 | 9 | 71 |
| frontend | Vitest 5 + Testing Library | 2 | 11 |
| **Total** | | **11** | **82** |

## Cobertura de los módulos críticos (E2) contra la línea base

Línea base registrada (sección 2.4): 0 pruebas, 0 % de cobertura en todos los módulos.

| Módulo crítico | Archivo | Líneas antes | Líneas después | Incremento |
|---|---|---|---|---|
| Motor de pre-evaluación | services/evaluationEngine.js | 0 % | 100 % | +100 pp |
| Motor de pre-evaluación | services/buroClient.js | 0 % | 100 % | +100 pp |
| Cálculo financiero | services/creditCalculator.js | 0 % | 100 % | +100 pp |
| Pagos y mora | services/paymentService.js | 0 % | 100 % | +100 pp |
| Pagos y mora | utils/dates.js | 0 % | 100 % | +100 pp |
| Solicitudes y estados | services/stateMachine.js | 0 % | 100 % | +100 pp |
| Solicitudes y estados | services/applicationService.js | 0 % | 44.8 % | +44.8 pp |
| Autenticación y autorización | services/authService.js | 0 % | 72.4 % | +72.4 pp |
| Autenticación y autorización | middleware/auth.js | 0 % | 100 % | +100 pp |

Todos los módulos críticos superan el incremento mínimo de 20 puntos porcentuales.

## Dobles de prueba (mocks y stubs) y justificación

| Prueba | Dependencia aislada | Por qué se aisló |
|---|---|---|
| applicationService.test.js | `buroClient` (servicio externo de buró) | Es un tercero: en producción tendría latencia, costo y datos cambiantes. El stub fija score y mora para recorrer cada regla de la tabla de decisión de forma repetible. |
| applicationService.test.js, paymentService.test.js, authService.test.js | `db/pool` (PostgreSQL) | La lógica a verificar (transiciones, cálculo de recargo, conteo de intentos fallidos) no depende de la base; usar una base real haría las pruebas lentas, dependientes de datos previos y no deterministas. El stub además permite verificar qué sentencias se ejecutan (por ejemplo, que la cuota se marque PAGADA). |
| paymentService.test.js | `applicationService` (findById, changeState) | Se prueba solo el módulo de pagos; el cambio de estado pertenece a otro módulo y ya tiene sus propias pruebas. |
| api.test.js, components.test.jsx (frontend) | `fetch` (red y backend) | El componente se valida con respuestas fijas del servidor, incluidos errores 400, sin levantar la API. |
| authMiddleware.test.js | objetos `req` y `next` de Express | Se verifica el middleware como función aislada, sin servidor HTTP. |

## Nota conceptual

Estas pruebas son **unitarias**: verifican funciones y componentes aislados con Jest y Vitest. Las pruebas
de la colección de Postman (E11) son **pruebas de API**: ejercitan la aplicación desplegada por HTTP.
