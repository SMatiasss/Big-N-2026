// Deja en un campo de texto sólo un número: dígitos y, si se permiten
// decimales, un único separador (la coma se normaliza a punto). Lo que se
// tipee o pegue que no sea eso se descarta en el momento y se llama a
// alInvalido(), para que la pantalla muestre el aviso.
//
// Hay que registrarlo ANTES que el validador general de la pantalla: corta
// el evento, porque si no ese validador ve el valor ya limpio y borra el aviso.
export function soloNumeros(input, { decimales = false, alInvalido = () => {} } = {}) {
  input.addEventListener('input', (evento) => {
    const original = input.value;

    const invalido = decimales
      ? /[^\d.,]/.test(original) || (original.match(/[.,]/g)?.length ?? 0) > 1
      : /\D/.test(original);

    let limpio = original.replace(decimales ? /[^\d.,]/g : /\D/g, '');
    if (decimales) {
      const [entero, ...resto] = limpio.replace(/,/g, '.').split('.');
      limpio = resto.length ? `${entero}.${resto.join('')}` : entero;
    }

    if (limpio !== original) input.value = limpio;
    if (!invalido) return;

    alInvalido();
    evento.stopImmediatePropagation();
  });
}
