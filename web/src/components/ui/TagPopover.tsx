import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TagIcon } from './icons';

export interface TagPopoverTag {
  id: number;
  name: string;
  color: string;
}

interface TagPopoverProps {
  tag: TagPopoverTag | null | undefined;
}

const POPOVER_MAX_WIDTH = 280;
const POPOVER_MIN_WIDTH = 80;
const VIEWPORT_MARGIN = 8;
const CLOSE_DELAY_MS = 180;
const EXIT_DURATION_MS = 160;

export function TagPopover({ tag }: TagPopoverProps) {
  if (!tag) return null;
  return <TagIconAnchor tag={tag} />;
}

function TagIconAnchor({ tag }: { tag: TagPopoverTag }) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const anchorRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);
  const unmountTimer = useRef<number | null>(null);

  const clearTimers = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    if (unmountTimer.current !== null) {
      window.clearTimeout(unmountTimer.current);
      unmountTimer.current = null;
    }
  };

  const show = () => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    clearTimers();
    setPosition({ top: rect.bottom + VIEWPORT_MARGIN, left: rect.left });
    if (open) {
      setVisible(true);
    } else {
      setOpen(true);
    }
  };

  const keepOpen = () => {
    clearTimers();
    setVisible(true);
  };

  const scheduleHide = () => {
    clearTimers();
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      setVisible(false);
      unmountTimer.current = window.setTimeout(() => {
        unmountTimer.current = null;
        setOpen(false);
      }, EXIT_DURATION_MS);
    }, CLOSE_DELAY_MS);
  };

  useEffect(
    () => () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
      if (unmountTimer.current !== null) window.clearTimeout(unmountTimer.current);
    },
    [],
  );

  useLayoutEffect(() => {
    if (!open) return;
    const anchor = anchorRef.current?.getBoundingClientRect();
    const popover = popoverRef.current;
    if (!anchor || !popover) return;

    const width = popover.offsetWidth;
    const height = popover.offsetHeight;
    const maxLeft = window.innerWidth - width - VIEWPORT_MARGIN;
    const left = Math.min(
      Math.max(VIEWPORT_MARGIN, anchor.left),
      Math.max(VIEWPORT_MARGIN, maxLeft),
    );
    const below = anchor.bottom + VIEWPORT_MARGIN;
    const above = anchor.top - height - VIEWPORT_MARGIN;
    const top = below + height > window.innerHeight ? Math.max(VIEWPORT_MARGIN, above) : below;

    setPosition((current) =>
      current.top === top && current.left === left ? current : { top, left },
    );

    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [open, tag.name]);

  return (
    <>
      <span
        ref={anchorRef}
        tabIndex={0}
        role="img"
        aria-label={`Tag: ${tag.name}`}
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
        onFocus={show}
        onBlur={scheduleHide}
        style={{ color: tag.color }}
        className="inline-flex cursor-help transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <TagIcon />
      </span>
      {open
        ? createPortal(
            <div
              ref={popoverRef}
              role="tooltip"
              onMouseEnter={keepOpen}
              onMouseLeave={scheduleHide}
              style={{
                top: position.top,
                left: position.left,
                minWidth: POPOVER_MIN_WIDTH,
                maxWidth: POPOVER_MAX_WIDTH,
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0) scale(1)' : 'translateY(-4px) scale(0.98)',
              }}
              className="fixed z-50 max-h-48 w-fit origin-top-left overflow-y-auto overflow-x-hidden break-words rounded-md bg-gray-900 px-3 py-2 text-xs text-white shadow-lg transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none dark:bg-gray-100 dark:text-gray-900"
            >
              <span className="flex items-center gap-2">
                <span
                  data-testid="tag-color-swatch"
                  aria-hidden="true"
                  style={{ backgroundColor: tag.color }}
                  className="size-3 shrink-0 rounded-full"
                />
                <span>{tag.name}</span>
              </span>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
