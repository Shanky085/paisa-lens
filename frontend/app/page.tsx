"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Activity, ArrowDownRight, ArrowUpRight, Bell, BookOpen,
  CheckCircle2, CircleAlert, Coffee, Home, LayoutDashboard, LoaderCircle,
  PiggyBank, Plus, Settings2, Sparkles, Target, Wallet, X,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis,
} from "recharts";
import {
  apiRequest, type DashboardSummary, type TransactionCreate,
} from "@/lib/api";

const money = (value: string | number | null | undefined) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(Number(value ?? 0));

const monthLabel = (period: string) => {
  const [year, month] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" })
    .format(new Date(year, month - 1, 1));
};

function Metric({
  title, value, sub, icon: Icon,
}: {
  title: string; value: string; sub: string; icon: typeof Wallet;
}) {
  return (
    <article className="glass metric">
      <div className="metric-label">{title}<Icon size={18} /></div>
      <strong>{value}</strong>
      <small>{sub}</small>
    </article>
  );
}

function categoryIcon(category: string) {
  if (/food|dining|cafe|mess/i.test(category)) return Coffee;
  if (/education|book|course/i.test(category)) return BookOpen;
  if (/hostel|home|essential/i.test(category)) return Home;
  return Wallet;
}

export default function Dashboard() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const period = `${year}-${String(month).padStart(2, "0")}`;

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<"transaction" | "budget" | null>(null);
  const [notice, setNotice] = useState("");
  const localToday = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest<DashboardSummary>(
        `/dashboard/summary?year=${year}&month=${month}`,
      );
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const chartData = useMemo(
    () => (summary?.daily_spending ?? []).map((item) => ({
      day: String(item.day).padStart(2, "0"),
      spend: Number(item.amount),
    })),
    [summary],
  );

  async function handleTransactionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload: TransactionCreate = {
      title: String(form.get("title") ?? "").trim(),
      amount: String(form.get("amount") ?? ""),
      kind: String(form.get("kind") ?? "expense") as "income" | "expense",
      category: String(form.get("category") ?? "Other"),
      transaction_date: String(form.get("transaction_date") ?? ""),
      note: String(form.get("note") ?? "").trim() || undefined,
    };
    setSaving(true);
    setError("");
    try {
      await apiRequest("/transactions", {
        method: "POST", body: JSON.stringify(payload),
      });
      setDialog(null);
      setNotice("Transaction saved.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save transaction.");
    } finally {
      setSaving(false);
    }
  }

  async function handleBudgetSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    try {
      await apiRequest(`/budgets/${year}/${month}`, {
        method: "PUT",
        body: JSON.stringify({ amount: String(form.get("amount") ?? "0") }),
      });
      setDialog(null);
      setNotice("Monthly budget updated.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save budget.");
    } finally {
      setSaving(false);
    }
  }

  const utilization = Math.min(Math.max(summary?.budget_utilization ?? 0, 0), 100);
  const budgetConfigured = summary?.monthly_budget !== null && summary?.monthly_budget !== undefined;

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-icon"><Activity /></span>Paisa<span>Lens</span></div>
        <p className="nav-caption">WORKSPACE</p>
        <a className="nav active" href="#"><LayoutDashboard /> Overview</a>
        <a className="nav" href="#transactions"><Wallet /> Transactions</a>
        <a className="nav" href="#goal-mode"><Target /> Goal mode</a>
        <a className="nav" href="#insights"><Sparkles /> AI insights</a>
        <p className="nav-caption">PREFERENCES</p>
        <a className="nav" href="#settings"><Settings2 /> Settings</a>
        <div className="side-note"><Sparkles /><b>Small steps add up.</b><p>Your financial clarity journey starts with one good decision.</p></div>
        <div className="profile"><div className="avatar">S</div><div><b>Student account</b><small>Local demo workspace</small></div></div>
      </aside>

      <section className="main">
        <header className="topbar">
          <span>Workspace / <b>Overview</b></span>
          <div><span className="demo">● {error ? "API ISSUE" : summary ? "API CONNECTED" : "CONNECTING"}</span><Bell size={18} /><span className="date">{monthLabel(period)}</span></div>
        </header>

        <section className="welcome">
          <div><small className="eyebrow">YOUR FINANCIAL SNAPSHOT</small><h1>Your money, <em>in focus.</em></h1><p>Here&apos;s what is happening with your finances this month.</p></div>
          <button onClick={() => { setError(""); setDialog("transaction"); }}><Plus size={17} /> Add transaction</button>
        </section>

        {notice && <div className="notice"><CheckCircle2 size={16} />{notice}<button aria-label="Dismiss notice" onClick={() => setNotice("")}><X size={15} /></button></div>}
        {error && <div className="alert"><CircleAlert size={17} /><span>{error}</span><button onClick={() => void refresh()}>Retry</button></div>}

        <div className="metrics">
          <Metric title="Total income" value={summary ? money(summary.income) : "—"} sub={summary ? "Recorded income this month" : "Waiting for API data"} icon={ArrowDownRight} />
          <Metric title="Total expenses" value={summary ? money(summary.expenses) : "—"} sub={summary ? `${summary.transaction_count} recorded transactions` : "Waiting for API data"} icon={ArrowUpRight} />
          <Metric title="Net cash flow" value={summary ? money(summary.net_cash_flow) : "—"} sub={summary ? "Income minus expenses" : "Waiting for API data"} icon={Activity} />
          <Metric title="Budget remaining" value={!summary ? "—" : !budgetConfigured ? "Not set" : money(summary.budget_remaining)} sub={budgetConfigured ? `${summary?.budget_utilization ?? 0}% of budget used` : summary ? "Set a monthly limit" : "Waiting for API data"} icon={PiggyBank} />
        </div>

        <div className="panels">
          <article className="glass panel">
            <div className="panel-head"><div><small>YOUR CASH FLOW</small><h2>Spending overview</h2><p>Daily expense totals from saved transactions</p></div><span className="date">{monthLabel(period)}</span></div>
            <div className="chart-total">{summary ? money(summary.expenses) : "—"} <small>total spent</small></div>
            <div className="chart">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ad91ff" stopOpacity={.35} /><stop offset="100%" stopColor="#ad91ff" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid stroke="#ffffff12" vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: "#85839b", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(value) => money(Number(value))} contentStyle={{ background: "#201d30", border: "1px solid #49425f", borderRadius: 12 }} />
                    <Area dataKey="spend" stroke="#b69cff" strokeWidth={2.5} fill="url(#fill)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <div className="empty-chart">{loading ? <LoaderCircle className="spin" /> : error ? "Spending data is unavailable until the API reconnects." : "No expenses recorded for this month yet."}</div>}
            </div>
          </article>

          <article className="glass panel budget">
            <small>SPENDING LIMIT</small><h2>Monthly budget</h2><p>Set the limit you want to stay within</p>
            <div className="ring" style={{ background: `conic-gradient(#b49aff 0 ${utilization}%, #ffffff14 ${utilization}% 100%)` }}>
              <div><b>{budgetConfigured ? `${summary?.budget_utilization ?? 0}%` : "—"}</b><small>used so far</small></div>
            </div>
            <div className="budget-values"><span>Spent <b>{money(summary?.expenses)}</b></span><span>Limit <b>{budgetConfigured ? money(summary?.monthly_budget) : "Not set"}</b></span></div>
            <div className="progress"><i style={{ width: `${utilization}%` }} /></div>
            <p className={budgetConfigured && Number(summary?.budget_remaining) < 0 ? "warning-text" : "success"}>
              {budgetConfigured ? (Number(summary?.budget_remaining) < 0 ? "● You are over your monthly limit." : "● You're within your monthly budget.") : "● A budget helps measure your spending pace."}
            </p>
            <button className="secondary-button" onClick={() => { setError(""); setDialog("budget"); }}>{budgetConfigured ? "Adjust budget" : "Set monthly budget"}</button>
          </article>
        </div>

        <div className="bottom-panels">
          <article className="glass panel" id="transactions">
            <small>RECENT ACTIVITY</small><h2>Latest transactions</h2>
            {(summary?.recent_transactions ?? []).length > 0 ? summary!.recent_transactions.map((item) => {
              const Icon = categoryIcon(item.category);
              return <div className="transaction" key={item.id}><div className="tx-icon"><Icon size={17} /></div><div className="tx-copy"><b>{item.title}</b><small>{item.category} · {new Date(item.transaction_date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</small></div><strong className={item.kind}>{item.kind === "income" ? "+" : "−"}{money(item.amount)}</strong></div>;
            }) : <div className="empty-state">{loading ? "Loading transactions…" : error ? "Transaction data is unavailable until the API reconnects." : "No transactions yet. Add your first entry to get started."}</div>}
          </article>

          <article className="glass panel categories" id="insights">
            <small>WHERE YOUR MONEY GOES</small><h2>Spending categories</h2>
            {(summary?.category_breakdown ?? []).length > 0 ? summary!.category_breakdown.slice(0, 5).map((item) => {
              const share = Number(summary?.expenses) > 0 ? Number(item.amount) / Number(summary?.expenses) * 100 : 0;
              return <div className="category-row" key={item.category}><div><span>{item.category}</span><b>{money(item.amount)}</b></div><div className="category-bar"><i style={{ width: `${share}%` }} /></div><small>{share.toFixed(1)}% of expenses</small></div>;
            }) : <div className="empty-state">{loading ? "Loading categories…" : error ? "Category data is unavailable until the API reconnects." : "Category insights appear after you add expenses."}</div>}
          </article>
        </div>

        <article className="glass panel goal-panel" id="goal-mode">
          <div className="goal-icon"><Target size={23} /></div><div><small>COMING IN THE NEXT MILESTONE</small><h2>Goal mode</h2><p>Plan savings toward a target date with fixed daily spending limits and no allowance rollover.</p></div><span className="coming-soon">IN DEVELOPMENT</span>
        </article>
        <footer>PAISALENS · YOUR DATA IS STORED IN YOUR CONFIGURED BACKEND · FINANCIAL CLARITY, ONE DECISION AT A TIME</footer>
      </section>

      {dialog && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setDialog(null); }}>
        <section className="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
          <div className="modal-head"><div><small>{dialog === "transaction" ? "TRANSACTION ENTRY" : "MONTHLY PLAN"}</small><h2 id="dialog-title">{dialog === "transaction" ? "Add transaction" : "Set monthly budget"}</h2></div><button className="icon-button" aria-label="Close dialog" onClick={() => setDialog(null)}><X size={18} /></button></div>
          {dialog === "transaction" ? (
            <form onSubmit={handleTransactionSubmit}>
              <label className="field">Description<input name="title" required maxLength={140} placeholder="e.g. Hostel mess" /></label>
              <div className="form-grid">
                <label className="field">Amount (₹)<input name="amount" type="number" min="0.01" step="0.01" required placeholder="850" /></label>
                <label className="field">Type<select name="kind"><option value="expense">Expense</option><option value="income">Income</option></select></label>
              </div>
              <div className="form-grid">
                <label className="field">Category<select name="category"><option>Food & dining</option><option>Education</option><option>Transport</option><option>Essentials</option><option>Shopping</option><option>Entertainment</option><option>Allowance</option><option>Stipend</option><option>Other</option></select></label>
                <label className="field">Date<input name="transaction_date" type="date" required defaultValue={localToday} /></label>
              </div>
              <label className="field">Note (optional)<input name="note" maxLength={500} placeholder="Add a short note" /></label>
              <button className="submit-button" disabled={saving}>{saving ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />} Save transaction</button>
            </form>
          ) : (
            <form onSubmit={handleBudgetSubmit}>
              <p className="modal-description">This sets your total spending limit for {monthLabel(period)}. It does not automatically change your income or savings.</p>
              <label className="field">Monthly spending limit (₹)<input name="amount" type="number" min="0" step="0.01" required defaultValue={summary?.monthly_budget ?? ""} placeholder="12000" /></label>
              <button className="submit-button" disabled={saving}>{saving ? <LoaderCircle className="spin" size={16} /> : <CheckCircle2 size={16} />} Save budget</button>
            </form>
          )}
        </section>
      </div>}
    </main>
  );
}
