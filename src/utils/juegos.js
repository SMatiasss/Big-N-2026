export const PARES_MEMOTEST = Object.freeze([
  [0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3],
]);

export function revelarMemotest(objetivo) {
  const parejaPremiada = PARES_MEMOTEST[objetivo - 1];
  if (!parejaPremiada) throw new Error('Resultado de Memotest inválido.');
  return Array.from({ length: 4 }, (_, indice) => parejaPremiada.includes(indice) ? '🍴' : '🍰');
}

export function anguloFinalRuleta(sector) {
  if (!Number.isInteger(sector) || sector < 0 || sector > 7) {
    throw new Error('Sector de ruleta inválido.');
  }
  // Tres vueltas completas y luego el centro del sector bajo el marcador.
  return 1080 - (sector * 45) - 22.5;
}
