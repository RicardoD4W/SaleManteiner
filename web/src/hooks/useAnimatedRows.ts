import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MOTION_MS, prefersReducedMotion } from '../lib/motion';

export type RowAnimationKind = 'in' | 'out';

interface RowAnimationEntry<T> {
  kind: RowAnimationKind;
  item: T;
}

interface AnimatedRowsState<T> {
  ids: string;
  items: T[];
  previousItems: T[];
  generation: string;
  animations: Map<number, RowAnimationEntry<T>>;
}

export interface AnimatedRows<T> {
  rows: T[];
  rowClassName: (id: number) => string | undefined;
  rowKey: (id: number) => string;
}

function idsKey<T extends { id: number }>(items: T[]): string {
  return items.map((item) => item.id).join(',');
}

export function useAnimatedRows<T extends { id: number }>(
  items: T[],
  generation = '',
): AnimatedRows<T> {
  const [state, setState] = useState<AnimatedRowsState<T>>(() => {
    const animations = new Map<number, RowAnimationEntry<T>>();
    for (const item of items) animations.set(item.id, { kind: 'in', item });
    return {
      ids: idsKey(items),
      items,
      previousItems: items,
      generation,
      animations,
    };
  });

  const ids = idsKey(items);

  if (ids !== state.ids) {
    const currentIds = new Set(items.map((item) => item.id));
    const animations = new Map(state.animations);
    const generationChanged = generation !== state.generation;

    if (generationChanged) {
      for (const item of items) animations.set(item.id, { kind: 'in', item });
    } else {
      for (const item of items) {
        if (!state.items.some((previous) => previous.id === item.id)) {
          animations.set(item.id, { kind: 'in', item });
        }
      }
    }

    for (const previous of state.items) {
      if (!currentIds.has(previous.id)) {
        animations.set(previous.id, { kind: 'out', item: previous });
      }
    }

    setState({
      ids,
      items,
      previousItems: state.items,
      generation,
      animations,
    });
  }

  const deadlinesRef = useRef(new Map<number, { entry: RowAnimationEntry<T>; deadline: number }>());

  useEffect(() => {
    const deadlines = deadlinesRef.current;
    const now = Date.now();
    const duration = prefersReducedMotion() ? 0 : MOTION_MS;

    for (const id of deadlines.keys()) {
      if (!state.animations.has(id)) deadlines.delete(id);
    }

    for (const [id, entry] of state.animations) {
      const existing = deadlines.get(id);
      if (!existing || existing.entry !== entry) {
        deadlines.set(id, { entry, deadline: now + duration });
      }
    }

    if (state.animations.size === 0) return;

    let earliest = Infinity;
    for (const { deadline } of deadlines.values()) {
      if (deadline < earliest) earliest = deadline;
    }

    const timer = setTimeout(
      () => {
        const current = Date.now();
        for (const [id, { deadline }] of deadlines) {
          if (deadline <= current) deadlines.delete(id);
        }
        setState((previous) => {
          const animations = new Map(previous.animations);
          for (const [id, entry] of animations) {
            const deadline = deadlines.get(id);
            if (!deadline || deadline.entry !== entry) animations.delete(id);
          }
          return { ...previous, animations };
        });
      },
      Math.max(0, earliest - Date.now()),
    );

    return () => clearTimeout(timer);
  }, [state.animations]);

  const rows = useMemo(() => {
    const merged = [...items];
    const previousIndex = new Map<number, number>();
    state.previousItems.forEach((item, index) => previousIndex.set(item.id, index));

    const exiting = Array.from(state.animations.values())
      .filter((entry) => entry.kind === 'out')
      .sort((a, b) => (previousIndex.get(a.item.id) ?? 0) - (previousIndex.get(b.item.id) ?? 0));

    for (const entry of exiting) {
      const at = Math.min(previousIndex.get(entry.item.id) ?? merged.length, merged.length);
      merged.splice(at, 0, entry.item);
    }

    return merged;
  }, [items, state.previousItems, state.animations]);

  const rowClassName = useCallback(
    (id: number) => {
      const animation = state.animations.get(id);
      if (!animation) return undefined;
      return animation.kind === 'out' ? 'animate-row-out' : 'animate-row-in';
    },
    [state.animations],
  );

  const rowKey = useCallback(
    (id: number) => (state.generation ? `${state.generation}:${id}` : String(id)),
    [state.generation],
  );

  return { rows, rowClassName, rowKey };
}
