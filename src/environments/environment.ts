/**
 * Entorno de desarrollo: `ng serve` habla con el proyecto real de Supabase.
 *
 * La clave publicable (anon) no es secreta: va en el navegador por diseño y
 * el control de acceso lo hacen las políticas RLS de cada tabla
 * (`publica/supabase/supabase/migrations`). La `service_role` nunca va aquí.
 */
export const environment = {
  production: false,
  supabaseUrl: 'https://PENDIENTE.supabase.co',
  supabaseKey: 'PENDIENTE',
};
