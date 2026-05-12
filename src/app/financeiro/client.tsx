"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import CustoForm from "@/components/financeiro/CustoForm";

interface DRE {
  data:               string;
  faturamento_bruto:  number;
  custo_variavel:     number;
  margem_variavel:    number;
  margem_variavel_pct:number;
  qtd_vendas:         number;
  aliquota_pct:       number;
  tributacao:         number;
}

interface CustoOperacional {
  id:            string;
  nome:          string;
  categoria:     string;
  valor:         number;
  temporalidade: string;
  dia_vencimento:number | null;
  ativo:         boolean;
}

interface Aliquota {
  aliquota_pct: number;
}

type Periodo = "diario" | "semanal" | "mensal";

const PERIODO_LABEL: Record<Periodo, string> = {
  diario:  "Diário",
  semanal: "Semanal",
  mensal:  "Mensal",
};

const CATEGORIA_CORES: Record<string, string> = {
  "Aluguel":       "#fde68a:#92400e",
  "Funcionários":  "#dbeafe:#1e40af",
  "Energia":       "#fef3c7:#92400e",
  "Água":          "#e0f2fe:#0369a1",
  "Internet":      "#ede9fe:#5b21b6",
  "Marketing":     "#fce7f3:#9d174d",
  "Manutenção":    "#fee2e2:#dc2626",
  "Contabilidade": "#dcfce7:#166534",
  "Embalagens":    "#f3f4f6:#374151",
  "Outros":        "#f3f4f6:#374151",
};

function CategoriaBadge({ cat }: { cat: string }) {
  const [bg, text] = (CATEGORIA_CORES[cat] || "#f3f4f6:#374151").split(":");
  return (
    <span style={{ background:bg, color:text, fontSize:".65rem", fontWeight:700, letterSpacing:"0.5px", padding:"2px 8px", borderRadius:20, textTransform:"uppercase", whiteSpace:"nowrap" }}>
      {cat}
    </span>
  );
}

export default function FinanceiroClient() {
  const supabase = createClient();
  const [periodo, setPeriodo]         = useState<Periodo>("diario");
  const [dre, setDre]                 = useState<DRE[]>([]);
  const [custos, setCustos]           = useState<CustoOperacional[]>([]);
  const [aliquota, setAliquota]       = useState<number>(6.0);
  const [loading, setLoading]         = useState(true);
  const [formAberto, setFormAberto]   = useState(false);
  const [editando, setEditando]       = useState<CustoOperacional | null>(null);
  const [abaAtiva, setAbaAtiva]       = useState<"dre"|"custos"|"config">("dre");

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });

  const buscarDados = useCallback(async () => {
    setLoading(true);

    // DRE
    const { data: dreData } = await supabase
      .from("vw_dre_diario")
      .select("*")
      .limit(periodo === "diario" ? 30 : periodo === "semanal" ? 12 : 12);
    if (dreData) setDre(dreData);

    // Custos operacionais
    const { data: custosData } = await supabase
      .from("custos_operacionais")
      .select("*")
      .order("categoria").order("nome");
    if (custosData) setCustos(custosData);

    // Alíquota
    const { data: aliqData } = await supabase
      .from("config_tributaria")
      .select("aliquota_pct")
      .eq("ativo", true)
      .single();
    if (aliqData) setAliquota(aliqData.aliquota_pct);

    setLoading(false);
  }, [periodo]);

  useEffect(() => {
    const t = setTimeout(buscarDados, 300);
    return () => clearTimeout(t);
  }, [buscarDados]);

  // Calcular custo fixo mensal total
  const custoFixoMensal = custos
    .filter(c => c.ativo)
    .reduce((s, c) => {
      if (c.temporalidade === "mensal")     return s + c.valor;
      if (c.temporalidade === "semanal")    return s + c.valor * 4.33;
      if (c.temporalidade === "quinzenal")  return s + c.valor * 2;
      if (c.temporalidade === "anual")      return s + c.valor / 12;
      return s + c.valor;
    }, 0);

  const custoFixoDiario = custoFixoMensal / 30;

  // Totais do período
  const totalFaturamento  = dre.reduce((s, d) => s + d.faturamento_bruto, 0);
  const totalCustoVariavel = dre.reduce((s, d) => s + d.custo_variavel, 0);
  const totalTributacao   = dre.reduce((s, d) => s + d.tributacao, 0);
  const totalMargemVariavel = totalFaturamento - totalCustoVariavel;
  const totalCustoFixo    = custoFixoDiario * dre.length;
  const totalMargemOp     = totalMargemVariavel - totalCustoFixo - totalTributacao;
  const totalMargemOpPct  = totalFaturamento > 0 ? (totalMargemOp / totalFaturamento * 100) : 0;

  async function toggleCusto(item: CustoOperacional) {
    await supabase.from("custos_operacionais").update({ ativo: !item.ativo }).eq("id", item.id);
    buscarDados();
  }

  return (
    <div style={{ padding:24, maxWidth:1100, margin:"0 auto" }}>

      {/* HEADER */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16, marginBottom:24, flexWrap:"wrap" }}>
        <div>
          <p style={{ fontSize:".65rem", letterSpacing:3, textTransform:"uppercase", color:"#10b981", fontWeight:700, marginBottom:4 }}>Módulo 7</p>
          <h1 style={{ fontSize:"1.6rem", fontWeight:800, color:"#111", lineHeight:1.1 }}>Financeiro</h1>
          <p style={{ fontSize:".82rem", color:"#888", marginTop:4 }}>DRE · Custos Operacionais · Margem Real</p>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          {(["diario","semanal","mensal"] as Periodo[]).map(p => (
            <button key={p} onClick={() => setPeriodo(p)}
              style={{ background:periodo===p?"#ecfdf5":"#f4f4f5", border:`1.5px solid ${periodo===p?"#10b981":"#e4e4e7"}`, borderRadius:8, padding:"8px 16px", fontSize:".8rem", fontWeight:700, color:periodo===p?"#065f46":"#666", cursor:"pointer" }}>
              {PERIODO_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs PRINCIPAIS */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:24 }}>
        {[
          { label:"Faturamento Bruto",   val:fmt(totalFaturamento),   cor:"#111",    sub:"período selecionado" },
          { label:"CMV / Custo Variável",val:fmt(totalCustoVariavel), cor:"#dc2626", sub:`${totalFaturamento>0?((totalCustoVariavel/totalFaturamento)*100).toFixed(1):0}% do faturamento` },
          { label:"Margem Operacional",  val:`${totalMargemOpPct.toFixed(1)}%`, cor: totalMargemOpPct>=15?"#15803d":totalMargemOpPct>=5?"#92400e":"#dc2626", sub:fmt(totalMargemOp) },
          { label:"Custo Fixo Estimado", val:fmt(totalCustoFixo),     cor:"#6366f1", sub:`R$ ${custoFixoMensal.toFixed(2)}/mês` },
        ].map(({ label, val, cor, sub }) => (
          <div key={label} style={{ background:"#fff", border:"1px solid #f0f0f0", borderRadius:12, padding:"16px 20px", boxShadow:"0 1px 3px rgba(0,0,0,.05)" }}>
            <div style={{ fontSize:".68rem", color:"#888", fontWeight:500, textTransform:"uppercase", letterSpacing:.5, marginBottom:4 }}>{label}</div>
            <div style={{ fontSize:"1.3rem", fontWeight:800, color:cor }}>{val}</div>
            <div style={{ fontSize:".7rem", color:"#aaa", marginTop:4 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div style={{ display:"flex", borderBottom:"1px solid #f0f0f0", marginBottom:20, gap:0 }}>
        {[
          { key:"dre",    label:"📊 DRE" },
          { key:"custos", label:"💸 Custos Operacionais" },
          { key:"config", label:"⚙️ Configurações" },
        ].map(t => (
          <button key={t.key} type="button" onClick={() => setAbaAtiva(t.key as any)}
            style={{ background:"none", border:"none", padding:"10px 20px", fontSize:".85rem", fontWeight:600, cursor:"pointer", color:abaAtiva===t.key?"#10b981":"#999", borderBottom:abaAtiva===t.key?"2px solid #10b981":"2px solid transparent", marginBottom:-1 }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding:40, textAlign:"center", color:"#888" }}>Carregando...</div>
      ) : (
        <>
          {/* ABA DRE */}
          {abaAtiva === "dre" && (
            <div>
              {dre.length === 0 ? (
                <div style={{ padding:60, textAlign:"center", color:"#888" }}>
                  <p>Nenhum dado financeiro encontrado.</p>
                  <p style={{ fontSize:".8rem", marginTop:8 }}>Registre vendas para gerar o DRE.</p>
                </div>
              ) : (
                <>
                  {/* DRE Consolidado */}
                  <div style={{ background:"#fff", border:"1px solid #f0f0f0", borderRadius:14, padding:24, marginBottom:20, boxShadow:"0 1px 6px rgba(0,0,0,.06)" }}>
                    <div style={{ fontSize:".7rem", fontWeight:700, color:"#10b981", textTransform:"uppercase", letterSpacing:2, marginBottom:16 }}>DRE Consolidado — {PERIODO_LABEL[periodo]}</div>

                    {[
                      { label:"(+) Faturamento Bruto",      val:totalFaturamento,   cor:"#111",    bold:true },
                      { label:"(-) CMV / Custo Variável",   val:-totalCustoVariavel,cor:"#dc2626",  bold:false },
                      { label:"(=) Margem de Contribuição", val:totalMargemVariavel,cor: totalMargemVariavel>=0?"#15803d":"#dc2626", bold:true },
                      { label:"(-) Custos Fixos Estimados", val:-totalCustoFixo,    cor:"#6366f1",  bold:false },
                      { label:"(-) Tributação (Simples)",   val:-totalTributacao,   cor:"#f59e0b",  bold:false },
                      { label:"(=) Resultado Operacional",  val:totalMargemOp,      cor: totalMargemOp>=0?"#15803d":"#dc2626", bold:true },
                    ].map(({ label, val, cor, bold }, i) => (
                      <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:"1px solid #f9f9f9" }}>
                        <span style={{ fontSize:bold?".9rem":".85rem", fontWeight:bold?800:400, color:bold?"#111":"#555" }}>{label}</span>
                        <span style={{ fontSize:bold?"1.1rem":".9rem", fontWeight:bold?800:600, color:cor }}>{fmt(Math.abs(val))}</span>
                      </div>
                    ))}

                    {totalFaturamento > 0 && (
                      <div style={{ marginTop:16, background:"#f0fdf4", borderRadius:10, padding:"12px 16px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <span style={{ fontSize:".82rem", color:"#15803d", fontWeight:600 }}>Margem Operacional Final</span>
                        <span style={{ fontSize:"1.4rem", fontWeight:800, color: totalMargemOpPct>=15?"#15803d":totalMargemOpPct>=5?"#f59e0b":"#dc2626" }}>
                          {totalMargemOpPct.toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Tabela diária */}
                  <div style={{ background:"#fff", border:"1px solid #f0f0f0", borderRadius:14, overflow:"hidden", boxShadow:"0 1px 6px rgba(0,0,0,.06)" }}>
                    <div style={{ padding:"14px 20px", borderBottom:"1px solid #f0f0f0", fontSize:".7rem", fontWeight:700, color:"#aaa", textTransform:"uppercase", letterSpacing:2 }}>
                      Detalhamento por Dia
                    </div>
                    <table style={{ width:"100%", borderCollapse:"collapse" }}>
                      <thead>
                        <tr style={{ background:"#f9fafb", borderBottom:"1px solid #f0f0f0" }}>
                          {["Data","Vendas","Faturamento","CMV","Margem Variável","% Margem","Tributação"].map(h => (
                            <th key={h} style={{ padding:"11px 16px", textAlign:"left", fontSize:".68rem", fontWeight:700, textTransform:"uppercase", letterSpacing:.5, color:"#888" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {dre.map((d, i) => {
                          const margem = d.faturamento_bruto - d.custo_variavel;
                          const margemPct = d.faturamento_bruto > 0 ? (margem/d.faturamento_bruto*100) : 0;
                          return (
                            <tr key={i} style={{ borderBottom:"1px solid #f9f9f9" }}>
                              <td style={{ padding:"12px 16px", fontWeight:600, fontSize:".85rem" }}>
                                {new Date(d.data).toLocaleDateString("pt-BR")}
                              </td>
                              <td style={{ padding:"12px 16px", textAlign:"center" }}>
                                <span style={{ background:"#f0f9ff", color:"#0369a1", fontWeight:700, padding:"2px 8px", borderRadius:20, fontSize:".72rem" }}>{d.qtd_vendas}</span>
                              </td>
                              <td style={{ padding:"12px 16px", fontWeight:700, fontSize:".88rem" }}>{fmt(d.faturamento_bruto)}</td>
                              <td style={{ padding:"12px 16px", fontSize:".85rem", color:"#dc2626" }}>{fmt(d.custo_variavel)}</td>
                              <td style={{ padding:"12px 16px", fontWeight:700, color: margem>=0?"#15803d":"#dc2626", fontSize:".88rem" }}>{fmt(margem)}</td>
                              <td style={{ padding:"12px 16px" }}>
                                <span style={{ background: margemPct>=65?"#dcfce7":margemPct>=45?"#fef3c7":"#fee2e2", color: margemPct>=65?"#15803d":margemPct>=45?"#92400e":"#dc2626", fontSize:".72rem", fontWeight:700, padding:"2px 8px", borderRadius:20 }}>
                                  {margemPct.toFixed(1)}%
                                </span>
                              </td>
                              <td style={{ padding:"12px 16px", fontSize:".82rem", color:"#f59e0b" }}>{fmt(d.tributacao)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ABA CUSTOS */}
          {abaAtiva === "custos" && (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                <div style={{ fontSize:".82rem", color:"#888" }}>
                  Total mensal estimado: <strong style={{ color:"#6366f1" }}>{fmt(custoFixoMensal)}</strong>
                </div>
                <button onClick={() => { setEditando(null); setFormAberto(true); }}
                  style={{ background:"#10b981", border:"none", borderRadius:8, padding:"8px 18px", fontSize:".82rem", fontWeight:700, color:"#fff", cursor:"pointer" }}>
                  + Novo Custo
                </button>
              </div>

              <div style={{ background:"#fff", border:"1px solid #f0f0f0", borderRadius:14, overflow:"hidden", boxShadow:"0 1px 6px rgba(0,0,0,.06)" }}>
                {custos.length === 0 ? (
                  <div style={{ padding:60, textAlign:"center", color:"#888" }}>
                    <p style={{ marginBottom:16 }}>Nenhum custo cadastrado.</p>
                    <button onClick={() => setFormAberto(true)}
                      style={{ background:"#10b981", border:"none", borderRadius:8, padding:"10px 20px", fontSize:".85rem", fontWeight:700, color:"#fff", cursor:"pointer" }}>
                      + Cadastrar primeiro custo
                    </button>
                  </div>
                ) : (
                  <table style={{ width:"100%", borderCollapse:"collapse" }}>
                    <thead>
                      <tr style={{ background:"#f9fafb", borderBottom:"1px solid #f0f0f0" }}>
                        {["Custo","Categoria","Valor","Frequência","Vencimento","Status",""].map(h => (
                          <th key={h} style={{ padding:"11px 16px", textAlign:"left", fontSize:".7rem", fontWeight:700, textTransform:"uppercase", letterSpacing:.5, color:"#888" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {custos.map(item => (
                        <tr key={item.id} style={{ borderBottom:"1px solid #f9f9f9", opacity:item.ativo?1:0.5 }}>
                          <td style={{ padding:"12px 16px", fontWeight:600, color:"#111", fontSize:".88rem" }}>{item.nome}</td>
                          <td style={{ padding:"12px 16px" }}><CategoriaBadge cat={item.categoria} /></td>
                          <td style={{ padding:"12px 16px", fontWeight:700, fontSize:".88rem" }}>{fmt(item.valor)}</td>
                          <td style={{ padding:"12px 16px", fontSize:".82rem", color:"#666", textTransform:"capitalize" }}>{item.temporalidade}</td>
                          <td style={{ padding:"12px 16px", fontSize:".82rem", color:"#888" }}>
                            {item.dia_vencimento ? `Dia ${item.dia_vencimento}` : <span style={{color:"#ccc"}}>—</span>}
                          </td>
                          <td style={{ padding:"12px 16px" }}>
                            <span style={{ display:"inline-block", fontSize:".68rem", fontWeight:700, padding:"2px 10px", borderRadius:20, textTransform:"uppercase", background:item.ativo?"#ecfdf5":"#f3f4f6", color:item.ativo?"#065f46":"#9ca3af" }}>
                              {item.ativo ? "Ativo" : "Inativo"}
                            </span>
                          </td>
                          <td style={{ padding:"12px 16px" }}>
                            <div style={{ display:"flex", gap:4 }}>
                              <button onClick={() => { setEditando(item); setFormAberto(true); }} style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 6px", borderRadius:6, fontSize:"1rem" }}>✏️</button>
                              <button onClick={() => toggleCusto(item)} style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 6px", borderRadius:6, fontSize:"1rem" }}>
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
            </div>
          )}

          {/* ABA CONFIG */}
          {abaAtiva === "config" && (
            <div style={{ maxWidth:480 }}>
              <div style={{ background:"#fff", border:"1px solid #f0f0f0", borderRadius:14, padding:24, boxShadow:"0 1px 6px rgba(0,0,0,.06)" }}>
                <div style={{ fontSize:".7rem", fontWeight:700, color:"#10b981", textTransform:"uppercase", letterSpacing:2, marginBottom:16 }}>Tributação — Simples Nacional</div>
                <div style={{ fontSize:".85rem", color:"#666", marginBottom:16 }}>
                  A alíquota é aplicada sobre o faturamento bruto para calcular o imposto no DRE.
                </div>
                <div>
                  <label style={{ fontSize:".75rem", fontWeight:700, color:"#555", textTransform:"uppercase", letterSpacing:".5px", marginBottom:5, display:"block" }}>
                    Alíquota Simples Nacional (%)
                  </label>
                  <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                    <div style={{ display:"flex", border:"1.5px solid #e4e4e7", borderRadius:8, overflow:"hidden", background:"#fafafa", maxWidth:160 }}>
                      <input type="number" min="0" max="20" step="0.1" value={aliquota}
                        onChange={e => setAliquota(parseFloat(e.target.value)||0)}
                        style={{ border:"none", background:"transparent", flex:1, padding:"9px 12px", fontSize:".88rem", outline:"none", fontFamily:"inherit", textAlign:"center" }} />
                      <span style={{ padding:"0 12px", background:"#f4f4f5", fontSize:".75rem", color:"#888", display:"flex", alignItems:"center", borderLeft:"1px solid #e4e4e7", fontWeight:600 }}>%</span>
                    </div>
                    <button onClick={async () => {
                      await supabase.from("config_tributaria").update({ aliquota_pct: aliquota }).eq("ativo", true);
                      buscarDados();
                    }} style={{ background:"#10b981", border:"none", borderRadius:8, padding:"9px 20px", fontSize:".85rem", fontWeight:700, color:"#fff", cursor:"pointer" }}>
                      Salvar
                    </button>
                  </div>
                </div>
                <div style={{ marginTop:20, background:"#f0fdf4", borderRadius:10, padding:"12px 16px", fontSize:".78rem", color:"#15803d" }}>
                  💡 Faixas comuns do Simples Nacional para restaurantes:<br/>
                  Até R$ 180k/ano: <strong>4,0%</strong> &nbsp;|&nbsp;
                  Até R$ 360k/ano: <strong>7,3%</strong> &nbsp;|&nbsp;
                  Até R$ 720k/ano: <strong>9,5%</strong>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {formAberto && (
        <CustoForm
          inicial={editando ?? undefined}
          onSalvo={() => { setFormAberto(false); buscarDados(); }}
          onCancelar={() => setFormAberto(false)}
        />
      )}
    </div>
  );
}