import { useTags } from '../../hooks/useTags';
import type { TagFilter as TagFilterValue } from '../../api/queryString';
import { cn } from '../../lib/classNames';

interface TagFilterProps {
  value: TagFilterValue;
  onChange: (value: TagFilterValue) => void;
  onManage: () => void;
}

const chipBaseClass =
  'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ' +
  'dark:focus-visible:ring-brand-400 dark:focus-visible:ring-offset-gray-900';

const chipIdleClass =
  'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 ' +
  'dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700';

const chipActiveClass =
  'border-brand-500 bg-brand-50 text-brand-800 ' +
  'dark:border-brand-400 dark:bg-brand-400/20 dark:text-brand-100';

export function TagFilter({ value, onChange, onManage }: TagFilterProps) {
  const { data: tags } = useTags('buy');

  const selectedIds = value.tagIds ?? [];
  const sinTagActive = value.sinTag === true;
  const hasActiveFilter = selectedIds.length > 0 || sinTagActive;

  const toggleTag = (id: number) => {
    if (selectedIds.includes(id)) {
      onChange({ tagIds: selectedIds.filter((tagId) => tagId !== id) });
      return;
    }
    onChange({ tagIds: [...selectedIds, id] });
  };

  const toggleSinTag = () => {
    if (sinTagActive) {
      onChange({});
      return;
    }
    onChange({ sinTag: true });
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        role="group"
        aria-label="Filtro de tags"
        className="flex flex-wrap items-center gap-2 lg:justify-end"
      >
        {(tags ?? []).map((tag) => {
          const active = selectedIds.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              aria-pressed={active}
              onClick={() => toggleTag(tag.id)}
              className={cn(chipBaseClass, active ? chipActiveClass : chipIdleClass)}
            >
              <span
                aria-hidden="true"
                data-testid="tag-swatch"
                className="size-3 rounded-full ring-1 ring-inset ring-black/10"
                style={{ backgroundColor: tag.color }}
              />
              {tag.name}
            </button>
          );
        })}

        <button
          type="button"
          aria-pressed={sinTagActive}
          onClick={toggleSinTag}
          className={cn(chipBaseClass, sinTagActive ? chipActiveClass : chipIdleClass)}
        >
          <span
            aria-hidden="true"
            data-testid="tag-swatch"
            className="size-3 rounded-full border border-dashed border-gray-400 dark:border-gray-500"
          />
          Sin tag
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 lg:justify-end">
        <button
          type="button"
          onClick={onManage}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 dark:focus-visible:ring-gray-400 dark:focus-visible:ring-offset-gray-900"
        >
          Gestionar tags
        </button>

        <button
          type="button"
          onClick={() => onChange({})}
          disabled={!hasActiveFilter}
          className="rounded-md px-2 py-1.5 text-sm font-medium text-brand-700 hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:text-brand-400 dark:focus-visible:ring-brand-400 dark:focus-visible:ring-offset-gray-900"
        >
          Quitar filtro de tags
        </button>
      </div>
    </div>
  );
}
