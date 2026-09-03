# HU11 — ESTADO ACTUALIZADO

**PARCIAL.** Se preservó la rama `feature/hu11-carta-consulta-mozo-chat`, base `ec75772`, y el trabajo anterior. No hubo commit, push, migración remota, eliminación de stashes ni usuarios reales de prueba creados. Los tres stashes siguen presentes.

## Dependencia HU06

### Vulnerabilidad comprobada

`src/services/perfiles.service.js:altaPerfil()` inserta el objeto recibido directamente en `public.perfiles`. En `src/pages/empleados/alta-empleado/index.js` se ejecuta `signUp` sobre el cliente compartido, seguido por ese INSERT con el rol elegido y estado aprobado. Ocultar el formulario no impide invocar la Data API.

Policy real `perfiles_alta`, INSERT, PUBLIC:

```sql
(id = auth.uid()) OR es_jefe() OR (mi_rol() = 'metre')
```

No restringe rol/estado para el alta propia. Cualquier cuenta autenticada sin perfil puede insertar su ID como dueño, supervisor, metre, mozo, cocinero o cantinero, proporcionando también los campos requeridos por constraints. No significa que un cliente ya existente pueda actualizar directamente su rol: ese UPDATE está restringido a `es_jefe()`; el vector demostrado es el **alta** de una cuenta nueva.

`mi_rol()` lee ese rol y `es_jefe()`/`es_empleado()` lo usan con SECURITY DEFINER. Son lectores, no RPC que eleven el rol por sí mismas, pero propagan la confianza en un dato autoasignable. Afecta a todo el sistema. La función `crear_usuario_demo` encontrada es INVOKER, y `anon`/`authenticated` no tienen INSERT en `auth.users`: no se demostró como bypass de permisos. Contiene lógica de credencial de demo que no se reproduce aquí y debe revisarse fuera de esta entrega.

### Corrección mínima preparada y probada localmente

Dentro de la migración HU11, `hu11_perfiles_alta_segura` es RESTRICTIVE (AND con las policies existentes):

- Alta propia registrada: rol cliente_registrado, pendiente, activo, sin resolución; no sesión anónima.
- Alta propia anónima: rol cliente_anonimo, aprobado, activo y claim firmado `is_anonymous=true`.
- Jefe existente, aprobado y activo: conserva alta administrativa.
- Metre habilitado: sólo alta de cliente registrado pendiente, no empleados.
- UPDATE: sólo jefe existente activo/aprobado; impide que un jefe deshabilitado se reactive mediante `perfiles_aprueba`. No cambia las transiciones de aprobación HU06.
- Se retiran TRUNCATE/REFERENCES/TRIGGER de perfiles y estadías para clientes API. TRUNCATE no obedece RLS.

Se sustituyó el guard anterior que verificaba sólo un nombre de policy. No se aplica ni reescribe el resto de HU06 ni su lógica de decisiones. El flujo de alta de empleados debe pasar a preservar la sesión administrativa mediante un backend autorizado; no se implementó ese cambio global aquí. El equipo debe coordinarlo antes del despliegue. Revisar también la legitimidad de los perfiles privilegiados ya existentes: una restricción nueva no sanea datos anteriores.

## Migración HU11 — auditoría

`supabase/migrations/20260903020318_hu11_mesa_chat_seguro.sql`:

| Aspecto | Resultado |
|---|---|
| Sintaxis | Ejecutada completamente en PostgreSQL embebido |
| Tablas/enums/columnas/FK | Contrastadas con catálogos reales; reutiliza estadías/mensajes y agrega validación privada |
| Ownership | Ensayo como postgres; funciones privilegiadas propiedad de postgres. Desplegar sólo con migrador de confianza |
| SECURITY DEFINER | Helpers en esquema privado, autorización explícita por auth.uid y perfil vigente |
| search_path | Vacío, referencias calificadas; funciones públicas INVOKER |
| EXECUTE | RPC sólo authenticated; sin acceso anon. Trigger sin EXECUTE directo para authenticated |
| RLS | Cliente sólo su visita validada; mozo activo/aprobado; no INSERT/UPDATE/DELETE directo de mensajes |
| Recursión | SELECT/INSERT y restricciones de perfiles probados sin recursión con las policies existentes |
| Asignación | Trigger impide cambiar ID/cliente/mesa/asignador/espera o reabrir desde sesión autenticada |
| Candados | Se autoriza antes de bloquear estadía y se revalida después; se serializan envíos/cierre |
| Índices | Mensajes(estadía,fecha,id), accesos por cliente y mesa; PK de acceso por estadía |
| Coste | Historial limitado a 100 con paginación por clave; conversaciones filtra no cerradas. Sin benchmark de gran volumen; helper RLS depende de cada fila |
| Transacción | Ensayada con ROLLBACK: no deja las nuevas RPC. También aplicada y utilizada en memoria |
| Deshacer después de COMMIT | No hay down migration automática: no se debe restaurar la policy insegura como rollback |
| Remoto | No aplicado; conserva sus problemas anteriores |

Supabase local completo no está configurado: falta `supabase/config.toml`, Docker/servicios locales y psql accesible. PGlite 0.5.8 corre en memoria, sin red ni .env. El fixture carga `01_schema.sql` y `03_baja_logica.sql`, reproduce la diferencia real de apellidos nullable con CHECK y usa claims ficticios y roles postgres/anon/authenticated. No reproduce Auth, PostgREST, publicación de eventos o concurrencia entre conexiones reales. No usa datos personales.

Reproducir el ensayo:

```powershell
npm ci --prefix tests/postgres --ignore-scripts
npm test --prefix tests/postgres
node --experimental-test-module-mocks --test tests/*.test.js
```

## Seguridad y resultados de prueba

- Reproducción de alta indebida de los seis roles ANTES de la corrección; todas rechazadas DESPUÉS.
- Cliente mesa 7 lee/envía en 7; cliente mesa 8 no lee/envía en 7, tanto por RPC como SELECT directo.
- Sin mesa o sin QR: bloqueado. QR 8 para cliente 7: rechazo con mesa propia; relación no cambia.
- Ambos mozos leen la consulta; respuesta de mozo visible al cliente con nombre/rol/timestamp.
- Se generan dos registros de notificación para los dos mozos aprobados activos; respuesta sólo al cliente correspondiente. Mozo inactivo excluido.
- Reintento con el mismo ID no duplica mensajes ni avisos. El controlador bloquea un segundo submit mientras el primero está pendiente.
- Metre/cocinero/cantinero/dueño/supervisor no obtienen permisos de chat por ser empleados. Mozo inactivo y cliente pendiente también bloqueados.
- Rol DB `anon` sin sesión: sin acceso. Un invitado de Supabase Auth tiene rol DB authenticated y sólo puede ver SU visita validada; jamás la de otra mesa. Se preserva HU09.
- SQL rechaza vacío/espacios/saltos y más de 1000 caracteres.
- Cliente/mozo no cambian mesa, identidad o asignador. Visita cerrada bloquea lectura/envío y no puede reabrirse desde cliente.

Estas pruebas **no** prueban entrega Realtime ni push por red. Tampoco equivalen a carga concurrente con varios dispositivos.

## Push — diagnóstico y diseño mínimo

No hay Edge Functions desplegadas; cero tokens en `push_tokens`; no plugin Capacitor Push Notifications, Firebase/FCM operativo ni service worker de push. Android contiene el soporte Gradle condicional para Google Services pero falta `google-services.json`. Las tablas reales son `notificaciones` y `push_tokens`, no una segunda tabla de dispositivos.

Cambios seguros preparados:

- `guardarPushToken` usa usuario_id/plataforma y UNIQUE(token), exige identidad propia y no devuelve/loguea el token.
- `listarNotificaciones` usa destinatario_id y creado_en, restringido a la identidad propia.
- La Edge Function local `enviar-push` ahora responde HTTP 503 / enviado:false; no finge un envío sin proveedor. No se desplegó.
- No se instaló el plugin push ni se inventaron credenciales.

**Propuesta, no desplegada:** FCM para Android con el plugin oficial Capacitor. Reutilizar `enviar-push` como worker server-side y las filas existentes. El mensaje se guarda primero; el backend deriva destinatarios, nunca los toma del navegador. Cliente → todos los mozos aprobados/activos y todos sus dispositivos. Mozo → únicamente el cliente de la estadía. Cuerpo del aviso genérico, sin texto privado del chat.

Antes de conectar el worker hay que proteger los campos de notificación: la policy UPDATE actual limita la fila propia, pero no las columnas `tipo/datos/titulo`. El cliente sólo debe poder marcar `leida`, y el worker debe derivar contenido/relación desde el mensaje confirmado, no confiar en payload editable. Agregar estado de entrega/reintentos por dispositivo con unicidad mensaje+token, backoff y eliminación de tokens inválidos; no reutilizar `leida` como estado de envío. No enviar desde el frontend ni aceptar destinatarios arbitrarios en la Edge Function.

Configuración manual pendiente:

1. Confirmar Firebase/FCM con el equipo; proyecto y app Android. Usar el `applicationId` efectivo de Gradle: **com.ejemplo.pruebas**, que hoy difiere de `capacitor.config.json` (**com.ejemplo.BigN**). No renombrarlo silenciosamente.
2. Archivo app-level `google-services.json`, permiso de notificaciones Android 13+, registro/renovación/baja de tokens y canal Android.
3. Credencial de envío FCM HTTP v1 sólo en secretos del backend; nunca VITE, repo ni chat.
4. Worker protegido, ejecución/reintentos y navegación al tocar aviso. Comprobar autorización de la sala al abrir, aunque el aviso sea viejo.
5. Para iOS hacen falta configuración APNs y capacidades; no basta reutilizar un token APNs como si fuera FCM Android. No hay build iOS en esta entrega.

**Notificación persistida ≠ aceptada por FCM ≠ entregada/mostrada al dispositivo.** Sólo la prueba física permite cerrar el requisito.

Fuentes: [Capacitor Push Notifications v8](https://capacitorjs.com/docs/apis/push-notifications), [FCM HTTP v1](https://firebase.google.com/docs/cloud-messaging/send/v1-api), [RLS y sesiones anónimas](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Realtime

Se conserva el canal INSERT en mensajes, filtrado por estadía para cliente. Las RLS son la protección efectiva, no el filtro JS. Reconexión SUBSCRIBED vuelve a consultar; eventos combinados por ID; intervalos visibles cada 30 s y online/visibility. Cleanup idempotente probado.

Se corrigieron dos casos: una página reciente de 100 mensajes sin solapamiento después de estar offline ahora permite recuperar el historial faltante; un error tardío de una sala anterior no limpia la sala recién seleccionada. Tests de controlador, serialización y limpieza aprobados. Aislamiento SQL probado; eventos reales entre dispositivos pendientes de despliegue.

## Tests / builds

- JS: 33 aprobados, cero fallidos (incluye 16 HU06).
- PostgreSQL: 18 casos y contenedor aprobados (runner: 19), cero fallidos.
- `node --check`, build web y `git diff --check`: correctos al cierre.
- Web: warnings de Ionic `:host-context`; Node: mocking experimental/deprecated.
- Android: `BUILD SUCCESSFUL`, JDK JetBrains 21.0.8; warnings flatDir. Sin plugin nuevo. Gradle con caché de usuario.
- Capacitor falló dentro del sandbox con `uv_os_get_passwd ENOMEM`; funcionó con permisos fuera del sandbox. Primer Gradle intentó usar `C:\.gradle`; se configuró `GRADLE_USER_HOME` correctamente, sin alterar la configuración global.
- APK: `android/app/build/outputs/apk/debug/app-debug.apk`. Es debug, sin push operativo. No instalado en teléfonos por el agente.
- Dos archivos Gradle generados cambian para incluir native-audio, ya existente en package.json; rutas normalizadas a node_modules para no versionar rutas internas de pnpm de este equipo.

## Requisitos HU11

"Local" significa prueba automatizada aislada; no validación E2E remota.

| Requisito | Implementado | Probado | Observaciones |
|---|---|---|---|
| QR de mesa validado | Sí | Local SQL | Cámara real pendiente |
| Mesa asignada validada | Sí | Local SQL | Reutiliza HU10 |
| Carta | Sí | Build | UI real pendiente |
| Platos | Sí | No E2E | Consulta por tipo |
| Bebidas | Sí | No E2E | Consulta por tipo |
| Postres | Sí | No E2E | Consulta por tipo |
| Tres imágenes por producto | Sí | Orden unitario | Visual/dispositivo pendiente |
| Nombre | Sí | No E2E | Texto de producto |
| Precio | Sí | No E2E | ARS |
| Descripción | Sí | No E2E | Texto |
| Tiempo estimado | Sí | No E2E | Minutos |
| Consulta al mozo | Sí | Local | RPC requiere despliegue |
| Número de mesa | Sí | Local SQL | Derivado de estadía |
| Timestamp | Sí | Local SQL | Servidor |
| Chat persistente | Sí | Local SQL | Historial consultado tras INSERT |
| Respuesta del mozo | Sí | Local SQL | Mozo habilitado |
| Nombre del mozo | Sí | Local SQL | Perfil real por ID |
| Timestamp respuesta | Sí | Local SQL | Servidor |
| Todos los mozos reciben consulta | Preparado | Lectura/fan-out local | Recepción real no probada |
| Push cliente → mozos | BLOQUEADO | No | Falta FCM/worker/dispositivos |
| Cliente recibe respuesta | Preparado | Lectura local | Evento de red no probado |
| Push mozo → cliente | BLOQUEADO | No | Falta FCM/worker/dispositivos |
| Aislamiento de chats | Sí local | SQL roles/RLS | Remoto sin migración |
| RLS segura HU11 | Propuesta local | SQL | No declara seguro todo el proyecto |
| Build web | Sí | Sí | Con warnings |
| Build Android | Sí | Sí | APK debug |
| Multiusuario/multidispositivo real | NO PROBADO | No | Requiere backend/push |

## Prueba manual con A/B/C/D

Prerequisitos: autorización y despliegue revisado de SQL; perfiles existentes legítimos; luego completar FCM antes de exigir los pasos push. Sin migración, las rutas operativas informarán falta de backend.

1. Instalar APK actualizado en A (cliente), B (mozo 1), C (mozo 2), D (metre), con sesiones distintas. B/C activos y aprobados. Registrar permisos/tokens cuando exista integración push.
2. A entra en lista de espera mediante el flujo existente. Sin mesa, abrir carta operativa/chat: rechazo.
3. D asigna mesa 7. A debe ver mesa 7. No depende de crear otra estadía desde HU11.
4. A escanea QR 8: rechazo e indicación de mesa 7; verificar que mesa_id no cambia. Escanear QR 7: carta.
5. Revisar las tres fotos, textos y categorías de productos en A.
6. B y C abren Consultas de clientes. A envía “Cubiertos, por favor”. Ambos ven una sola consulta, mesa 7 y hora del servidor.
7. Con proveedor ya operativo, enviar otra consulta con B/C en segundo plano: **ambos deben recibir push**. Este paso hoy está bloqueado, no se considera satisfecho por filas en notificaciones.
8. B responde. A ve nombre, respuesta y hora. Repetir con A en segundo plano y comprobar su push. C debe ver también respuesta/historial.
9. Usar otra sesión cliente, asignada a mesa 8: no debe ver ni enviar a la conversación 7, incluso llamando RPC con ese ID. Nunca probar esto con service-role.
10. Enviar vacío, doble click, perder/restaurar red, recargar, cambiar de sala mientras carga. No duplicar ni mezclar mensajes.
11. Cerrar estadía de A: acceso bloqueado. Otra visita en mesa 7 no hereda historial. Cliente y mozo no pueden cambiar mesa_id ni reabrir.
12. Repetir casos con invitado Auth y con cocinero/cantinero/metre: invitado sólo su estadía; otros empleados no responden como mozo.

## Archivos tocados en esta continuación

| Archivo | Motivo |
|---|---|
| `supabase/migrations/20260903020318_hu11_mesa_chat_seguro.sql` | Corrección mínima de alta, grants, candados e índice |
| `src/pages/pedidos/consulta-mozo/index.js` | Recuperación de huecos y errores de salas anteriores |
| `src/utils/hu11.js` | Detectar ventana de mensajes sin solapamiento |
| `src/services/notificaciones.service.js` | Contrato real y propietario de tokens/avisos |
| `supabase/functions/enviar-push/index.ts` | Eliminar éxito ficticio |
| `tests/hu11.test.js` | Prueba de reconexión con hueco |
| `tests/hu11-controlador.test.js` | Doble submit y cleanup/serialización |
| `tests/hu11-notificaciones.test.js` | Tokens/listado y fallo explícito sin proveedor |
| `tests/postgres/hu11-postgres.test.js` | Migración, roles, RLS y transacción en memoria |
| `tests/postgres/package.json` | PGlite aislado y fijado a 0.5.8 |
| `tests/postgres/package-lock.json` | Dependencia reproducible |
| `android/app/capacitor.build.gradle` | Sincronización del plugin ya existente |
| `android/capacitor.settings.gradle` | Módulos nativos portables |
| `docs/HU11-carta-consulta-chat.md` | Actualizar estado previo |
| `docs/HU11-auditoria-cierre.md` | Este diagnóstico y criterio de cierre |

El resto del diff es el trabajo HU11 previo y se preservó. package.json/package-lock.json raíz no cambiaron.

## Advisors remotos (sólo lectura)

Persisten cinco vistas SECURITY DEFINER, seis funciones con search_path mutable, helpers públicos y advertencias de acceso anónimo y protección de contraseñas filtradas. Son hallazgos preexistentes del proyecto, no cambios realizados por esta migración local; no se afirma que producción quedó saneada.

Remediaciones oficiales: [vistas](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view), [search_path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [helpers públicos](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [contraseñas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Pendientes reales y siguiente acción

1. Revisar con el equipo el cambio de alta de perfiles y el impacto en altas de empleados; auditar perfiles privilegiados existentes.
2. Autorizar despliegue controlado de la migración HU11, sin ejecutar migraciones históricas indiscriminadamente. Verificar ownership y esquema privado no expuesto.
3. Configurar Firebase/FCM y completar registro nativo/worker seguro/reintentos. No hay entrega push hoy.
4. Probar con sesiones reales, Realtime y los cuatro dispositivos. Validar cámara/UI y entrega push, no sólo builds.

**Próximo paso recomendado:** revisar y aprobar con el equipo el INSERT restrictivo de perfiles y el plan de alta administrativa, para poder autorizar después el despliegue de esta migración. No hacer merge ni declarar HU11 completa todavía.
