# Peluquería · Gestión de citas

Aplicación web *mobile first* para gestionar las citas de una peluquería con un único profesional.

**Stack:** Next.js 15 (App Router, Server Actions) · TypeScript · Prisma 6 · PostgreSQL 16 · Tailwind CSS 4 · Vitest.
Es una sola aplicación (frontend y backend juntos), así que se despliega en Docker o en Vercel con muy pocos cambios.

## Arranque rápido (desarrollo)

```bash
docker compose up
```

Abre <http://localhost:3000>. La primera vez aparece un **asistente de configuración** que:

1. Crea la cuenta del profesional (administrador).
2. Pregunta si quieres cargar **datos de prueba**. Incluyen tratamientos, horario, ofertas, 6 clientes, unas 60 citas pasadas y futuras y valoraciones.

Cuentas demo de clientes (contraseña `demo1234`): `lucia@demo.local`, `marcos@demo.local`, `ana@demo.local`, `david@demo.local`, `carmen@demo.local` y `javier@demo.local`.

También se puede cargar el dataset sin pasar por el asistente:

```bash
docker compose exec app npm run db:seed   # crea admin@demo.local / demo1234 si no hay administrador
```

### Volúmenes y recarga en caliente

- El código fuente se monta en el contenedor (`.:/app`). Cualquier cambio se refleja al instante gracias al hot reload de Next.js.
- `node_modules` y `.next` viven en volúmenes con nombre, así que no chocan con tu sistema operativo.
- Si cambias `package.json`, reinicia el servicio con `docker compose restart app` (al arrancar ejecuta `npm install`).
- Si cambias el modelo de datos:
  ```bash
  docker compose exec app npx prisma migrate dev --name descripcion_cambio
  ```
- Para empezar de cero: `docker compose down -v`.

### Tests

```bash
docker compose exec app npm test      # o, en local con Node 20+: npm install && npm test
```

Los tests unitarios (`tests/`) cubren la lógica de negocio pura:

- `pricing.test.ts`: aplicación de ofertas por fechas, ofertas personales, la regla de "la más ventajosa sin acumular" y los redondeos.
- `availability.test.ts`: cálculo de huecos con franjas partidas, solapes con citas o bloqueos, antelación mínima y conversión de zona horaria.

## Producción

**Docker:**

```bash
echo "SESSION_SECRET=$(openssl rand -base64 32)" > .env
docker compose -f docker-compose.prod.yml up --build -d
```

La imagen aplica las migraciones al arrancar. Detrás de HTTPS funciona tal cual. Si la sirves por HTTP plano en un dominio que no sea `localhost`, define `INSECURE_COOKIES=1` (solo para pruebas).

**Vercel / Netlify:**

1. Crea una base de datos PostgreSQL gestionada (Neon, Supabase, Vercel Postgres…).
2. Importa el repositorio y define las variables `DATABASE_URL`, `SESSION_SECRET` y `BUSINESS_TZ` (opcional, por defecto `Europe/Madrid`).
3. Vercel usa el script `vercel-build`, que ejecuta `prisma generate && prisma migrate deploy && next build`.
4. Al abrir la web por primera vez aparece el asistente de configuración.

## Funcionalidades

### Clientes
- Registro e inicio de sesión (contraseñas con bcrypt, sesión JWT en una cookie httpOnly).
- **Reserva en 3 pasos**:
  1. Elegir uno o varios tratamientos **encadenados** y su orden.
  2. Elegir día y hora. Solo se muestran los huecos donde cabe la duración total.
  3. Ver el desglose de precio con descuentos y confirmar.
- Máximo 3 citas pendientes por cliente.
- Cancelación online hasta *N* horas antes (configurable).
- **Valoración** de 1 a 5★ con comentario, solo en citas realizadas. Se puede ver la respuesta del profesional.
- Avisos dentro de la app: confirmación, cancelación, ofertas nuevas, respuestas a valoraciones…
- Consulta de las ofertas personales disponibles.

### Profesional (administrador)
- **Agenda diaria** con indicadores: citas de la semana, ingresos del mes, valoración media y citas pasadas sin cerrar. Cada cita se puede marcar como realizada, no presentada o cancelada.
- **Nueva cita en nombre de un cliente**, para las reservas por teléfono.
- **Horario**: franjas semanales (se admiten varias por día) y bloqueos puntuales (vacaciones, festivos). También configura el intervalo entre huecos, la antelación mínima para reservar y cancelar, y los días máximos de antelación.
- **Tratamientos**: alta, edición y baja (si tienen citas, se desactivan en lugar de borrarse), duración y precio. **Ofertas por rango de fechas** en cada tratamiento.
- **Clientes**: buscador, ficha con historial y estadísticas, activar o desactivar la cuenta, y **ofertas personales** (porcentaje sobre un tratamiento o sobre el total de una cita, con caducidad opcional).
- **Valoraciones**: media y distribución, filtros, respuesta pública y ocultar o mostrar en la web.

### Reglas de negocio destacadas
- **Ofertas sin acumulación: se aplica siempre la más ventajosa para el cliente.** Para cada tratamiento se toma el mayor descuento vigente el día de la cita. Una oferta personal sobre un tratamiento solo se usa si mejora la de temporada. Una oferta personal sobre el total compite con la suma de los descuentos por línea, y gana el precio más bajo.
- Las ofertas personales son **de un solo uso**. Quedan ligadas a la cita y se liberan si esta se cancela.
- El precio, la duración y el nombre de cada tratamiento se **copian en la cita** al reservar, para que los cambios posteriores del catálogo no alteren el histórico.
- La reserva se hace en una **transacción serializable** que vuelve a comprobar el hueco, así se evitan dobles reservas simultáneas.
- Las horas se guardan como "hora local del negocio" (ver `src/lib/time.ts`). El resultado es el mismo en Docker, en Vercel (UTC) o con cambio de horario de verano.

## Estructura

```
prisma/              schema.prisma, migraciones, seed por CLI
src/lib/             lógica: pricing.ts y availability.ts (puras y testeadas), booking.ts, auth.ts, seed.ts…
src/app/setup/       asistente de primer inicio
src/app/(site)/      web pública, reservar/, mis-citas/, admin/…
src/app/api/slots/   endpoint de huecos libres y presupuesto
tests/               tests unitarios (Vitest)
```

## Posibles ampliaciones
- Notificaciones por email (recordatorio 24 h antes) con un contenedor Mailpit en desarrollo.
- Recuperación de contraseña.
- Lista de espera cuando no hay huecos.
- Tests de integración y e2e (Playwright).
