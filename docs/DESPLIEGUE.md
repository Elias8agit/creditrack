# Guía de despliegue en capa gratuita (Render + Neon)

Tiempo estimado: 20 a 30 minutos.

## 1. Subir el repositorio a GitHub
1. Crear un repositorio **público** en GitHub llamado `creditrack` (sin README).
2. En la carpeta del proyecto:
   ```bash
   git remote add origin https://github.com/<su-usuario>/creditrack.git
   git push -u origin main
   ```

## 2. Base de datos PostgreSQL en Neon (gratuita, sin vencimiento)
1. Entrar a https://neon.tech e iniciar sesión con GitHub.
2. Crear proyecto `creditrack`, región más cercana (AWS us-east-1).
3. Copiar la *connection string* (formato `postgresql://usuario:clave@host/neondb?sslmode=require`).

> Alternativa: PostgreSQL gratuito de Render. Tome en cuenta que la base gratuita de Render expira a los 30 días,
> antes del cierre de la fase 2.

## 3. Backend y frontend en Render
1. Entrar a https://render.com con GitHub.
2. **New > Blueprint**, seleccionar el repositorio. Render detecta `render.yaml` y propone dos servicios:
   `creditrack-api` (web service) y `creditrack-web` (static site).
3. Completar variables pedidas:
   - `DATABASE_URL`: la cadena de Neon.
   - `CORS_ORIGIN`: `https://creditrack-web.onrender.com` (o la URL que Render asigne al frontend).
   - `VITE_API_URL`: `https://creditrack-api.onrender.com/api` (o la URL que Render asigne al backend).
4. Aplicar. Al terminar, verificar:
   - `https://creditrack-api.onrender.com/api/health` responde `{"status":"ok",...}`.
   - `https://creditrack-web.onrender.com` abre el simulador.
5. Si las URLs asignadas son distintas, actualizar `CORS_ORIGIN` y `VITE_API_URL` y redeplegar ambos
   (el frontend necesita recompilarse porque `VITE_API_URL` se inyecta en el build).

## Notas
- El plan gratuito de Render suspende el servicio tras 15 minutos sin tráfico; la primera petición puede tardar
  30 a 60 segundos. Antes de grabar el video o de la calificación, abrir `/api/health` para "despertarlo".
- Los datos semilla se cargan automáticamente la primera vez (tabla `users` vacía).
- Para reiniciar la base: ejecutar localmente `DATABASE_URL=<neon> DATABASE_SSL=true npm run db:reset` en `backend/`.
