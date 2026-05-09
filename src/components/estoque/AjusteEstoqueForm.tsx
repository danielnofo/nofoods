"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";

interface ItemEstoque {
  id:           string;
  nome:         string;
  unidade:      string;
  saldo_atual:  number;
}

interface Props {
  item:       ItemEstoque;
  onSalvo?:   () => void;
  onCancelar?:() => void;
}

export default function AjusteEstoqueForm({ item, onSalvo, onCancelar }: Props) {
  const supabase = createClient();
  const [tipo, setTipo]           = useState<"entrada"|"saida"|"ajuste">("ajuste");
  const [quantidade, setQuantidade] = useState("");
  const [qualidade, setQualidade] = useState("bom");
  const [observacoes, setObs]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [erro, setErro]           = useState<string | null>(null);

  const fmtQtd = (n: number) => `${n % 1 === 0 ? n : n.toFixed(3)} ${item.unidade}`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!quantidade || parseFloat(quantidade) <= 0) return setErro("Informe uma quantidade válida.");
    setLoading(true);

    const { error } = await supabase.from("estoque_movimentacoes").insert({
      ingrediente_id: item.id,
      tipo,
      quantidade:     parseFloat(quantidade),
      unidade:        item.unidade,
      motivo:         "ajuste_manual",
      qualidade,
      observacoes:    observacoes.trim() || null,
    });

    setLoading(false);
    if (error) return setErro(error.message);
    onSalvo?.();
  }

  const inputStyle = {
    border:"1.5px solid #e4e4e7", borderRadius:8,
    padding:"9px 12px", fontSize:".88rem", color:"#111",
    background:"#fafafa", width:"100%", outline:"none", fontFamily:"inherit",
  };
  const labelStyle = {
    fontSize:".75rem", fontWeight:700 as const, color:"#555",
    textTransform:"uppercase" as const, letterSpacing:".5px", marginBottom:5, display:"block",
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:50, background:"rgba(0,0,0,.55)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#fff", borderRadius:16, width:"100%", maxWidth:480, boxShadow:"0 24px 60px rgba(0,0,0,.2)" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", padding:"24px 24px 0", gap:12 }}>
          <div>
            <p style={{ fontSize:".65rem", letterSpacing:3, textTransform:"uppercase", color:"#8b5cf6", fontWeight:700, marginBottom:2 }}>ESTOQUE</p>
            <h2 style={{ fontSize:"1.2rem", fontWeight:700, color:"#111" }}>Ajuste Manual</h2>
            <p style={{ fontSize:".8rem", color:"#888", marginTop:4 }}>{item.nome} · Saldo atual: <strong>{fmtQtd(item.saldo_atual)}</strong></p>
          </div>
          <button onClick={onCancelar} style={{ background:"#f4f4f5", border:"none", borderRadius:8, width:32, height:32, cursor:"pointer", fontSize:".9rem", color:"#666" }}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding:"20px 24px", display:"flex", flexDirection:"column", gap:14 }}>

            {/* Tipo */}
            <div>
              <label style={labelStyle}>Tipo de Ajuste</label>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
                {[
                  { key:"entrada", label:"Entrada",     emoji:"⬆️", cor:"#15803d", bg:"#dcfce7" },
                  { key:"saida",   label:"Saída",       emoji:"⬇️", cor:"#dc2626", bg:"#fee2e2" },
                  { key:"ajuste",  label:"Correção",    emoji:"✏️", cor:"#6d28d9", bg:"#ede9fe" },
                ].map(op => (
                  <button key={op.key} type="button" onClick={() => setTipo(op.key as any)}
                    style={{ background: tipo===op.key ? op.bg : "#f9fafb", border:`2px solid ${tipo===op.key ? op.cor : "#e4e4e7"}`, borderRadius:10, padding:"10px 8px", cursor:"pointer", textAlign:"center" }}>
                    <div style={{ fontSize:"1.2rem" }}>{op.emoji}</div>
                    <div style={{ fontSize:".78rem", fontWeight:700, color: tipo===op.key ? op.cor : "#666", marginTop:4 }}>{op.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Quantidade */}
            <div>
              <label style={labelStyle}>Quantidade ({item.unidade})</label>
              <input style={inputStyle} type="number" min="0" step="0.001" placeholder="0" value={quantidade} onChange={e => setQuantidade(e.target.value)} autoFocus />
            </div>

            {/* Qualidade */}
            <div>
              <label style={labelStyle}>Qualidade</label>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {[
                  { key:"bom",     label:"✅ Bom",     cor:"#15803d", bg:"#dcfce7" },
                  { key:"avariado",label:"⚠️ Avariado", cor:"#dc2626", bg:"#fee2e2" },
                ].map(q => (
                  <button key={q.key} type="button" onClick={() => setQualidade(q.key)}
                    style={{ background: qualidade===q.key ? q.bg : "#f9fafb", border:`2px solid ${qualidade===q.key ? q.cor : "#e4e4e7"}`, borderRadius:10, padding:"10px", cursor:"pointer", fontSize:".82rem", fontWeight:700, color: qualidade===q.key ? q.cor : "#666" }}>
                    {q.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Observações */}
            <div>
              <label style={labelStyle}>Observações</label>
              <textarea style={{ ...inputStyle, resize:"vertical" }} value={observacoes} onChange={e => setObs(e.target.value)} placeholder="Motivo do ajuste, número da nota, etc..." rows={2} />
            </div>

            {/* Preview */}
            {quantidade && parseFloat(quantidade) > 0 && (
              <div style={{ background:"#f5f3ff", border:"1px solid #ddd6fe", borderRadius:10, padding:"12px 16px", fontSize:".82rem", color:"#6d28d9" }}>
                {tipo === "ajuste"
                  ? `📦 Estoque será corrigido para ${fmtQtd(parseFloat(quantidade))}`
                  : tipo === "entrada"
                  ? `⬆️ Novo saldo: ${fmtQtd(item.saldo_atual + parseFloat(quantidade))}`
                  : `⬇️ Novo saldo: ${fmtQtd(Math.max(0, item.saldo_atual - parseFloat(quantidade)))}`
                }
              </div>
            )}
          </div>

          {erro && (
            <div style={{ margin:"0 24px 8px", background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8, padding:"10px 14px", fontSize:".82rem", color:"#dc2626" }}>{erro}</div>
          )}

          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", padding:"16px 24px", borderTop:"1px solid #f0f0f0" }}>
            <button type="button" onClick={onCancelar} style={{ background:"none", border:"1.5px solid #e4e4e7", borderRadius:8, padding:"9px 20px", fontSize:".85rem", fontWeight:600, color:"#666", cursor:"pointer" }}>Cancelar</button>
            <button type="submit" disabled={loading} style={{ background:loading ? "#c4b5fd" : "#8b5cf6", border:"none", borderRadius:8, padding:"9px 24px", fontSize:".85rem", fontWeight:700, color:"#fff", cursor:loading?"not-allowed":"pointer" }}>
              {loading ? "Salvando..." : "Confirmar Ajuste"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}