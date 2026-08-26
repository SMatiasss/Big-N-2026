# Grupete 2026 — TFI Restaurante

App Ionic + Capacitor + Supabase para el TFI. Ver `estructura_carpetas.md` (en el
repo del grupo) para la convención de carpetas y el reparto de puntos por persona.

## Desarrollo

1. Copiar `.env.example` a `.env` y completar con las credenciales de Supabase.
2. `npm install`
3. `npm run dev`

## Estructura

- `src/pages/` — una carpeta por punto del enunciado.
- `src/services/` — única puerta de acceso a Supabase.
- `src/components/` — bloques de UI reutilizados entre pantallas.
- `supabase/` — migraciones SQL y Edge Functions.

## Capturas

Ver `docs/capturas/` para el índice de imágenes de cada módulo.
