# Publicar Ofixio en App Store y Google Play

La app nativa no duplica el servidor. Capacitor abre `OFICIO_PUBLIC_URL` (hoy `https://oficio-app.onrender.com`). Si el celular no tiene red, muestra `mobile/www/offline.html` con la marca. El identificador es `mx.ofixio.app` y el nombre visible es Ofixio.

Los pagos de servicios en casa siguen en Mercado Pago (tarjeta, OXXO o SPEI). Apple permite ese cobro porque el servicio se presta fuera de la app. No hay compras dentro de la app.

Los perfiles marcados «Datos de ejemplo» o «Ejemplo ficticio» son ficticios. No inventes reseñas ni certificaciones para la ficha.

## 1. Cuentas

### Apple Developer — 99 USD al año

1. Entra a [developer.apple.com/programs/enroll](https://developer.apple.com/programs/enroll/) con el Apple ID de Marcos.
2. Inscríbete como persona física. El cobro es de 99 USD cada año.
3. Cuando aprueben la cuenta, en [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources) crea un App ID con el bundle `mx.ofixio.app`.
4. Activa las capacidades **Sign in with Apple** y **Push Notifications**.
5. Crea una llave (.p8) con Sign in with Apple y Apple Push Notifications (APNs). Anota el **Key ID** y el **Team ID**. El archivo .p8 solo se descarga una vez.
6. Crea un Services ID (por ejemplo `mx.ofixio.app.signin`) para el botón de Apple en la web. En su configuración, el dominio es `oficio-app.onrender.com` y la URL de retorno es `https://oficio-app.onrender.com/api/auth/apple/callback`.
7. En App Store Connect crea la app con el mismo bundle. La categoría sugerida es **Estilo de vida**.

### Google Play — 25 USD, un solo pago

1. Entra a [play.google.com/console/signup](https://play.google.com/console/signup) con la cuenta de Google de Marcos.
2. Paga los 25 USD. No se renueva.
3. Crea la app **Ofixio**. El nombre del paquete es `mx.ofixio.app`.
4. La categoría sugerida es **Casa y hogar**.

## 2. Variables del servidor

En Render, además de las que ya usa el sitio:

| Variable | Para qué |
| --- | --- |
| `OFICIO_PUBLIC_URL` | `https://oficio-app.onrender.com`. Es la dirección que abre la app. |
| `FCM_SERVICE_ACCOUNT_JSON` | JSON de la cuenta de servicio de Firebase, en una sola línea. Sin él, Android no recibe push. El aviso dentro de la app sigue funcionando. |
| `APPLE_CLIENT_ID` | Services ID (`mx.ofixio.app.signin`). |
| `APPLE_TEAM_ID` | Team ID de Apple. |
| `APPLE_KEY_ID` | Key ID de la llave .p8. |
| `APPLE_PRIVATE_KEY` | Contenido del .p8. Puedes escribir los saltos como `\n`. |
| `APPLE_BUNDLE_ID` | Opcional. Por defecto `mx.ofixio.app`. Es el tema de APNs y una audiencia válida del token de Apple. |
| `APNS_SANDBOX` | `1` solo mientras pruebas un build de desarrollo de iOS. En la tienda déjalo vacío. |

Si falta cualquiera de las cuatro variables de Apple, el botón **Iniciar sesión con Apple** no se muestra. Si falta `FCM_SERVICE_ACCOUNT_JSON`, no se envían push de Android. Nada de eso tumba el arranque.

### Firebase (push de Android, y iOS si también quieres FCM)

1. Crea un proyecto en [Firebase console](https://console.firebase.google.com/).
2. Agrega una app Android con el paquete `mx.ofixio.app` y descarga `google-services.json` a `android/app/google-services.json`. Ese archivo no va al git.
3. En Firebase, Project settings → Service accounts → Generate new private key. Ese JSON es `FCM_SERVICE_ACCOUNT_JSON`.
4. Para que iOS reciba por FCM además de APNs, sube la llave .p8 de Apple en Firebase → Cloud Messaging. Ofixio manda el push de iOS directo a APNs con la misma llave, así que FCM en iOS es opcional.

El token del celular se guarda en la tabla `PushDevice` con `POST /api/devices/push`. Se manda un aviso cuando hay una solicitud nueva, un mensaje o un pago confirmado (y también en los otros avisos que ya escribe la app).

## 3. Secretos de GitHub Actions

El workflow `.github/workflows/mobile.yml` solo corre cuando lo lanzas a mano (**Actions → Apps móviles → Run workflow**). No se dispara en cada push.

Secretos de Android:

| Secreto | Contenido |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | El archivo `.jks` o `.keystore` en base64. |
| `ANDROID_KEYSTORE_PASSWORD` | Contraseña del almacén. |
| `ANDROID_KEY_ALIAS` | Alias de la llave. |
| `ANDROID_KEY_PASSWORD` | Contraseña de la llave. |

Crea el almacén una vez, en tu máquina:

```bash
keytool -genkeypair -v -keystore ofixio-release.keystore -alias ofixio -keyalg RSA -keysize 2048 -validity 10000
base64 -w 0 ofixio-release.keystore
```

Guarda el keystore. Si lo pierdes, no podrás actualizar la app en Play.

Secretos de iOS:

| Secreto | Contenido |
| --- | --- |
| `IOS_CERTIFICATE_BASE64` | Certificado de distribución `.p12` en base64. |
| `IOS_CERTIFICATE_PASSWORD` | Contraseña de ese `.p12`. |
| `IOS_PROVISION_PROFILE_BASE64` | Perfil de aprovisionamiento App Store del bundle `mx.ofixio.app`, en base64. |

El job de iOS usa un Mac de GitHub y deja un `.xcarchive`. Subirlo a App Store Connect todavía pide la app de Transporter o `xcrun altool` con una llave de API de App Store Connect. Si el runner de macOS se te hace caro, Codemagic hace el mismo papel: el `capacitor.config.ts` y las carpetas `ios/` y `android/` ya están listos para ese servicio.

## 4. Compilar en esta máquina

Hace falta Node 20 y, para Android, Java 21 y Android SDK.

```bash
npm ci
npm run mobile:icons
OFICIO_PUBLIC_URL=https://oficio-app.onrender.com npx cap sync
```

Android, APK de prueba (no sirve para la tienda):

```bash
cd android && ./gradlew assembleDebug
```

El APK queda en `android/app/build/outputs/apk/debug/app-debug.apk`.

Android, paquete de Play (AAB), con el keystore en el entorno:

```bash
cd android
ANDROID_KEYSTORE_PATH=ofixio-release.keystore \
ANDROID_KEYSTORE_PASSWORD=... \
ANDROID_KEY_ALIAS=ofixio \
ANDROID_KEY_PASSWORD=... \
./gradlew bundleRelease
```

iOS solo se archiva en Mac, con Xcode abierto en `ios/App`. Activa el team de firma, Sign in with Apple y Push Notifications. Luego Product → Archive.

`google-services.json` es opcional para compilar. El `build.gradle` de la app solo aplica el plugin de Google si ese archivo existe. Sin él, el APK abre el sitio y el push de Android no se registra.

## 5. Subir

### Google Play

1. Play Console → Ofixio → Prueba interna o Producción → Crear versión.
2. Sube el `.aab`.
3. Completa la ficha, la clasificación de contenido y Data safety (la lista de abajo).
4. En la política de datos declara que la cuenta se puede borrar dentro de la app: Perfil → **Borrar mi cuenta**.

### App Store

1. Abre el archive en Xcode Organizer o súbelo con Transporter.
2. En App Store Connect llena la ficha, la privacidad (App Privacy) y el contacto de revisión.
3. En «Inicio de sesión» pega las notas del revisor de la sección 7. No hace falta un usuario de Apple si el revisor entra con la cuenta demo.

## 6. Textos sugeridos para la ficha

No copies reseñas. No digas que alguien está verificado si la app no muestra esa etiqueta. No hables de depósito, custodia ni garantía de devolución.

**Nombre:** Ofixio

**Subtítulo (Apple, 30 caracteres):** Oficios cerca de tu casa

**Descripción corta (Play, 80 caracteres):** Pide plomeros, electricistas y otros oficios. Acuerdas el precio y sigues el trabajo.

**Descripción:**

Ofixio conecta a quien necesita un oficio en casa con quien lo ofrece, en México.

Pides el trabajo con tu zona. Recibes un precio antes de confirmar. La calle exacta se comparte con el proveedor solo cuando el servicio queda confirmado. Puedes pagar con Mercado Pago (tarjeta, OXXO o SPEI) o acordar efectivo. El efectivo no pasa por Ofixio. Ofixio no retiene el dinero ni ofrece un depósito en garantía. Si el pago fue con Mercado Pago, la devolución y la disputa se atienden en Mercado Pago.

Sigues el trabajo desde el celular: cotizado, confirmado, en camino, en proceso o terminado. Al final puedes dejar una reseña.

Algunas fichas de la demostración dicen «Datos de ejemplo». Esas personas y esas reseñas son ficticias.

**Palabras clave (Apple, separadas por coma, máximo 100 caracteres):**

plomero,electricista,oficios,hogar,reparacion,Mexico

**Categoría:** Apple, Estilo de vida. Google Play, Casa y hogar.

**URL de soporte y de privacidad:** `https://oficio-app.onrender.com/privacidad`

**URL de términos:** `https://oficio-app.onrender.com/terminos`

## 7. Notas para el revisor

Pega esto en App Store Connect y en el acceso de revisión de Play:

```
Ofixio es un mercado de oficios para el hogar en México. La app nativa abre el sitio publicado.

Cuentas de demostración (contraseña demo1234):
- Cliente: ana.lopez@oficio.demo
- Proveedor: jorge.ramirez@oficio.demo
- Admin: admin@oficio.demo

Para ver el flujo: entra como Ana, pide un servicio, entra como Jorge, cotiza, vuelve como Ana, agenda y registra el pago. Sin token de Mercado Pago el pago queda marcado como simulado y no se cobra. Con un token de prueba, Mercado Pago muestra que no se cobra dinero real.

Borrar la cuenta: Perfil → Borrar mi cuenta. Las cuentas demo se vuelven a crear en el siguiente arranque del servidor. Para probar el borrado de una cuenta real, regístrate con un correo propio y bórrala desde Perfil.

Términos: /terminos. Aviso de privacidad: /privacidad. También están en el pie y en Perfil.

Iniciar sesión con Apple solo aparece si el servidor tiene APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID y APPLE_PRIVATE_KEY. Si no están, usa el correo de demostración.

Los pagos son de servicios físicos (Mercado Pago o efectivo). No hay bienes digitales.

Los perfiles con la etiqueta «Datos de ejemplo» son ficticios.
```

## 8. Privacidad (App Privacy y Data safety)

Marca solo lo que la app hace hoy. No marques seguimiento entre apps. No marques datos de menores.

| Dato | ¿Se recoge? | ¿Ligado a la persona? | Para qué |
| --- | --- | --- | --- |
| Nombre | Sí | Sí | La cuenta y el perfil. |
| Correo | Sí, si lo da | Sí | Entrar y avisos. |
| Teléfono | Sí, si lo da | Sí | Entrar. No enviamos SMS. |
| Identificador de Apple | Solo si usa Sign in with Apple | Sí | Reconocer la misma cuenta. |
| Ubicación aproximada | Sí | Sí | Buscar oficios cerca. En el mapa público la casa se muestra a dos decimales, no en el pin exacto. |
| Ubicación precisa | Sí, en el celular, si la persona lo permite | Sí | El botón «Cerca de mí» y guardar la dirección. La calle exacta solo la ve el proveedor cuando el trabajo está confirmado. |
| Token de avisos | Sí, en la app nativa si acepta avisos | Sí | Avisar solicitudes, mensajes y pagos. |
| Contenido de mensajes y fotos del trabajo | Sí | Sí | El chat del servicio. |
| Historial de solicitudes y reseñas | Sí | Sí | El servicio y la reputación. |
| Datos de pago | El monto, el estado y el id de Mercado Pago | Sí | Mostrar el recibo. El número de tarjeta y la CLABE los captura Mercado Pago, no Ofixio. |
| Compras dentro de la app | No | — | No hay productos digitales. |

**Borrado:** Perfil → Borrar mi cuenta. Eso quita el usuario, la sesión, el perfil, los tokens de push, las solicitudes de esa cuenta y sus mensajes.

**Enlaces visibles:** pie de cada pantalla, Perfil → Términos y condiciones y Aviso de privacidad, y el registro.

**Cifrado:** la app usa HTTPS. En la exportación de cifrado de Apple responde que solo usa el cifrado estándar del sistema (HTTPS).

**Permisos que pide el sistema:**

- Ubicación mientras se usa la app: «Ofixio usa tu ubicación para mostrar oficios cerca de ti.»
- Avisos: solicitudes nuevas, mensajes y pagos confirmados.

Sin el permiso, la búsqueda sigue usando la dirección guardada en el perfil.
