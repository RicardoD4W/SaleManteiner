import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface NotesPopoverProps {
  notes: string | null | undefined;
}

const POPOVER_WIDTH = 280;
const POPOVER_MAX_HEIGHT = 200;

export function NotesPopover({ notes }: NotesPopoverProps) {
  const text = notes?.trim();
  if (!text) return null;
  return <NotesIcon text={text} />;
}

function NotesIcon({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const anchorRef = useRef<HTMLSpanElement>(null);

  const show = () => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - POPOVER_WIDTH - 8);
    const below = rect.bottom + 8;
    const above = rect.top - POPOVER_MAX_HEIGHT - 8;
    setPosition({ top: below + POPOVER_MAX_HEIGHT > window.innerHeight ? above : below, left });
    setOpen(true);
  };

  const hide = () => setOpen(false);

  return (
    <>
      <span
        ref={anchorRef}
        tabIndex={0}
        role="img"
        aria-label={`Notas: ${text}`}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="inline-flex cursor-help text-gray-400 transition-colors hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-gray-500 dark:hover:text-gray-300"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="size-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
          />
        </svg>
      </span>
      {open
        ? createPortal(
            <div
              role="tooltip"
              style={{ top: position.top, left: position.left, width: POPOVER_WIDTH }}
              className="fixed z-50 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md bg-gray-900 px-3 py-2 text-xs text-white shadow-lg dark:bg-gray-100 dark:text-gray-900"
            >
              {text}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
