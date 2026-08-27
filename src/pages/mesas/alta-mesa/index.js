// src/pages/mesas/alta-mesa/index.js
import { altaMesa } from '../../../services/mesas.service.js';

export function render(container) {
  container.innerHTML = `
    <ion-content class="fondo-terciario">
      <h2>Agregar mesa</h2>
      <form id="form-alta-mesa">
        <ion-input name="numero" type="number" placeholder="Número" required></ion-input>
        <ion-input name="cantidad" type="number" placeholder="Cantidad de comensales" required></ion-input>
        <ion-select name="tipo" placeholder="Tipo">
          <ion-select-option value="estandar">Estándar</ion-select-option>
          <ion-select-option value="vip">VIP</ion-select-option>
          <ion-select-option value="movilidad_reducida">Movilidad reducida</ion-select-option>
        </ion-select>
        <ion-button type="submit">Guardar</ion-button>
      </form>
      <div id="mensaje-error"></div>
    </ion-content>
  `;

  const form = container.querySelector('#form-alta-mesa');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const datos = new FormData(form);

    try {
      const mesa = await altaMesa({
        numero: Number(datos.get('numero')),
        cantidad_comensales: Number(datos.get('cantidad')),
        tipo: datos.get('tipo'),
      });
      // acá, por ejemplo, navegás al listado o mostrás el QR generado
      console.log('Mesa creada con QR:', mesa.qr_token);
    } catch (error) {
      container.querySelector('#mensaje-error').textContent = error.message;
    }
  });
}