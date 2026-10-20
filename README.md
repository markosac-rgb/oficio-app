# Ofixio

App web para México que conecta a clientes con personas que hacen oficios en casa: plomería, electricidad, carpintería, pintura, técnicos, jardinería y limpieza. Se usa desde el celular y también en computadora. Se puede instalar como aplicación (PWA). La frase de la marca es «Lo arreglamos por ti».

La interfaz está en español de México. Los precios se muestran en pesos (MXN).

## Cómo correrla

Un solo comando, desde la carpeta del proyecto:

```bash
npm run iniciar
```

Eso instala dependencias si faltan, aplica las migraciones de PostgreSQL, carga los datos de ejemplo y abre la app en [http://127.0.0.1:43123](http://127.0.0.1:43123). En esta máquina hace falta Postgres en `127.0.0.1:5432`, base `oficio`, usuario `oficio`, contraseña `oficio`. Si el servicio está apagado, el script intenta encenderlo.

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

Los datos se guardan en PostgreSQL. La sesión es una cookie httpOnly.

- Crear cuenta de cliente o de proveedor, con correo y/o teléfono y contraseña.
- Entrar con esa contraseña.
- Publicar servicios, zona, precios y horario.
- Buscar por oficio, nombre o problema, con filtros de distancia, precio, disponibilidad, calificación y emergencia.
- Pedir un trabajo, con descripción, fotos y dirección.
- Cotizar. El cliente acepta o rechaza antes de confirmar.
- Elegir fecha y hora, o “lo antes posible”.
- Chat dentro de la app, también con fotos.
- Pagar el precio acordado con Mercado Pago (tarjeta, OXXO o SPEI) cuando hay `MP_ACCESS_TOKEN`. Sin token, se registra el método y la pantalla dice que es simulado. La comisión sale de `OFIXIO_COMMISSION_PCT` (0 si no se define) y no se suma al precio.
- Seguir el trabajo: solicitado, cotizado, confirmado, en camino, en proceso, completado o cancelado.
- Calificar al terminar.
- Favoritos, volver a pedir, ayuda, cancelación y reportes.
- Panel de administración: usuarios, solicitudes, reportes, disputas y marcas de revisión.

La dirección exacta y la referencia solo las ve el proveedor cuando el trabajo ya está confirmado. El teléfono del proveedor no se publica.

## Qué es simulado

Cada pieza externa está detrás de un adaptador en `src/adapters/`. En pantalla aparece **Simulado / Demo**. Ninguna de estas acciones es real:

| Pieza | Qué hace hoy | Qué hace falta conectar |
| --- | --- | --- |
| Pagos | Con `MP_ACCESS_TOKEN`, Checkout Pro de Mercado Pago. Sin token, guarda el método y un recibo `DEMO-NO-COBRAR` marcado como simulado. Un token `TEST-` avisa que no se cobra dinero real. | Mercado Pago México. La comisión partida pide que el proveedor conecte su cuenta (`MP_CLIENT_ID` y `MP_CLIENT_SECRET`). |
| Mapas y códigos postales | Directorio local de algunos códigos y un mapa ilustrado para mover el punto. | Google Maps o Mapbox |
| Código por SMS o correo | El código se muestra en la misma pantalla. No se envía. | Twilio, MessageBird u otro SMS en México, más correo transaccional |
| Google | Entra a una cuenta de demostración fija. No abre Google. | OAuth de Google Cloud |
| Identidad | El documento queda pendiente hasta que administración lo marque. Nadie queda “verificado” solo. | Un proveedor que revise INE u otra identificación |
| Avisos push | Solo avisos dentro de la app. | FCM o APNs cuando exista la app nativa |

Ofixio **no** retiene el dinero del cliente ni ofrece un depósito en garantía. Si el proveedor no conectó Mercado Pago, el pago entra a la cuenta de Ofixio y Ofixio le paga al proveedor. Si lo conectó, el pago entra a su cuenta y Mercado Pago descuenta la comisión. Las devoluciones y las disputas de ese pago se atienden en Mercado Pago. El efectivo se acuerda entre las dos personas y no pasa por la plataforma.

## Prueba del flujo

Con la app corriendo:

```bash
npm run test:e2e
```

Playwright recorre: cliente pide, proveedor cotiza, el cliente acepta, agenda, registra el pago, el proveedor termina el trabajo y el cliente deja reseña.

## Cómo desplegarla

Hace falta Node 20 o más nuevo y un PostgreSQL. El arranque aplica `prisma migrate deploy` y después la siembra idempotente. Esa siembra hace upserts: no borra cuentas ni trabajos.

```bash
npm install
npx prisma migrate deploy
npx tsx prisma/seed.ts
npm run build
npm start
```

`npm start` escucha en el puerto 43123. En producción define `DATABASE_URL` con la cadena de PostgreSQL y sirve la app por HTTPS. La cookie de sesión se marca segura cuando `NODE_ENV=production`.

Si la base usa un pooler (Neon), `DATABASE_URL` es la URL con `-pooler` y `sslmode=require`. `DIRECT_URL` es la URL directa, sin pooler, y solo la usa `prisma migrate`. Si omites `DIRECT_URL`, las migraciones usan `DATABASE_URL`. En runtime, si el host es un pooler de Neon y la URL no trae `pgbouncer=true`, la app lo agrega para no romper las consultas preparadas.

### Paquete para un servidor sin el repositorio

`node scripts/make-bundle.mjs` genera `oficio-bundle.tar.gz`: build standalone, archivos estáticos, el motor de Prisma para Linux x86_64 (`debian-openssl-3.0.x`) y `start.sh`. La base no va dentro del paquete. En la otra máquina hace falta Node y un `DATABASE_URL` de PostgreSQL:

```bash
tar -xzf oficio-bundle.tar.gz
cd oficio
DATABASE_URL="postgresql://..." ./start.sh
```

Escucha en `0.0.0.0` y en el puerto de `PORT` (43123 si no lo defines). Detrás de un túnel HTTPS el proxy debe reenviar el host público en `Host` o en `X-Forwarded-Host`, y `X-Forwarded-Proto: https`. Si el proxy deja `Host` en una dirección interna, `trust-proxy.cjs` usa el host público para que Next no bloquee el origen.

### Render

El servicio es Docker, plan gratis, sin disco. Los datos persisten en Neon. Al arrancar, el contenedor aplica las migraciones y vuelve a sembrar las cuentas demo y los ejemplos ficticios. La siembra no duplica filas y no borra lo que ya está en Neon.

Variables en Render:

| Variable | Valor |
| --- | --- |
| `DATABASE_URL` | Cadena pooled de Neon, con `sslmode=require`. Conviene agregar `pgbouncer=true`. |
| `DIRECT_URL` | Opcional. Cadena directa de Neon, sin `-pooler`, para `prisma migrate`. Si falta, se usa `DATABASE_URL`. |
| `NODE_ENV` | `production` |
| `OFICIO_TRUST_ORIGIN` | `1` |
| `OFICIO_DEMO_DATA` | `1` por defecto. Con `0`, el arranque oculta los perfiles de ejemplo hasta que un admin los vuelva a mostrar |
| `OFICIO_PUBLIC_URL` | `https://oficio-app.onrender.com` (hace falta para Google y para las URLs de Mercado Pago) |
| `GOOGLE_CLIENT_ID` | opcional |
| `GOOGLE_CLIENT_SECRET` | opcional |
| `MP_ACCESS_TOKEN` | Token de Mercado Pago México. Sin él, el pago queda simulado. Si empieza con `TEST-`, la pantalla avisa que no se cobra dinero real. |
| `MP_PUBLIC_KEY` | opcional |
| `MP_WEBHOOK_SECRET` | opcional. Si está, el webhook exige la firma `x-signature`. |
| `MP_CLIENT_ID` | opcional. Junto con el secreto, enciende «Conectar Mercado Pago» para el proveedor. |
| `MP_CLIENT_SECRET` | opcional |
| `OFIXIO_COMMISSION_PCT` | Porcentaje de comisión. `0` por defecto. `10` es 10% del precio acordado, no un cargo extra. Solo se manda como `marketplace_fee` si el proveedor conectó su cuenta. |

Un administrador puede ocultar los perfiles de ejemplo en Administración. Mientras se muestran, la franja de cifras y las tarjetas dicen «Datos de ejemplo». Los números salen de la base: una cuenta real los aumenta. Si los ejemplos se ocultan, la franja cuenta solo personas reales.

La revisión de salud es `GET /api/health`. Render termina HTTPS y manda `X-Forwarded-Proto` y el host público. La cookie de sesión sale con `Secure`.

`render.yaml` describe ese servicio. `DATABASE_URL` y `DIRECT_URL` se llenan en el panel de Render; no van en el repositorio.

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

## Documentos legales

Hay un borrador de términos y un aviso de privacidad (integral y simplificado) en `docs/legal/`, en Markdown y en Word. Las páginas públicas son `/terminos` y `/privacidad`. Arriba de cada una dice que un abogado debe revisarlo antes de publicarse.

Los datos del responsable están en `src/lib/legal-party.ts`. Las páginas y el aviso simplificado del registro los leen de ahí:

- Responsable: Marcos Iván Amezquita Canizales (persona física)
- Domicilio: Circuito Berrugata 3303, Palmilla
- RFC: AECM880617U33
- Correo de privacidad: xionplanta@gmail.com
- Última actualización: 20 de octubre de 2026

La versión que guarda la aplicación al crear una cuenta es `2026-10-20.2`.

### Mercado Pago

Webhook para registrar en el panel de Mercado Pago, en modo producción o de prueba según el token:

`https://oficio-app.onrender.com/api/payments/mercadopago/webhook`

Evento: pagos (`payment`).

URL de retorno de OAuth, si el proveedor conecta su cuenta:

`https://oficio-app.onrender.com/api/provider/mercadopago/callback`

Las `back_urls` del checkout vuelven a `https://oficio-app.onrender.com/solicitudes/{id}/pago`. El estado del pago se confirma consultando la API de Mercado Pago; no se cree al parámetro `status` de la URL.

## App nativa más adelante

La interfaz ya es móvil y se instala como PWA. Para envolverla con Capacitor:

1. Publica esta app Next.js en un servidor (las rutas `/api` necesitan Node).
2. Crea el proyecto Capacitor y apunta `server.url` a esa dirección.
3. Si más tarde separas la API, define `NEXT_PUBLIC_API_BASE` con la URL del servidor. El cliente ya la usa en `src/lib/api.ts`.

Expo puede abrir la misma URL en un WebView. No hace falta reescribir las pantallas para el primer empaque.
