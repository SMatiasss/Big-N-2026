# Punto 6 — Verificar ingreso del cliente registrado

Fecha de inspección: 2026-09-02. Estado: **PARCIAL**.
Base: `main`, commit `7a4c486`, sincronizado con `origin/main` mediante fast-forward.
Se conservaron los tres stashes y la rama de respaldo. La implementación se entrega
en `feature/06-verificar-ingreso-cliente`, sin aplicar cambios a Supabase remoto.

## Revisión rápida de puntos 1–5

| Punto | Estado | Implementado | Faltante | Bloquea Punto 6 |
|---|---|---|---|---|
| 1 Empleado | PARCIAL | Campos, validaciones, cámara exclusiva y lector QR | Se guarda una foto placeholder; `signUp` comparte sesión del administrador; verificar DNI QR real y autorización del alta | El defecto de autoasignación de rol debe coordinarse antes de aplicar seguridad |
| 2 Plato | PARCIAL | Tres fotos, cámara/galería, validaciones, persistencia y consulta final | `/carta` sigue TODO; rollback de tablas sin DELETE permitido | No |
| 3 Bebida | PARCIAL | Formulario y persistencia compartida con platos | Mismos pendientes de carta/rollback | No |
| 4 Mesa | PARCIAL | Alta, foto, listado, `estado=libre`, token QR por default | No se gestiona disponibilidad desde el listado; método usa columna inexistente `disponible`; permisos incluyen metre; verificar QR visual/dispositivo | No |
| 5 Cliente registrado | INCOMPLETO | Auth y esquema disponibles | Página de alta TODO; sin registro pendiente conectado, email ni push | Sí: creación y E2E |

La revisión fue de código/esquema, no una nueva certificación Android de puntos 1–5.
No se reimplementaron estos puntos; sólo login/router como dependencia de Punto 6.

## Arquitectura implementada

1. Login consulta el perfil persistido y bloquea cliente registrado pendiente/rechazado.
2. Dueño/supervisor tienen acceso al botón **Clientes pendientes**.
3. `aprobacion-clientes.service.js` valida actor activo/aprobado y consulta sólo
   `id, nombres, apellidos, foto_url, estado`, filtrando cliente registrado pendiente.
4. Panel muestra tarjetas, fotos centradas completas, aceptar/rechazar, carga y errores.
   Actualiza automáticamente mediante Realtime, sin botón manual. No llama directamente a Supabase.
5. UPDATE por ID, rol y estado pendiente guarda decisión, `resuelto_por` y `resuelto_en`.
   La marca de tiempo procede del cliente; no es una auditoría de tiempo confiable del servidor.
6. Sólo tras obtener la fila actualizada se intenta invocar la función de email existente.
   Se envía únicamente `{id}`; el futuro backend debe resolver destinatario/estado.
7. Se elimina del listado local y se informa por separado el resultado del email.
8. En el siguiente login se vuelve a consultar el estado real, sin confiar en metadata.

El servicio nuevo es específico del panel para no cambiar los métodos genéricos
de perfiles que pueden utilizar otros integrantes.

## Supabase real inspeccionado

Clientes en `public.perfiles`, FK `id -> auth.users.id`.
Columnas: `id`, `apellidos`, `nombres`, `dni`, `cuil`, `email`, `foto_url`, `rol`,
`estado`, `motivo_rechazo`, `resuelto_por`, `resuelto_en`, `creado_en`, `activo`.

- Roles reales: `dueno`, `supervisor`, `metre`, `mozo`, `cocinero`, `cantinero`,
  `cliente_registrado`, `cliente_anonimo`.
- Estados reales: `pendiente`, `aprobado`, `rechazado`.
- **Default de estado: aprobado**, no pendiente. Punto 5 debe enviar pendiente
  explícitamente para clientes registrados; la propuesta RLS rechaza autoaprobación.
- `resuelto_por -> perfiles.id`; `resuelto_en` timestamp con zona.
- RLS habilitada en perfiles, push_tokens y notificaciones.
- `perfiles_propio`: SELECT propio por `auth.uid()`.
- `perfiles_staff_lee`: SELECT por `es_empleado()` (más amplio que el panel).
- `perfiles_aprueba`: UPDATE USING y WITH CHECK `es_jefe()`.
- `es_jefe()` contempla exactamente dueño/supervisor, sin estado/activo.
- `mi_rol()` devuelve el rol del perfil por `auth.uid()`, sin estado/activo.
- `perfiles_alta`: INSERT propio, jefe o metre, sin restringir el rol a crear.
- Único trigger de perfiles encontrado: impedir DELETE físico. No hay trigger
  de nuevo cliente ni de decisión para notificar.
- Perfiles y notificaciones están publicados en Supabase Realtime. Eso NO equivale
  a notificación push nativa.
- En la inspección no había clientes pendientes/rechazados ni tokens push.
- No había Edge Functions desplegadas.

### SQL local, NO aplicado

`supabase/migrations/04_punto6_seguridad.sql`:

- Agrega dos policies **restrictivas** (AND sobre las existentes), sin policies abiertas.
- Limita altas propias a cliente registrado pendiente o anónimo autenticado como tal.
- Metre sólo puede crear cliente registrado pendiente; jefe activo/aprobado conserva
  alta administrativa existente.
- Restringe resolución de clientes a pendiente -> aprobado/rechazado por jefe activo/aprobado.
- Revoca TRUNCATE/REFERENCES/TRIGGER de perfiles al frontend: RLS no cubre TRUNCATE.
- No cambia tablas, columnas, enums, funciones ni Storage.

**No aplicar automáticamente**: requiere pruebas SQL locales/staging y coordinación.
Cierra la posibilidad que aprovecha el alta actual de empleados al hacer signUp y luego
insertar un rol de empleado como usuario recién creado. Esa alta necesita una operación
administrativa segura sin reemplazar la sesión del jefe. Además, la policy de decisión
limita otras ediciones/bajas lógicas de clientes ya resueltos; acordar su diseño primero.
No reemplaza la revisión global de RLS ni valida perfiles privilegiados ya existentes.

## Push notification — pendiente real

`supabase/functions/enviar-push/index.ts` sólo tiene un TODO y devuelve `ok:true`.
No se llama para altas, no se integra FCM/otro proveedor y no hay plugin nativo de push
en las dependencias actuales. `push_tokens` tiene `usuario_id, token, plataforma`,
pero el servicio genérico local usa `perfil_id` y omite plataforma.
`notificaciones` usa `destinatario_id, creado_en`; el servicio genérico usa nombres distintos.
No se modificaron esos placeholders para aparentar que funcionan.

Evento requerido: nuevo `cliente_registrado` pendiente. Receptores: dueño/supervisor
activos/aprobados. Mensaje sugerido sin PII: “Hay un nuevo cliente pendiente de revisión”.
Falta acordar proveedor, registro de tokens, emisor server-side autenticado, permisos,
reintentos/idempotencia y despliegue autorizado. No se envió ninguna notificación.

## Email — intento conectado, entrega pendiente

Se reutilizan `email.service.js` y nombres `enviar-email-aprobacion` /
`enviar-email-rechazo`. Se invocan después de guardar la decisión, no antes.
Las funciones locales siguen siendo placeholders no desplegados. Sólo una respuesta
`{enviado:true}` del backend futuro confirma entrega al proveedor; `ok:true` no alcanza.
Ante fallo, el estado queda guardado y se muestra aviso; no se revierte ni se repite UPDATE.

Falta implementación segura: validar JWT y actor, consultar destinatario/estado desde
BD, no confiar en email recibido del frontend, proveedor/secreto sólo backend y
reintentos durables/idempotencia. La invocación desde frontend NO garantiza entrega si
se cierra la app entre guardar y enviar. Antes de cerrar el requisito debe existir un
mecanismo durable server-side que recupere decisiones sin email enviado.

## Login y límites de seguridad

- Cliente registrado aprobado/activo: entra.
- Pendiente/rechazado: mensaje explícito y cierre de sesión local.
- Anónimo activo: exento de aprobación.
- Perfil ausente/inactivo: bloqueado.
- Sesión restaurada y enlaces directos: se verifican en login/router.
- Dueño/supervisor inactivos o no aprobados: el service del panel deniega.

Esto bloquea la navegación de la aplicación, **no impide que Auth emita un JWT** con
credenciales correctas. Un token puede seguir vigente después de cerrar sesión.
Las policies de otras tablas no verifican universalmente aprobación/activo: falta
la revisión de autorización servidor para impedir uso de API por clientes pendientes.
La policy remota de UPDATE exige jefe, pero la policy de INSERT propia permite
escalar rol a una cuenta sin perfil. No afirmar seguridad completa hasta corregirlo.
No se probaron ataques ni modificaciones sobre datos productivos.

## Verificaciones ejecutadas

- `npm run build`: OK (Vite 8.2.2, 251 módulos).
- `node --check`: OK en los siete JS nuevos/modificados, incluido test.
- `node --experimental-test-module-mocks --test tests/punto6.test.js`: 16/16 OK.
- `git diff --check`: OK.
- Sin dependencias nuevas, cambios de lockfile ni configuración Android.
- Advertencias: Ionic `:host-context` al minificar CSS; tiempos de plugins Vite;
  mocks experimentales y `namedExports` deprecado en Node; conversión LF/CRLF de Git.
- Tests de servicios con Supabase simulado, no prueba real de RLS/email/push ni visual.
- Migración no aplicada ni ejecutada en PostgreSQL local. Android no compilado/probado.

## Checklist manual web / Android

Precondición: acordar entorno/cuentas de prueba (no datos reales), implementar Punto 5,
seguridad y servicios de envío. Actualmente no se puede completar el caso integral.

Web: `npm run dev`, abrir la URL indicada, iniciar sesión con dueño/supervisor,
botón **Clientes pendientes** o `/#/clientes/aprobacion`. Hoy puede verificarse la
lista vacía con cuenta autorizada y el rechazo del panel con empleado/cliente.

Android cuando se autorice regenerar: `npm run build`, `npx cap sync android`,
`npx cap open android`; ejecutar en dispositivo con Android Studio. No utilizar el
APK anterior para validar cambios que todavía no contiene.

### Caso A — Aceptar

1. Crear cliente desde Punto 5, verificar `rol=cliente_registrado`, `estado=pendiente`.
2. Confirmar push en dispositivos de dueño/supervisor, incluso app en segundo plano.
3. Intentar login del cliente: bloqueado; repetir con URL directa y recarga.
4. Dueño deja abierto pendientes; el nuevo cliente debe aparecer automáticamente.
   Verifica apellidos/nombres/foto correcta y centrada.
5. Acepta; repetir doble clic y comprobar una única decisión.
6. Cliente desaparece; confirmar estado y autor en BD.
7. Confirmar email real (también revisar spam); nunca tomar el aviso de UI como entrega.
8. Cliente vuelve a iniciar sesión y ahora entra.

### Caso B — Rechazar

1. Otro cliente de prueba pendiente; verificar push.
2. Supervisor rechaza: desaparece del listado y queda rechazado en BD.
3. Confirmar email de rechazo.
4. Cliente no entra, incluso con recarga/sesión previa.

### Caso C — Autorización y concurrencia

1. Con cliente, cocinero, cantinero y metre, abrir ruta del panel: sin listado/acciones.
2. En staging, intentar UPDATE directo autenticado con cada rol: debe denegarse.
3. En staging, probar autoalta como jefe/autoaprobación: debe denegarse tras migración.
4. Dos jefes abren el mismo pendiente; uno acepta y otro rechaza: una sola decisión;
   el segundo recibe mensaje de conflicto y el listado se actualiza automáticamente.
5. Simular caída de correo: estado guardado, aviso honesto, sin duplicar decisión.
6. Verificar cliente anónimo y flujos existentes de platos/bebidas/mesas.

## Siguiente paso recomendado

Coordinar Punto 5 y alta segura de empleados con sus responsables; elegir infraestructura
de push/email. Revisar/probar SQL en staging antes de aprobar despliegue. Luego completar
envíos durables, autorización servidor y ejecutar casos A/B/C en navegador y Android.
No dar Punto 6 por terminado ni hacer merge sólo por tener build verde.

## Actualización automática del panel

Se verificó en remoto que `public.perfiles` pertenece a `supabase_realtime`, sin
cambiar publicaciones ni policies. El servicio escucha cambios del rol
`cliente_registrado` (no filtra por pendiente, para recibir también aprobaciones).
Cada evento vuelve a consultar el listado autorizado; no inserta el payload directo
en el DOM. Al conectar/reconectar se consulta de nuevo para recuperar eventos perdidos.
Los eventos durante una decisión/carga quedan agrupados en una recarga posterior.
El aviso de email/decisión permanece separado para que una recarga no lo borre.

Como respaldo se consulta cada 30 segundos mientras la pestaña es visible, al volver
a ella y al recuperar red. Al salir se retiran canal, temporizador y listeners.
Esto actualiza la pantalla abierta: **no es push nativo** ni reemplaza ese pendiente.

Prueba: dejar el panel abierto e insertar un perfil de prueba registrado/pendiente
desde Supabase. Debe aparecer sin F5. Resolverlo desde otra sesión de jefe: debe
desaparecer. Probar desconexión/reconexión y salir/volver al panel sin duplicados.

## Diseño final del panel

- Pestaña **Todos**: incluye únicamente clientes registrados con estado aprobado.
- Pestaña **Pendientes**: incluye únicamente clientes registrados pendientes.
- Filas compactas con foto o iniciales, nombre y apellido; colores del diseño del equipo.
- Sólo pendientes dispone de **Elegir → Aceptar / Rechazar**.
- Un modal identifica al cliente y explica la consecuencia. Cancelar no modifica datos.
- Al confirmar, se guarda la decisión; el aprobado pasa a Todos y el rechazado sale
  de pendientes. Se mantiene la actualización automática y la protección de concurrencia.
- No se agregó el botón de alta porque Punto 5 todavía es un placeholder.
- Los tests automatizados son de servicios/reglas de acceso; no certifican el modal
  ni el diseño en Android. Sigue pendiente la prueba integral del checklist.
