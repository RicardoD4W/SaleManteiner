---
name: visual-verification
description: Verificar visualmente la web antes de cerrar un feature. Trigger: feature con UI, "mirar la web", capturas de pantalla, revisión visual, el cambio se ve bien.
allowed-tools: Read, Bash, Edit, Write
---

# Verificación visual

Un test verde no demuestra que la UI se vea bien. Este skill es el paso de
**mirar la web** antes de cerrar un feature que **afecta a la UI**.

## Cuándo aplica

- **Aplica**: cambios que tocan la UI (textos, layout, estilos, componentes).
- **No aplica**: specs **solo de código** (refactor, renombres, limpieza) que
  no cambian ni la funcionalidad ni el aspecto → los verifican los gates
  (typecheck, lint, format, tests).

**El arnés no vive en el repo**: se crea en el momento de resolver la spec
que lo necesita (ver AGENTS.md §8.1) y se puede borrar cuando la spec está
resuelta.

## Procedimiento

1. **Capturar**: el arnés se arma **fuera del repo**, en el directorio
   temporal. Un script levanta su propio backend (`PORT=<puerto libre>
   SALEMANTEINER_DIR=<dir temporal>`) y su propio Vite (`--port <puerto
   libre>`, con `API_TARGET` apuntando a ese backend), siembra datos por
   la API y captura con el Chromium del repo (`@playwright/test`). La BD
   es **temporal**: nunca toca `~/.salemanteiner`. Para congelar una
   transición en el aire: CDP (`Animation.setPlaybackRate`).

2. **Mirar** las capturas con la herramienta `read` (renderiza el PNG como
   imagen). No alcanza con que el script haya pasado: hay que mirarlas.

3. **Comparar** contra lo que el feature promete (spec/aceptación). Buscar
   justo lo que los tests no ven:

   - texto cortado o partido (encabezados, celdas, botones);
   - columnas que se salen de la tabla o scroll horizontal inesperado;
   - elementos superpuestos (modales que tapan el contenido, header sobre
     el contenido);
   - colores sin contraparte `dark:` o contraste bajo;
   - modales que no centran, que no cierran con Escape o que devuelven el
     foco al lugar equivocado;
   - charts que quedan en su fallback de carga ("Cargando gráfico...");
   - la versión móvil (390px): nav recortada, tabla ilegible.

4. **Flujos interactivos puntuales**: para clics/ teclado / consola / red
   está el MCP de Playwright; para lo demás, el Playwright del repo desde
   un script (`node --input-type=module -e "..."` desde `web/`).

## Qué mirar primero (orden de utilidad)

1. La pantalla que cambió.
2. La misma pantalla en **dark mode** (el toggle del header).
3. La misma pantalla en **móvil** (390×844).
4. Los modales que abre.

## Reporte

El cierre de un feature con UI incluye **las capturas revisadas** en el
informe: qué se vio y si algo quedó mal. Si no se pudo mirar, se dice
explícitamente — no se da por verificado.

## Notas del repo

- La app es de una sola página en español (`/`, `/buys`, `/solds`,
  `/customers`); sin i18n.
- Tokens de color y convención de dark mode: `AGENTS.md` §9.
- El MCP de Playwright de esta máquina apunta al Chrome de sistema, que no
  está instalado: usar el Chromium del repo (`npx playwright install
  chromium`) o el script de captura.
