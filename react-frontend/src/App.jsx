import { useState } from "react";
import "./App.css";

function App() {
  const [poA, setPoA] = useState(null);
  const [poB, setPoB] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [results, setResults] = useState([]);
  const [warning, setWarning] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!poA || !poB) {
      setError("Please select both files.");
      return;
    }
    setError(null);
    setLoading(true);

    const form = new FormData();
    form.append("po_a", poA);
    form.append("po_b", poB);

    try {
      const resp = await fetch("http://127.0.0.1:8000/compare-pos", {
        method: "POST",
        body: form,
      });
      if (!resp.ok) throw new Error(`Server error: ${resp.status}`);
      const data = await resp.json();
      setSummary(data.summary || {});
      setResults(data.results || []);
      setWarning((data.summary && data.summary.warning) || null);
    } catch (err) {
      setError(err.message || "Failed to fetch. Is the backend running on http://127.0.0.1:8000?");
    } finally {
      setLoading(false);
    }
  };

  const validated = results.filter((r) => r.status === "ok");
  const conflicts = results.filter((r) => r.status !== "ok");

  return (
    <div className="shell">
      <h1>PO Comparison</h1>
      <p className="sub">
        Upload company and customer PDFs to compare items, prices, and charge types.
      </p>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="row">
            <div className="col">
              <label className="label">Company PO (PDF)</label>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx"
                onChange={(e) => setPoA(e.target.files?.[0] || null)}
              />
            </div>
            <div className="col">
              <label className="label">Customer PO (PDF)</label>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx"
                onChange={(e) => setPoB(e.target.files?.[0] || null)}
              />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button type="submit" disabled={loading}>
                {loading ? "Comparing..." : "Compare"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {error && <div className="error">{error}</div>}
      {warning && <div className="warning">{warning}</div>}

      {summary && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="summary-grid">
            <div className="pill">
              <b>Items (Company)</b>
              {summary.total_items_a ?? 0}
            </div>
            <div className="pill">
              <b>Items (Customer)</b>
              {summary.total_items_b ?? 0}
            </div>
            <div className="pill">
              <b>Matched</b>
              {summary.matched_items ?? 0}
            </div>
            <div className="pill">
              <b>Conflicts</b>
              <span
                className="badge"
                style={{
                  background:
                    (summary.conflict_count ?? 0) > 0 ? "#2b0f13" : "#0f2b1c",
                  color:
                    (summary.conflict_count ?? 0) > 0 ? "#ffb2b2" : "#96f2c7",
                }}
              >
                {summary.conflict_count ?? 0}
              </span>
            </div>
            <div className="pill">
              <b>Order similarity</b>
              {(summary.order_similarity !== undefined
                ? summary.order_similarity.toFixed(2)
                : "n/a")}
            </div>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="split-grid">
            <div className="left">
              <h2>✅ Validated & Matching Items</h2>
              {validated.length === 0 && <div className="muted">No validated items.</div>}
              <ul className="item-list">
                {validated.map((r, idx) => {
                  const a = r.item_a || {};
                  const name = a.product_name || a.raw_description || a.normalized_description || "(no product)";
                  const qty = a.qty || a.quantity || a.count || "-";
                  const price = a.unit_price || a.price || a.amount || "-";
                  return (
                    <li key={idx} className="item-row">
                      <div className="item-name">{name}</div>
                      <div className="item-meta">Qty: <span className="match-val">{qty}</span> — Price: <span className="match-val">{price}</span></div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="right">
              <div className="right-head">
                <h2>⚠️ Price & Semantic Conflicts</h2>
                <div className="mini-meta">
                  <div>Threshold: {summary.threshold_used ?? "70%"}</div>
                  {summary.currency_validation && (
                    <div>
                      Currency: {summary.currency_validation.company_currency ?? "-"} ↔ {summary.currency_validation.customer_currency ?? "-"}
                    </div>
                  )}
                </div>
              </div>

              {conflicts.length === 0 && <div className="muted">No conflicts detected.</div>}

              <ul className="conflict-list">
                {conflicts.map((r, idx) => {
                  const itemA = r.item_a || {};
                  const itemB = r.item_b || {};
                  const name = itemA.product_name || itemA.raw_description || itemA.normalized_description || itemB.raw_description || "(no product)";
                  const conflictEntries = (r.conflicts || []).map((c, i) => (
                    <li key={i} className="conflict-entry">
                      <strong>{c.field}</strong>: <span className="conflict-val">{c.a}</span> vs <span className="conflict-val alt">{c.b}</span>
                    </li>
                  ));

                  return (
                    <li key={idx} className="conflict-row">
                      <div className="conflict-title">{name}</div>
                      <div className="conflict-meta">Similarity: {r.similarity ?? "-"} — Status: <span className={r.status}>{r.status}</span></div>
                      <ul>{conflictEntries.length ? conflictEntries : <li>Not found in customer PO</li>}</ul>
                    </li>
                  );
                })}
              </ul>

              <div className="action-card">
                <h3>Action Items</h3>
                <ul>
                  {conflicts.map((r, idx) => {
                    const itemA = r.item_a || {};
                    const itemB = r.item_b || {};
                    const name = itemA.product_name || itemA.raw_description || itemA.normalized_description || itemB.raw_description || "(unknown)";
                    const actions = (r.conflicts || []).map((c, i) => {
                      const field = (c.field || "").toLowerCase();
                      if (field.includes("price") || field.includes("unit")) {
                        return `Action: Update Customer PO price for '${name}' from ${c.b} to ${c.a} to match Company PO.`;
                      }
                      if (field.includes("description") || field.includes("name")) {
                        return `Action: Review and reconcile product name for '${name}' (Company: ${c.a} / Customer: ${c.b}).`;
                      }
                      return `Action: Investigate '${field}' for '${name}': Company='${c.a}' vs Customer='${c.b}'.`;
                    });

                    if (r.status === "missing_in_b") {
                      actions.unshift(`Action: Add '${name}' to Customer PO to match Company PO.`);
                    }

                    return actions.map((a, i2) => <li key={`${idx}-${i2}`}>{a}</li>);
                  })}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
