// Listado de productos con pestañas de platos y bebidas. Mismo esquema que
// gestión de mesas (listado + botón "+" que lleva al alta) y mismas pestañas
// que aprobación de clientes: se cargan todos los productos una sola vez y el
// cambio de solapa sólo vuelve a dibujar, sin pedir datos de nuevo.
import './index.css';
import { ajustarLista } from '../../../components/lista-ajustada/lista-ajustada.js';
import { TIPOS_PRODUCTO } from '../../../config/constantes.js';
import { PERMISOS_PESTANAS } from '../../../config/navegacion.js';
import { puedeAltaBebida, puedeAltaPlato } from '../../../config/permisos.js';
import { obtenerPermisos } from '../../../services/auth.service.js';
import { listarCartaConFotos } from '../../../services/productos.service.js';
import { navegarA } from '../../../router.js';
import { crearAppHeader } from '../../../components/app-header/app-header.js';
import { crearPestanas } from '../../../components/pestanas-filtro/pestanas-filtro.js';
import { reintentarUnaVez } from '../../../utils/reintentar.js';

const PESTANAS = {
  [TIPOS_PRODUCTO.PLATO]: {
    titulo: 'Platos',
    etiqueta: 'Platos',
    ruta: '/productos/alta-plato',
    vacio: 'Todavía no hay platos cargados.',
  },
  [TIPOS_PRODUCTO.BEBIDA]: {
    titulo: 'Bebidas',
    etiqueta: 'Bebidas',
    ruta: '/productos/alta-bebida',
    vacio: 'Todavía no hay bebidas cargadas.',
  },
};

function formatearPrecio(precio) {
  return `$${Number(precio).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
}

// La tarjeta se arma con el DOM en vez de innerHTML: el nombre y la
// descripción los escribe un empleado, así que van como texto y no como HTML
// (mismo criterio que aprobacion-clientes con los datos del perfil).
function tarjetaProducto(producto) {
  const tarjeta = document.createElement('article');
  tarjeta.className = 'producto-card';
  tarjeta.dataset.id = producto.id;

  const foto = document.createElement('div');
  foto.className = 'producto-card__foto';
  // Sin foto -o si la URL guardada ya no responde- queda el ícono de respaldo.
  const respaldo = document.createElement('span');
  respaldo.className = 'producto-card__sin-foto';
  respaldo.setAttribute('aria-hidden', 'true');
  respaldo.textContent = '🍽️';
  foto.append(respaldo);

  if (producto.fotoPrincipal) {
    const imagen = document.createElement('img');
    imagen.alt = `Foto de ${producto.nombre}`;
    imagen.src = producto.fotoPrincipal;
    imagen.loading = 'lazy';
    imagen.addEventListener('error', () => imagen.replaceWith(respaldo), { once: true });
    foto.replaceChildren(imagen);
  }

  const info = document.createElement('div');
  info.className = 'producto-card__info';

  const nombre = document.createElement('h2');
  nombre.className = 'producto-card__nombre';
  nombre.textContent = producto.nombre;

  const precio = document.createElement('p');
  precio.className = 'producto-card__precio';
  precio.textContent = formatearPrecio(producto.precio);

  const descripcion = document.createElement('p');
  descripcion.className = 'producto-card__descripcion';
  descripcion.textContent = producto.descripcion;

  info.append(nombre, precio, descripcion);

  const badge = document.createElement('span');
  badge.className = 'producto-card__badge';
  badge.textContent = `${producto.tiempo_elaboracion_min} min`;

  tarjeta.append(foto, info, badge);
  return tarjeta;
}

export function render(container) {
  container.innerHTML = `
    <ion-page class="gestion-productos">
      <ion-content class="pantalla-lista" scroll-y="false">
        <div data-header></div>
        <main class="gestion-productos__contenido pantalla-lista__cuerpo">

          <div data-pestanas></div>

          <div class="gestion-productos__estado-carga">
            <ion-spinner name="crescent" aria-hidden="true"></ion-spinner>
            <span>Cargando productos...</span>
          </div>

          <section class="gestion-productos__lista lista-ajustada" aria-label="Platos" hidden></section>

          <p class="gestion-productos__mensaje" role="status" aria-live="polite" hidden></p>
        </main>
      </ion-content>
    </ion-page>
  `;

  const estadoCarga = container.querySelector('.gestion-productos__estado-carga');
  const lista = container.querySelector('.gestion-productos__lista');
  const mensaje = container.querySelector('.gestion-productos__mensaje');

  ajustarLista(lista);

  let productos = [];
  let cartaCargada = false;
  let tipoSeleccionado = TIPOS_PRODUCTO.PLATO;
  // Qué puede dar de alta este perfil. El permiso decide el botón "+", no el
  // acceso a la pantalla: todo el staff puede mirar la carta completa.
  let puedeCrearPlato = false;
  let puedeCrearBebida = false;

  const header = crearAppHeader({
    titulo: 'Productos',
    etiquetaVolver: 'Volver al inicio',
    onVolver: () => navegarA('/home'),
    accion: {
      texto: '+',
      etiqueta: 'Agregar producto',
      onClick: () => navegarA(PESTANAS[tipoSeleccionado].ruta),
    },
  });
  container.querySelector('[data-header]').append(header);
  const botonAlta = header.querySelector('.app-header__accion');
  botonAlta.hidden = true;

  // Se arma primero con las dos pestañas habilitadas (todavía no se sabe el
  // rol) y se reconstruye apenas resuelven los permisos si corresponde grisar
  // alguna -así no hay que esperar la respuesta para mostrar algo en pantalla-.
  function crearYMontarPestanas(deshabilitadas = {}) {
    const nuevaPestanas = crearPestanas({
      etiqueta: 'Filtrar productos',
      opciones: Object.entries(PESTANAS).map(([valor, { etiqueta }]) => ({
        valor, texto: etiqueta, deshabilitada: deshabilitadas[valor] === 'deshabilitada',
      })),
      seleccionInicial: tipoSeleccionado,
      onCambio: (valor) => {
        tipoSeleccionado = valor;
        dibujar();
      },
    });
    container.querySelector('[data-pestanas]').replaceChildren(nuevaPestanas.elemento);
    return nuevaPestanas;
  }
  crearYMontarPestanas();

  function actualizarBotonAlta() {
    const puede = tipoSeleccionado === TIPOS_PRODUCTO.PLATO ? puedeCrearPlato : puedeCrearBebida;
    botonAlta.hidden = !puede;
    botonAlta.setAttribute(
      'aria-label',
      tipoSeleccionado === TIPOS_PRODUCTO.PLATO ? 'Agregar plato' : 'Agregar bebida',
    );
  }

  function dibujar() {
    const pestana = PESTANAS[tipoSeleccionado];
    const visibles = productos.filter((producto) => producto.tipo === tipoSeleccionado);

    lista.setAttribute('aria-label', pestana.etiqueta);
    actualizarBotonAlta();

    if (visibles.length === 0) {
      lista.hidden = true;
      lista.replaceChildren();
      mensaje.textContent = pestana.vacio;
      mensaje.hidden = false;
      return;
    }

    mensaje.hidden = true;
    lista.replaceChildren(...visibles.map(tarjetaProducto));
    lista.hidden = false;
  }

  // Los permisos no bloquean el listado: si la consulta falla, se muestra la
  // carta igual y sólo queda oculto el botón de alta.
  reintentarUnaVez(obtenerPermisos)
    .then((permisos) => {
      puedeCrearPlato = puedeAltaPlato(permisos);
      puedeCrearBebida = puedeAltaBebida(permisos);

      // Cocinero/cantinero ven las dos pestañas, pero una queda gris (pedido
      // explícito: nunca ocultarla). Cualquier otro rol que llegue acá
      // (jefe, o alguien por URL directa) sigue viendo las dos habilitadas.
      const deshabilitadas = PERMISOS_PESTANAS.productos[permisos.rol];
      if (deshabilitadas) {
        if (deshabilitadas[tipoSeleccionado] === 'deshabilitada') {
          tipoSeleccionado = tipoSeleccionado === TIPOS_PRODUCTO.PLATO ? TIPOS_PRODUCTO.BEBIDA : TIPOS_PRODUCTO.PLATO;
        }
        crearYMontarPestanas(deshabilitadas);
      }

      actualizarBotonAlta();
      // Si la carta ya cargó, hay que redibujar con la pestaña corregida; si
      // todavía no, listarCartaConFotos() ya va a dibujar con el valor
      // correcto de tipoSeleccionado apenas resuelva -evita mostrar el
      // mensaje de "vacío" de una pestaña de más mientras se espera la carta-.
      if (cartaCargada) dibujar();
    })
    .catch((error) => console.error('No se pudieron cargar los permisos de productos.', error));

  listarCartaConFotos()
    .then((cartaCompleta) => {
      productos = cartaCompleta;
      cartaCargada = true;
      estadoCarga.hidden = true;
      dibujar();
    })
    .catch((error) => {
      estadoCarga.hidden = true;
      mensaje.textContent = `No se pudieron cargar los productos: ${error.message ?? 'error desconocido'}`;
      mensaje.hidden = false;
    });
}
