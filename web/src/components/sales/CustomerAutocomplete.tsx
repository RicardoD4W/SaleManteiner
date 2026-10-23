import { useEffect, useId, useRef, useState } from 'react';
import { useCustomers } from '../../hooks/useCustomers';
import { useCreateCustomer } from '../../hooks/useCreateCustomer';

import { Spinner } from '../ui/Spinner';
import type { Customer } from '../../schemas/customers';

interface CustomerAutocompleteProps {
  value: Customer | null;

  onChange: (customer: Customer | null) => void;

  label?: string;

  error?: string;

  placeholder?: string;
}

export function CustomerAutocomplete({
  value,
  onChange,
  label = 'Cliente *',
  error,
  placeholder = 'Nombre del cliente…',
}: CustomerAutocompleteProps) {
  const { data: customers, isLoading } = useCustomers();
  const createCustomer = useCreateCustomer();

  const [inputValue, setInputValue] = useState(value?.name ?? '');
  const [isOpen, setIsOpen] = useState(false);

  const [activeIndex, setActiveIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInputValue(value?.name ?? '');
  }, [value]);

  const filtered = (customers ?? []).filter((c) =>
    c.name.toLowerCase().startsWith(inputValue.toLowerCase()),
  );

  const exactMatch = filtered.find((c) => c.name.toLowerCase() === inputValue.toLowerCase());

  const showCreateOption =
    inputValue.trim().length > 0 && !exactMatch && inputValue.trim().length <= 200;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    setActiveIndex(-1);
    setIsOpen(true);
  };

  const handleSelect = (customer: Customer) => {
    onChange(customer);
    setInputValue(customer.name);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleCreateCustomer = async () => {
    const name = inputValue.trim();
    if (!name) return;
    try {
      const created = await createCustomer.mutateAsync({ name });
      onChange(created);
      setInputValue(created.name);
      setIsOpen(false);
      setActiveIndex(-1);
    } catch {
      return;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const totalOptions = filtered.length + (showCreateOption ? 1 : 0);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, totalOptions - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && isOpen) {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < filtered.length) {
        handleSelect(filtered[activeIndex]);
      } else if (showCreateOption && activeIndex === filtered.length) {
        void handleCreateCustomer();
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
    } else if (e.key === 'Tab') {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  const activeDescendant =
    activeIndex >= 0 && activeIndex < filtered.length
      ? `${listboxId}-option-${filtered[activeIndex].id}`
      : activeIndex === filtered.length
        ? `${listboxId}-create`
        : undefined;

  return (
    <div className="relative flex flex-col gap-1">
      {label ? (
        <label
          htmlFor="customer-autocomplete-input"
          className="text-sm font-medium text-gray-800 dark:text-gray-200"
        >
          {label}
        </label>
      ) : null}

      <div className="relative">
        <input
          ref={inputRef}
          id="customer-autocomplete-input"
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-activedescendant={activeDescendant}
          aria-invalid={!!error}
          aria-describedby={error ? `${listboxId}-error` : undefined}
          autoComplete="off"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setIsOpen(false)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={[
            'block w-full rounded-md border bg-white px-3 py-2 pr-10 text-sm text-gray-900',
            'placeholder:text-gray-400',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            'dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-400',
            error
              ? 'border-red-500 focus:border-red-500 focus:ring-red-200 dark:focus:ring-red-800'
              : 'border-gray-300 focus:border-brand-500 focus:ring-brand-100 dark:border-gray-700 dark:focus:border-brand-400 dark:focus:ring-brand-900',
          ].join(' ')}
        />

        {isLoading ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <Spinner size="sm" />
          </span>
        ) : (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </span>
        )}
      </div>

      {isOpen && (filtered.length > 0 || showCreateOption) && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label="Clientes"
          onMouseDown={(e) => e.preventDefault()}
          className={[
            'absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-auto rounded-lg border',
            'bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800',
            'divide-y divide-gray-100 dark:divide-gray-700',
          ].join(' ')}
        >
          {filtered.map((customer, idx) => (
            <li
              key={customer.id}
              id={`${listboxId}-option-${customer.id}`}
              role="option"
              aria-selected={value?.id === customer.id}
              onClick={() => handleSelect(customer)}
              className={[
                'cursor-pointer px-3 py-2 text-sm',
                activeIndex === idx
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                  : 'text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700',
                value?.id === customer.id ? 'font-medium text-brand-700 dark:text-brand-300' : '',
              ].join(' ')}
            >
              {customer.name}
            </li>
          ))}

          {showCreateOption && (
            <li
              id={`${listboxId}-create`}
              role="option"
              aria-selected={false}
              onClick={() => void handleCreateCustomer()}
              className={[
                'cursor-pointer px-3 py-2 text-sm',
                activeIndex === filtered.length
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                  : 'text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700',
                'flex items-center gap-2 border-t border-gray-100 dark:border-gray-700',
              ].join(' ')}
            >
              <svg
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span className="font-medium text-brand-700 dark:text-brand-300">
                Crear cliente &quot;{inputValue.trim()}&quot;
              </span>
            </li>
          )}
        </ul>
      )}

      {error ? (
        <p
          id={`${listboxId}-error`}
          className="text-sm text-red-600 dark:text-red-400"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {createCustomer.isPending && (
        <p className="text-sm text-gray-500 dark:text-gray-400">Creando cliente…</p>
      )}
    </div>
  );
}
