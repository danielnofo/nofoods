"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import CompraForm from "@/components/compras/CompraForm";

interface Compra {
  id:            string;
  data_compra:   string;
  data_entrega:  string | undefined;
  status:        string;
  observacoes:   string | undefined;
  fornecedor:    { nome_fantasia: string } | undefined;
  itens_count:   number;
  total:         number;
}

const STATUS_CORES: Record<string, string> = {
  pendente:   "#fef3c7:#92400e",
  recebido:   "#dcfce7:#15803d",
  cancelado:  "#fee2e2:#dc2626",
};

function StatusBadge({ status }: { status: string }) {
  const [bg, text] = (STATUS_CORES[status] || "#f3f4f6:#374151").split(":");
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span style={{ background:bg, color:text, fontSize:".68rem", fontWeight:700, padding:"2px 10px", borderRadius:20, textTransform:"uppercase", letterSpacing:.5 }}>
      {label}
    </span>
  );
}

export default function ComprasClient() {
  const supabase = createClient();
  const [compras, setCompras]         = useState<Compra[]>([]);
  const [loading, setLoading]         = useState(true);
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [formAberto, setFormAberto]   = useState(false);
  const [editando, setEditando]       = useState<Compra | null>(null);

  const buscarCompras = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("compras")
      .select("id,data_compra,data_entrega,status,observacoes,fornecedor:fornecedores(nome_fantasia)")
      .order("data_compra", { ascending: false });
    if (statusFiltro !== "todos") query = query.eq("status", statusFiltro);
    const { data, error } = await query;
    if (!error && data) {
      // buscar contagem e total de itens por compra
      const comprasComTotal = await Promise.all(
        data.map(async (c: any) => {
          const { data: itens } = await supabase
            .from("compra_itens")
            .select("valor_total")
            .eq("compra_id", c.id);
          const total = (itens || []).reduce((s: number, i: any) => s + (i.valor_total || 0), 0);
          return { ...c, itens_count: (itens || []).length, total };
        })
      );
      setCompras(comprasComTotal);
    }
    setLoading(false);
  }, [statusFiltro]);

  useEffect(() => {
    const t = setTimeout(buscarCompras, 300);
    return () => clearTimeout(t);
  }, [buscarCompras]);

  async function atualizarStatus(id: string, status: string) {
    await supabase.from("compras").update({ status }).eq("id", id);
    buscarCompras();
  }

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
  const totalPendente = compras.filter(c => c.status==="pendente").reduce((s,c) => s+c.total, 0);
  const totalRecebido = compras.filter(c => c.status==="recebido").reduce((s,c) => s+c.total, 0);

  return (
    <div style={{ padding:24, maxWidth:1100, margin:"0 auto" }}>

      {/* HEADER */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16, marginBottom:24, flexWrap:"wrap" }}>
        <div>
          <p style={{ fontSize:".65rem", letterSpacing:3, textTransform:"uppercase", color:"#0ea5e9", fontWeight:700, marginBottom:4 }}>Módulo 4</p>
          <h1 style={{ fontSize:"1.6rem", fontWeight:800, color:"#111", lineHeight:1.1 }}>Compras</h1>
          <p style={{ fontSize:".82rem", color:"#888", marginTop:4 }}>Registre compras e atualize o custo dos ingredientes</p>
        </div>
        <button onClick={() => { setEditando(null); setFormAberto(true); }}
          style={{ background:"#0ea5e9", border:"none", borderRadius:10, padding:"10px 20px", fontSize:".85rem", fontWeight:700, color:"#fff", cursor:"pointer" }}>
          + Nova Compra
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:24 }}>
        {[
          { num:compras.length,                                          label:"Total de compras",  cor:"#111" },
          { num:compras.filter(c=>c.status==="pendente").length,         label:"Pendentes",         cor:"#f59e0b" },
          { num:fmt(totalPendente),                                      label:"Valor pendente",    cor:"#f59e0b" },
          { num:fmt(totalRecebido),                                      label:"Total recebido",    cor:"#22c55e" },
        ].map(({ num, label, cor }) => (
          <div key={label} style={{ background:"#fff", border:"1px solid #f0f0f0", borderRadius:12, padding:"16px 20px", boxShadow:"0 1px 3px rgba(0,0,0,.05)" }}>
            <div style={{ fontSize: typeof num === "string" ? "1.1rem" : "1.6rem", fontWeight:800, color:cor }}>{num}</div>
            <div style={{ fontSize:".72rem", color:"#888", fontWeight:500 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* FILTRO STATUS */}
      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
        {["todos","pendente","recebido","cancelado"].map(s => (
          <button key={s} onClick={() => setStatusFiltro(s)}
            style={{ background: statusFiltro===s ? "#e0f2fe" : "#f4f4f5", border:`1.5px solid ${statusFiltro===s ? "#0ea5e9" : "#e4e4e7"}`, borderRadius:20, padding:"4px 16px", fontSize:".75rem", fontWeight:600, color: statusFiltro===s ? "#0369a1" : "#666", cursor:"pointer" }}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* TABELA */}
      <div style={{ background:"#fff", border:"1px solid #f0f0f0", borderRadius:14, overflow:"hidden", boxShadow:"0 1px 6px rgba(0,0,0,.06)" }}>
        {loading ? (
          <div style={{ padding:40, textAlign:"center", color:"#888" }}>Carregando...</div>
        ) : compras.length === 0 ? (
          <div style={{ padding:60, textAlign:"center", color:"#888" }}>
            <p style={{ marginBottom:16 }}>Nenhuma compra encontrada.</p>
            <button onClick={() => setFormAberto(true)}
              style={{ background:"#0ea5e9", border:"none", borderRadius:10, padding:"10px 20px", fontSize:".85rem", fontWeight:700, color:"#fff", cursor:"pointer" }}>
              + Registrar primeira compra
            </button>
          </div>
        ) : (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"#f9fafb", borderBottom:"1px solid #f0f0f0" }}>
                {["Data","Fornecedor","Itens","Total","Entrega","Status","Ações"].map(h => (
                  <th key={h} style={{ padding:"11px 16px", textAlign:"left", fontSize:".7rem", fontWeight:700, textTransform:"uppercase", letterSpacing:.5, color:"#888" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {compras.map(item => (
                <tr key={item.id} style={{ borderBottom:"1px solid #f9f9f9" }}>
                  <td style={{ padding:"12px 16px", fontSize:".85rem", fontWeight:600, color:"#111" }}>
                    {new Date(item.data_compra).toLocaleDateString("pt-BR")}
                  </td>
                  <td style={{ padding:"12px 16px", fontSize:".85rem", color:"#444" }}>
                    {(item.fornecedor as any)?.nome_fantasia || <span style={{color:"#ccc"}}>—</span>}
                  </td>
                  <td style={{ padding:"12px 16px", textAlign:"center", fontSize:".85rem" }}>
                    <span style={{ background:"#f0f9ff", color:"#0369a1", fontWeight:700, padding:"2px 10px", borderRadius:20, fontSize:".72rem" }}>
                      {item.itens_count} {item.itens_count === 1 ? "item" : "itens"}
                    </span>
                  </td>
                  <td style={{ padding:"12px 16px", fontSize:".88rem", fontWeight:700, color:"#111" }}>
                    {fmt(item.total)}
                  </td>
                  <td style={{ padding:"12px 16px", fontSize:".82rem", color:"#666" }}>
                    {item.data_entrega ? new Date(item.data_entrega).toLocaleDateString("pt-BR") : <span style={{color:"#ccc"}}>—</span>}
                  </td>
                  <td style={{ padding:"12px 16px" }}>
                    <StatusBadge status={item.status} />
                  </td>
                  <td style={{ padding:"12px 16px" }}>
                    <div style={{ display:"flex", gap:4 }}>
                      <button onClick={() => { setEditando(item); setFormAberto(true); }}
                        style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 6px", borderRadius:6, fontSize:"1rem" }}>✏️</button>
                      {item.status === "pendente" && (
                        <button onClick={() => atualizarStatus(item.id, "recebido")}
                          title="Marcar como recebido"
                          style={{ background:"#dcfce7", border:"1px solid #bbf7d0", cursor:"pointer", padding:"4px 8px", borderRadius:6, fontSize:".72rem", fontWeight:700, color:"#15803d" }}>
                          ✓ Recebido
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {formAberto && (
        <CompraForm
          inicial={editando ? editando as any : undefined}
          onSalvo={() => { setFormAberto(false); buscarCompras(); }}
          onCancelar={() => setFormAberto(false)}
        />
      )}
    </div>
  );
}