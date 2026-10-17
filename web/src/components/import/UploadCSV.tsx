import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import Papa from 'papaparse';
import { Button } from '../ui/Button';

export interface ParsedCsv {
  /** Headers leídos de la primera línea del CSV. */
  headers: string[];
  /** Filas como dict header → valor crudo (siempre string, papaparse con dynamicTyping=false). */
  rows: Record<string, string>[];
  /** Nombre del archivo original (para mostrar al usuario). */
  fileName: string;
}

interface UploadCSVProps {
  onParsed: (parsed: ParsedCsv) => void;
  /** Mensaje de error si el CSV no se pudo parsear (encoding, formato inválido, etc.). */
  onError?: (msg: string) => void;
}

/**
 * Drop zone / file picker para CSV (Fase 3). Usa papaparse con
 * `header: true` y `dynamicTyping: false` para mantener todo como string;
 * la coerción a tipos del schema vive en la página (UploadCSV no sabe
 * del shape de Sale).
 *
 * Headers esperados en el CSV (orden indiferente, mayúsculas no):
 *  `product_name` (obligatoria), `buyer_name`, `cost_cents`, `price_cents`,
 *  `associated_costs_cents`, `sold`, `purchase_date`, `sold_at`, `notes`.
 * Los importes van en céntimos (entero).
 */
export function UploadCSV({ onParsed, onError }: UploadCSVProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  function parseFile(file: File) {
    setIsParsing(true);
    void file
      .text()
      .then((text) => {
        const result = Papa.parse<Record<string, string>>(text, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: false,
        });
        const headers = result.meta.fields ?? [];
        const rows = (result.data ?? []) as Record<string, string>[];
        const parseErrors = result.errors.filter(
          (e) => e.type !== 'FieldMismatch' && e.code !== 'TooFewFields',
        );
        if (parseErrors.length > 0) {
          onError?.(`No se pudo leer el CSV: ${parseErrors[0]!.message}`);
          return;
        }
        if (headers.length === 0) {
          onError?.('El CSV no tiene encabezados.');
          return;
        }
        if (!headers.includes('product_name')) {
          onError?.(
            'Falta la columna obligatoria `product_name` en el encabezado del CSV.',
          );
          return;
        }
        onParsed({ headers, rows, fileName: file.name });
      })
      .catch((err: unknown) => {
        onError?.(
          err instanceof Error ? err.message : 'Error desconocido al leer el archivo.',
        );
      })
      .finally(() => setIsParsing(false));
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
    // Limpia el input para permitir re-subir el mismo archivo.
    e.target.value = '';
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsHovering(false);
    const file = e.dataTransfer.files?.[0];
    if (file) parseFile(file);
  }

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setIsHovering(true);
      }}
      onDragLeave={() => setIsHovering(false)}
      onDrop={onDrop}
      className={[
        'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 text-center cursor-pointer transition-colors',
        isHovering
          ? 'border-brand-500 bg-brand-50'
          : 'border-gray-300 bg-white hover:border-gray-400',
      ].join(' ')}
      data-testid="csv-dropzone"
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={onChange}
        className="sr-only"
        data-testid="csv-input"
      />
      <p className="text-sm text-gray-600">
        {isParsing
          ? 'Parseando…'
          : 'Arrastrá tu CSV acá, o hacé click para elegir uno'}
      </p>
      <p className="text-xs text-gray-500">
        Encabezados: <code>product_name</code>, <code>buyer_name</code>,{' '}
        <code>cost_cents</code>, <code>price_cents</code>,{' '}
        <code>associated_costs_cents</code>, <code>sold</code>,{' '}
        <code>purchase_date</code>, <code>sold_at</code>, <code>notes</code>.
        Importes en céntimos.
      </p>
      <Button
        type="button"
        variant="secondary"
        onClick={(e) => {
          e.preventDefault();
          inputRef.current?.click();
        }}
        disabled={isParsing}
      >
        Elegir archivo
      </Button>
    </label>
  );
}
