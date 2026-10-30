# Pruebas de API (E11)

Colección de Postman versionada en el repositorio. Son **pruebas de API** (ejercitan la aplicación por HTTP);
las pruebas unitarias están en `backend/tests` y `frontend/tests`.

| Archivo | Contenido |
|---|---|
| `CrediTrack.postman_collection.json` | 24 solicitudes, 63 aserciones (código de respuesta, esquema JSON y contenido) |
| `local.postman_environment.json` | `baseUrl` = http://localhost:3000/api (local y pipeline) |
| `render.postman_environment.json` | `baseUrl` = https://creditrack-api.onrender.com/api (ambiente en la nube) |
| `generar-coleccion.js` | Script que genera la colección (fuente de verdad, revisable en los PR) |

## Estructura

1. **Salud y catálogo:** health check, productos, simulación correcta y fuera de rango.
2. **Autenticación y acceso:** registro (con DPI de score alto generado en el pre-request), email duplicado,
   login de analista y administrador, contraseña incorrecta, perfil sin contraseña expuesta, 401 y 403.
3. **Flujo de negocio completo (solicitudes encadenadas):** crear solicitud → enviar (pre-evaluación R5) →
   bandeja del analista → aprobar → desembolsar → cotizar → pagar las 3 cuotas → crédito FINALIZADO con historial
   completo → pago rechazado sobre crédito finalizado. Cada paso usa variables guardadas por el anterior
   (`clienteToken`, `appId`, `planPagos`).
4. **Reportes:** reporte de cartera.

## Ejecución con Newman

```bash
npx newman run qa/postman/CrediTrack.postman_collection.json -e qa/postman/local.postman_environment.json
npx newman run qa/postman/CrediTrack.postman_collection.json -e qa/postman/render.postman_environment.json
```

Cada ejecución registra un cliente nuevo (email y DPI aleatorios), por lo que la colección se puede repetir
sin limpiar la base de datos.
