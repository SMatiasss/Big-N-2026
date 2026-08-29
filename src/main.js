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
