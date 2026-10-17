# Oficio

App web para México que conecta a clientes con personas que hacen oficios en casa: plomería, electricidad, carpintería, pintura, técnicos, jardinería y limpieza. Se usa desde el celular y también en computadora. Se puede instalar como aplicación (PWA).

La interfaz está en español de México. Los precios se muestran en pesos (MXN).

## Cómo correrla

Un solo comando, desde la carpeta del proyecto:

```bash
npm run iniciar
```

Eso instala dependencias si faltan, prepara la base SQLite, carga los datos de ejemplo y abre la app en [http://127.0.0.1:43123](http://127.0.0.1:43123).

También sirve `./iniciar.sh`.

## Cuentas de demostración

Contraseña de las tres: `demo1234`

| Quién | Correo | Teléfono |
| --- | --- | --- |
| Cliente | ana.lopez@oficio.demo | 5512340001 |
| Proveedor (plomero) | jorge.ramirez@oficio.demo | 5512340002 |
| Administración | admin@oficio.demo | 5512340003 |

Los proveedores y las reseñas que ya vienen cargados son **ejemplos ficticios**. La app lo dice en pantalla. No son negocios ni opiniones reales.

## Qué sí funciona

Los datos se guardan en SQLite (archivo `prisma/dev.db`). La sesión es una cookie httpOnly.

- Crear cuenta de cliente o de proveedor, con correo y/o teléfono y contraseña.
- Entrar con esa contraseña.
- Publicar servicios, zona, precios y horario.
- Buscar por oficio, nombre o problema, con filtros de distancia, precio, disponibilidad, calificación y emergencia.
- Pedir un trabajo, con descripción, fotos y dirección.
- Cotizar. El cliente acepta o rechaza antes de confirmar.
- Elegir fecha y hora, o “lo antes posible”.
- Chat dentro de la app, también con fotos.
- Registrar el método de pago y el desglose (costo y comisión del 10%). No se cobra dinero.
- Seguir el trabajo: solicitado, cotizado, confirmado, en camino, en proceso, completado o cancelado.
- Calificar al terminar.
- Favoritos, volver a pedir, ayuda, cancelación y reportes.
- Panel de administración: usuarios, solicitudes, reportes, disputas y marcas de revisión.

La dirección exacta y la referencia solo las ve el proveedor cuando el trabajo ya está confirmado. El teléfono del proveedor no se publica.

## Qué es simulado

Cada pieza externa está detrás de un adaptador en `src/adapters/`. En pantalla aparece **Simulado / Demo**. Ninguna de estas acciones es real:

| Pieza | Qué hace hoy | Qué hace falta conectar |
| --- | --- | --- |
| Pagos | Guarda el método y un recibo con la referencia `DEMO-NO-COBRAR`. No hay cobro, ficha de OXXO ni CLABE. | Conekta, Stripe México, Mercado Pago u OpenPay |
| Mapas y códigos postales | Directorio local de algunos códigos y un mapa ilustrado para mover el punto. | Google Maps o Mapbox |
| Código por SMS o correo | El código se muestra en la misma pantalla. No se envía. | Twilio, MessageBird u otro SMS en México, más correo transaccional |
| Google | Entra a una cuenta de demostración fija. No abre Google. | OAuth de Google Cloud |
| Identidad | El documento queda pendiente hasta que administración lo marque. Nadie queda “verificado” solo. | Un proveedor que revise INE u otra identificación |
| Avisos push | Solo avisos dentro de la app. | FCM o APNs cuando exista la app nativa |

Oficio **no** retiene el dinero del cliente ni ofrece un depósito en garantía. La comisión se muestra antes de confirmar, pero no se cobra. Efectivo se acuerda entre las dos personas, sin protección de la plataforma.

## Prueba del flujo

Con la app corriendo:

```bash
npm run test:e2e
```

Playwright recorre: cliente pide, proveedor cotiza, el cliente acepta, agenda, registra el pago, el proveedor termina el trabajo y el cliente deja reseña.

## Cómo desplegarla

Hace falta Node 20 o más nuevo y un disco donde viva el archivo SQLite.

```bash
npm install
npx prisma migrate deploy
npx tsx prisma/seed.ts
npm run build
npm start
```

`npm start` escucha en el puerto 43123. En producción define `DATABASE_URL` (por ejemplo `file:/datos/oficio.db`) y sirve la app por HTTPS. La cookie de sesión se marca segura cuando `NODE_ENV=production`.

### Paquete para un servidor sin el repositorio

`node scripts/make-bundle.mjs` genera `oficio-bundle.tar.gz`: build standalone, archivos estáticos, el motor de Prisma para Linux x86_64 (`debian-openssl-3.0.x`), la base ya migrada y con las cuentas demo, y `start.sh`. En la otra máquina solo hace falta Node:

```bash
tar -xzf oficio-bundle.tar.gz
cd oficio
./start.sh
```

Escucha en `0.0.0.0` y en el puerto de `PORT` (43123 si no lo defines). La base del paquete es `data/oficio.db`. Detrás de un túnel HTTPS el proxy debe reenviar el host público en `Host` o en `X-Forwarded-Host`, y `X-Forwarded-Proto: https`. Si el proxy deja `Host` en una dirección interna, `trust-proxy.cjs` usa el host público para que Next no bloquee el origen.

### Render

En el plan gratis el disco se borra en cada deploy. Por eso la base vive en `/tmp` y, al arrancar, el contenedor aplica las migraciones y vuelve a sembrar las cuentas demo y los ejemplos ficticios. La siembra usa upserts: no duplica filas y no borra cuentas que alguien haya creado en esa misma vida del contenedor. Si el contenedor se reinicia, `/tmp` queda vacío y las cuentas demo vuelven a existir.

Variables en Render:

| Variable | Valor |
| --- | --- |
| `DATABASE_URL` | `file:/tmp/oficio.db` |
| `NODE_ENV` | `production` |
| `OFICIO_TRUST_ORIGIN` | `1` |
| `OFICIO_PUBLIC_URL` | `https://oficio-app.onrender.com` (hace falta si activas Google) |
| `GOOGLE_CLIENT_ID` | opcional |
| `GOOGLE_CLIENT_SECRET` | opcional |

La revisión de salud es `GET /api/health`. Render termina HTTPS y manda `X-Forwarded-Proto` y el host público. La cookie de sesión sale con `Secure`.

El archivo `render.yaml` sigue describiendo un servicio Docker. Si más adelante pasas a un plan con disco, monta 1 GB en `/data` y cambia `DATABASE_URL` a `file:/data/oficio.db`.

### Entrar con Google (gratis)

Sin `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`, el botón dice **simulado** y no abre Google.

Para activarlo en [Google Cloud Console](https://console.cloud.google.com/):

1. Crea un proyecto (el nivel gratuito alcanza).
2. Ve a **APIs y servicios → Pantalla de consentimiento de OAuth** y configúrala como externa, en modo de prueba. Agrega tu correo como usuario de prueba.
3. Ve a **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**. Tipo: aplicación web.
4. En **Orígenes autorizados de JavaScript** pon `https://oficio-app.onrender.com`.
5. En **URI de redireccionamiento autorizados** pon exactamente `https://oficio-app.onrender.com/api/auth/google/callback`.
6. Copia el ID y el secreto a las variables de Render y vuelve a desplegar.

La URL de retorno que usa el servidor es `<OFICIO_PUBLIC_URL>/api/auth/google/callback`. Si no defines `OFICIO_PUBLIC_URL`, se arma con el host que manda el proxy.

SQLite alcanza para una sola instancia. Si más adelante hay varios servidores, se puede cambiar el proveedor en `prisma/schema.prisma` (por ejemplo PostgreSQL) y generar una migración nueva. El resto del código usa Prisma.

## App nativa más adelante

La interfaz ya es móvil y se instala como PWA. Para envolverla con Capacitor:

1. Publica esta app Next.js en un servidor (las rutas `/api` necesitan Node).
2. Crea el proyecto Capacitor y apunta `server.url` a esa dirección.
3. Si más tarde separas la API, define `NEXT_PUBLIC_API_BASE` con la URL del servidor. El cliente ya la usa en `src/lib/api.ts`.

Expo puede abrir la misma URL en un WebView. No hace falta reescribir las pantallas para el primer empaque.
