"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import CustoForm from "@/components/financeiro/CustoForm";

interface ContaDRE {
  codigo:  string;
  nome:    string;
  nivel:   number;
  pai_id:  string | null;
  tipo:    string;
  ordem:   number;
  total:   number;
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

const TIPO_COR: Record<string, string> = {
  receita:  "#15803d",
  deducao:  "#dc2626",
  cmv:      "#f59e0b",
  perda:    "#ef4444",
  custo:    "#6366f1",
  resultado:"#0369a1",
};

const RESULTADO_LABELS: Record<string, string> = {
  "3":  "= Receita Líquida",
  "6":  "= Margem de Contribuição",
  "8":  "= EBITDA",
  "10": "= Lucro Líquido",
};

export default function FinanceiroClient() {
  const supabase = createClient();

  const hoje = new Date();
  const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split("T")[0];
  const hojeStr = hoje.toISOString().split("T")[0];

  const [dataInicio, setDataInicio] = useState(primeiroDiaMes);
  const [dataFim, setDataFim]       = useState(hojeStr);
  const [contas, setContas]         = useState<ContaDRE[]>([]);
  const [custos, setCustos]         = useState<CustoOperacional[]>([]);
  const [aliquota, setAliquota]     = useState<number>(6.0);
  const [loading, setLoading]       = useState(true);
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando]     = useState<CustoOperacional | null>(null);
  const [abaAtiva, setAbaAtiva]     = useState<"dre"|"custos"|"config">("dre");
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set(["1","2","4","5","7","9"]));

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });

  const buscarDados = useCallback(async () => {
    setLoading(true);

    // Buscar lançamentos do período
    const { data: lancamentos } = await supabase
      .from("financeiro_lancamentos")
      .select("conta_id, valor")
      .gte("data_competencia", dataInicio)
      .lte("data_competencia", dataFim);

    // Buscar plano de contas
    const { data: plano } = await supabase
      .from("financeiro_plano_contas")
      .select("*")
      .eq("ativo", true)
      .order("codigo");

    if (plano) {
      // Somar lançamentos por conta
      const totaisPorConta: Record<string, number> = {};
      (lancamentos || []).forEach(l => {
        totaisPorConta[l.conta_id] = (totaisPorConta[l.conta_id] || 0) + l.valor;
      });

      // Montar contas com totais
      const contasComTotal: ContaDRE[] = plano.map(p => ({
        ...p,
        total: totaisPorConta[p.id] || 0,
      }));

      // Propagar totais dos filhos para os pais
      const propagado = propagarTotais(contasComTotal);
      setContas(propagado);
    }

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
  }, [dataInicio, dataFim]);

  useEffect(() => {
    const t = setTimeout(buscarDados, 300);
    return () => clearTimeout(t);
  }, [buscarDados]);

  function propagarTotais(contas: ContaDRE[]): ContaDRE[] {
    const mapa = new Map<string, ContaDRE>();
    contas.forEach(c => mapa.set(c.codigo, { ...c }));

    // Ordenar por código decrescente (filhos antes dos pais)
    const ordenados = [...contas].sort((a,b) => b.codigo.localeCompare(a.codigo));

    ordenados.forEach(conta => {
      if (conta.pai_id) {
        const pai = contas.find(c => c.codigo === conta.codigo.split(".").slice(0,-1).join("."));
        if (pai) {
          const paiAtual = mapa.get(pai.codigo);
          if (paiAtual) {
            paiAtual.total += mapa.get(conta.codigo)?.total || 0;
          }
        }
      }
    });

    return [...mapa.values()].sort((a,b) => a.codigo.localeCompare(b.codigo));
  }

  function toggleExpandido(codigo: string) {
    setExpandidos(prev => {
      const novo = new Set(prev);
      if (novo.has(codigo)) novo.delete(codigo);
      else novo.add(codigo);
      return novo;
    });
  }

  function temFilhos(codigo: string) {
    return contas.some(c => c.codigo.startsWith(codigo + ".") && c.nivel === contas.find(x => x.codigo===codigo)!.nivel + 1);
  }

  // Calcular KPIs
  const receitaBruta    = contas.find(c => c.codigo==="1")?.total || 0;
  const deducoes        = contas.find(c => c.codigo==="2")?.total || 0;
  const receitaLiquida  = receitaBruta - deducoes;
  const cmv             = contas.find(c => c.codigo==="4")?.total || 0;
  const perdas          = contas.find(c => c.codigo==="5")?.total || 0;
  const margemContrib   = receitaLiquida - cmv - perdas;
  const custoFixoMensal = custos.filter(c=>c.ativo).reduce((s,c) => {
    if (c.temporalidade==="mensal")    return s+c.valor;
    if (c.temporalidade==="semanal")   return s+c.valor*4.33;
    if (c.temporalidade==="quinzenal") return s+c.valor*2;
    if (c.temporalidade==="anual")     return s+c.valor/12;
    return s+c.valor;
  }, 0);

  // Dias no período
  const diasPeriodo = Math.max(1, Math.round((new Date(dataFim).getTime() - new Date(dataInicio).getTime()) / 86400000) + 1);
  const custosFixosPeriodo = custoFixoMensal / 30 * diasPeriodo;
  const custosOperacionais = contas.find(c => c.codigo==="7")?.total || 0;
  const totalCustos = custosFixosPeriodo + custosOperacionais;
  const ebitda      = margemContrib - totalCustos;
  const resultFin   = contas.find(c => c.codigo==="9")?.total || 0;
  const lucroLiquido = ebitda - resultFin;
  const margemLiqPct = receitaBruta > 0 ? (lucroLiquido/receitaBruta*100) : 0;
  const cmvPct       = receitaBruta > 0 ? (cmv/receitaBruta*100) : 0;

  return (
    <div style={{ padding:24, maxWidth:1100, margin:"0 auto" }}>

      {/* HEADER */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16, marginBottom:24, flexWrap:"wrap" }}>
        <div>
          <p style={{ fontSize:".65rem", letterSpacing:3, textTransform:"uppercase", color:"#10b981", fontWeight:700, marginBottom:4 }}>Módulo 7</p>
          <h1 style={{ fontSize:"1.6rem", fontWeight:800, color:"#111", lineHeight:1.1 }}>Financeiro</h1>
          <p style={{ fontSize:".82rem", color:"#888", marginTop:4 }}>DRE Gerencial · Custos · Margem Real</p>
        </div>
        {/* Filtro de período */}
        <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <label style={{ fontSize:".75rem", fontWeight:600, color:"#888" }}>De</label>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
              style={{ border:"1.5px solid #e4e4e7", borderRadius:8, padding:"7px 10px", fontSize:".82rem", outline:"none", color:"#111", background:"#fafafa" }} />
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <label style={{ fontSize:".75rem", fontWeight:600, color:"#888" }}>Até</label>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
              style={{ border:"1.5px solid #e4e4e7", borderRadius:8, padding:"7px 10px", fontSize:".82rem", outline:"none", color:"#111", background:"#fafafa" }} />
          </div>
          {/* Atalhos rápidos */}
          <div style={{ display:"flex", gap:4 }}>
            {[
              { label:"Hoje", inicio:hojeStr, fim:hojeStr },
              { label:"7d",   inicio:new Date(Date.now()-6*86400000).toISOString().split("T")[0], fim:hojeStr },
              { label:"Mês",  inicio:primeiroDiaMes, fim:hojeStr },
            ].map(p => (
              <button key={p.label} onClick={() => { setDataInicio(p.inicio); setDataFim(p.fim); }}
                style={{ background: dataInicio===p.inicio&&dataFim===p.fim?"#ecfdf5":"#f4f4f5", border:`1.5px solid ${dataInicio===p.inicio&&dataFim===p.fim?"#10b981":"#e4e4e7"}`, borderRadius:8, padding:"6px 12px", fontSize:".75rem", fontWeight:700, color:dataInicio===p.inicio&&dataFim===p.fim?"#065f46":"#666", cursor:"pointer" }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginBottom:24 }}>
        {[
          { label:"Receita Bruta",      val:fmt(receitaBruta),   cor:"#111",    sub:"faturamento total" },
          { label:"CMV",                val:`${cmvPct.toFixed(1)}%`, cor: cmvPct<=30?"#15803d":cmvPct<=40?"#f59e0b":"#dc2626", sub:fmt(cmv) },
          { label:"Margem Contribuição",val:fmt(margemContrib),  cor: margemContrib>=0?"#15803d":"#dc2626", sub: receitaBruta>0?`${(margemContrib/receitaBruta*100).toFixed(1)}%`:"—" },
          { label:"EBITDA",             val:fmt(ebitda),         cor: ebitda>=0?"#6366f1":"#dc2626", sub: receitaBruta>0?`${(ebitda/receitaBruta*100).toFixed(1)}%`:"—" },
          { label:"Lucro Líquido",      val:`${margemLiqPct.toFixed(1)}%`, cor: margemLiqPct>=10?"#15803d":margemLiqPct>=5?"#f59e0b":"#dc2626", sub:fmt(lucroLiquido) },
        ].map(({ label, val, cor, sub }) => (
          <div key={label} style={{ background:"#fff", border:"1px solid #f0f0f0", borderRadius:12, padding:"14px 16px", boxShadow:"0 1px 3px rgba(0,0,0,.05)" }}>
            <div style={{ fontSize:".63rem", color:"#888", fontWeight:500, textTransform:"uppercase", letterSpacing:.5, marginBottom:4 }}>{label}</div>
            <div style={{ fontSize:"1.2rem", fontWeight:800, color:cor }}>{val}</div>
            <div style={{ fontSize:".68rem", color:"#aaa", marginTop:3 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div style={{ display:"flex", borderBottom:"1px solid #f0f0f0", marginBottom:20 }}>
        {[
          { key:"dre",    label:"📊 DRE Gerencial" },
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
            <div style={{ background:"#fff", border:"1px solid #f0f0f0", borderRadius:14, overflow:"hidden", boxShadow:"0 1px 6px rgba(0,0,0,.06)" }}>
              {contas.filter(c => c.nivel === 1).map(conta1 => {
                const isResultado = ["3","6","8","10"].includes(conta1.codigo);
                const filhos2 = contas.filter(c => c.nivel===2 && c.codigo.startsWith(conta1.codigo+"."));
                const aberto = expandidos.has(conta1.codigo);
                const valor = isResultado
                  ? conta1.codigo==="3"  ? receitaLiquida
                  : conta1.codigo==="6"  ? margemContrib
                  : conta1.codigo==="8"  ? ebitda
                  : conta1.codigo==="10" ? lucroLiquido
                  : conta1.total
                  : conta1.total;

                return (
                  <div key={conta1.codigo}>
                    {/* Linha nível 1 */}
                    <div
                      onClick={() => !isResultado && temFilhos(conta1.codigo) && toggleExpandido(conta1.codigo)}
                      style={{
                        display:"flex", alignItems:"center", justifyContent:"space-between",
                        padding:"14px 20px",
                        background: isResultado ? "#f9fafb" : "#fff",
                        borderTop:"1px solid #f0f0f0",
                        cursor: !isResultado && temFilhos(conta1.codigo) ? "pointer" : "default",
                      }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        {!isResultado && temFilhos(conta1.codigo) && (
                          <span style={{ fontSize:".75rem", color:"#aaa", width:16 }}>{aberto?"▼":"▶"}</span>
                        )}
                        <span style={{ fontSize:isResultado?".95rem":".9rem", fontWeight:isResultado?800:700, color: isResultado ? TIPO_COR[conta1.tipo] : "#111" }}>
                          {isResultado ? RESULTADO_LABELS[conta1.codigo] || conta1.nome : conta1.nome}
                        </span>
                        <span style={{ fontSize:".65rem", color:"#ccc", fontFamily:"monospace" }}>{conta1.codigo}</span>
                      </div>
                      <span style={{ fontSize:isResultado?"1.1rem":".95rem", fontWeight:isResultado?800:700, color: valor<0?"#dc2626": isResultado?TIPO_COR[conta1.tipo]:"#111" }}>
                        {valor < 0 ? `(${fmt(Math.abs(valor))})` : fmt(valor)}
                      </span>
                    </div>

                    {/* Filhos nível 2 */}
                    {aberto && filhos2.map(conta2 => {
                      const filhos3 = contas.filter(c => c.nivel===3 && c.codigo.startsWith(conta2.codigo+"."));
                      const aberto2 = expandidos.has(conta2.codigo);
                      return (
                        <div key={conta2.codigo}>
                          <div
                            onClick={() => filhos3.length > 0 && toggleExpandido(conta2.codigo)}
                            style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 20px 10px 44px", background:"#fafafa", borderTop:"1px solid #f5f5f5", cursor: filhos3.length>0?"pointer":"default" }}>
                            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                              {filhos3.length > 0 && (
                                <span style={{ fontSize:".7rem", color:"#bbb", width:14 }}>{aberto2?"▼":"▶"}</span>
                              )}
                              <span style={{ fontSize:".85rem", fontWeight:600, color:"#333" }}>{conta2.nome}</span>
                              <span style={{ fontSize:".62rem", color:"#ddd", fontFamily:"monospace" }}>{conta2.codigo}</span>
                            </div>
                            <span style={{ fontSize:".88rem", fontWeight:700, color: conta2.total>0?TIPO_COR[conta2.tipo]:"#aaa" }}>
                              {conta2.total > 0 ? fmt(conta2.total) : "—"}
                            </span>
                          </div>

                          {/* Filhos nível 3 */}
                          {aberto2 && filhos3.map(conta3 => (
                            <div key={conta3.codigo} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 20px 8px 72px", background:"#fff", borderTop:"1px solid #f9f9f9" }}>
                              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                <span style={{ width:6, height:6, background:"#e4e4e7", borderRadius:"50%", display:"inline-block", flexShrink:0 }} />
                                <span style={{ fontSize:".8rem", color:"#555" }}>{conta3.nome}</span>
                                <span style={{ fontSize:".6rem", color:"#e0e0e0", fontFamily:"monospace" }}>{conta3.codigo}</span>
                              </div>
                              <span style={{ fontSize:".82rem", fontWeight:600, color: conta3.total>0?TIPO_COR[conta3.tipo]:"#ccc" }}>
                                {conta3.total > 0 ? fmt(conta3.total) : "—"}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
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
                    <button onClick={() => setFormAberto(true)} style={{ background:"#10b981", border:"none", borderRadius:8, padding:"10px 20px", fontSize:".85rem", fontWeight:700, color:"#fff", cursor:"pointer" }}>
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
                          <td style={{ padding:"12px 16px" }}>
                            <span style={{ fontSize:".68rem", fontWeight:700, padding:"2px 8px", borderRadius:20, background:"#f0fdf4", color:"#15803d", textTransform:"uppercase" }}>{item.categoria}</span>
                          </td>
                          <td style={{ padding:"12px 16px", fontWeight:700, fontSize:".88rem" }}>{fmt(item.valor)}</td>
                          <td style={{ padding:"12px 16px", fontSize:".82rem", color:"#666", textTransform:"capitalize" }}>{item.temporalidade}</td>
                          <td style={{ padding:"12px 16px", fontSize:".82rem", color:"#888" }}>
                            {item.dia_vencimento ? `Dia ${item.dia_vencimento}` : <span style={{color:"#ccc"}}>—</span>}
                          </td>
                          <td style={{ padding:"12px 16px" }}>
                            <span style={{ display:"inline-block", fontSize:".68rem", fontWeight:700, padding:"2px 10px", borderRadius:20, textTransform:"uppercase", background:item.ativo?"#ecfdf5":"#f3f4f6", color:item.ativo?"#065f46":"#9ca3af" }}>
                              {item.ativo?"Ativo":"Inativo"}
                            </span>
                          </td>
                          <td style={{ padding:"12px 16px" }}>
                            <div style={{ display:"flex", gap:4 }}>
                              <button onClick={() => { setEditando(item); setFormAberto(true); }} style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 6px", borderRadius:6, fontSize:"1rem" }}>✏️</button>
                              <button onClick={async () => { await supabase.from("custos_operacionais").update({ ativo:!item.ativo }).eq("id",item.id); buscarDados(); }} style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 6px", borderRadius:6, fontSize:"1rem" }}>
                                {item.ativo?"🔴":"🟢"}
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
                  Alíquota aplicada sobre o faturamento bruto no DRE.
                </div>
                <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                  <div style={{ display:"flex", border:"1.5px solid #e4e4e7", borderRadius:8, overflow:"hidden", background:"#fafafa", maxWidth:160 }}>
                    <input type="number" min="0" max="20" step="0.1" value={aliquota} onChange={e => setAliquota(parseFloat(e.target.value)||0)}
                      style={{ border:"none", background:"transparent", flex:1, padding:"9px 12px", fontSize:".88rem", outline:"none", fontFamily:"inherit", textAlign:"center" }} />
                    <span style={{ padding:"0 12px", background:"#f4f4f5", fontSize:".75rem", color:"#888", display:"flex", alignItems:"center", borderLeft:"1px solid #e4e4e7", fontWeight:600 }}>%</span>
                  </div>
                  <button onClick={async () => { await supabase.from("config_tributaria").update({ aliquota_pct:aliquota }).eq("ativo",true); buscarDados(); }}
                    style={{ background:"#10b981", border:"none", borderRadius:8, padding:"9px 20px", fontSize:".85rem", fontWeight:700, color:"#fff", cursor:"pointer" }}>
                    Salvar
                  </button>
                </div>
                <div style={{ marginTop:20, background:"#f0fdf4", borderRadius:10, padding:"12px 16px", fontSize:".78rem", color:"#15803d" }}>
                  💡 Faixas Simples Nacional para restaurantes:<br/>
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