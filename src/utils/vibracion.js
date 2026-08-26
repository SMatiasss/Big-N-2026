// Wrapper de Haptics para vibrar en error (punto excluyente).
// Requiere agregar la dependencia @capacitor/haptics al package.json.

export async function vibrarError() {
  try {
    const { Haptics, NotificationType } = await import('@capacitor/haptics');
    await Haptics.notification({ type: NotificationType.Error });
  } catch {
    // Sin soporte de Haptics (ej. navegador de escritorio): no hacemos nada.
  }
}
