import { App } from '@capacitor/app';
import '@ionic/core/css/ionic.bundle.css';
import { initialize } from '@ionic/core/components';
import { defineCustomElements } from '@ionic/core/loader';
import './styles/variables.css';
import './styles/tipografia.css';
import './styles/globales.css';
import { initSupabase } from './services/supabase.client.js';
import { iniciarRouter } from './router.js';

initialize();
defineCustomElements(window);
initSupabase();
//location.hash = '/mesas/alta'
iniciarRouter(document.querySelector('#app'));


// Splash screen con movimiento y sonido custom
window.addEventListener('load', () => {
    const sonido = new Audio('/assets/sonidos/sonido-inicio.mp3');
    sonido.play().catch(e => console.log("Bloqueado en web PC, pero sonará en celular:", e));

    setTimeout(() => {
    const splash = document.getElementById('web-splash');
    if (splash) {
        splash.style.opacity = '0'; // Inicia el desvanecimiento
        setTimeout(() => {
        splash.remove(); // La borra para que puedas usar la app
        }, 500);
    }
    }, 4000); // 3.5 segundos en pantalla
});
// location.hash = '/mesas/alta'
iniciarRouter(document.querySelector('#app'));

// El router cambia de pantalla vía location.hash, lo que apila entradas en el
// historial del WebView. Por eso el botón "atrás" físico puede resolverse
// simplemente retrocediendo ese historial en lugar de cerrar la app.
App.addListener('backButton', ({ canGoBack }) => {
  if (canGoBack) window.history.back();
  else App.exitApp();
});
