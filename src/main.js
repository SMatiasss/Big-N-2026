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

window.addEventListener('load', () => {
    setTimeout(() => {
    const splash = document.getElementById('web-splash');
    if (splash) {
        splash.style.opacity = '0'; // Inicia el desvanecimiento
        setTimeout(() => {
        splash.remove(); // La borra para que puedas usar la app
        }, 500); // Dura lo mismo que la transición
    }
    }, 3500); // 2.5 segundos en pantalla
});