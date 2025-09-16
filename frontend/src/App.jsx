import React, { useMemo, useState, useEffect } from "react";
import { Plus, Trash2, Upload, Download, Info } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

const nf = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const n2 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2, minimumFractionDigits: 2 });

const API_BASE = (() => {
  try {
    return (import.meta && import.meta.env && import.meta.env.VITE_API_BASE) || "http://localhost:4000";
  } catch {
    return "http://localhost:4000";
  }
})();

const PIE_COLORS = ["#0ea5e9", "#22c55e", "#f59e0b"];

const CATALOG = {
  "Tôlerie": { articles: ["ART-0001", "ART-0002"], technical: { "ART-0001": ["Laser A", "Presse Plieuse A"], "ART-0002": ["Laser B", "Presse Plieuse B"] } },
  "Usinage": { articles: ["ART-1000", "ART-1001"], technical: { "ART-1000": ["Centre UGV"], "ART-1001": ["Tour CN"] } },
  "Assemblage": { articles: ["ART-2000"], technical: { "ART-2000": ["Poste Assemblage A"] } }
};

const defaultMaterials = [
  { id: crypto.randomUUID(), name: "Acier S235", qty: 2, unitCost: 3.9 },
];
const defaultOperations = [
  {
    id: crypto.randomUUID(),
    name: "Découpe laser",
    type: "Opérateur",
    machine: "Laser Bystronic",
    cadenceH: 10,
    hourlyRate: 55,
    subcontractCost: 0,
    trgPct: 100,
    crew: 1,
  },
];

export default function App() {
  const [family, setFamily] = useState("");
  const [articles, setArticles] = useState([]);
  const [articleRef, setArticleRef] = useState("");
  const [technicalList, setTechnicalList] = useState([]);
  const [selectedTechnical, setSelectedTechnical] = useState("");

  const [batchQty, setBatchQty] = useState(100);
  const safeBatch = useMemo(() => Math.max(1, Number(batchQty) || 1), [batchQty]);
  const [salePrice, setSalePrice] = useState(12.5);
  const [eoyDiscountPct, setEoyDiscountPct] = useState(3);
  const [overheadPct, setOverheadPct] = useState(12);

  const [materials, setMaterials] = useState(defaultMaterials);
  const [operations, setOperations] = useState(defaultOperations);
  const [loadingSylob, setLoadingSylob] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (family && CATALOG[family]) {
      setArticles(CATALOG[family].articles);
    } else {
      setArticles([]);
    }
    setArticleRef("");
    setTechnicalList([]);
    setSelectedTechnical("");
  }, [family]);

  useEffect(() => {
    if (family && articleRef && CATALOG[family] && CATALOG[family].technical[articleRef]) {
      setTechnicalList(CATALOG[family].technical[articleRef]);
    } else {
      setTechnicalList([]);
    }
    setSelectedTechnical("");
  }, [articleRef, family]);

  const totals = useMemo(() => {
    const matTotal = materials.reduce((s, m) => s + (Number(m.qty) || 0) * safeBatch * (Number(m.unitCost) || 0), 0);
    const opTotal = operations.reduce((s, o) => {
      if (o.type === "Sous-traitance") return s + (Number(o.subcontractCost) || 0);
      const cadence = Number(o.cadenceH) || 0;
      const r = Number(o.hourlyRate) || 0;
      const trg = Number(o.trgPct ?? 100);
      const crew = Number(o.crew ?? 1);
      if (cadence <= 0) return s;
      const trgFactor = o.type === "Opérateur" ? (trg > 0 ? 100 / trg : 1) : 1;
      const hoursBatch = safeBatch / cadence;
      return s + hoursBatch * r * crew * trgFactor;
    }, 0);
    const directCosts = matTotal + opTotal;
    const netRevenue = (Number(salePrice) || 0) * safeBatch * (1 - (Number(eoyDiscountPct) || 0) / 100);
    const overhead = ((Number(overheadPct) || 0) / 100) * netRevenue;
    const totalCost = directCosts + overhead;
    const unitCost = totalCost / safeBatch;
    const margin = netRevenue - totalCost;
    const marginPerUnit = margin / safeBatch;
    const marginPct = netRevenue > 0 ? (margin / netRevenue) * 100 : 0;
    const d = (Number(eoyDiscountPct) || 0) / 100;
    const k = 1 - (Number(overheadPct) || 0) / 100;
    const neededNetRevenue = k > 0 ? directCosts / k : Infinity;
    const breakEvenUnit = neededNetRevenue / (safeBatch * (1 - d));
    const chartData = [
      { name: "Matière", value: matTotal },
      { name: "Opérations", value: opTotal },
      { name: "Frais fixes", value: overhead },
    ];
    return {
      matTotal,
      opTotal,
      directCosts,
      overhead,
      totalCost,
      unitCost,
      netRevenue,
      margin,
      marginPerUnit,
      marginPct,
      breakEvenUnit,
      chartData,
      safeBatch,
    };
  }, [materials, operations, safeBatch, salePrice, eoyDiscountPct, overheadPct]);

  const addMaterial = () => {
    setMaterials((arr) => [
      ...arr,
      { id: crypto.randomUUID(), name: "", qty: 1, unitCost: 0 },
    ]);
  };
  const removeMaterial = (id) => setMaterials((arr) => arr.filter((m) => m.id !== id));
  const updateMaterial = (id, field, value) => setMaterials((arr) => arr.map((m) => (m.id === id ? { ...m, [field]: value } : m)));

  const addOperation = () => {
    setOperations((arr) => [
      ...arr,
      { id: crypto.randomUUID(), name: "", type: "Opérateur", machine: "", cadenceH: 0, hourlyRate: 0, subcontractCost: 0, trgPct: 100, crew: 1 },
    ]);
  };
  const removeOperation = (id) => setOperations((arr) => arr.filter((o) => o.id !== id));
  const updateOperation = (id, field, value) => setOperations((arr) => arr.map((o) => (o.id === id ? { ...o, [field]: value } : o)));

  const exportJSON = () => {
    const model = {
      family,
      articleRef,
      selectedTechnical,
      batchQty,
      salePrice,
      eoyDiscountPct,
      overheadPct,
      materials,
      operations,
      generatedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(model, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `simu_${articleRef || "article"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(String(e.target?.result || "{}"));
        if (data.family !== undefined) setFamily(data.family);
        if (data.articleRef !== undefined) setArticleRef(data.articleRef);
        if (data.selectedTechnical !== undefined) setSelectedTechnical(data.selectedTechnical);
        if (data.batchQty !== undefined) setBatchQty(data.batchQty);
        if (data.salePrice !== undefined) setSalePrice(data.salePrice);
        if (data.eoyDiscountPct !== undefined) setEoyDiscountPct(data.eoyDiscountPct);
        if (data.overheadPct !== undefined) setOverheadPct(data.overheadPct);
        if (Array.isArray(data.materials)) setMaterials(data.materials);
        if (Array.isArray(data.operations)) setOperations(
          data.operations.map((o) => ({
            ...o,
            trgPct: o.trgPct ?? 100,
            crew: o.crew ?? 1,
            cadenceH: o.cadenceH ?? (o.durationH ? (Number(o.durationH) > 0 ? 1 / Number(o.durationH) : 0) : 0),
          }))
        );
      } catch (err) {
        alert("Fichier invalide");
      }
    };
    reader.readAsText(file);
  };

  const loadFromSylob = async () => {
    if (!articleRef) return;
    setLoadingSylob(true);
    setLoadError("");
    try {
      const q = encodeURIComponent(articleRef);
      const [bomRes, routingRes] = await Promise.all([
        fetch(`${API_BASE}/api/bom?article=${q}`),
        fetch(`${API_BASE}/api/routing?article=${q}`),
      ]);
      if (!bomRes.ok) throw new Error(`BOM: HTTP ${bomRes.status}`);
      if (!routingRes.ok) throw new Error(`Routage: HTTP ${routingRes.status}`);
      const bom = await bomRes.json();
      const ops = await routingRes.json();
      const comps = Array.isArray(bom.components) ? bom.components : bom;
      const opsApi = Array.isArray(ops.operations) ? ops.operations : ops;
      setMaterials(
        (comps || []).map((c) => ({
          id: crypto.randomUUID(),
          name: [c.code, c.name].filter(Boolean).join(" – "),
          qty: Number(c.qty_per) || Number(c.qty) || 0,
          unitCost: Number(c.unit_cost) || Number(c.cost) || 0,
        }))
      );
      setOperations(
        (opsApi || []).map((o) => {
          const runPerUnit = Number(o.run_h_per_unit) || 0;
          const cadenceH = runPerUnit > 0 ? 1 / runPerUnit : 0;
          const t = String(o.type || "").toLowerCase();
          let mappedType = "Opérateur";
          if (t.includes("régleur") || t.includes("regleur")) mappedType = "Régleur";
          if (t.includes("sous") || t.includes("subcontract")) mappedType = "Sous-traitance";
          return {
            id: crypto.randomUUID(),
            name: o.name || o.operation || o.workcenter || "Opération",
            type: mappedType,
            machine: o.machine || o.workcenter || o.resource || "",
            cadenceH: mappedType === "Sous-traitance" ? 0 : cadenceH,
            hourlyRate: Number(o.hourly_rate) || Number(o.rate) || 0,
            subcontractCost: mappedType === "Sous-traitance" ? Number(o.subcontract_cost) || Number(o.cost) || 0 : 0,
            trgPct: 100,
            crew: 1,
          };
        })
      );
    } catch (e) {
      setLoadError(e?.message || "Erreur de chargement depuis Sylob");
    } finally {
      setLoadingSylob(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Simulateur de rentabilité d’article</h1>
            <p className="text-sm text-slate-600">Prototype UI – prêt à connecter à vos bases (ERP, PDM, etc.).</p>
          </div>
          <div className="flex gap-2">
            <button onClick={loadFromSylob} disabled={loadingSylob} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-slate-900 text-white shadow hover:shadow-lg disabled:opacity-50">
              {loadingSylob ? "Chargement…" : "Charger depuis Sylob"}
            </button>
            <button onClick={exportJSON} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-white shadow hover:shadow-md">
              <Download className="w-4 h-4" /> Export JSON
            </button>
            <label className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-white shadow hover:shadow-md cursor-pointer">
              <Upload className="w-4 h-4" /> Import JSON
              <input type="file" accept="application/json" className="hidden" onChange={(e) => importJSON(e.target.files?.[0])} />
            </label>
          </div>
        </header>

        {loadError && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 text-red-700 p-3 text-sm">
            Erreur: {loadError}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="font-semibold mb-3">Paramètres article</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-slate-600">Famille article</label>
                <select value={family} onChange={(e) => setFamily(e.target.value)} className="w-full mt-1 rounded-xl border p-2">
                  <option value="">Sélectionner…</option>
                  {Object.keys(CATALOG).map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-600">Article</label>
                <select value={articleRef} onChange={(e) => setArticleRef(e.target.value)} disabled={!family || articles.length===0} className="w-full mt-1 rounded-xl border p-2">
                  <option value="">Sélectionner…</option>
                  {articles.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-600">Donnée Technique</label>
                <select value={selectedTechnical} onChange={(e) => setSelectedTechnical(e.target.value)} disabled={!articleRef || technicalList.length===0} className="w-full mt-1 rounded-xl border p-2">
                  <option value="">Sélectionner…</option>
                  {technicalList.map((dt) => (
                    <option key={dt} value={dt}>{dt}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-slate-600">Quantité par lot</label>
                  <input type="number" min={1} value={batchQty} onChange={(e) => setBatchQty(Number(e.target.value))} className="w-full mt-1 rounded-xl border p-2" />
                </div>
                <div>
                  <label className="text-sm text-slate-600">Prix de vente HT / unité</label>
                  <input type="number" min={0} step="0.01" value={salePrice} onChange={(e) => setSalePrice(Number(e.target.value))} className="w-full mt-1 rounded-xl border p-2" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-slate-600">Remise fin d’année (%)</label>
                  <input type="number" min={0} step="0.1" value={eoyDiscountPct} onChange={(e) => setEoyDiscountPct(Number(e.target.value))} className="w-full mt-1 rounded-xl border p-2" />
                </div>
                <div>
                  <label className="text-sm text-slate-600">Frais fixes (%)</label>
                  <input type="number" min={0} step="0.1" value={overheadPct} onChange={(e) => setOverheadPct(Number(e.target.value))} className="w-full mt-1 rounded-xl border p-2" />
                </div>
              </div>
              <div className="flex items-start gap-2 text-xs text-slate-600">
                <Info className="w-4 h-4 mt-0.5" />
                <p>Le % de frais fixe est appliqué sur le chiffre d’affaires net de remise.</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="font-semibold mb-3">Synthèse (par lot : {totals.safeBatch})</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Coûts matière</span><span>{nf.format(totals.matTotal)}</span></div>
              <div className="flex justify-between"><span>Coûts opérations</span><span>{nf.format(totals.opTotal)}</span></div>
              <div className="flex justify-between"><span>Frais fixes</span><span>{nf.format(totals.overhead)}</span></div>
              <div className="border-t my-2"></div>
              <div className="flex justify-between font-medium"><span>Coût de revient (lot)</span><span>{nf.format(totals.totalCost)}</span></div>
              <div className="flex justify-between"><span>Coût unitaire</span><span>{nf.format(totals.unitCost)}</span></div>
              <div className="border-t my-2"></div>
              <div className="flex justify-between"><span>CA net (après remise)</span><span>{nf.format(totals.netRevenue)}</span></div>
              <div className={`flex justify-between ${totals.margin < 0 ? "text-red-600" : "text-emerald-700"} font-semibold`}><span>Marge (lot)</span><span>{nf.format(totals.margin)}</span></div>
              <div className={`flex justify-between ${totals.margin < 0 ? "text-red-600" : "text-emerald-700"}`}><span>Marge unitaire</span><span>{nf.format(totals.marginPerUnit)}</span></div>
              <div className={`flex justify-between ${totals.margin < 0 ? "text-red-600" : "text-emerald-700"}`}><span>Marge % (sur CA)</span><span>{n2.format(totals.marginPct)} %</span></div>
              <div className="border-t my-2"></div>
              <div className="flex justify-between text-slate-600"><span>Prix unitaire seuil de rentabilité</span><span>{nf.format(totals.breakEvenUnit)}</span></div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="font-semibold mb-3">Répartition des coûts</h2>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie dataKey="value" data={totals.chartData} innerRadius={50} outerRadius={80} paddingAngle={3}>
                    {totals.chartData.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => nf.format(Number(v))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <section className="bg-white rounded-2xl shadow p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Matières / composants</h2>
            <button onClick={addMaterial} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-slate-900 text-white"><Plus className="w-4 h-4" /> Ajouter une ligne</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-600">
                  <th className="p-2">Désignation</th>
                  <th className="p-2 w-32">Qté nécessaire</th>
                  <th className="p-2 w-40">Coût unitaire (€)</th>
                  <th className="p-2 w-40">Sous-total (€)</th>
                  <th className="p-2 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {materials.map((m) => {
                  const subtotal = (Number(m.qty) || 0) * safeBatch * (Number(m.unitCost) || 0);
                  return (
                    <tr key={m.id} className="border-t">
                      <td className="p-2">
                        <input value={m.name} onChange={(e) => updateMaterial(m.id, "name", e.target.value)} className="w-full rounded-lg border p-2" placeholder="Nom du composant" />
                      </td>
                      <td className="p-2">
                        <input type="number" step="0.0001" value={m.qty} onChange={(e) => updateMaterial(m.id, "qty", Number(e.target.value))} className="w-full rounded-lg border p-2" />
                      </td>
                      <td className="p-2">
                        <input type="number" step="0.0001" value={m.unitCost} onChange={(e) => updateMaterial(m.id, "unitCost", Number(e.target.value))} className="w-full rounded-lg border p-2" />
                      </td>
                      <td className="p-2 text-right">{nf.format(subtotal)}</td>
                      <td className="p-2 text-right">
                        <button onClick={() => removeMaterial(m.id)} className="p-2 rounded-lg hover:bg-slate-100"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Opérations</h2>
            <button onClick={addOperation} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-slate-900 text-white"><Plus className="w-4 h-4" /> Ajouter une ligne</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-600">
                  <th className="p-2">Poste</th>
                  <th className="p-2 w-40">Type</th>
                  <th className="p-2">Machine</th>
                  <th className="p-2 w-40">Cadence (u/h)</th>
                  <th className="p-2 w-40">Taux horaire (€/h)</th>
                  <th className="p-2 w-28">TRG (%)</th>
                  <th className="p-2 w-28">Effectif</th>
                  <th className="p-2 w-40">Coût sous-traitance (€)</th>
                  <th className="p-2 w-40">Sous-total (€)</th>
                  <th className="p-2 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {operations.map((o) => {
                  const isSubc = o.type === "Sous-traitance";
                  const cadence = Number(o.cadenceH) || 0;
                  const r = Number(o.hourlyRate) || 0;
                  const trg = Number(o.trgPct ?? 100);
                  const crew = Number(o.crew ?? 1);
                  const trgFactor = o.type === "Opérateur" ? (trg > 0 ? 100 / trg : 1) : 1;
                  const hoursBatch = cadence > 0 ? safeBatch / cadence : 0;
                  const subtotal = isSubc ? (Number(o.subcontractCost) || 0) : hoursBatch * r * crew * trgFactor;
                  return (
                    <tr key={o.id} className="border-t">
                      <td className="p-2">
                        <input value={o.name} onChange={(e) => updateOperation(o.id, "name", e.target.value)} className="w-full rounded-lg border p-2" placeholder="Nom de l’opération" />
                      </td>
                      <td className="p-2">
                        <select value={o.type} onChange={(e) => updateOperation(o.id, "type", e.target.value)} className="w-full rounded-lg border p-2">
                          <option>Opérateur</option>
                          <option>Régleur</option>
                          <option>Sous-traitance</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <input value={o.machine} onChange={(e) => updateOperation(o.id, "machine", e.target.value)} className="w-full rounded-lg border p-2" placeholder="Machine / Fournisseur" />
                      </td>
                      <td className="p-2">
                        <input type="number" step="0.0001" value={o.cadenceH ?? 0} onChange={(e) => updateOperation(o.id, "cadenceH", Number(e.target.value))} className={`w-full rounded-lg border p-2 ${isSubc ? "opacity-40" : ""}`} disabled={isSubc} />
                      </td>
                      <td className="p-2">
                        <input type="number" step="0.01" value={o.hourlyRate} onChange={(e) => updateOperation(o.id, "hourlyRate", Number(e.target.value))} className={`w-full rounded-lg border p-2 ${isSubc ? "opacity-40" : ""}`} disabled={isSubc} />
                      </td>
                      <td className="p-2">
                        <input type="number" min={1} max={100} step="1" value={o.trgPct ?? 100} onChange={(e) => updateOperation(o.id, "trgPct", Number(e.target.value))} className={`w-full rounded-lg border p-2 ${o.type === "Opérateur" ? "" : "opacity-40"}`} disabled={o.type !== "Opérateur"} />
                      </td>
                      <td className="p-2">
                        <input type="number" min={1} step="1" value={o.crew ?? 1} onChange={(e) => updateOperation(o.id, "crew", Number(e.target.value))} className={`w-full rounded-lg border p-2 ${o.type === "Opérateur" ? "" : "opacity-40"}`} disabled={o.type !== "Opérateur"} />
                      </td>
                      <td className="p-2">
                        <input type="number" step="0.01" value={o.subcontractCost} onChange={(e) => updateOperation(o.id, "subcontractCost", Number(e.target.value))} className={`w-full rounded-lg border p-2 ${isSubc ? "" : "opacity-40"}`} disabled={!isSubc} />
                      </td>
                      <td className="p-2 text-right">{nf.format(subtotal)}</td>
                      <td className="p-2 text-right">
                        <button onClick={() => removeOperation(o.id)} className="p-2 rounded-lg hover:bg-slate-100"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <div className="bg-white rounded-2xl shadow p-4">
          <h3 className="font-semibold mb-2">Prochaines étapes suggérées</h3>
          <ul className="text-sm list-disc ml-5 space-y-1 text-slate-700">
            <li>Brancher les listes Famille/Article/DT sur Sylob.</li>
            <li>Recalcul automatique des durées opérations si la quantité de lot change.</li>
            <li>Grilles de taux horaires par atelier et périodes de validité.</li>
            <li>Historiser les versions de chiffrage et comparaisons.</li>
          </ul>
        </div>

        <div className="h-10" />
      </div>
    </div>
  );
}
