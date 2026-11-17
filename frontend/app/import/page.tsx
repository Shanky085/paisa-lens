"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import Link from "next/link";
import {
  Activity, ArrowLeft, ArrowRight, CheckCircle2, CircleAlert,
  FileSpreadsheet, FileUp, Info, LayoutDashboard, LoaderCircle,
  ShieldCheck, Sparkles, Target, UploadCloud, Wallet, X,
} from "lucide-react";
import {
  apiRequest,
  type TransactionCreate,
  type TransactionImportResult,
} from "@/lib/api";

type CsvRecord = { line: number; cells: string[] };
type CsvMapping = {
  date: string;
  title: string;
  amount: string;
  kind: string;
  debit: string;
  credit: string;
  category: string;
  note: string;
};
type FieldKey = keyof CsvMapping;
type PreviewRow = {
  line: number;
  transaction: TransactionCreate | null;
  error: string;
  suspectedTransfer: boolean;
  duplicateInFile: boolean;
};
type PendingImport = {
  transactions: TransactionCreate[];
  csvLines: number[];
  duplicateLines: number[];
};

const FIELD_LABELS: { key: FieldKey; label: string }[] = [
  { key: "date", label: "Transaction date" },
  { key: "title", label: "Description / narration" },
  { key: "amount", label: "Amount (single column)" },
  { key: "kind", label: "Type (income / expense / DR / CR)" },
  { key: "debit", label: "Debit amount" },
  { key: "credit", label: "Credit amount" },
  { key: "category", label: "Category" },
  { key: "note", label: "Note" },
];

const TRANSFER_PATTERN =
  /\b(self\s*transfer|self\s*a\/?c|own\s*a\/?c|own\s*account|between\s*own|transfer\s+to\s+self|internal\s+transfer)\b/i;

function parseCsv(source: string): string[][] {
  const input = source.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else if (char === "\r" && input[index + 1] === "\n") {
        cell += "\n";
        index += 1;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"' && cell.length === 0) {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
      if (char === "\r" && input[index + 1] === "\n") index += 1;
    } else {
      cell += char;
    }
  }

  if (quoted) throw new Error("The CSV contains an opening quote without a closing quote.");
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some((value) => value.trim() !== "")) rows.push(row);
  }

  return rows;
}

function detectColumn(headers: string[], patterns: RegExp[]): string {
  const index = headers.findIndex((header) =>
    patterns.some((pattern) => pattern.test(header.trim().toLowerCase())),
  );
  return index >= 0 ? String(index) : "";
}

function detectMapping(headers: string[]): CsvMapping {
  return {
    date: detectColumn(headers, [/^date\b/, /transaction date/, /txn date/, /value date/]),
    title: detectColumn(headers, [/description/, /narration/, /particulars/, /transaction details/, /^details$/, /^remarks$/]),
    amount: detectColumn(headers, [/^amount$/, /txn amount/, /transaction amount/]),
    kind: detectColumn(headers, [/transaction type/, /^type$/, /^dr\/cr$/, /^cr\/dr$/, /debit.?credit/]),
    debit: detectColumn(headers, [/^debit$/, /debit amount/, /withdrawal/, /paid out/, /^dr amount$/]),
    credit: detectColumn(headers, [/^credit$/, /credit amount/, /deposit/, /paid in/, /^cr amount$/]),
    category: detectColumn(headers, [/^category$/, /spending category/]),
    note: detectColumn(headers, [/^note$/, /^memo$/, /additional remarks/]),
  };
}

function parseDateValue(raw: string): string | null {
  const value = raw.trim();
  let year: number;
  let month: number;
  let day: number;
  let match = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (match) {
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  } else {
    match = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (match) {
      day = Number(match[1]);
      month = Number(match[2]);
      year = Number(match[3]);
    } else {
      match = value.match(/^(\d{1,2})[- ]([A-Za-z]{3,})[- ](\d{4})$/);
      if (!match) return null;
      day = Number(match[1]);
      year = Number(match[3]);
      const monthIndex = [
        "jan", "feb", "mar", "apr", "may", "jun",
        "jul", "aug", "sep", "oct", "nov", "dec",
      ].indexOf(match[2].slice(0, 3).toLowerCase());
      month = monthIndex + 1;
    }
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;

  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function parseAmount(raw: string): number | null {
  const value = raw.trim();
  if (!value) return null;
  const parenthesized = /^\(.*\)$/.test(value);
  const normalized = value
    .replace(/₹|INR|Rs\.?/gi, "")
    .replace(/,/g, "")
    .replace(/\s/g, "")
    .replace(/(?:DR|CR|DEBIT|CREDIT)\.?$/i, "")
    .replace(/[()]/g, "");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return parenthesized ? -Math.abs(parsed) : parsed;
}

function parseKind(raw: string): "income" | "expense" | null {
  const value = raw.trim().toLowerCase();
  if (/^(income|credit|cr|deposit|received|inflow|refund)$/.test(value)) return "income";
  if (/^(expense|debit|dr|withdrawal|paid|outflow|payment)$/.test(value)) return "expense";
  return null;
}

function amountSuffixKind(raw: string): "income" | "expense" | null {
  const suffix = raw.trim().match(/\b(DR|DEBIT|CR|CREDIT)\.?\s*$/i)?.[1] ?? "";
  return suffix ? parseKind(suffix) : null;
}

function signatureOf(item: TransactionCreate): string {
  return [
    item.transaction_date,
    Number(item.amount).toFixed(2),
    item.kind,
    item.title.toLocaleLowerCase().replace(/\s+/g, " ").trim(),
  ].join("|");
}

function buildPreview(
  records: CsvRecord[],
  mapping: CsvMapping,
  positiveAmountKind: "income" | "expense",
): PreviewRow[] {
  const seen = new Set<string>();
  return records.map((record) => {
    const value = (field: FieldKey) => {
      const column = mapping[field];
      return column === "" ? "" : (record.cells[Number(column)] ?? "").trim();
    };

    const title = value("title");
    const date = parseDateValue(value("date"));
    let amount: number | null = null;
    let kind: "income" | "expense" | null = null;

    const debitRaw = value("debit");
    const creditRaw = value("credit");
    const usesSplitAmounts = mapping.debit !== "" || mapping.credit !== "";

    if (usesSplitAmounts) {
      const debit = debitRaw ? parseAmount(debitRaw) : null;
      const credit = creditRaw ? parseAmount(creditRaw) : null;
      const debitPresent = debitRaw !== "";
      const creditPresent = creditRaw !== "";
      if ((debitPresent && debit === null) || (creditPresent && credit === null)) {
        return { line: record.line, transaction: null, error: "Debit or credit amount is not numeric.", suspectedTransfer: false, duplicateInFile: false };
      }
      if (debit !== null && debit !== 0 && credit !== null && credit !== 0) {
        return { line: record.line, transaction: null, error: "Both debit and credit contain values; check the column mapping.", suspectedTransfer: false, duplicateInFile: false };
      }
      if (debit !== null && debit !== 0) {
        amount = Math.abs(debit);
        kind = "expense";
      } else if (credit !== null && credit !== 0) {
        amount = Math.abs(credit);
        kind = "income";
      }
    } else {
      const parsed = parseAmount(value("amount"));
      if (parsed !== null) {
        amount = Math.abs(parsed);
        const explicitKind = value("kind") ? parseKind(value("kind")) : amountSuffixKind(value("amount"));
        if (value("kind") && explicitKind === null) {
          return { line: record.line, transaction: null, error: "Transaction type is not recognised. Use income/credit/CR or expense/debit/DR.", suspectedTransfer: false, duplicateInFile: false };
        }
        kind = explicitKind ?? (parsed < 0 ? "expense" : positiveAmountKind);
      }
    }

    if (!date) {
      return { line: record.line, transaction: null, error: "Date could not be read. Use YYYY-MM-DD or DD/MM/YYYY.", suspectedTransfer: false, duplicateInFile: false };
    }
    if (!title) {
      return { line: record.line, transaction: null, error: "Description is empty.", suspectedTransfer: false, duplicateInFile: false };
    }
    if (title.length > 140) {
      return { line: record.line, transaction: null, error: "Description exceeds the 140-character limit.", suspectedTransfer: false, duplicateInFile: false };
    }
    if (amount === null || amount <= 0) {
      return { line: record.line, transaction: null, error: "A positive amount was not found.", suspectedTransfer: false, duplicateInFile: false };
    }
    if (!kind) {
      return { line: record.line, transaction: null, error: "Could not determine whether this row is income or expense.", suspectedTransfer: false, duplicateInFile: false };
    }

    const category = value("category") || "Other";
    const note = value("note");
    if (category.length > 60) {
      return { line: record.line, transaction: null, error: "Category exceeds the 60-character limit.", suspectedTransfer: false, duplicateInFile: false };
    }
    if (note.length > 500) {
      return { line: record.line, transaction: null, error: "Note exceeds the 500-character limit.", suspectedTransfer: false, duplicateInFile: false };
    }

    const transaction: TransactionCreate = {
      title,
      amount: amount.toFixed(2),
      kind,
      category,
      transaction_date: date,
      ...(note ? { note } : {}),
    };
    const signature = signatureOf(transaction);
    const duplicateInFile = seen.has(signature);
    seen.add(signature);

    return {
      line: record.line,
      transaction,
      error: "",
      suspectedTransfer: TRANSFER_PATTERN.test(title),
      duplicateInFile,
    };
  });
}

export default function ImportPage() {
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [records, setRecords] = useState<CsvRecord[]>([]);
  const [mapping, setMapping] = useState<CsvMapping>({
    date: "", title: "", amount: "", kind: "", debit: "", credit: "", category: "", note: "",
  });
  const [positiveAmountKind, setPositiveAmountKind] = useState<"income" | "expense">("expense");
  const [includedOverrides, setIncludedOverrides] = useState<Record<number, boolean>>({});
  const [fileError, setFileError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);

  const previewRows = useMemo(
    () => buildPreview(records, mapping, positiveAmountKind),
    [records, mapping, positiveAmountKind],
  );

  const readyRows = previewRows.filter((row) => row.transaction !== null);
  const selectedRows = readyRows.filter((row) => {
    const defaultIncluded = !row.suspectedTransfer && !row.duplicateInFile;
    return includedOverrides[row.line] ?? defaultIncluded;
  });
  const invalidCount = previewRows.filter((row) => row.transaction === null).length;
  const transferCount = readyRows.filter((row) => row.suspectedTransfer).length;
  const duplicateCount = readyRows.filter((row) => row.duplicateInFile).length;
  const defaultIncludedCount = readyRows.filter((row) => !row.suspectedTransfer && !row.duplicateInFile).length;

  const mappingReady =
    mapping.date !== "" &&
    mapping.title !== "" &&
    (mapping.amount !== "" || mapping.debit !== "" || mapping.credit !== "") &&
    (mapping.amount === "" || mapping.debit === "" && mapping.credit === "");

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileError("");
    setError("");
    setNotice("");
    setPendingImport(null);
    setIncludedOverrides({});

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setFileError("Choose a .csv file. Excel files will be supported in a later milestone.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFileError("This file is larger than 5 MB. Export a smaller date range and try again.");
      return;
    }

    try {
      const parsed = parseCsv(await file.text());
      if (parsed.length < 2) throw new Error("The CSV needs a header row and at least one transaction row.");
      const nextHeaders = parsed[0].map((item, index) => item.trim() || "Column " + (index + 1));
      const dataRows = parsed.slice(1);
      if (dataRows.length > 1000) throw new Error("This import is limited to 1,000 data rows at a time. Split the statement into smaller files.");
      setFileName(file.name);
      setHeaders(nextHeaders);
      setRecords(dataRows.map((cells, index) => ({ line: index + 2, cells })));
      setMapping(detectMapping(nextHeaders));
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Could not read this CSV file.");
      setFileName("");
      setHeaders([]);
      setRecords([]);
    }
    event.target.value = "";
  }

  function updateMapping(field: FieldKey, value: string) {
    setMapping((current) => ({ ...current, [field]: value }));
  }

  function toggleRow(line: number, checked: boolean) {
    setIncludedOverrides((current) => ({ ...current, [line]: checked }));
  }

  async function sendImport(
    transactions: TransactionCreate[],
    csvLines: number[],
    allowDuplicates: boolean,
  ) {
    setSaving(true);
    setError("");
    try {
      const result = await apiRequest<TransactionImportResult>("/transactions/import", {
        method: "POST",
        body: JSON.stringify({ transactions, allow_duplicates: allowDuplicates }),
      });

      if (result.requires_confirmation) {
        const duplicateLines = result.duplicate_rows.map((rowNumber) => csvLines[rowNumber - 1] ?? rowNumber);
        setPendingImport({ transactions, csvLines, duplicateLines });
        return;
      }

      setNotice(
        "Imported " + result.imported_count + " transaction" +
        (result.imported_count === 1 ? "" : "s") +
        (result.duplicate_count ? ". " + result.duplicate_count + " possible duplicate row(s) were included after your confirmation." : "."),
      );
      setPendingImport(null);
      setFileName("");
      setHeaders([]);
      setRecords([]);
      setIncludedOverrides({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "The transactions could not be imported.");
    } finally {
      setSaving(false);
    }
  }

  async function handleImport() {
    const chosen = selectedRows.filter((row): row is PreviewRow & { transaction: TransactionCreate } => row.transaction !== null);
    if (chosen.length === 0) return;
    await sendImport(
      chosen.map((row) => row.transaction),
      chosen.map((row) => row.line),
      false,
    );
  }

  async function confirmDuplicates() {
    if (!pendingImport) return;
    await sendImport(pendingImport.transactions, pendingImport.csvLines, true);
  }

  function clearFile() {
    setFileName("");
    setHeaders([]);
    setRecords([]);
    setIncludedOverrides({});
    setPendingImport(null);
    setFileError("");
  }

  const columnOptions = [
    { value: "", label: "— Not mapped —" },
    ...headers.map((header, index) => ({ value: String(index), label: header })),
  ];

  return (
    <main className="shell">
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span className="brand-icon"><Activity /></span>Paisa<span>Lens</span>
        </Link>
        <p className="nav-caption">WORKSPACE</p>
        <Link className="nav" href="/"><LayoutDashboard /> Overview</Link>
        <Link className="nav" href="/transactions"><Wallet /> Transactions</Link>
        <Link className="nav active" href="/import"><FileSpreadsheet /> Import statement</Link>
        <Link className="nav" href="/#goal-mode"><Target /> Goal mode</Link>
        <Link className="nav" href="/#insights"><Sparkles /> AI insights</Link>
        <div className="side-note">
          <ShieldCheck />
          <b>Your statement stays local.</b>
          <p>The CSV is parsed in this browser. Only approved transaction fields are sent to your API.</p>
        </div>
        <div className="profile">
          <div className="avatar">S</div>
          <div><b>Student account</b><small>Local demo workspace</small></div>
        </div>
      </aside>

      <nav className="mobile-nav" aria-label="Primary navigation">
        <Link href="/"><LayoutDashboard /><span>Overview</span></Link>
        <Link href="/transactions"><Wallet /><span>Transactions</span></Link>
        <Link className="active" href="/import" aria-current="page"><FileSpreadsheet /><span>Import</span></Link>
        <Link href="/#goal-mode"><Target /><span>Goals</span></Link>
      </nav>

      <section className="main transactions-main">
        <header className="topbar">
          <span>Workspace / <b>Import statement</b></span>
          <div><span className="demo">● REVIEW BEFORE IMPORT</span><span className="date">CSV import</span></div>
        </header>

        <section className="welcome transactions-welcome">
          <div>
            <small className="eyebrow">BRING YOUR STATEMENT INTO PAISALENS</small>
            <h1>Import <em>transactions.</em></h1>
            <p>Map columns, check the preview and approve only the rows you want to add.</p>
          </div>
          <Link className="back-link" href="/transactions"><ArrowLeft size={16} /> Transaction history</Link>
        </section>

        {notice && (
          <div className="notice"><CheckCircle2 size={16} />{notice}<button aria-label="Dismiss notice" onClick={() => setNotice("")}><X size={15} /></button></div>
        )}
        {error && <div className="alert"><CircleAlert size={17} /><span>{error}</span><button onClick={() => setError("")}>Dismiss</button></div>}
        {fileError && <div className="alert"><CircleAlert size={17} /><span>{fileError}</span><button onClick={() => setFileError("")}>Dismiss</button></div>}

        <section className="glass import-upload">
          <div className="import-section-heading">
            <div className="import-step">01</div>
            <div><small>SELECT A STATEMENT</small><h2>Upload CSV file</h2><p>Supported now: CSV, UTF-8, up to 5 MB and 1,000 data rows.</p></div>
          </div>
          {!fileName ? (
            <label className="upload-dropzone">
              <input type="file" accept=".csv,text/csv" onChange={(event) => void handleFile(event)} />
              <span className="upload-icon"><UploadCloud size={25} /></span>
              <b>Choose a bank or UPI statement CSV</b>
              <small>Nothing is uploaded at this stage. The browser reads the file for preview.</small>
              <span className="upload-button"><FileUp size={15} /> Select CSV file</span>
              <span className="sample-file-link">Or <Link href="/samples/sample-student-statement.csv" download>download a synthetic sample CSV</Link> to try the importer.</span>
            </label>
          ) : (
            <div className="selected-file">
              <span className="file-icon"><FileSpreadsheet size={21} /></span>
              <div><b>{fileName}</b><small>{records.length.toLocaleString("en-IN")} data rows detected</small></div>
              <button className="row-action delete-action" aria-label="Remove CSV file" onClick={clearFile}><X size={16} /></button>
            </div>
          )}
        </section>

        {headers.length > 0 && (
          <>
            <section className="glass import-section">
              <div className="import-section-heading">
                <div className="import-step">02</div>
                <div><small>CONFIRM THE COLUMN MAPPING</small><h2>Match your CSV columns</h2><p>We preselected likely matches. Verify them against your statement format.</p></div>
              </div>

              <div className="mapping-grid">
                {FIELD_LABELS.map((field) => (
                  <label className="field mapping-field" key={field.key}>
                    {field.label}
                    <select value={mapping[field.key]} onChange={(event) => updateMapping(field.key, event.target.value)}>
                      {columnOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                ))}
              </div>

              {mapping.amount !== "" && mapping.debit === "" && mapping.credit === "" && mapping.kind === "" && (
                <div className="positive-direction">
                  <Info size={16} />
                  <span>For unsigned values, what does a positive amount mean in this file?</span>
                  <select value={positiveAmountKind} onChange={(event) => setPositiveAmountKind(event.target.value as "income" | "expense")}>
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>
              )}
              {mapping.amount !== "" && (mapping.debit !== "" || mapping.credit !== "") && (
                <div className="mapping-warning"><CircleAlert size={15} /> Map either a single Amount column or Debit/Credit columns, not both.</div>
              )}
              {!mappingReady && (
                <div className="mapping-warning"><CircleAlert size={15} /> Required: date, description and either Amount or Debit/Credit column(s).</div>
              )}
            </section>

            <section className="glass import-section">
              <div className="import-section-heading preview-heading">
                <div className="import-step">03</div>
                <div><small>CHECK EVERY ROW BEFORE SAVING</small><h2>Import preview</h2><p>Possible own-account transfers and repeated rows are excluded by default.</p></div>
              </div>

              <div className="import-stats">
                <div><b>{previewRows.length}</b><small>Rows read</small></div>
                <div><b className="income">{defaultIncludedCount}</b><small>Ready by default</small></div>
                <div><b className="transfer-number">{transferCount}</b><small>Possible transfers</small></div>
                <div><b className="duplicate-number">{duplicateCount}</b><small>Repeated in file</small></div>
                <div><b className="invalid-number">{invalidCount}</b><small>Need correction</small></div>
              </div>

              <div className="preview-toolbar">
                <span>{selectedRows.length} of {readyRows.length} valid rows selected</span>
                <button className="clear-filters" onClick={() => setIncludedOverrides({})}>Reset row selection</button>
              </div>

              <div className="import-table-wrap">
                <table className="ledger-table import-table">
                  <thead><tr><th>Include</th><th>CSV row</th><th>Description</th><th>Date</th><th>Type</th><th className="amount-cell">Amount</th><th>Review status</th></tr></thead>
                  <tbody>
                    {previewRows.map((row) => {
                      const item = row.transaction;
                      const defaultIncluded = Boolean(item) && !row.suspectedTransfer && !row.duplicateInFile;
                      const checked = includedOverrides[row.line] ?? defaultIncluded;
                      const status = row.error
                        ? row.error
                        : row.suspectedTransfer
                          ? "Possible own-account transfer"
                          : row.duplicateInFile
                            ? "Repeated row in this CSV"
                            : "Ready";
                      return (
                        <tr key={row.line}>
                          <td><input aria-label={"Include CSV row " + row.line} type="checkbox" disabled={!item} checked={checked} onChange={(event) => toggleRow(row.line, event.target.checked)} /></td>
                          <td className="ledger-date">#{row.line}</td>
                          <td><div className="ledger-title">{item?.title ?? "Unusable row"}</div>{item?.category && <div className="ledger-note">{item.category}</div>}</td>
                          <td className="ledger-date">{item?.transaction_date ?? "—"}</td>
                          <td>{item ? <span className={"kind-chip " + item.kind}>{item.kind}</span> : "—"}</td>
                          <td className="amount-cell ledger-amount">{item ? "₹" + Number(item.amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}</td>
                          <td><span className={"import-status " + (row.error ? "invalid" : row.suspectedTransfer ? "transfer" : row.duplicateInFile ? "duplicate" : "ready")} title={row.error || status}>{status}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {invalidCount > 0 && <p className="import-footnote">{invalidCount} row(s) have validation errors and cannot be selected. Adjust the mapping if the problem affects multiple rows.</p>}
              <div className="import-actions">
                <div className="import-privacy"><ShieldCheck size={16} /><span>Only selected, mapped transaction fields will be sent to your configured API.</span></div>
                <button className="submit-button import-submit" disabled={!mappingReady || selectedRows.length === 0 || saving} onClick={() => void handleImport()}>
                  {saving ? <LoaderCircle className="spin" size={16} /> : <ArrowRight size={16} />}
                  Import {selectedRows.length} selected
                </button>
              </div>
            </section>
          </>
        )}

        <section className="import-guidance">
          <div><Info size={16} /><b>How duplicate review works</b></div>
          <p>Rows are compared using transaction date, amount, type and normalised description. This is a possible-duplicate check, not a guarantee: two legitimate purchases can look identical. If matches exist in your ledger, PaisaLens stops and asks you before importing them.</p>
          <p>Rows whose descriptions look like self-transfers are highlighted and left unchecked. Review them carefully; do not count transfers between your own accounts as income or spending.</p>
        </section>

        <footer>PAISALENS · USER-INITIATED IMPORT · ORIGINAL STATEMENT FILE IS NOT SENT TO THE API</footer>
      </section>

      {pendingImport && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setPendingImport(null); }}>
          <section className="modal duplicate-modal" role="dialog" aria-modal="true" aria-labelledby="duplicate-title">
            <div className="modal-head">
              <div><small>CONFIRM POSSIBLE DUPLICATES</small><h2 id="duplicate-title">Some rows may already exist</h2></div>
              <button className="icon-button" aria-label="Close dialog" onClick={() => setPendingImport(null)}><X size={18} /></button>
            </div>
            <div className="duplicate-warning"><CircleAlert size={19} /><span>{pendingImport.duplicateLines.length} selected row(s) match an existing transaction or another selected row based on date, amount, type and description.</span></div>
            <p className="modal-description">No transactions have been imported yet. Matching CSV line(s): {pendingImport.duplicateLines.slice(0, 20).map((line) => "#" + line).join(", ")}{pendingImport.duplicateLines.length > 20 ? " and more" : ""}.</p>
            <p className="modal-description">Identical purchases can be legitimate. Review your statement and ledger before continuing.</p>
            <button className="submit-button" disabled={saving} onClick={() => void confirmDuplicates()}>
              {saving ? <LoaderCircle className="spin" size={16} /> : <CheckCircle2 size={16} />}
              Import anyway
            </button>
            <button className="secondary-button cancel-import" disabled={saving} onClick={() => setPendingImport(null)}>Go back and review</button>
          </section>
        </div>
      )}
    </main>
  );
}
