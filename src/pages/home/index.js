import "./index.css";
import { crearLectorQr } from "../../components/lector-qr/lector-qr.js";
import { mostrarToastError } from "../../components/toast-error/toast-error.js";
import { ETIQUETAS_ROL } from "../../config/constantes.js";
import {
  esRolCliente,
  obtenerAccionesHome,
  obtenerAccionesHomeEmpleado,
  puedeAccederRuta,
} from "../../config/navegacion.js";
import { buscarMesaPorQr } from "../../services/mesas.service.js";
import { normalizarQrMesa } from "../../utils/hu11.js";
import { obtenerPerfilActual, signOut } from "../../services/auth.service.js";
import { validarQrIngreso } from "../../services/qr.service.js";
import {
  borrarTokenActual,
  iniciarPushAdministracion,
  iniciarPushCliente,
  iniciarPushConsultasMozo,
  iniciarPushListaEspera,
  iniciarPushSectores,
} from "../../services/notificaciones.service.js";
import {
  consumirAvisoNavegacion,
  navegarA,
  reemplazarRuta,
} from "../../router.js";

function nombreVisible(perfil) {
  return (
    [perfil?.nombres, perfil?.apellidos].filter(Boolean).join(" ").trim() ||
    "Usuario"
  );
}

function iconoAccion(id) {
  const iconos = {
    clientes:
      '<path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 20v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    empleados:
      '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/>',
    "registrar-cliente":
      '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/>',
    consultas:
      '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3v-4.5A7 7 0 0 1 2 14V7a4 4 0 0 1 4-4h11a4 4 0 0 1 4 4z"/><path d="M7 9h10M7 13h6"/>',
    productos:
      '<path d="M4 11h16M6 11a6 6 0 0 1 12 0M3 20h18M5 16h14"/><path d="M12 5V3"/>',
    "ingreso-local":
      '<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM18 18h3v3h-3z"/>',
    mesas:
      '<rect x="3" y="5" width="18" height="4" rx="1"/><path d="M6 9v10M18 9v10"/>',
    pedidos:
      '<path d="M6 2h12v19l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h4"/>',
    espera: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    // Punto 22: cobrar. Un ticket con sus renglones y el borde dentado abajo.
    cuentas:
      '<path d="M5 3h14v18l-2.5-2-2.5 2-2-2-2 2-2.5-2L5 21z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  };
  const grilla =
    '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>';
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${
    iconos[id] ?? grilla
  }</svg>`;
}

function crearTarjetaAccion(accion, principal = false) {
  const boton = document.createElement("button");
  boton.type = "button";
  boton.className = principal
    ? "home__accion home__accion--principal"
    : "home__accion";
  boton.dataset.accion = accion.id;
  boton.insertAdjacentHTML("beforeend", iconoAccion(accion.id));
  const titulo = document.createElement("strong");
  titulo.textContent = accion.titulo;
  boton.append(titulo);
  if (accion.descripcion && (!principal || accion.id === "ingreso-local")) {
    const descripcion = document.createElement("span");
    descripcion.textContent = accion.descripcion;
    boton.append(descripcion);
  }
  // habilitada === false sólo aparece en las tarjetas de empleados (ver
  // config/navegacion.js): se muestran siempre las 7, grisadas si el rol no
  // tiene esa función. No es un "sólo lectura": el botón no navega a nada.
  if (accion.habilitada === false) {
    boton.disabled = true;
    boton.classList.add("home__accion--bloqueada");
    boton.title = "No disponible para tu perfil";
  }
  return boton;
}

export async function render(container) {
  container.innerHTML = `
    <ion-page class="home">
      <ion-content>
        <main class="home__contenido" aria-busy="true">
          <header class="home__encabezado">
            <div class="home__marca"><span class="home__logo"><img src="/assets/logo/Icono Big N.svg" alt=""></span><span>Big N</span></div>
            <h1 class="home__saludo sr-only">Bienvenido <span data-nombre-saludo>Usuario</span></h1>
          </header>
          <p class="home__aviso" role="status" aria-live="polite" hidden></p>
          <p class="home__error" role="alert" hidden></p>
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
            <button class="home__qr-mesa" type="button" aria-label="Escanear QR de mesa" title="Escanear QR de mesa" hidden>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM18 18h3v3h-3z"/></svg>
            </button>
            <button class="home__cerrar" type="button" aria-label="Cerrar sesión" title="Cerrar sesión">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17l5-5-5-5M15 12H3M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/></svg>
            </button>
          </section>
        </main>
      </ion-content>
    </ion-page>`;

  const raiz = container.querySelector(".home__contenido");
  const error = raiz.querySelector(".home__error");
  const aviso = raiz.querySelector(".home__aviso");
  const mensajeNavegacion = consumirAvisoNavegacion();
  if (mensajeNavegacion) {
    aviso.textContent = mensajeNavegacion;
    aviso.hidden = false;
  }

  try {
    const perfil = await obtenerPerfilActual();
    if (!raiz.isConnected) return;
    const nombre = nombreVisible(perfil);
    const rol = ETIQUETAS_ROL[perfil.rol] ?? perfil.rol;
    // El saludo usa sólo el primer nombre; el nombre completo queda para la
    // barra de perfil de abajo (data-nombre), que es donde importa ser preciso.
    raiz.querySelector("[data-nombre-saludo]").textContent =
      perfil?.nombres || nombre;
    raiz.querySelector("[data-nombre]").textContent = nombre;
    raiz.querySelector("[data-inicial]").textContent = nombre
      .charAt(0)
      .toUpperCase();
    raiz.querySelector("[data-detalle]").textContent = rol ?? "";
    raiz.querySelector(".home__perfil").hidden = false;

    const agregarAcciones = (selector, lista, principal) => {
      const seccion = raiz.querySelector(selector);
      if (!lista.length) return;
      seccion.hidden = false;
      const contenedor = seccion.querySelector(".home__acciones");
      contenedor.dataset.cantidad = String(lista.length);
      lista.forEach((accion) => {
        const boton = crearTarjetaAccion(accion, principal);
        boton.addEventListener("click", () => {
          if (accion.ruta) navegarA(accion.ruta);
          if (accion.accion === "ingreso-local") abrirIngresoLocal(boton);
        });
        contenedor.append(boton);
      });
    };

    // Empleados: se muestran las 7 tarjetas siempre; la matriz de acceso en
    // config/navegacion.js decide cuáles quedan grisadas para cada rol.
    // Clientes siguen con su propia lista por rol, sin cambios.
    if (esRolCliente(perfil.rol)) {
      const acciones = obtenerAccionesHome(perfil.rol);
      agregarAcciones("[data-principales]", acciones.principales, true);
      agregarAcciones("[data-secundarias]", acciones.secundarias, false);
    } else {
      agregarAcciones(
        "[data-principales]",
        obtenerAccionesHomeEmpleado(perfil.rol),
        true,
      );
    }

    // QR de mesa para el personal (metre, mozo, dueño, supervisor): va en la
    // barra de perfil y no como tarjeta, para no sumarle una fila a la grilla
    // del home. Abre la cámara directo y lleva a la info de esa mesa.
    const botonQrMesa = raiz.querySelector(".home__qr-mesa");
    if (puedeAccederRuta("/mesa/:id", perfil.rol)) {
      botonQrMesa.hidden = false;
      botonQrMesa.addEventListener("click", () => abrirQrMesa(botonQrMesa));
    }

    function abrirQrMesa(boton) {
      boton.disabled = true;
      const lector = crearLectorQr({
        titulo: "Escaneá el QR de la mesa",
        descripcion: "Vas a ver su número, lugares, tipo y disponibilidad.",
        textoBoton: "Escanear QR de mesa",
        nombreObjeto: "QR de mesa",
        variante: "acceso",
        onLectura: async (contenido) => {
          try {
            const mesa = await buscarMesaPorQr(normalizarQrMesa(contenido));
            if (!mesa) {
              mostrarToastError("Ese QR no corresponde a ninguna mesa del local.");
              return;
            }
            navegarA(`/mesa/${mesa.id}`);
          } catch (e) {
            mostrarToastError(e.message ?? "No se pudo leer el QR de la mesa.");
          }
        },
      });
      // El lector no se inserta en pantalla: sus errores (sin cámara, sin
      // permiso, etc.) se muestran con el toast de siempre.
      void lector.escanear().finally(() => {
        const aviso = lector.elemento.querySelector("ion-note")?.textContent;
        if (aviso) mostrarToastError(aviso);
        if (boton.isConnected) boton.disabled = false;
      });
    }

    function abrirIngresoLocal(boton) {
      boton.disabled = true;
      const contenedor = raiz.querySelector(".home__lector");
      contenedor.replaceChildren();
      const lector = crearLectorQr({
        titulo: "Escaneá el QR de la entrada",
        descripcion: "Es el código que está en la puerta del local.",
        textoBoton: "Escanear código",
        nombreObjeto: "código",
        variante: "acceso",
        onLectura: async (contenido) => {
          try {
            if (!(await validarQrIngreso(contenido))) {
              mostrarToastError(
                "Ese código no es el de ingreso al local. Probá de nuevo.",
              );
              return;
            }
            navegarA("/lista-espera");
          } catch (e) {
            mostrarToastError(
              `No se pudo validar el código: ${
                e.message ?? "error desconocido"
              }`,
            );
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
      iniciarPushAdministracion(perfil),
      iniciarPushListaEspera(perfil),
      iniciarPushCliente(perfil),
      iniciarPushConsultasMozo(perfil),
      iniciarPushSectores(perfil),
    ]);
  } catch (e) {
    error.textContent = e.message ?? "No se pudo cargar tu inicio.";
    error.hidden = false;
  } finally {
    raiz.setAttribute("aria-busy", "false");
  }

  raiz.querySelector(".home__cerrar").addEventListener("click", async () => {
    const boton = raiz.querySelector(".home__cerrar");
    boton.disabled = true;
    try {
      await borrarTokenActual();
      await signOut();
      reemplazarRuta("/login");
    } catch (e) {
      error.textContent = e.message ?? "No se pudo cerrar la sesión.";
      boton.disabled = false;
    }
  });
}
