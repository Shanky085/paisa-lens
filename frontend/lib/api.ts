"use client";

export const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"
).replace(/\/+$/, "");

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(API_BASE + path, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      cache: "no-store",
    });
  } catch {
    throw new Error(
      "Could not reach the PaisaLens API. Check that the backend is running and the API URL is correct.",
    );
  }

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      payload && typeof payload.detail === "string"
        ? payload.detail
        : "Request failed with status " + response.status;
    throw new Error(detail);
  }

  return payload as T;
}

export type DailySpending = { date: string; day: number; amount: string };
export type CategorySpending = { category: string; amount: string };
export type RecentTransaction = {
  id: number;
  title: string;
  amount: string;
  kind: "income" | "expense";
  category: string;
  transaction_date: string;
};

export type DashboardSummary = {
  period: string;
  income: string;
  expenses: string;
  net_cash_flow: string;
  transaction_count: number;
  monthly_budget: string | null;
  budget_remaining: string | null;
  budget_utilization: number | null;
  daily_spending: DailySpending[];
  category_breakdown: CategorySpending[];
  recent_transactions: RecentTransaction[];
};

export type TransactionCreate = {
  title: string;
  amount: string;
  kind: "income" | "expense";
  category: string;
  transaction_date: string;
  note?: string | null;
};

export type TransactionRecord = TransactionCreate & {
  id: number;
  created_at: string;
};

export type TransactionUpdate = Partial<TransactionCreate>;
