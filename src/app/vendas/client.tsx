"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import VendaForm from "@/components/vendas/VendaForm";

interface Venda {
  id:               string;
  canal:            string;
  forma_pagamento:  string;
  status:           string;
  previsao_entrega: string | null;
  total:            number;
  subtotal:         number;
  taxa_entrega:     number;
  desconto:         number;
  qtd_itens:        number;
  cliente_nome:     string | null;
  cliente_whatsapp: string | null;
  observacoes:      string | null;
  created_at:       string;
}

const CANAL_EMOJI: Record<string, string> = {
  "Balcão":   "🏪",
  "WhatsApp": "📱",
  "iFood":    "🛵",
  "99Food":   "🛵",
  "Site":     "🌐",
};

const STATUS_CORES: Record<string, string> = {
  pendente:   "#fef3c7:#92400e",
  confirmado: "#dbeafe:#1e40af",
  em_preparo: "#fde68a:#92400e",
  entregue:   "#dcfce7:#15803d",
  cancelado:  "#fee2e2:#dc2626",
};

const STATUS_LABEL: Record<string, string> = {
  pendente:   "Pendente",
  confirmado: "Confirmado",
  em_preparo: "Em Preparo",
  entregue:   "Entregue",
  cancelado:  "Cancelado",
};

function StatusBadge({ status }: { status: string }) {
  const [bg, text] = (STATUS_CORES[status] || "#f3f4f6:#374151").split(":");
  return (
    <span style={{ background:bg, color:text, fontSize:".68rem", fontWeight:700, padding:"2px 10px", borderRadius:20, textTransform:"uppercase", letterSpacing:.5 }}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

export default function VendasClient() {
  const supabase = createClient();
  const [vendas, setVendas]           = useState<Venda[]>([]);
  const [loading, setLoading]         = useState(true);
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [canalFiltro, setCanalFiltro] = useState("todos");
  const [formAberto, setFormAberto]   = useState(false);

const buscarVendas = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("vw_vendas").select("*");

    if (statusFiltro === "atrasado") {
      query = query
        .not("previsao_entrega", "is", null)
        .lt("previsao_entrega", new Date().toISOString())
        .not("status", "in", "(entregue,cancelado)");
    } else if (statusFiltro !== "todos") {
      query = query.eq("status", statusFiltro);
    }

    if (canalFiltro !== "todos") query = query.eq("canal", canalFiltro);

    const { data, error } = await query;
    if (!error && data) setVendas(data);
    setLoading(false);
  }, [statusFiltro, canalFiltro]);

  useEffect(() => {
    const t = setTimeout(buscarVendas, 300);
    return () => clearTimeout(t);
  }, [buscarVendas]);

  async function atualizarStatus(id: string, status: string) {
    await supabase.from("vendas").update({ status }).eq("id", id);
    buscarVendas();
  }

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });

  const totalHoje = vendas
    .filter(v => v.status !== "cancelado" && new Date(v.created_at).toDateString() === new Date().toDateString())
    .reduce((s, v) => s + v.total, 0);

  const ticketMedio = vendas.filter(v => v.status !== "cancelado").length > 0
    ? vendas.filter(v => v.status !== "cancelado").reduce((s,v) => s+v.total, 0) / vendas.filter(v => v.status !== "cancelado").length
    : 0;

  return (
    <div style={{ padding:24, maxWidth:1100, margin:"0 auto" }}>

      {/* HEADER */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16, marginBottom:24, flexWrap:"wrap" }}>
        <div>
          <p style={{ fontSize:".65rem", letterSpacing:3, textTransform:"uppercase", color:"#ec4899", fontWeight:700, marginBottom:4 }}>Módulo 6</p>
          <h1 style={{ fontSize:"1.6rem", fontWeight:800, color:"#111", lineHeight:1.1 }}>Vendas</h1>
          <p style={{ fontSize:".82rem", color:"#888", marginTop:4 }}>Registre vendas e acompanhe faturamento em tempo real</p>
        </div>
        <button onClick={() => setFormAberto(true)}
          style={{ background:"#ec4899", border:"none", borderRadius:10, padding:"10px 20px", fontSize:".85rem", fontWeight:700, color:"#fff", cursor:"pointer" }}>
          + Nova Venda
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:24 }}>
        {[
          { num:vendas.filter(v=>v.status!=="cancelado").length, label:"Total vendas",    cor:"#111" },
          { num:fmt(totalHoje),                                  label:"Faturamento hoje",cor:"#ec4899" },
          { num:fmt(ticketMedio),                                label:"Ticket médio",    cor:"#6366f1" },
          { num:vendas.filter(v=>v.status==="em_preparo").length,label:"Em preparo",      cor:"#f59e0b" },
        ].map(({ num, label, cor }) => (
          <div key={label} style={{ background:"#fff", border:"1px solid #f0f0f0", borderRadius:12, padding:"16px 20px", boxShadow:"0 1px 3px rgba(0,0,0,.05)" }}>
            <div style={{ fontSize: typeof num === "string" ? "1.1rem" : "1.6rem", fontWeight:800, color:cor }}>{num}</div>
            <div style={{ fontSize:".72rem", color:"#888", fontWeight:500 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* FILTROS */}
      <div style={{ display:"flex", gap:16, marginBottom:16, flexWrap:"wrap" }}>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {["todos","pendente","confirmado","em_preparo","entregue","cancelado","atrasado"].map(s => (
            <button key={s} onClick={() => setStatusFiltro(s)}
              style={{ background: statusFiltro===s ? "#fce7f3" : "#f4f4f5", border:`1.5px solid ${statusFiltro===s ? "#ec4899" : "#e4e4e7"}`, borderRadius:20, padding:"4px 14px", fontSize:".75rem", fontWeight:600, color: statusFiltro===s ? "#9d174d" : "#666", cursor:"pointer" }}>
              {s === "atrasado" ? "⚠️ Atrasados" : STATUS_LABEL[s] || "Todos"}
            </button>
          ))}
        </div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {["todos","Balcão","WhatsApp","iFood","99Food","Site"].map(c => (
            <button key={c} onClick={() => setCanalFiltro(c)}
              style={{ background: canalFiltro===c ? "#f0fdf4" : "#f4f4f5", border:`1.5px solid ${canalFiltro===c ? "#22c55e" : "#e4e4e7"}`, borderRadius:20, padding:"4px 14px", fontSize:".75rem", fontWeight:600, color: canalFiltro===c ? "#15803d" : "#666", cursor:"pointer" }}>
              {c === "todos" ? "Todos canais" : `${CANAL_EMOJI[c]} ${c}`}
            </button>
          ))}
        </div>
      </div>

      {/* TABELA */}
      <div style={{ background:"#fff", border:"1px solid #f0f0f0", borderRadius:14, overflow:"hidden", boxShadow:"0 1px 6px rgba(0,0,0,.06)" }}>
        {loading ? (
          <div style={{ padding:40, textAlign:"center", color:"#888" }}>Carregando...</div>
        ) : vendas.length === 0 ? (
          <div style={{ padding:60, textAlign:"center", color:"#888" }}>
            <p style={{ marginBottom:16 }}>Nenhuma venda encontrada.</p>
            <button onClick={() => setFormAberto(true)}
              style={{ background:"#ec4899", border:"none", borderRadius:10, padding:"10px 20px", fontSize:".85rem", fontWeight:700, color:"#fff", cursor:"pointer" }}>
              + Registrar primeira venda
            </button>
          </div>
        ) : (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"#f9fafb", borderBottom:"1px solid #f0f0f0" }}>
                {["Data/Hora","Canal","Cliente","Itens","Subtotal","Total","Pagamento","Previsão","Status","Ações"].map(h => (
                  <th key={h} style={{ padding:"11px 14px", textAlign:"left", fontSize:".68rem", fontWeight:700, textTransform:"uppercase", letterSpacing:.5, color:"#888", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vendas.map(item => (
                <tr key={item.id} style={{ borderBottom:"1px solid #f9f9f9" }}>
                  <td style={{ padding:"12px 14px" }}>
                    <div style={{ fontWeight:600, color:"#111", fontSize:".82rem" }}>
                      {new Date(item.created_at).toLocaleDateString("pt-BR")}
                    </div>
                    <div style={{ fontSize:".68rem", color:"#aaa" }}>
                      {new Date(item.created_at).toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" })}
                    </div>
                  </td>
                  <td style={{ padding:"12px 14px", fontSize:".85rem" }}>
                    {CANAL_EMOJI[item.canal]} {item.canal}
                  </td>
                  <td style={{ padding:"12px 14px", fontSize:".82rem", color:"#444" }}>
                    {item.cliente_nome || <span style={{color:"#ccc"}}>—</span>}
                  </td>
                  <td style={{ padding:"12px 14px", textAlign:"center" }}>
                    <span style={{ background:"#f0f9ff", color:"#0369a1", fontWeight:700, padding:"2px 8px", borderRadius:20, fontSize:".72rem" }}>
                      {item.qtd_itens}
                    </span>
                  </td>
                  <td style={{ padding:"12px 14px", fontSize:".85rem", color:"#666" }}>
                    {fmt(item.subtotal)}
                  </td>
                  <td style={{ padding:"12px 14px", fontSize:".88rem", fontWeight:700, color:"#111" }}>
                    {fmt(item.total)}
                  </td>
                  <td style={{ padding:"12px 14px", fontSize:".78rem", color:"#555" }}>
                    {item.forma_pagamento}
                  </td>
                  <td style={{ padding:"12px 14px", fontSize:".78rem", color:"#555" }}>
                    {item.forma_pagamento}
                  </td>
                  <td style={{ padding:"12px 14px" }}>
                    {item.previsao_entrega ? (
                  <div>
                  <div style={{ fontSize:".82rem", fontWeight:700, color: new Date(item.previsao_entrega) < new Date() && item.status !== "entregue" && item.status !== "cancelado" ? "#dc2626" : "#15803d" }}>
                    {new Date(item.previsao_entrega).toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" })}
                  </div>
                    {new Date(item.previsao_entrega) < new Date() && item.status !== "entregue" && item.status !== "cancelado" && (
                  <div style={{ fontSize:".65rem", background:"#fee2e2", color:"#dc2626", padding:"1px 6px", borderRadius:10, fontWeight:700, display:"inline-block", marginTop:2 }}>
                    ⚠️ ATRASADO
                  </div>
                    )}
                  </div>
                    ) : <span style={{color:"#ccc"}}>—</span>}
                  </td>
                  <td style={{ padding:"12px 14px" }}>
                    <StatusBadge status={item.status} />
                  </td>
                  <td style={{ padding:"12px 14px" }}>
                    <div style={{ display:"flex", gap:4 }}>
                      {item.status === "confirmado" && (
                        <button onClick={() => atualizarStatus(item.id, "em_preparo")}
                          style={{ background:"#fef3c7", border:"1px solid #fde68a", borderRadius:6, padding:"3px 8px", fontSize:".68rem", fontWeight:700, color:"#92400e", cursor:"pointer", whiteSpace:"nowrap" }}>
                          🍳 Preparo
                        </button>
                      )}
                      {item.status === "em_preparo" && (
                        <button onClick={() => atualizarStatus(item.id, "entregue")}
                          style={{ background:"#dcfce7", border:"1px solid #bbf7d0", borderRadius:6, padding:"3px 8px", fontSize:".68rem", fontWeight:700, color:"#15803d", cursor:"pointer", whiteSpace:"nowrap" }}>
                          ✓ Entregue
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
        <VendaForm
          onSalvo={() => { setFormAberto(false); buscarVendas(); }}
          onCancelar={() => setFormAberto(false)}
        />
      )}
    </div>
  );
}