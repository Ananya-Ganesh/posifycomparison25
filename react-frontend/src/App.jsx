import { useState } from "react";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

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
      const resp = await fetch(`${API_BASE}/compare-pos`, {
        method: "POST",
        body: form,
      });

      if (!resp.ok) {
        throw new Error(`Server error: ${resp.status}`);
      }

      const data = await resp.json();
      setSummary(data.summary || {});
      setResults(data.results || []);
      setWarning(data.summary?.warning || null);
    } catch (err) {
      setError(err.message || "Failed to connect to backend.");
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
            <div className="pill"><b>Items (Company)</b>{summary.total_items_a ?? 0}</div>
            <div className="pill"><b>Items (Customer)</b>{summary.total_items_b ?? 0}</div>
            <div className="pill"><b>Matched</b>{summary.matched_items ?? 0}</div>
            <div className="pill">
              <b>Conflicts</b>
              <span className="badge">{summary.conflict_count ?? 0}</span>
            </div>
            <div className="pill">
              <b>Order similarity</b>
              {summary.order_similarity?.toFixed(2) ?? "n/a"}
            </div>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="split-grid">
            <div className="left">
              <h2>✅ Validated & Matching Items</h2>
              <ul className="item-list">
                {validated.map((r, i) => (
                  <li key={i} className="item-row">
                    <div className="item-name">
                      {r.item_a?.product_name || "(no product)"}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="right">
              <h2>⚠️ Price & Semantic Conflicts</h2>
              <ul className="conflict-list">
                {conflicts.map((r, i) => (
                  <li key={i} className="conflict-row">
                    {r.item_a?.product_name || "(unknown item)"}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
