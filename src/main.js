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
// location.hash = '/mesas/alta'
iniciarRouter(document.querySelector('#app'));

// El router cambia de pantalla vía location.hash, lo que apila entradas en el
// historial del WebView. Por eso el botón "atrás" físico puede resolverse
// simplemente retrocediendo ese historial en lugar de cerrar la app.
App.addListener('backButton', ({ canGoBack }) => {
  if (canGoBack) window.history.back();
  else App.exitApp();
});
