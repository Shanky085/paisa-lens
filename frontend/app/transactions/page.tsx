"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Activity, ArrowLeft, CalendarDays, CheckCircle2, CircleAlert, Filter,
  LayoutDashboard, LoaderCircle, Pencil, Search, Sparkles, Target, Trash2,
  Wallet, X,
} from "lucide-react";
import { apiRequest, type TransactionCreate } from "@/lib/api";

type Transaction = TransactionCreate & {
  id: number;
  created_at: string;
  note?: string | null;
};

type TransactionUpdate = Partial<Omit<TransactionCreate, "note">> & {
  note?: string | null;
};

const money = (value: string | number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value));

const dateLabel = (value: string) =>
  new Date(value + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const CATEGORIES = [
  "Food & dining", "Education", "Transport", "Essentials", "Shopping",
  "Entertainment", "Allowance", "Stipend", "Other",
];

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [category, setCategory] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ limit: "200", offset: "0" });
    if (kind) params.set("kind", kind);
    if (category) params.set("category", category);
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);

    try {
      const data = await apiRequest<Transaction[]>(
        "/transactions?" + params.toString(),
      );
      setTransactions(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load transactions.",
      );
    } finally {
      setLoading(false);
    }
  }, [kind, category, startDate, endDate]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const visibleTransactions = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return transactions;
    return transactions.filter((item) =>
      [item.title, item.category, item.note ?? ""]
        .some((value) => value.toLocaleLowerCase().includes(term)),
    );
  }, [transactions, search]);

  const availableCategories = useMemo(
    () => Array.from(new Set([...CATEGORIES, ...transactions.map((item) => item.category)])).sort((a, b) => a.localeCompare(b)),
    [transactions],
  );

  const totals = useMemo(() => {
    return visibleTransactions.reduce(
      (result, item) => {
        if (item.kind === "income") result.income += Number(item.amount);
        else result.expenses += Number(item.amount);
        return result;
      },
      { income: 0, expenses: 0 },
    );
  }, [visibleTransactions]);

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    const payload: TransactionUpdate = {
      title: String(form.get("title") ?? "").trim(),
      amount: String(form.get("amount") ?? ""),
      kind: String(form.get("kind") ?? "expense") as "income" | "expense",
      category: String(form.get("category") ?? "Other"),
      transaction_date: String(form.get("transaction_date") ?? ""),
      note: String(form.get("note") ?? "").trim() || null,
    };

    setSaving(true);
    setError("");
    try {
      await apiRequest<Transaction>(
        "/transactions/" + editing.id,
        { method: "PATCH", body: JSON.stringify(payload) },
      );
      setEditing(null);
      setNotice("Transaction updated.");
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update transaction.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: Transaction) {
    const confirmed = window.confirm(
      "Delete “" + item.title + "” (" + money(item.amount) + ")? This cannot be undone.",
    );
    if (!confirmed) return;

    setDeletingId(item.id);
    setError("");
    try {
      await apiRequest<void>("/transactions/" + item.id, { method: "DELETE" });
      setNotice("Transaction deleted.");
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not delete transaction.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  function clearFilters() {
    setSearch("");
    setKind("");
    setCategory("");
    setStartDate("");
    setEndDate("");
  }

  const hasFilters = Boolean(search || kind || category || startDate || endDate);

  return (
    <main className="shell">
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span className="brand-icon"><Activity /></span>Paisa<span>Lens</span>
        </Link>
        <p className="nav-caption">WORKSPACE</p>
        <Link className="nav" href="/"><LayoutDashboard /> Overview</Link>
        <Link className="nav active" href="/transactions"><Wallet /> Transactions</Link>
        <Link className="nav" href="/#goal-mode"><Target /> Goal mode</Link>
        <Link className="nav" href="/#insights"><Sparkles /> AI insights</Link>
        <div className="side-note">
          <Sparkles />
          <b>Know where it goes.</b>
          <p>Every transaction adds context to your financial picture.</p>
        </div>
        <div className="profile">
          <div className="avatar">S</div>
          <div><b>Student account</b><small>Local demo workspace</small></div>
        </div>
      </aside>

      <section className="main transactions-main">
        <header className="topbar">
          <span>Workspace / <b>Transactions</b></span>
          <div><span className="demo">● {error ? "API ISSUE" : loading && transactions.length === 0 ? "CONNECTING" : "API CONNECTED"}</span><span className="date">Transaction ledger</span></div>
        </header>

        <section className="welcome transactions-welcome">
          <div>
            <small className="eyebrow">YOUR MONEY, LINE BY LINE</small>
            <h1>Transaction <em>history.</em></h1>
            <p>Search, review and correct the activity behind your financial snapshot.</p>
          </div>
          <Link className="back-link" href="/"><ArrowLeft size={16} /> Back to overview</Link>
        </section>

        {notice && (
          <div className="notice">
            <CheckCircle2 size={16} />{notice}
            <button aria-label="Dismiss notice" onClick={() => setNotice("")}><X size={15} /></button>
          </div>
        )}
        {error && (
          <div className="alert">
            <CircleAlert size={17} /><span>{error}</span>
            <button onClick={() => void refresh()}>Retry</button>
          </div>
        )}

        <section className="transaction-summary">
          <article className="glass ledger-stat">
            <span>Visible entries</span>
            <strong>{loading && transactions.length === 0 ? "—" : visibleTransactions.length}</strong>
            <small>{hasFilters ? "Matching current filters" : "Latest 200 records"}</small>
          </article>
          <article className="glass ledger-stat">
            <span>Income in view</span>
            <strong className="income">{money(totals.income)}</strong>
            <small>Based on visible entries</small>
          </article>
          <article className="glass ledger-stat">
            <span>Expenses in view</span>
            <strong className="expense">{money(totals.expenses)}</strong>
            <small>Based on visible entries</small>
          </article>
        </section>

        <section className="glass ledger-panel">
          <div className="ledger-heading">
            <div><small>LEDGER</small><h2>All transactions</h2><p>Filters are applied to the API results; search checks descriptions and notes.</p></div>
            <span className="ledger-count"><Wallet size={14} /> {visibleTransactions.length} shown</span>
          </div>

          <div className="filter-toolbar">
            <label className="search-field">
              <Search size={17} />
              <input
                aria-label="Search transactions"
                placeholder="Search description, category or note…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {search && <button aria-label="Clear search" onClick={() => setSearch("")}><X size={15} /></button>}
            </label>
            <label className="filter-field">
              <Filter size={15} />
              <select aria-label="Filter by type" value={kind} onChange={(event) => setKind(event.target.value)}>
                <option value="">All types</option>
                <option value="expense">Expenses</option>
                <option value="income">Income</option>
              </select>
            </label>
            <label className="filter-field">
              <select aria-label="Filter by category" value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="">All categories</option>
                {availableCategories.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          </div>

          <div className="date-filters">
            <label><CalendarDays size={15} /><span>From</span><input aria-label="Start date" type="date" value={startDate} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} /></label>
            <label><CalendarDays size={15} /><span>To</span><input aria-label="End date" type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} /></label>
            {hasFilters && <button className="clear-filters" onClick={clearFilters}>Clear filters</button>}
          </div>

          <div className="ledger-table-wrap">
            <table className="ledger-table">
              <thead>
                <tr><th>Description</th><th>Category</th><th>Date</th><th>Type</th><th className="amount-cell">Amount</th><th className="actions-heading">Actions</th></tr>
              </thead>
              <tbody>
                {visibleTransactions.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="ledger-title">{item.title}</div>
                      {item.note && <div className="ledger-note">{item.note}</div>}
                    </td>
                    <td><span className="category-chip">{item.category}</span></td>
                    <td className="ledger-date">{dateLabel(item.transaction_date)}</td>
                    <td><span className={"kind-chip " + item.kind}>{item.kind === "income" ? "Income" : "Expense"}</span></td>
                    <td className={"amount-cell ledger-amount " + item.kind}>{item.kind === "income" ? "+" : "−"}{money(item.amount)}</td>
                    <td>
                      <div className="ledger-actions">
                        <button className="row-action" aria-label={"Edit " + item.title} title="Edit transaction" onClick={() => setEditing(item)}><Pencil size={15} /></button>
                        <button className="row-action delete-action" aria-label={"Delete " + item.title} title="Delete transaction" disabled={deletingId === item.id} onClick={() => void handleDelete(item)}>
                          {deletingId === item.id ? <LoaderCircle className="spin" size={15} /> : <Trash2 size={15} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {loading && transactions.length === 0 && <div className="ledger-empty"><LoaderCircle className="spin" size={20} /> Loading transactions…</div>}
            {!loading && !error && visibleTransactions.length === 0 && (
              <div className="ledger-empty">
                <Wallet size={22} />
                <b>{transactions.length === 0 ? "No transactions found" : "No matching transactions"}</b>
                <span>{transactions.length === 0 ? "Add a transaction from the overview to begin building your ledger." : "Try changing your search or clearing one of the filters."}</span>
                {hasFilters && <button className="secondary-button" onClick={clearFilters}>Clear all filters</button>}
              </div>
            )}
            {!loading && transactions.length === 200 && (
              <p className="ledger-limit">Showing the latest 200 matching records. Narrow the date range to inspect a smaller period.</p>
            )}
          </div>
        </section>

        <footer>PAISALENS · EDITS UPDATE YOUR LEDGER · DELETIONS ARE PERMANENT</footer>
      </section>

      {editing && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setEditing(null); }}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-transaction-title">
            <div className="modal-head">
              <div><small>LEDGER CORRECTION</small><h2 id="edit-transaction-title">Edit transaction</h2></div>
              <button className="icon-button" aria-label="Close dialog" onClick={() => setEditing(null)}><X size={18} /></button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <label className="field">Description<input name="title" required maxLength={140} defaultValue={editing.title} /></label>
              <div className="form-grid">
                <label className="field">Amount (₹)<input name="amount" type="number" min="0.01" step="0.01" required defaultValue={editing.amount} /></label>
                <label className="field">Type<select name="kind" defaultValue={editing.kind}><option value="expense">Expense</option><option value="income">Income</option></select></label>
              </div>
              <div className="form-grid">
                <label className="field">Category<select name="category" defaultValue={editing.category}>
                  {CATEGORIES.map((item) => <option key={item}>{item}</option>)}
                  {!CATEGORIES.includes(editing.category) && <option>{editing.category}</option>}
                </select></label>
                <label className="field">Date<input name="transaction_date" type="date" required defaultValue={editing.transaction_date} /></label>
              </div>
              <label className="field">Note (optional)<input name="note" maxLength={500} defaultValue={editing.note ?? ""} placeholder="Add a short note" /></label>
              <button className="submit-button" disabled={saving}>
                {saving ? <LoaderCircle className="spin" size={16} /> : <CheckCircle2 size={16} />}
                Save changes
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
