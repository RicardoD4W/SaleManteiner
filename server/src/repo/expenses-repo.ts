import type { Database } from 'better-sqlite3';
import { definedOnly } from '../lib/defined-only.js';
import { round2 } from '../lib/round.js';
import type { AssociatedExpense, CascadeResult } from './types.js';
import type {
  CreateExpenseCategoryInput,
  CreateExpenseInput,
  ExpenseCategory,
  ExpenseCategoryWithMetrics,
  ExpenseWithCategory,
  UpdateExpenseCategoryInput,
  UpdateExpenseInput,
} from '../schemas/expenses.js';

export interface ExpenseListFilters {
  categoryId?: number;
}

export interface ExpenseRow {
  id: number;
  concept: string;
  amount: number;
  category_id: number;
  category_name: string;
  expense_date: string;
  created_at: string;
}

export interface ExpenseCategoryRow {
  id: number;
  name: string;
  created_at: string;
}

export interface ExpenseCategoryMetricsRow extends ExpenseCategoryRow {
  expenses_count: number;
  total_amount: number;
}

export class UnknownExpenseCategoryError extends Error {
  readonly error = 'La categoría de gasto no existe';

  constructor() {
    super('La categoría de gasto no existe');
    this.name = 'UnknownExpenseCategoryError';
  }
}

export class DuplicateExpenseCategoryError extends Error {
  readonly error = 'Ya existe una categoría de gasto con ese nombre';

  constructor() {
    super('Ya existe una categoría de gasto con ese nombre');
    this.name = 'DuplicateExpenseCategoryError';
  }
}

export type RemoveExpenseCategoryResult =
  | { ok: true }
  | { ok: false; code: 'NOT_FOUND' }
  | { ok: false; code: 'HAS_EXPENSES'; expenses_count: number; expenses: AssociatedExpense[] };

export interface ExpensesRepo {
  create(input: CreateExpenseInput): ExpenseWithCategory;
  getById(id: number): ExpenseWithCategory | null;
  list(filters?: ExpenseListFilters): ExpenseWithCategory[];
  total(filters?: ExpenseListFilters): number;
  update(id: number, input: UpdateExpenseInput): ExpenseWithCategory | null;
  remove(id: number): boolean;
}

export interface ExpenseCategoriesRepo {
  create(input: CreateExpenseCategoryInput): ExpenseCategoryWithMetrics;
  getById(id: number): ExpenseCategory | null;
  list(): ExpenseCategoryWithMetrics[];
  update(id: number, input: UpdateExpenseCategoryInput): ExpenseCategory | null;
  remove(id: number): RemoveExpenseCategoryResult;
  listAssociatedExpenses(id: number): AssociatedExpense[];
  removeWithCascade(id: number): CascadeResult;
}

function rowToExpense(row: ExpenseRow): ExpenseWithCategory {
  return {
    id: row.id,
    concept: row.concept,
    amount: round2(row.amount),
    category_id: row.category_id,
    category_name: row.category_name,
    expense_date: row.expense_date,
    created_at: row.created_at,
  };
}

function rowToCategory(row: ExpenseCategoryRow): ExpenseCategory {
  return {
    id: row.id,
    name: row.name,
    created_at: row.created_at,
  };
}

function rowToCategoryWithMetrics(row: ExpenseCategoryMetricsRow): ExpenseCategoryWithMetrics {
  return {
    ...rowToCategory(row),
    expenses_count: row.expenses_count,
    total_amount: round2(row.total_amount),
  };
}

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Error && err.message.includes('UNIQUE constraint failed');
}

function isForeignKeyConstraintError(err: unknown): boolean {
  return err instanceof Error && err.message.includes('FOREIGN KEY constraint failed');
}

export function createExpensesRepo(db: Database): ExpensesRepo {
  const insertStmt = db.prepare(`
    INSERT INTO expenses (concept, amount, category_id, expense_date, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const getStmt = db.prepare(`
    SELECT e.id, e.concept, e.amount, e.category_id, c.name AS category_name, e.expense_date, e.created_at
    FROM expenses e
    JOIN expense_categories c ON c.id = e.category_id
    WHERE e.id = ?
  `);
  const listStmt = db.prepare(`
    SELECT e.id, e.concept, e.amount, e.category_id, c.name AS category_name, e.expense_date, e.created_at
    FROM expenses e
    JOIN expense_categories c ON c.id = e.category_id
    WHERE (? IS NULL OR e.category_id = ?)
    ORDER BY e.expense_date DESC, e.id DESC
  `);
  const totalStmt = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM expenses
    WHERE (? IS NULL OR category_id = ?)
  `);
  const deleteStmt = db.prepare('DELETE FROM expenses WHERE id = ?');
  const updateStmt = db.prepare(`
    UPDATE expenses SET
      concept = ?,
      amount = ?,
      category_id = ?,
      expense_date = ?
    WHERE id = ?
  `);
  const categoryExistsStmt = db.prepare('SELECT id FROM expense_categories WHERE id = ?');

  function assertCategoryExists(categoryId: number): void {
    const row = categoryExistsStmt.get(categoryId) as { id: number } | undefined;
    if (!row) throw new UnknownExpenseCategoryError();
  }

  function create(input: CreateExpenseInput): ExpenseWithCategory {
    assertCategoryExists(input.category_id);
    const now = new Date().toISOString();
    let result: { lastInsertRowid: number | bigint };
    try {
      result = insertStmt.run(
        input.concept,
        round2(input.amount),
        input.category_id,
        input.expense_date,
        now,
      );
    } catch (err) {
      if (isForeignKeyConstraintError(err)) throw new UnknownExpenseCategoryError();
      throw err;
    }
    const id = Number(result.lastInsertRowid);
    return rowToExpense(getStmt.get(id) as ExpenseRow);
  }

  function getById(id: number): ExpenseWithCategory | null {
    const row = getStmt.get(id) as ExpenseRow | undefined;
    return row ? rowToExpense(row) : null;
  }

  function list(filters?: ExpenseListFilters): ExpenseWithCategory[] {
    const categoryId = filters?.categoryId ?? null;
    const rows = listStmt.all(categoryId, categoryId) as ExpenseRow[];
    return rows.map(rowToExpense);
  }

  function total(filters?: ExpenseListFilters): number {
    const categoryId = filters?.categoryId ?? null;
    const row = totalStmt.get(categoryId, categoryId) as { total: number };
    return round2(row.total);
  }

  function update(id: number, input: UpdateExpenseInput): ExpenseWithCategory | null {
    const existing = getById(id);
    if (!existing) return null;

    const definedPatch = definedOnly(input);
    if (Object.keys(definedPatch).length === 0) return existing;

    const next = { ...existing, ...definedPatch };
    if (next.category_id !== existing.category_id) {
      assertCategoryExists(next.category_id);
    }

    try {
      updateStmt.run(next.concept, round2(next.amount), next.category_id, next.expense_date, id);
    } catch (err) {
      if (isForeignKeyConstraintError(err)) throw new UnknownExpenseCategoryError();
      throw err;
    }

    return getById(id);
  }

  function remove(id: number): boolean {
    return deleteStmt.run(id).changes > 0;
  }

  return {
    create,
    getById,
    list,
    total,
    update,
    remove,
  };
}

export function createExpenseCategoriesRepo(db: Database): ExpenseCategoriesRepo {
  const insertStmt = db.prepare(`
    INSERT INTO expense_categories (name, created_at) VALUES (?, ?)
  `);
  const getStmt = db.prepare('SELECT * FROM expense_categories WHERE id = ?');
  const getWithMetricsStmt = db.prepare(`
    SELECT c.id, c.name, c.created_at,
           COUNT(e.id) AS expenses_count,
           COALESCE(SUM(e.amount), 0) AS total_amount
    FROM expense_categories c
    LEFT JOIN expenses e ON e.category_id = c.id
    WHERE c.id = ?
    GROUP BY c.id
  `);
  const listStmt = db.prepare(`
    SELECT c.id, c.name, c.created_at,
           COUNT(e.id) AS expenses_count,
           COALESCE(SUM(e.amount), 0) AS total_amount
    FROM expense_categories c
    LEFT JOIN expenses e ON e.category_id = c.id
    GROUP BY c.id
    ORDER BY c.name COLLATE NOCASE
  `);
  const deleteStmt = db.prepare('DELETE FROM expense_categories WHERE id = ?');
  const updateStmt = db.prepare('UPDATE expense_categories SET name = ? WHERE id = ?');
  const countExpensesStmt = db.prepare(
    'SELECT COUNT(*) AS cnt FROM expenses WHERE category_id = ?',
  );
  const listAssociatedExpensesStmt = db.prepare(`
    SELECT id, concept, amount, expense_date
    FROM expenses
    WHERE category_id = ?
    ORDER BY id DESC
  `);
  const deleteExpensesStmt = db.prepare('DELETE FROM expenses WHERE category_id = ?');

  function create(input: CreateExpenseCategoryInput): ExpenseCategoryWithMetrics {
    const now = new Date().toISOString();
    try {
      const result = insertStmt.run(input.name, now);
      const id = Number(result.lastInsertRowid);
      const row = getWithMetricsStmt.get(id) as ExpenseCategoryMetricsRow | undefined;
      if (!row) throw new UnknownExpenseCategoryError();
      return rowToCategoryWithMetrics(row);
    } catch (err) {
      if (isUniqueConstraintError(err)) throw new DuplicateExpenseCategoryError();
      throw err;
    }
  }

  function getById(id: number): ExpenseCategory | null {
    const row = getStmt.get(id) as ExpenseCategoryRow | undefined;
    return row ? rowToCategory(row) : null;
  }

  function list(): ExpenseCategoryWithMetrics[] {
    const rows = listStmt.all() as ExpenseCategoryMetricsRow[];
    return rows.map(rowToCategoryWithMetrics);
  }

  function update(id: number, input: UpdateExpenseCategoryInput): ExpenseCategory | null {
    const existing = getById(id);
    if (!existing) return null;

    const definedPatch = definedOnly(input);
    if (Object.keys(definedPatch).length === 0) return existing;

    const next = { ...existing, ...definedPatch };
    try {
      updateStmt.run(next.name, id);
    } catch (err) {
      if (isUniqueConstraintError(err)) throw new DuplicateExpenseCategoryError();
      throw err;
    }
    return getById(id);
  }

  function listAssociatedExpenses(id: number): AssociatedExpense[] {
    const rows = listAssociatedExpensesStmt.all(id) as Array<{
      id: number;
      concept: string;
      amount: number;
      expense_date: string;
    }>;
    return rows.map((row) => ({ ...row, amount: round2(row.amount) }));
  }

  function remove(id: number): RemoveExpenseCategoryResult {
    return db.transaction((): RemoveExpenseCategoryResult => {
      const existing = getStmt.get(id) as ExpenseCategoryRow | undefined;
      if (!existing) return { ok: false, code: 'NOT_FOUND' };
      const row = countExpensesStmt.get(id) as { cnt: number };
      if (row.cnt > 0) {
        return {
          ok: false,
          code: 'HAS_EXPENSES',
          expenses_count: row.cnt,
          expenses: listAssociatedExpenses(id),
        };
      }
      deleteStmt.run(id);
      return { ok: true };
    })();
  }

  function removeWithCascade(id: number): CascadeResult {
    return db.transaction((): CascadeResult => {
      const existing = getStmt.get(id) as ExpenseCategoryRow | undefined;
      if (!existing) return { ok: false, code: 'NOT_FOUND' };
      deleteExpensesStmt.run(id);
      if (deleteStmt.run(id).changes === 0) return { ok: false, code: 'NOT_FOUND' };
      return { ok: true };
    })();
  }

  return {
    create,
    getById,
    list,
    update,
    remove,
    listAssociatedExpenses,
    removeWithCascade,
  };
}
