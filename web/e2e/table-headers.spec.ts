/**
 * E2E: cabeceras de tabla (S4 de `feature-acciones-en-listas`).
 *
 * El bug reportado: al ordenar por "Asociados (€)" en `/solds`, el indicador
 * (▼) "caía" a la línea de abajo, PARTIENDO la cabecera en dos renglones.
 *
 * Por qué se mide y no se comprueba solo el texto: el síntoma es puramente
 * visual (una caja del indicador 20px más abajo que el texto). La medición
 * se hace sobre los nodos de texto del `<th>`, así que el test no depende de
 * la estructura interna del componente (sirve igual con la implementación
 * vieja y con la nueva).
 *
 * Se covers las TRES tablas con cabecera ordenable:
 *  - `/solds` y `/buys` (tabla virtualizada, `VirtualTable`).
 *  - `/products` (tabs del dashboard, `SortHeader` propio).
 */
import { expect } from '@playwright/test';
import { test, clearAll } from './fixtures';

/** Métricas de una cabecera: líneas del texto, posición del indicador, etc. */
interface Medidas {
  /** Cuántos renglones ocupa el texto de la cabecera. */
  lineas: number;
  /** Y (px) de la primera línea del texto. */
  textoTop: number | null;
  /** Y (px) del indicador (▲/▼). */
  indicadorY: number | null;
  /** Diferencia vertical entre el texto y el indicador (0 = mismo renglón). */
  desvio: number | null;
  /** Si el texto quedó recortado (ellipsis) por no entrar en la columna. */
  recortado: boolean;
}

/** Mide la cabecera de la columna indicada. */
async function medirCabecera(
  page: import('@playwright/test').Page,
  columna: string,
): Promise<Medidas> {
  const header = page.getByRole('columnheader', { name: new RegExp(columna) });
  await expect(header).toBeVisible();
  return header.evaluate((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const textos: Text[] = [];
    while (walker.nextNode()) textos.push(walker.currentNode as Text);

    const nodoTexto =
      textos.find((t) => t.textContent?.trim().startsWith('Asociados')) ??
      textos.find((t) => t.textContent?.trim().startsWith('Precio de venta')) ??
      textos.find((t) => t.textContent?.trim());
    const nodoIndicador = textos.find(
      (t) => t.textContent?.includes('▼') || t.textContent?.includes('▲'),
    );

    const rangoTexto = document.createRange();
    if (nodoTexto) rangoTexto.selectNodeContents(nodoTexto);
    const rects = nodoTexto ? Array.from(rangoTexto.getClientRects()) : [];

    const rangoIndicador = document.createRange();
    if (nodoIndicador) rangoIndicador.selectNodeContents(nodoIndicador);
    const rectIndicador = nodoIndicador ? rangoIndicador.getBoundingClientRect() : null;

    // ¿El texto quedó recortado con "…"? (scrollWidth > clientWidth).
    const padre = nodoTexto?.parentElement ?? null;
    const recortado = padre ? padre.scrollWidth > padre.clientWidth + 1 : false;

    const textoTop = rects.length ? rects[0]!.y : null;
    const indicadorY = rectIndicador ? rectIndicador.y : null;

    return {
      lineas: rects.length,
      textoTop,
      indicadorY,
      desvio: textoTop !== null && indicadorY !== null ? Math.abs(indicadorY - textoTop) : null,
      recortado,
    };
  });
}

/** Ancho (px) de la primera cabecera de la tabla (la que NO se ordena). */
async function anchoPrimeraCabecera(page: import('@playwright/test').Page): Promise<number> {
  const caja = await page.locator('thead th').first().boundingBox();
  return caja?.width ?? 0;
}

test.beforeEach(async ({ request }) => {
  await clearAll(request);
});

test('el indicador de orden se queda en la misma línea que la cabecera', async ({
  page,
  request,
}) => {
  // Datos: una compra y una venta (para que /solds tenga filas).
  const buy = await request.post('/api/buys', {
    data: {
      product_name: 'Funda iPhone',
      purchase_cost: 100,
      quantity: 20,
      associated_costs: 5,
    },
  });
  const buyBody = (await buy.json()) as { data: { id: number } };
  const cust = await request.post('/api/customers', { data: { name: 'Juan' } });
  const custBody = (await cust.json()) as { data: { id: number } };
  await request.post('/api/solds', {
    data: {
      customer_id: custBody.data.id,
      sale_price: 40,
      associated_costs: 5,
      items: [{ buy_id: buyBody.data.id, quantity: 5 }],
    },
  });

  // Tablas con cabecera ordenable. La columna elegida es la más estrecha:
  // "Asociados (€)" es la que reportó el bug.
  const tablas: Array<{ url: string; columna: string }> = [
    { url: '/solds', columna: 'Asociados' },
    { url: '/buys', columna: 'Asociados' },
    { url: '/products', columna: 'Precio de venta' },
  ];

  for (const { url, columna } of tablas) {
    await page.goto(url);
    const header = page.getByRole('columnheader', { name: new RegExp(columna) });
    await expect(header).toBeVisible();

    const anchoAntes = await anchoPrimeraCabecera(page);

    // Ordenar por esa columna (click en la cabecera). El orden es 3 estados
    // en las tabs del dashboard (neutral → asc → desc) y 2 en las tablas
    // virtualizadas, así que se acepta cualquiera de los dos sentidos.
    await header.click();
    await expect(header).toHaveAttribute('aria-sort', /ascending|descending/);

    const medidas = await medirCabecera(page, columna);

    // 1) El indicador (▼) está en el MISMO renglón que el texto.
    expect(
      medidas.desvio,
      `${url}: el indicador no está en la línea del texto`,
    ).toBeLessThanOrEqual(2);
    // 2) El texto de la cabecera no se parte en dos renglones.
    expect(medidas.lineas, `${url}: la cabecera se partió en dos líneas`).toBe(1);
    // 3) El texto completo se ve: no se recorta con "…".
    expect(medidas.recortado, `${url}: el texto de la cabecera quedó recortado`).toBe(false);
    // 4) La tabla no se desajusta al ordenar: el ancho de las otras columnas
    //    no cambia (el hueco del indicador se reserva siempre).
    const anchoDespues = await anchoPrimeraCabecera(page);
    expect(
      Math.abs(anchoDespues - anchoAntes),
      `${url}: la tabla se desajustó al ordenar`,
    ).toBeLessThanOrEqual(1);
  }
});
