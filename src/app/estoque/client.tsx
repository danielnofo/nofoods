"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import AjusteEstoqueForm from "@/components/estoque/AjusteEstoqueForm";

interface ItemEstoque {
  id:                  string;
  nome:                string;
  codigo_interno:      string | null;
  categoria:           string;
  unidade:             string;
  estoque_minimo:      number;
  saldo_atual:         number;
  estoque_agendado:    number;
  previsao_entrega:    string | null;
  custo_medio_atual:   number;
  custo_agendado:      number;
  variacao_custo_pct:  number | null;
  consumo_medio_diario:number;
  cobertura_dias:      number | null;
  nivel_estoque:       "saudavel" | "risco" | "ruptura";
}

const NIVEL_CONFIG = {
  saudavel: { label:"Saudável", bg:"#dcfce7", cor:"#15803d", emoji:"🟢" },
  risco:    { label:"Risco de Ruptura", bg:"#fef3c7", cor:"#92400e", emoji:"🟡" },
  ruptura:  { label:"Ruptura", bg:"#fee2e2", cor:"#dc2626", emoji:"🔴" },
};

function NivelBadge({ nivel }: { nivel: keyof typeof NIVEL_CONFIG }) {
  const c = NIVEL_CONFIG[nivel];
  return (
    <span style={{ background:c.bg, color:c.cor, fontSize:".68rem", fontWeight:700, padding:"2px 10px", borderRadius:20, whiteSpace:"nowrap" }}>
      {c.emoji} {c.label}
    </span>
  );
}

function VariacaoBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span style={{color:"#ccc"}}>—</span>;
  const cor = pct > 10 ? "#dc2626" : pct > 0 ? "#f59e0b" : "#15803d";
  const bg  = pct > 10 ? "#fee2e2" : pct > 0 ? "#fef3c7" : "#dcfce7";
  return (
    <span style={{ background:bg, color:cor, fontSize:".72rem", fontWeight:700, padding:"2px 8px", borderRadius:20 }}>
      {pct > 0 ? "+" : ""}{pct.toFixed(1)}%
    </span>
  );
}

export default function EstoqueClient() {
  const supabase = createClient();
  const [itens, setItens]             = useState<ItemEstoque[]>([]);
  const [loading, setLoading]         = useState(true);
  const [nivelFiltro, setNivelFiltro] = useState("todos");
  const [busca, setBusca]             = useState("");
  const [ajusteItem, setAjusteItem]   = useState<ItemEstoque | null>(null);

  const buscarEstoque = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("vw_estoque").select("*");
    if (nivelFiltro !== "todos") query = query.eq("nivel_estoque", nivelFiltro);
    if (busca.trim())            query = query.ilike("nome", `%${busca.trim()}%`);
    const { data, error } = await query;
    if (!error && data) setItens(data);
    setLoading(false);
  }, [nivelFiltro, busca]);

  useEffect(() => {
    const t = setTimeout(buscarEstoque, 300);
    return () => clearTimeout(t);
  }, [buscarEstoque]);

  const fmt    = (n: number) => n.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
  const fmtQtd = (n: number, u: string) => `${n % 1 === 0 ? n : n.toFixed(3)} ${u}`;

  const totalRuptura = itens.filter(i => i.nivel_estoque==="ruptura").length;
  const totalRisco   = itens.filter(i => i.nivel_estoque==="risco").length;
  const totalSaudavel= itens.filter(i => i.nivel_estoque==="saudavel").length;

  return (
    <div style={{ padding:24, maxWidth:1200, margin:"0 auto" }}>

      {/* HEADER */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16, marginBottom:24, flexWrap:"wrap" }}>
        <div>
          <p style={{ fontSize:".65rem", letterSpacing:3, textTransform:"uppercase", color:"#8b5cf6", fontWeight:700, marginBottom:4 }}>Módulo 5</p>
          <h1 style={{ fontSize:"1.6rem", fontWeight:800, color:"#111", lineHeight:1.1 }}>Estoque</h1>
          <p style={{ fontSize:".82rem", color:"#888", marginTop:4 }}>Saldo, cobertura, qualidade e alertas em tempo real</p>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:24 }}>
        {[
          { num:itens.length,   label:"Total ingredientes", cor:"#111" },
          { num:totalSaudavel,  label:"🟢 Saudável",        cor:"#15803d" },
          { num:totalRisco,     label:"🟡 Risco",           cor:"#92400e" },
          { num:totalRuptura,   label:"🔴 Ruptura",         cor:"#dc2626" },
        ].map(({ num, label, cor }) => (
          <div key={label} style={{ background:"#fff", border:`1px solid ${cor==="#dc2626"&&num>0?"#fecaca":cor==="#92400e"&&num>0?"#fde68a":"#f0f0f0"}`, borderRadius:12, padding:"16px 20px", boxShadow:"0 1px 3px rgba(0,0,0,.05)" }}>
            <div style={{ fontSize:"1.6rem", fontWeight:800, color:cor }}>{num}</div>
            <div style={{ fontSize:".72rem", color:"#888", fontWeight:500 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* FILTROS */}
      <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:16 }}>
        <input placeholder="🔍  Buscar ingrediente..." value={busca} onChange={e => setBusca(e.target.value)}
          style={{ border:"1.5px solid #e4e4e7", borderRadius:10, padding:"10px 16px", fontSize:".88rem", width:"100%", maxWidth:380, outline:"none" }} />
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {[
            { key:"todos",    label:"Todos" },
            { key:"ruptura",  label:"🔴 Ruptura" },
            { key:"risco",    label:"🟡 Risco" },
            { key:"saudavel", label:"🟢 Saudável" },
          ].map(f => (
            <button key={f.key} onClick={() => setNivelFiltro(f.key)}
              style={{ background: nivelFiltro===f.key ? "#ede9fe" : "#f4f4f5", border:`1.5px solid ${nivelFiltro===f.key ? "#8b5cf6" : "#e4e4e7"}`, borderRadius:20, padding:"4px 16px", fontSize:".75rem", fontWeight:600, color: nivelFiltro===f.key ? "#6d28d9" : "#666", cursor:"pointer" }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* TABELA */}
      <div style={{ background:"#fff", border:"1px solid #f0f0f0", borderRadius:14, overflow:"auto", boxShadow:"0 1px 6px rgba(0,0,0,.06)" }}>
        {loading ? (
          <div style={{ padding:40, textAlign:"center", color:"#888" }}>Carregando...</div>
        ) : itens.length === 0 ? (
          <div style={{ padding:60, textAlign:"center", color:"#888" }}>
            <p>Nenhum item encontrado.</p>
            <p style={{ fontSize:".8rem", marginTop:8 }}>Registre compras como "Recebido" para alimentar o estoque.</p>
          </div>
        ) : (
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:900 }}>
            <thead>
              <tr style={{ background:"#f9fafb", borderBottom:"1px solid #f0f0f0" }}>
                {["Ingrediente","Saldo Atual","Est. Agendado","Previsão","Cobertura","Nível","Custo Atual","Custo Agendado","Δ Custo","Ajuste"].map(h => (
                  <th key={h} style={{ padding:"11px 14px", textAlign:"left", fontSize:".65rem", fontWeight:700, textTransform:"uppercase", letterSpacing:.5, color:"#888", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {itens.map(item => (
                <tr key={item.id} style={{ borderBottom:"1px solid #f9f9f9", background: item.nivel_estoque==="ruptura" ? "#fff5f5" : item.nivel_estoque==="risco" ? "#fffbeb" : "#fff" }}>
                  <td style={{ padding:"12px 14px" }}>
                    <div style={{ fontWeight:600, color:"#111", fontSize:".85rem" }}>{item.nome}</div>
                    {item.codigo_interno && <div style={{ fontSize:".65rem", color:"#aaa", fontFamily:"monospace" }}>{item.codigo_interno}</div>}
                  </td>
                  <td style={{ padding:"12px 14px" }}>
                    <span style={{ fontWeight:700, fontSize:".88rem", color: item.saldo_atual <= 0 ? "#dc2626" : item.saldo_atual <= item.estoque_minimo ? "#f59e0b" : "#111" }}>
                      {fmtQtd(item.saldo_atual, item.unidade)}
                    </span>
                    {item.estoque_minimo > 0 && (
                      <div style={{ fontSize:".62rem", color:"#aaa" }}>mín: {fmtQtd(item.estoque_minimo, item.unidade)}</div>
                    )}
                  </td>
                  <td style={{ padding:"12px 14px", fontSize:".85rem", color:"#6366f1", fontWeight:600 }}>
                    {item.estoque_agendado > 0 ? fmtQtd(item.estoque_agendado, item.unidade) : <span style={{color:"#ccc"}}>—</span>}
                  </td>
                  <td style={{ padding:"12px 14px", fontSize:".8rem", color:"#666" }}>
                    {item.previsao_entrega ? new Date(item.previsao_entrega).toLocaleDateString("pt-BR") : <span style={{color:"#ccc"}}>—</span>}
                  </td>
                  <td style={{ padding:"12px 14px", textAlign:"center" }}>
                    {item.cobertura_dias !== null ? (
                      <span style={{ fontWeight:700, fontSize:".85rem", color: item.cobertura_dias <= 1 ? "#dc2626" : item.cobertura_dias <= 3 ? "#f59e0b" : "#15803d" }}>
                        {item.cobertura_dias}d
                      </span>
                    ) : <span style={{color:"#ccc"}}>—</span>}
                  </td>
                  <td style={{ padding:"12px 14px" }}>
                    <NivelBadge nivel={item.nivel_estoque} />
                  </td>
                  <td style={{ padding:"12px 14px", fontSize:".82rem", color:"#444" }}>
                    {item.custo_medio_atual > 0 ? fmt(item.custo_medio_atual) : <span style={{color:"#ccc"}}>—</span>}
                  </td>
                  <td style={{ padding:"12px 14px", fontSize:".82rem", color:"#444" }}>
                    {item.custo_agendado > 0 ? fmt(item.custo_agendado) : <span style={{color:"#ccc"}}>—</span>}
                  </td>
                  <td style={{ padding:"12px 14px" }}>
                    <VariacaoBadge pct={item.variacao_custo_pct} />
                  </td>
                  <td style={{ padding:"12px 14px" }}>
                    <button onClick={() => setAjusteItem(item)}
                      style={{ background:"#f5f3ff", border:"1px solid #ddd6fe", borderRadius:6, padding:"4px 10px", fontSize:".72rem", fontWeight:700, color:"#6d28d9", cursor:"pointer" }}>
                      ✏️ Ajustar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {ajusteItem && (
        <AjusteEstoqueForm
          item={ajusteItem}
          onSalvo={() => { setAjusteItem(null); buscarEstoque(); }}
          onCancelar={() => setAjusteItem(null)}
        />
      )}
    </div>
  );
}