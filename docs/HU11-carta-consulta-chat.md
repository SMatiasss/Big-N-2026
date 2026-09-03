# PUNTO 11 — RESULTADO

Estado: **PARCIAL**. Continuación auditada: ver `docs/HU11-auditoria-cierre.md`. SQL ensayado en PostgreSQL embebido y APK debug compilado; no se aplicó SQL remoto, no hay entrega push real y falta prueba integral con sesiones/dispositivos.

## Git

- Base: `main` sincronizado por fast-forward con `origin/main`, commit `ec75772` (merge de HU06).
- Rama creada: `feature/hu11-carta-consulta-mozo-chat`.
- Se preservaron los tres stashes existentes. Sin commit ni push. Android sincronizado en la continuación.
- Dependencias de la app sin cambios; PGlite aislado en `tests/postgres`. `.env` no se editó ni se debe incluir.

## Dependencias verificadas

### Punto 9

Se reutilizan el ingreso anónimo, `lista_espera`, `lista-espera.service.js`, `anuncio-cliente`, el lector nativo compartido y Auth. El anónimo es un usuario de Auth con un perfil `cliente_anonimo`; el registrado tiene rol `cliente_registrado` y requiere aprobación. La identidad proviene de Auth, no de un ID libre del formulario.

El QR de entrada valida `configuracion.qr_ingreso_token` en `qr.service.js`. No equivale al QR de mesa. La espera guarda `cliente_id`, comensales y estado; el cliente consulta su fila `esperando`, y la asignación pasa a `asignado`. Las pantallas ya usan Realtime. Los resultados de encuestas siguen siendo un placeholder de HU20.

Limitación preexistente: al reiniciar la app, el control de sesión anónima puede cerrar una sesión sin estadía aunque esté esperando. No se reescribió ese flujo.

### Punto 10

Se reutilizan `estadias`, `mesas`, `estadias.service.js` y la asignación del panel del metre. La estadía guarda `cliente_id`, `mesa_id`, `lista_espera_id`, `asignada_por` y estado. Los índices únicos de estadías no cerradas impiden asignar simultáneamente una mesa o cliente a dos visitas. El trigger existente ocupa la mesa y actualiza la espera.

El QR documentado es `mesa:<qr_token>` (UUID). Antes de este trabajo, el botón de escaneo del cliente no tenía acción y no se restauraba una estadía activa al volver a la espera. Sólo se conectó ese punto de entrada y se restauró la asignación existente; no se modificó el mecanismo de asignación.

El aviso de asignación por Realtime existe, pero no se encontró entrega push real. El intento de insertar notificaciones desde el panel no dispone de policy INSERT en el esquema inspeccionado.

## Flujo de mesa

Metre asigna → se crea la estadía → cliente ve su número → `/mesa/escanear` reutiliza el lector → RPC compara el token con **su** estadía → registra validación → `/mesa/carta` → `/pedidos/consulta`.

No se acepta un `cliente_id` enviado por el navegador, no se cambia la asignación al escanear y un QR incorrecto devuelve el número de la mesa propia. Sin estadía o validación, las RPC rechazan el acceso, incluso entrando por URL.

La tabla privada `hu11_privado.accesos_mesa` registra la validación por visita; no duplica la asignación. El chat se vincula a **estadía**, no sólo a mesa física: la siguiente visita no hereda los mensajes.

Limitación: `mesas` tiene SELECT público, incluido `qr_token`. Validar el token demuestra que corresponde a la asignación, no presencia física infalsificable. Restringir la exposición del QR sería otro cambio a coordinar. En desarrollo web existe un campo para pegar el QR y probar el mismo backend; se elimina del build de producción y no reemplaza la prueba con cámara.

## Carta

Se completa la página existente, compartiendo `/carta` (general, sin acciones de mesa; el router actual requiere sesión) y `/mesa/carta` (operativa, exige validación).

Consulta `productos` activos con `producto_fotos`, sin modificar las policies públicas de lectura. Agrupa platos, bebidas y postres; muestra nombre, descripción, precio en ARS y minutos de elaboración. El carrusel existente ahora presenta exclusivamente una imagen centrada por vez, con anterior/siguiente y contador de tres posiciones, por `orden` 1/2/3. Fotos faltantes o inaccesibles se informan, no se inventan. En la inspección agregada no se encontraron productos activos con fotos incompletas; la BD no tiene un CHECK que limite `orden` a 1/2/3.

## Consulta y chat

- La consulta es un mensaje persistido en la tabla existente `mensajes`, con FK `estadia_id` y `autor_id`.
- La RPC fija autor desde `auth.uid()` y fecha desde PostgreSQL; no acepta nombres ni timestamps del frontend.
- Se muestran nombre, rol, fecha, hora/minutos y burbujas propias/ajenas. Texto tratado como texto, no HTML.
- Historial de 100 mensajes recientes y paginación hacia atrás por `(creado_en,id)`; orden cronológico y combinación por ID.
- Cliente: sólo su visita validada, abierta. Mozo aprobado y activo: selector de todas las visitas habilitadas. Otros roles no acceden al chat.
- Mensaje obligatorio, máximo 1000 caracteres; bloqueo durante envío. UUID de intento reutilizable tras error de red para evitar duplicados en backend.
- Realtime reutiliza la publicación existente de `mensajes`. Los eventos invalidan y vuelven a consultar la RPC autorizada. Canal por estadía para cliente; mozos reciben eventos autorizados por RLS.
- Reconexión y respaldo cada 30 segundos mientras la página está visible; limpieza al navegar. Un error de acceso limpia el historial visible.
- La consulta usa `creado_en`, no el antiguo `created_at` inexistente.
- Las visitas cerradas dejan de ser accesibles; no se implementó un archivo histórico administrativo de visitas cerradas.

## Push cliente → mozos / mozo → cliente

**No implementado como entrega real.** No hay Edge Functions desplegadas, se encontraron cero registros en `push_tokens`, falta registro nativo de dispositivos y el archivo local `enviar-push` es un placeholder. El servicio antiguo usa nombres de columnas que no coinciden con el esquema (`perfil_id` frente a `usuario_id`, entre otros).

La migración propone crear registros durables en la tabla existente `notificaciones`, dentro de la misma transacción que el mensaje:

- Consulta: una notificación para cada mozo activo y aprobado.
- Respuesta: una notificación sólo al cliente de esa estadía.
- Título con número de mesa; sin contenido privado del chat en el aviso; datos con estadía/mensaje.
- Reintentar el mismo ID no duplica mensaje ni notificaciones.

Esto **no equivale a push**. Falta configurar el proveedor elegido por el equipo, registrar tokens/plataforma, implementar el envío server-side con reintentos/idempotencia y navegación a la conversación, y probarlo en primer y segundo plano. No se introdujeron claves ni una segunda infraestructura.

## Supabase: propuesta local, no aplicada

Archivo: `supabase/migrations/20260903020318_hu11_mesa_chat_seguro.sql`.

Esquema real consultado en modo lectura: perfiles, mesas, estadías, mensajes, productos/fotos, notificaciones, push_tokens; constraints, índices, RLS, funciones, triggers y publicación Realtime. Sin datos personales innecesarios.

Problemas reales encontrados:

1. `mensajes_lectura` permite leer todos los mensajes con cualquier estadía activa; no aísla conversaciones.
2. `mensajes_alta` tampoco vincula la estadía de la fila con la del autor.
3. `estadias_update` permite al cliente alterar la mesa de su estadía.
4. `perfiles_alta` permite crear el perfil propio sin restringir el rol. La corrección HU06 está en el repositorio, pero no aplicada en el remoto inspeccionado.

Propuesta HU11:

- Nueva tabla privada de validaciones, RLS habilitado y sin acceso directo.
- Reemplazar las dos policies inseguras de mensajes por SELECT autorizado por visita. Retirar escritura directa a `mensajes`; sólo escribir mediante RPC validada.
- Funciones privilegiadas con `search_path` vacío en esquema privado; wrappers públicos invoker y permisos explícitos para authenticated.
- RPC: contexto, validación QR, conversaciones del mozo, historial, envío idempotente.
- Trigger mínimo protege identidad/asignación de la estadía y evita reabrirla desde el cliente autenticado. No altera el INSERT del metre ni los estados operativos restantes.
- Índice de mensajes por estadía/fecha/ID.
- Sin cambios en Storage, productos, Auth, enums, plugins ni publicación Realtime.

**Orden de despliegue actualizado:** HU11 incorpora una restricción mínima de INSERT de perfiles, sin exigir aplicar toda `04_punto6_seguridad.sql`. Coordinar el impacto sobre el alta de empleados, revisar el SQL y autorizar el despliegue antes de probar sesiones reales. No ejecutar todas las migraciones históricas a ciegas contra una base existente.

La continuación ejecutó la migración en PostgreSQL embebido (PGlite, memoria) con fixtures ficticios, RLS y roles simulados. No equivale a Supabase local completo: faltan JWT real, PostgREST, Realtime y dispositivos. El esquema privado debe permanecer fuera de los schemas expuestos por Data API.

## Archivos

| Archivo | Cambio | Motivo |
|---|---|---|
| `src/router.js` | Rutas de escaneo/carta de mesa | Continuación HU10 |
| `src/pages/auth/login/index.js` | Acceso de mozo a consultas | Navegación |
| `src/pages/lista-espera/anuncio-cliente/index.js` | Restaurar estadía y conectar escaneo | Integración mínima |
| `src/pages/mesas/escanear-mesa/index.js` | Escaneo/validación | Mesa correcta |
| `src/pages/productos/carta/index.js` | Carta general y operativa compartida | Productos reales |
| `src/pages/productos/carta/index.css` | Estilos locales | Identidad visual |
| `src/pages/pedidos/consulta-mozo/index.js` | Chat cliente/mozo | Consulta e historial |
| `src/components/carrusel-imagenes/carrusel-imagenes.js` | Controles de tres fotos | Componente reutilizado |
| `src/components/carrusel-imagenes/carrusel-imagenes.css` | Contenedor individual | Imagen centrada |
| `src/components/burbuja-chat/burbuja-chat.js` | Autor/texto/hora | Presentación segura |
| `src/components/burbuja-chat/burbuja-chat.css` | Burbujas propias/ajenas | Lectura clara |
| `src/services/productos.service.js` | Consulta carta con fotos | Sin duplicar alta |
| `src/services/mensajes.service.js` | RPC y Realtime | Eliminar consulta insegura |
| `src/services/mesa-cliente.service.js` | Contrato RPC | Validación server-side |
| `src/utils/hu11.js` | Validaciones y orden de fotos | Reglas compartidas |
| `src/utils/actualizacion-hu11.js` | Actualización serializada/limpieza | Evitar carreras |
| `supabase/migrations/20260903020318_hu11_mesa_chat_seguro.sql` | Propuesta local | Seguridad pendiente de despliegue |
| `tests/hu11.test.js` | Tests unitarios con mocks | Contratos y validaciones |
| `docs/HU11-carta-consulta-chat.md` | Este informe | Alcance y pruebas |

## Verificaciones

- 33 tests JS aprobados y 19 resultados del runner PostgreSQL (18 casos más el contenedor). Ver el informe de auditoría para alcance.
- Build web aprobado. Warnings de minificación de CSS Ionic `:host-context`; tests usan mocking experimental/deprecated de Node.
- Android debug compilado con JDK 21. No se agregaron plugins; la sincronización reincorporó native-audio, ya declarado en el proyecto.
- No se certificaron todavía UI en dispositivo, RLS en el remoto ni entrega push.

## Prueba manual exacta (después del ensayo y despliegue autorizado de SQL)

1. Preparar en un entorno de prueba un metre, dos mozos activos/aprobados y dos clientes habilitados (incluir un anónimo y un registrado). No compartir contraseñas/tokens. Usar sesiones independientes: dispositivos, perfiles de navegador o ventanas privadas independientes.
2. Preparar dos mesas libres con sus QR reales y productos activos con fotos en órdenes 1, 2 y 3. Reutilizar altas existentes; no insertar mensajes manualmente como administrador para probar RLS.
3. Cliente A entra por el flujo de ingreso/lista de espera. Antes de asignar, abrir `/mesa/carta` y `/pedidos/consulta`: deben bloquear. El catálogo general `/carta` no habilita consultas.
4. El metre asigna mesa A usando su panel. Cliente A debe ver el número. Recargar/volver a la espera: debe conservar la asignación sin reinscribirse.
5. Escanear QR de mesa B: rechazo con número de mesa A; comprobar que no cambió `estadias.mesa_id`. Escanear A: abre carta operativa. En `npm run dev` puede pegarse `mesa:<token>` en el campo de prueba web; para cámara usar Android.
6. Comprobar platos, bebidas, postres, textos, ARS, minutos y las tres posiciones del carrusel. Verificar fotos grandes centradas sin imágenes vecinas.
7. Cliente A abre Consulta al mozo y envía “¿Podrían traer cubiertos?”. Ambos mozos abren Consultas de clientes desde login, seleccionan mesa A y deben ver una sola fila con autor/fecha/hora.
8. Mozo 1 responde. Cliente A ve la respuesta y autor automáticamente. Recargar y comprobar persistencia. Mozo 2 también ve historial/respuesta.
9. Cliente B, con su propia estadía validada, NO ve mensajes de A. Con su sesión, intentar `hu11_listar_mensajes`/`hu11_enviar_mensaje` pasando el ID de A: error 42501. Un SELECT directo a mensajes de A debe devolver cero filas; INSERT directo debe rechazarse. No usar credenciales administrativas para esta prueba.
10. Repetir llamadas de lectura/envío con rol cocinero/cantinero/metre: deben ser rechazadas. Probar mozo inactivo o no aprobado y cliente registrado rechazado.
11. Enviar vacío, espacios, saltos o más de 1000 caracteres: rechazo. Doble click: un registro. Simular respuesta de red perdida y reintentar mismo cuerpo/ID: una fila y un conjunto de notificaciones, no duplicados.
12. Probar más de 100 mensajes en entorno de ensayo, paginar, recibir mensajes nuevos y verificar que se conserva el historial sin duplicación. Cambiar de sala durante una lectura lenta no debe mezclar historiales.
13. Cerrar la estadía con flujo autorizado: se bloquea acceso. Reutilizar la mesa para otro cliente: no hereda la conversación previa. Intentar alterar `mesa_id` o reabrir desde sesión cliente: rechazo.
14. Cortar/restaurar conectividad: informar error/reconectar; no mostrar un envío como confirmado sin respuesta. Salir y volver: no duplicar suscripciones.
15. **Push pendiente:** cuando exista proveedor, registrar dos mozos y dos clientes en dispositivos reales. Consulta A debe notificar a ambos mozos; respuesta debe notificar sólo a A, nunca a B. Probar app en background/cerrada, apertura de aviso, tokens vencidos y reintentos. Hasta verificar esto HU11 sigue parcial.

## Cierre de jornada — 3 de septiembre de 2026

- El usuario probó la carta general en Android y confirmó la navegación de regreso.
- Se compactaron las tarjetas: foto y carrusel a la izquierda, datos a la derecha, fondo verde oscuro y acentos naranjas. Se conservan las tres posiciones y todos los datos del producto.
- Se generó una nueva APK debug con este diseño; queda pendiente confirmar su presentación en el dispositivo. La APK no se versiona.
- Por decisión del usuario, la migración de seguridad sigue como propuesta local sin ejecutar. Guardarla en Git no autoriza su despliegue.
- El circuito operativo de mesa y el chat siguen pendientes de las RPC y pruebas integrales; la carta general funcionando no certifica esos flujos. Push continúa pendiente.

## Pendientes

Revisión coordinada de seguridad HU06, ensayo/aprobación de SQL HU11, infraestructura push compartida, pruebas reales de RLS/Realtime/múltiples dispositivos y validación visual Android. No publicar la implementación como requisito completo antes de esas comprobaciones.
