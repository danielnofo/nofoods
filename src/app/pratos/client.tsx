"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import PratoForm from "@/components/pratos/PratoForm";

interface Prato {
  id:              string;
  nome:            string;
  categoria:       string;
  descricao:       string | null;
  preco_venda:     number | null;
  margem_desejada: number;
  ativo:           boolean;
  calorias_total:  number;
  custo_total:     number;
  margem_real:     number | null;
}

const CATEGORIAS_FILTRO = [
  "Todas","Entrada","Porçöes","Prato Principal","Acompanhamento",
  "Sobremesa","Bebida","Combo","Outros",
];

const CATEGORIA_CORES: Record<string, string> = {
  "Entrada":         "#fde68a:#92400e",
  "Prato Principal": "#dbeafe:#1e40af",
  "Acompanhamento":  "#dcfce7:#166534",
  "Sobremesa":       "#fce7f3:#9d174d",
  "Bebida":          "#e0f2fe:#0369a1",
  "Combo":           "#ede9fe:#5b21b6",
  "Outros":          "#f3f4f6:#374151",
};

function CategoriaBadge({ cat }: { cat: string }) {
  const [bg, text] = (CATEGORIA_CORES[cat] || "#f3f4f6:#374151").split(":");
  return (
    <span style={{ background:bg, color:text, fontSize:".65rem", fontWeight:700, letterSpacing:"0.5px", padding:"2px 8px", borderRadius:20, textTransform:"uppercase", whiteSpace:"nowrap" }}>
      {cat}
    </span>
  );
}

function MargemBadge({ margem }: { margem: number | null }) {
  if (margem === null) return <span style={{ color:"#ccc" }}>—</span>;
  const cor = margem >= 65 ? "#15803d" : margem >= 45 ? "#92400e" : "#dc2626";
  const bg  = margem >= 65 ? "#dcfce7"  : margem >= 45 ? "#fef3c7"  : "#fef2f2";
  return (
    <span style={{ background:bg, color:cor, fontSize:".72rem", fontWeight:700, padding:"2px 10px", borderRadius:20 }}>
      {margem.toFixed(1)}%
    </span>
  );
}

export default function PratosClient() {
  const supabase = createClient();
  const [pratos, setPratos]           = useState<Prato[]>([]);
  const [loading, setLoading]         = useState(true);
  const [busca, setBusca]             = useState("");
  const [catFiltro, setCatFiltro]     = useState("Todas");
  const [apenasAtivos, setApenasAtivos] = useState(true);
  const [formAberto, setFormAberto]   = useState(false);
  const [editando, setEditando]       = useState<Prato | null>(null);

  const buscarPratos = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("vw_pratos_custo")
      .select("*")
      .order("categoria").order("nome");
    if (apenasAtivos)          query = query.eq("ativo", true);
    if (catFiltro !== "Todas") query = query.eq("categoria", catFiltro);
    if (busca.trim())          query = query.ilike("nome", `%${busca.trim()}%`);
    const { data, error } = await query;
    if (!error && data) setPratos(data);
    setLoading(false);
  }, [apenasAtivos, catFiltro, busca]);

  useEffect(() => {
    const t = setTimeout(buscarPratos, 300);
    return () => clearTimeout(t);
  }, [buscarPratos]);

  async function toggleAtivo(item: Prato) {
    await supabase.from("pratos").update({ ativo: !item.ativo }).eq("id", item.id);
    buscarPratos();
  }

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
  const totalAtivos = pratos.filter(p => p.ativo).length;
  const mediaMargemboa = pratos.filter(p => (p.margem_real ?? 0) >= 65).length;

  return (
    <div style={{ padding:24, maxWidth:1100, margin:"0 auto" }}>

      {/* HEADER */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16, marginBottom:24, flexWrap:"wrap" }}>
        <div>
          <p style={{ fontSize:".65rem", letterSpacing:3, textTransform:"uppercase", color:"#6366f1", fontWeight:700, marginBottom:4 }}>Módulo 2</p>
          <h1 style={{ fontSize:"1.6rem", fontWeight:800, color:"#111", lineHeight:1.1 }}>Composição de Pratos</h1>
          <p style={{ fontSize:".82rem", color:"#888", marginTop:4 }}>Monte pratos, calcule custos e visualize margens</p>
        </div>
        <button onClick={() => { setEditando(null); setFormAberto(true); }} style={{ background:"#6366f1", border:"none", borderRadius:10, padding:"10px 20px", fontSize:".85rem", fontWeight:700, color:"#fff", cursor:"pointer" }}>
          + Novo Prato
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:24 }}>
        {[
          { num:pratos.length,   label:"Total de pratos",   cor:"#111" },
          { num:totalAtivos,     label:"Ativos",            cor:"#6366f1" },
          { num:mediaMargemboa,  label:"Margem saudável",   cor:"#22c55e" },
          { num:pratos.filter(p => (p.margem_real ?? 100) < 45).length, label:"Margem crítica", cor:"#dc2626" },
        ].map(({ num, label, cor }) => (
          <div key={label} style={{ background:"#fff", border:"1px solid #f0f0f0", borderRadius:12, padding:"16px 20px", boxShadow:"0 1px 3px rgba(0,0,0,.05)" }}>
            <div style={{ fontSize:"1.6rem", fontWeight:800, color:cor }}>{num}</div>
            <div style={{ fontSize:".72rem", color:"#888", fontWeight:500 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* FILTROS */}
      <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:16 }}>
        <input placeholder="🔍  Buscar prato..." value={busca} onChange={e => setBusca(e.target.value)}
          style={{ border:"1.5px solid #e4e4e7", borderRadius:10, padding:"10px 16px", fontSize:".88rem", width:"100%", maxWidth:380, outline:"none" }} />
        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
          {CATEGORIAS_FILTRO.map(c => (
            <button key={c} onClick={() => setCatFiltro(c)} style={{ background: catFiltro===c ? "#ede9fe" : "#f4f4f5", border:`1.5px solid ${catFiltro===c ? "#6366f1" : "#e4e4e7"}`, borderRadius:20, padding:"4px 14px", fontSize:".75rem", fontWeight:600, color: catFiltro===c ? "#4338ca" : "#666", cursor:"pointer" }}>
              {c}
            </button>
          ))}
        </div>
        <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:".8rem", color:"#666", cursor:"pointer" }}>
          <input type="checkbox" checked={apenasAtivos} onChange={e => setApenasAtivos(e.target.checked)} />
          Apenas ativos
        </label>
      </div>

      {/* TABELA */}
      <div style={{ background:"#fff", border:"1px solid #f0f0f0", borderRadius:14, overflow:"hidden", boxShadow:"0 1px 6px rgba(0,0,0,.06)" }}>
        {loading ? (
          <div style={{ padding:40, textAlign:"center", color:"#888" }}>Carregando...</div>
        ) : pratos.length === 0 ? (
          <div style={{ padding:60, textAlign:"center", color:"#888" }}>
            <p style={{ marginBottom:16 }}>Nenhum prato encontrado.</p>
            <button onClick={() => setFormAberto(true)} style={{ background:"#6366f1", border:"none", borderRadius:10, padding:"10px 20px", fontSize:".85rem", fontWeight:700, color:"#fff", cursor:"pointer" }}>
              + Criar primeiro prato
            </button>
          </div>
        ) : (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"#f9fafb", borderBottom:"1px solid #f0f0f0" }}>
                {["Prato","Categoria","Preço Venda","Custo","Margem","Calorias","Status",""].map(h => (
                  <th key={h} style={{ padding:"11px 16px", textAlign:"left", fontSize:".7rem", fontWeight:700, textTransform:"uppercase", letterSpacing:.5, color:"#888" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pratos.map(item => (
                <tr key={item.id} style={{ borderBottom:"1px solid #f9f9f9", opacity: item.ativo ? 1 : 0.5 }}>
                  <td style={{ padding:"12px 16px" }}>
                    <div style={{ fontWeight:600, color:"#111", fontSize:".88rem" }}>{item.nome}</div>
                    {item.descricao && <div style={{ fontSize:".68rem", color:"#aaa", marginTop:2 }}>{item.descricao}</div>}
                  </td>
                  <td style={{ padding:"12px 16px" }}><CategoriaBadge cat={item.categoria} /></td>
                  <td style={{ padding:"12px 16px", fontSize:".85rem", fontWeight:700, color:"#111" }}>
                    {item.preco_venda ? fmt(item.preco_venda) : <span style={{color:"#ccc"}}>—</span>}
                  </td>
                  <td style={{ padding:"12px 16px", fontSize:".85rem", color:"#666" }}>
                    {item.custo_total > 0 ? fmt(item.custo_total) : <span style={{color:"#ccc"}}>—</span>}
                  </td>
                  <td style={{ padding:"12px 16px" }}>
                    <MargemBadge margem={item.margem_real} />
                  </td>
                  <td style={{ padding:"12px 16px", textAlign:"center", fontSize:".85rem" }}>
                    {item.calorias_total > 0 ? `${Math.round(item.calorias_total)} kcal` : <span style={{color:"#ccc"}}>—</span>}
                  </td>
                  <td style={{ padding:"12px 16px", textAlign:"center" }}>
                    <span style={{ display:"inline-block", fontSize:".68rem", fontWeight:700, padding:"2px 10px", borderRadius:20, textTransform:"uppercase", background: item.ativo ? "#ede9fe" : "#f3f4f6", color: item.ativo ? "#4338ca" : "#9ca3af" }}>
                      {item.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td style={{ padding:"12px 16px" }}>
                    <div style={{ display:"flex", gap:4, justifyContent:"flex-end" }}>
                      <button onClick={() => { setEditando(item); setFormAberto(true); }} style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 6px", borderRadius:6, fontSize:"1rem" }}>✏️</button>
                      <button onClick={() => toggleAtivo(item)} style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 6px", borderRadius:6, fontSize:"1rem" }}>
                        {item.ativo ? "🔴" : "🟢"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {formAberto && (
        <PratoForm
          inicial={editando ?? undefined}
          onSalvo={() => { setFormAberto(false); buscarPratos(); }}
          onCancelar={() => setFormAberto(false)}
        />
      )}
    </div>
  );
}
