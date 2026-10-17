/**
 * Helper para disparar downloads desde el browser (Fase 6 — exportación CSV).
 *
 * Crea un `<a>` efímero con `href` al recurso y, opcionalmente, `download="..."`,
 * simula click y lo remueve del DOM. El server envía `Content-Disposition:
 * attachment; filename=…` con el filename definitivo; el `download` attribute
 * que pasamos acá se usa solo como hint si el server no setea uno.
 *
 * Si la URL es cross-origin (no debería serlo en este proyecto — Vite proxy
 * apunta `/api` al backend en :4000), algunos navegadores requieren
 * configuración adicional (`crossOrigin`, fetch + blob). En same-origin funciona
 * sin más.
 */
export function triggerDownload(url: string, filename?: string): void {
  const a = document.createElement('a');
  a.href = url;
  if (filename) a.download = filename;
  // Algunos navegadores requieren que esté en el DOM para que `click()` funcione
  // programáticamente.
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
