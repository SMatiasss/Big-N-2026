update public.juegos
set nombre = 'Rueda de la Fortuna'
where descuento_pct = 20
  and nombre in ('Ruleta', 'Rueda de la Fortuna');
