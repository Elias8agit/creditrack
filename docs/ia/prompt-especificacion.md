# Especificación utilizada para generar la aplicación con IA

Herramienta: Claude (modo Cowork, modelo claude-opus-5-5), Anthropic.
Fecha de generación: 23 de septiembre de 2026.
Forma de uso: se entregó a la herramienta el enunciado del proyecto final del curso y la instrucción del estudiante
("haz la app lo mejor posible donde logremos abarcar todo lo que el proyecto necesita"; dominio: solicitudes de crédito;
stack: Node/Express + React). A partir de ello la herramienta redactó la siguiente especificación y generó el código.

## Prompt / especificación

Construir "CrediTrack", una aplicación web cliente-servidor para gestionar solicitudes de crédito de una entidad
financiera ficticia. Monorepo con `backend/` (Node.js 22, Express 5, PostgreSQL, JWT) y `frontend/` (React + Vite),
con procesos de construcción separados. Moneda: quetzales (Q).

### Roles
- CLIENTE: se registra, simula, crea y envía solicitudes, corrige solicitudes devueltas, cancela, consulta su plan de pagos.
- ANALISTA: evalúa solicitudes en revisión (aprobar, rechazar, devolver), registra pagos de cuotas.
- ADMIN: todo lo del analista, además aprueba montos mayores a Q100,000, desembolsa, administra usuarios y productos, consulta reportes.

### Autenticación
- Registro de cliente: nombre (3 a 100), email único, contraseña con mínimo 8 caracteres, al menos una mayúscula,
  una minúscula y un dígito; DPI de 13 dígitos único; fecha de nacimiento (edad mínima 18 años);
  ingreso mensual mayor que 0; deudas mensuales mayor o igual a 0.
- Login con JWT (expira en 60 minutos). Cinco intentos fallidos consecutivos bloquean la cuenta 15 minutos.

### Productos (parametrizables por ADMIN)
| Código | Monto mínimo | Monto máximo | Plazo (meses) | Tasa anual |
|---|---|---|---|---|
| MICRO | 1,000 | 25,000 | 3 a 24 | 24 % |
| PERSONAL | 5,000 | 150,000 | 6 a 60 | 18 % |
| VEHICULO | 25,000 | 400,000 | 12 a 72 | 12 % |

### Cálculo de cuota
Sistema francés: cuota = P·i / (1 − (1 + i)^−n), i = tasa anual / 12, redondeo a 2 decimales.
Simulador público sin autenticación que devuelve cuota, total a pagar, total de intereses y tabla de amortización.

### Solicitudes y máquina de estados
BORRADOR → ENVIADA → EN_REVISION | RECHAZADA; EN_REVISION → APROBADA | RECHAZADA | DEVUELTA;
DEVUELTA → ENVIADA | CANCELADA; BORRADOR → CANCELADA; APROBADA → DESEMBOLSADA; DESEMBOLSADA → FINALIZADA.
Toda transición no permitida responde 409. Cada cambio de estado queda en el historial con usuario, fecha y comentario.
Un cliente puede tener como máximo 3 solicitudes activas (BORRADOR, ENVIADA, EN_REVISION, DEVUELTA, APROBADA).
Destino del crédito: 10 a 200 caracteres. Monto y plazo dentro de los límites del producto.

### Pre-evaluación automática al enviar (tabla de decisión)
Se consulta el servicio de buró (simulado) por DPI y se obtiene score (300 a 850) y mora activa.
Relación deuda/ingreso (RDI) = (deudas mensuales + cuota) / ingreso mensual.
Edad al vencimiento = edad actual + plazo/12.
1. Mora activa → RECHAZADA (MORA_ACTIVA).
2. Edad al vencimiento > 70 → RECHAZADA (EDAD).
3. Score < 600 → RECHAZADA (SCORE_INSUFICIENTE).
4. RDI > 40 % → RECHAZADA (CAPACIDAD_PAGO).
5. Score ≥ 700 y RDI ≤ 30 % → EN_REVISION con recomendación PREAPROBADA.
6. En otro caso → EN_REVISION con recomendación REVISION_MANUAL.

### Evaluación
Aprobar, rechazar o devolver solo desde EN_REVISION. Rechazar y devolver exigen comentario de al menos 10 caracteres.
Montos mayores a Q100,000 solo los aprueba un ADMIN (el analista recibe 403).

### Desembolso y pagos
ADMIN desembolsa una solicitud APROBADA indicando fecha de desembolso (no futura). Se genera el plan de pagos:
cuota k vence k meses después del desembolso. Pagos: se paga siempre la cuota pendiente más antigua, con fecha de
pago no futura. Si la fecha de pago supera el vencimiento en más de 5 días de gracia, se cobra recargo por mora del
5 % de la cuota. El monto pagado debe ser exactamente cuota + recargo. Al pagar la última cuota la solicitud pasa a FINALIZADA.

### Administración y reportes
ADMIN crea analistas, activa/desactiva y desbloquea usuarios, edita productos (tasa 1 % a 60 %, mínimo < máximo).
Reporte: solicitudes por estado, monto aprobado y desembolsado, tasa de aprobación, cuotas vencidas.

### No funcionales
Respuestas de API en JSON con mensajes de error en español, contraseñas con bcrypt, cabeceras de seguridad (helmet),
CORS restringido al frontend configurado, variables de entorno para secretos, datos semilla para pruebas.
