import './index.css';
import { crearLectorQr } from '../../components/lector-qr/lector-qr.js';
import { mostrarToastError } from '../../components/toast-error/toast-error.js';
import { ETIQUETAS_ROL } from '../../config/constantes.js';
import { obtenerAccionesHome } from '../../config/navegacion.js';
import { obtenerPerfilActual, signOut } from '../../services/auth.service.js';
import { validarQrIngreso } from '../../services/qr.service.js';
import {
  borrarTokenActual,
  iniciarPushAdministracion,
  iniciarPushCliente,
  iniciarPushConsultasMozo,
  iniciarPushListaEspera,
} from '../../services/notificaciones.service.js';
import { consumirAvisoNavegacion, navegarA, reemplazarRuta } from '../../router.js';

function nombreVisible(perfil) {
  return [perfil?.nombres, perfil?.apellidos].filter(Boolean).join(' ').trim() || 'Usuario';
}

function iconoAccion(id) {
  const iconos = {
    clientes: '<path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 20v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    empleados: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/>',
    'registrar-cliente': '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/>',
    consultas: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3v-4.5A7 7 0 0 1 2 14V7a4 4 0 0 1 4-4h11a4 4 0 0 1 4 4z"/><path d="M7 9h10M7 13h6"/>',
    productos: '<path d="M4 11h16M6 11a6 6 0 0 1 12 0M3 20h18M5 16h14"/><path d="M12 5V3"/>',
    'ingreso-local': '<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM18 18h3v3h-3z"/>',
  };
  const grilla = '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>';
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${iconos[id] ?? grilla}</svg>`;
}

function crearTarjetaAccion(accion, principal = false) {
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = principal ? 'home__accion home__accion--principal' : 'home__accion';
  boton.dataset.accion = accion.id;
  boton.insertAdjacentHTML('beforeend', iconoAccion(accion.id));
  const titulo = document.createElement('strong');
  titulo.textContent = accion.titulo;
  boton.append(titulo);
  if (accion.descripcion && !principal) {
    const descripcion = document.createElement('span');
    descripcion.textContent = accion.descripcion;
    boton.append(descripcion);
  }
  return boton;
}

export async function render(container) {
  container.innerHTML = `
    <ion-page class="home">
      <ion-content>
        <main class="home__contenido" aria-busy="true">
          <header class="home__encabezado">
            <div class="home__marca"><img src="/assets/logo/Icono Big N.svg" alt=""><span>Big N</span></div>
            <h1 class="home__saludo">Bienvenido, <span data-rol>Usuario</span></h1>
          </header>
          <p class="home__aviso" role="status" aria-live="polite" hidden></p>
          <section class="home__seccion home__seccion--principal" data-principales hidden>
            <div class="home__acciones" aria-label="Acciones principales"></div>
          </section>
          <section class="home__seccion" data-secundarias hidden>
            <div class="home__acciones home__acciones--secundarias" aria-label="Otras funciones"></div>
          </section>
          <div class="home__lector"></div>
          <section class="home__perfil" aria-label="Perfil activo" hidden>
            <span class="home__avatar" data-inicial></span>
            <span class="home__perfil-datos"><strong data-nombre>Usuario</strong><small data-detalle></small></span>
            <button class="home__cerrar" type="button" aria-label="Cerrar sesión" title="Cerrar sesión">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17l5-5-5-5M15 12H3M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/></svg>
            </button>
          </section>
          <p class="home__error" role="alert" aria-live="polite"></p>
        </main>
      </ion-content>
    </ion-page>`;

  const raiz = container.querySelector('.home__contenido');
  const error = raiz.querySelector('.home__error');
  const aviso = raiz.querySelector('.home__aviso');
  const mensajeNavegacion = consumirAvisoNavegacion();
  if (mensajeNavegacion) { aviso.textContent = mensajeNavegacion; aviso.hidden = false; }

  try {
    const perfil = await obtenerPerfilActual();
    if (!raiz.isConnected) return;
    const nombre = nombreVisible(perfil);
    const rol = ETIQUETAS_ROL[perfil.rol] ?? perfil.rol;
    raiz.querySelector('[data-nombre]').textContent = nombre;
    raiz.querySelector('[data-rol]').textContent = rol;
    raiz.querySelector('[data-inicial]').textContent = nombre.charAt(0).toUpperCase();
    raiz.querySelector('[data-detalle]').textContent = [rol, perfil.email].filter(Boolean).join(' · ');
    raiz.querySelector('.home__perfil').hidden = false;
    const acciones = obtenerAccionesHome(perfil.rol);

    const agregarAcciones = (selector, lista, principal) => {
      const seccion = raiz.querySelector(selector);
      if (!lista.length) return;
      seccion.hidden = false;
      const contenedor = seccion.querySelector('.home__acciones');
      lista.forEach((accion) => {
        const boton = crearTarjetaAccion(accion, principal);
        boton.addEventListener('click', () => {
          if (accion.ruta) navegarA(accion.ruta);
          if (accion.accion === 'ingreso-local') abrirIngresoLocal(boton);
        });
        contenedor.append(boton);
      });
    };
    agregarAcciones('[data-principales]', acciones.principales, true);
    agregarAcciones('[data-secundarias]', acciones.secundarias, false);

    function abrirIngresoLocal(boton) {
      boton.disabled = true;
      const contenedor = raiz.querySelector('.home__lector');
      contenedor.replaceChildren();
      const lector = crearLectorQr({
        titulo: 'Escaneá el QR de la entrada',
        descripcion: 'Es el código que está en la puerta del local.',
        textoBoton: 'Escanear código',
        nombreObjeto: 'código',
        onLectura: async (contenido) => {
          try {
            if (!await validarQrIngreso(contenido)) {
              mostrarToastError('Ese código no es el de ingreso al local. Probá de nuevo.');
              return;
            }
            navegarA('/lista-espera');
          } catch (e) {
            mostrarToastError(`No se pudo validar el código: ${e.message ?? 'error desconocido'}`);
          }
        },
      });
      // El cliente registrado ya eligió la acción desde el Home: ese mismo
      // toque abre la cámara, sin agregar otra tarjeta ni un segundo botón.
      void lector.escanear().finally(() => {
        if (boton.isConnected) boton.disabled = false;
      });
    }

    // El registro del token se inicia en Home, después de tener el perfil
    // validado. Cada función decide internamente si ese rol es destinatario.
    void Promise.allSettled([
      iniciarPushAdministracion(perfil), iniciarPushListaEspera(perfil),
      iniciarPushCliente(perfil), iniciarPushConsultasMozo(perfil),
    ]);
  } catch (e) {
    error.textContent = e.message ?? 'No se pudo cargar tu inicio.';
  } finally {
    raiz.setAttribute('aria-busy', 'false');
  }

  raiz.querySelector('.home__cerrar').addEventListener('click', async () => {
    const boton = raiz.querySelector('.home__cerrar');
    boton.disabled = true;
    try {
      await borrarTokenActual();
      await signOut();
      reemplazarRuta('/login');
    } catch (e) {
      error.textContent = e.message ?? 'No se pudo cerrar la sesión.';
      boton.disabled = false;
    }
  });
}
