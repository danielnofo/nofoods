"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

interface KPI {
  faturamento: number; faturamento_ant: number;
  margem: number; margem_ant: number;
  ticket_medio: number; ticket_ant: number;
  qtd_pedidos: number; em_preparo: number; atrasados: number;
}
interface Venda {
  id: string; canal: string; status: string; total: number;
  qtd_itens: number; cliente_nome: string | null;
  previsao_entrega: string | null; created_at: string;
}
interface FatDia { data: string; faturamento_bruto: number; }
interface ItemEstoque {
  id: string; nome: string; unidade: string; saldo_atual: number;
  cobertura_dias: number | null; estoque_agendado: number;
  previsao_entrega: string | null; nivel_estoque: string;
}
interface ContaDRE { codigo: string; nome: string; nivel: number; tipo: string; total: number; db_id: string; }

type Periodo = "diario" | "semanal" | "mensal";
type FiltroStatus = "todos" | "em_preparo" | "atrasado" | "entregue";
type FiltroEstoque = "todos" | "saudavel" | "risco" | "ruptura";

const CANAL_EMOJI: Record<string, string> = { "Balcão":"🏪","WhatsApp":"📱","iFood":"🛵","99Food":"🛵","Site":"🌐" };
const fmt = (n: number) => n.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
const fmtVar = (atual: number, ant: number) => {
  if (!ant) return null;
  const v = ((atual - ant) / ant) * 100;
  return { val: v, label: `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` };
};

// ── CORES FIXAS ──────────────────────────────────────────
const C = {
  bg:        "#1a1a1a",
  card:      "#242424",
  border:    "#333333",
  borderLt:  "#2a2a2a",
  text:      "#f0ede8",
  textSub:   "#888780",
  textMuted: "#555",
  green:     "#4ade80",
  red:       "#f87171",
  yellow:    "#fbbf24",
  blue:      "#60a5fa",
  blueBtn:   "#1d4ed8",
  blueBtnBg: "#1e3a5f",
};

export default function DashboardClient() {
  const supabase = createClient();
  const router = useRouter();
  const hoje = new Date();
  const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split("T")[0];
  const hojeStr = hoje.toISOString().split("T")[0];

  const [dataInicio, setDataInicio] = useState(primeiroDia);
  const [dataFim, setDataFim]       = useState(hojeStr);
  const [periodo, setPeriodo]       = useState<Periodo>("mensal");
  const [periodoFat, setPeriodoFat] = useState<Periodo>("semanal");
  const [filtroStatus, setFiltroStatus]   = useState<FiltroStatus>("todos");
  const [filtroEstoque, setFiltroEstoque] = useState<FiltroEstoque>("todos");
  const [kpi, setKpi]       = useState<KPI | null>(null);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [fatDias, setFatDias] = useState<FatDia[]>([]);
  const [estoque, setEstoque] = useState<ItemEstoque[]>([]);
  const [dreRows, setDreRows] = useState<{ label: string; atual: number; ant: number }[]>([]);
  const [loading, setLoading] = useState(true);

  function calcAnt(inicio: string, fim: string) {
    const d1 = new Date(inicio), d2 = new Date(fim);
    const dias = Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1;
    return {
      antIni: new Date(d1.getTime() - dias * 86400000).toISOString().split("T")[0],
      antFim: new Date(d1.getTime() - 86400000).toISOString().split("T")[0],
    };
  }

  const buscar = useCallback(async () => {
    setLoading(true);
    const { antIni, antFim } = calcAnt(dataInicio, dataFim);

    const [{ data: vd }, { data: va }, { data: fat }, { data: est }, { data: lanc }, { data: plano }] = await Promise.all([
      supabase.from("vw_vendas").select("id,canal,status,total,qtd_itens,cliente_nome,previsao_entrega,created_at").gte("created_at", dataInicio).lte("created_at", dataFim + "T23:59:59").order("created_at", { ascending: false }),
      supabase.from("vw_vendas").select("total,status").gte("created_at", antIni).lte("created_at", antFim + "T23:59:59"),
      supabase.from("vw_dre_diario").select("data,faturamento_bruto").gte("data", dataInicio).lte("data", dataFim).order("data"),
      supabase.from("vw_estoque").select("id,nome,unidade,saldo_atual,cobertura_dias,estoque_agendado,previsao_entrega,nivel_estoque").order("nivel_estoque").limit(10),
      supabase.from("financeiro_lancamentos").select("conta_id,valor").gte("data_competencia", dataInicio).lte("data_competencia", dataFim),
      supabase.from("financeiro_plano_contas").select("id,codigo,nome,nivel,tipo").eq("ativo", true).order("codigo"),
    ]);

    if (vd) {
      setVendas(vd);
      const ativas = vd.filter(v => v.status !== "cancelado");
      const ant    = (va || []).filter(v => v.status !== "cancelado");
      const fat2   = ativas.reduce((s, v) => s + v.total, 0);
      const fatA   = ant.reduce((s, v) => s + v.total, 0);
      const tick   = ativas.length > 0 ? fat2 / ativas.length : 0;
      const tickA  = ant.length > 0 ? fatA / ant.length : 0;
      setKpi({ faturamento:fat2, faturamento_ant:fatA, margem:38.4, margem_ant:41.6, ticket_medio:tick, ticket_ant:tickA, qtd_pedidos:ativas.length, em_preparo:vd.filter(v=>v.status==="em_preparo").length, atrasados:vd.filter(v=>v.previsao_entrega&&new Date(v.previsao_entrega)<new Date()&&v.status!=="entregue"&&v.status!=="cancelado").length });
    }
    if (fat) setFatDias(fat);
    if (est) setEstoque(est);

    if (plano && lanc) {
      const totais: Record<string, number> = {};
      lanc.forEach(l => { totais[l.conta_id] = (totais[l.conta_id] || 0) + l.valor; });
      const mapa = new Map<string, ContaDRE>();
      plano.forEach(p => mapa.set(p.codigo, { ...p, db_id: p.id, total: totais[p.id] || 0 }));
      const ord = [...mapa.values()].sort((a,b) => b.codigo.localeCompare(a.codigo));
      ord.forEach(c => {
        const pts = c.codigo.split(".");
        if (pts.length > 1) {
          const pai = mapa.get(pts.slice(0,-1).join("."));
          if (pai) {
            const temFilho = [...mapa.values()].some(x => x.codigo.startsWith(c.codigo+".") && x.codigo.split(".").length === c.codigo.split(".").length+1);
            if (!temFilho) pai.total += c.total;
          }
        }
      });
      const n1 = [...mapa.values()].filter(c => c.nivel===1).sort((a,b) => parseInt(a.codigo)-parseInt(b.codigo));
      const recBruta  = n1.find(c=>c.codigo==="1")?.total||0;
      const deducoes  = n1.find(c=>c.codigo==="2")?.total||0;
      const cmv       = n1.find(c=>c.codigo==="4")?.total||0;
      const perdas    = n1.find(c=>c.codigo==="5")?.total||0;
      const custosOp  = n1.find(c=>c.codigo==="7")?.total||0;
      const recLiq    = recBruta - deducoes;
      const margContr = recLiq - cmv - perdas;
      const ebitda    = margContr - custosOp;
      setDreRows([
        { label:"Faturamento bruto",      atual:recBruta,  ant:0 },
        { label:"CMV",                    atual:cmv,       ant:0 },
        { label:"Margem de contribuição", atual:margContr, ant:0 },
        { label:"Custos operacionais",    atual:custosOp,  ant:0 },
        { label:"Resultado operacional",  atual:ebitda,    ant:0 },
      ]);
    }
    setLoading(false);
  }, [dataInicio, dataFim]);

  useEffect(() => { const t = setTimeout(buscar, 300); return () => clearTimeout(t); }, [buscar]);

  function setAtalho(p: Periodo) {
    const h = new Date(), hs = h.toISOString().split("T")[0];
    setPeriodo(p);
    if (p==="diario") { setDataInicio(hs); setDataFim(hs); }
    else if (p==="semanal") { const d=new Date(h); d.setDate(h.getDate()-6); setDataInicio(d.toISOString().split("T")[0]); setDataFim(hs); }
    else { setDataInicio(new Date(h.getFullYear(),h.getMonth(),1).toISOString().split("T")[0]); setDataFim(hs); }
  }

  const { antIni, antFim } = calcAnt(dataInicio, dataFim);
  const fmtD = (s: string) => s.split("-").reverse().join("/");

  const chip = (active: boolean, activeBg = C.blueBtnBg, activeColor = C.blue, activeBorder = C.blueBtn): React.CSSProperties => ({
    height: 24, padding: "0 12px", fontSize: 11, borderRadius: 20,
    border: `0.5px solid ${active ? activeBorder : C.border}`,
    background: active ? activeBg : "transparent",
    color: active ? activeColor : C.textSub,
    cursor: "pointer", whiteSpace: "nowrap" as const,
    display: "inline-flex", alignItems: "center", flexShrink: 0,
    fontWeight: active ? 500 : 400,
  });

  const pill = (bg: string, color: string): React.CSSProperties => ({
    height: 20, padding: "0 8px", fontSize: 10, borderRadius: 20,
    background: bg, color, display: "inline-flex", alignItems: "center", whiteSpace: "nowrap" as const,
  });

  const card: React.CSSProperties = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 12 };
  const th: React.CSSProperties = { display: "grid", fontSize: 11, color: C.textSub, padding: "6px 0", borderBottom: `1px solid ${C.border}`, textTransform: "uppercase" as const, letterSpacing: "0.4px" };
  const trStyle = (last = false): React.CSSProperties => ({ display: "grid", padding: "8px 0", borderBottom: last ? "none" : `1px solid ${C.borderLt}`, fontSize: 12, alignItems: "center", color: C.text });

  const vendasFiltradas = vendas.filter(v => {
    if (filtroStatus==="todos") return true;
    if (filtroStatus==="atrasado") return v.previsao_entrega && new Date(v.previsao_entrega)<new Date() && v.status!=="entregue" && v.status!=="cancelado";
    return v.status===filtroStatus;
  });
  const estoqueFiltrado = estoque.filter(e => filtroEstoque==="todos" || e.nivel_estoque===filtroEstoque);

  if (loading) return <div style={{ padding:40, textAlign:"center", color: C.textSub }}>Carregando dashboard...</div>;

  return (
    <div style={{ padding:24, maxWidth:1100, margin:"0 auto", background: C.bg, minHeight:"100vh", color: C.text }}>

      {/* HEADER */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:600, color: C.text }}>Dashboard</h1>
          <p style={{ fontSize:12, color: C.textSub, marginTop:2 }}>Visão geral da operação</p>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
          <span style={{ fontSize:11, color: C.textSub }}>De</span>
          <div style={{ width:130, height:24, borderRadius:6, border:`0.5px solid ${C.border}`, overflow:"hidden", display:"flex", alignItems:"center" }}>
            <input type="date" value={dataInicio} onChange={e=>setDataInicio(e.target.value)} style={{ width:130, height:24, padding:"0 6px", fontSize:11, border:"none", background:"transparent", color: C.text, outline:"none", cursor:"pointer" }} />
          </div>
          <span style={{ fontSize:11, color: C.textSub }}>Até</span>
          <div style={{ width:130, height:24, borderRadius:6, border:`0.5px solid ${C.border}`, overflow:"hidden", display:"flex", alignItems:"center" }}>
            <input type="date" value={dataFim} onChange={e=>setDataFim(e.target.value)} style={{ width:130, height:24, padding:"0 6px", fontSize:11, border:"none", background:"transparent", color: C.text, outline:"none", cursor:"pointer" }} />
          </div>
          {(["diario","semanal","mensal"] as Periodo[]).map(p => (
            <button key={p} onClick={()=>setAtalho(p)} style={chip(periodo===p)}>{p==="diario"?"Diário":p==="semanal"?"Semanal":"Mensal"}</button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:16 }}>
        {kpi && [
          { label:"Faturamento",        val:fmt(kpi.faturamento),    v:fmtVar(kpi.faturamento,kpi.faturamento_ant) },
          { label:"Margem Operacional", val:`${kpi.margem.toFixed(1)}%`, v:fmtVar(kpi.margem,kpi.margem_ant) },
          { label:"Ticket Médio",       val:fmt(kpi.ticket_medio),   v:fmtVar(kpi.ticket_medio,kpi.ticket_ant) },
          { label:"Pedidos",            val:String(kpi.qtd_pedidos), v:null, sub:`${kpi.em_preparo} em preparo · ${kpi.atrasados} atrasado${kpi.atrasados!==1?"s":""}` },
        ].map(({ label, val, v, sub }) => (
          <div key={label} style={{ background: C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 16px" }}>
            <div style={{ fontSize:11, color: C.textSub, marginBottom:5, textTransform:"uppercase", letterSpacing:"0.4px" }}>{label}</div>
            <div style={{ fontSize:22, fontWeight:500, color: C.text }}>{val}</div>
            {v && <div style={{ fontSize:11, marginTop:4, color: v.val>=0 ? C.green : C.red }}>{v.val>=0?"↑":"↓"} {v.label} vs período anterior</div>}
            {sub && <div style={{ fontSize:11, marginTop:4, color: C.textSub }}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* GRÁFICO */}
      <div style={card}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10, gap:8 }}>
          <span style={{ fontSize:12, fontWeight:500, color: C.textSub, textTransform:"uppercase", letterSpacing:"0.5px" }}>Evolução do faturamento</span>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ display:"flex", gap:8, fontSize:11, color: C.textSub, alignItems:"center" }}>
              <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:10, height:2, background:"#3266ad", display:"inline-block", borderRadius:2 }}></span>Atual</span>
              <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:10, height:2, background:"#666", display:"inline-block", borderRadius:2 }}></span>Anterior</span>
            </div>
            <div style={{ display:"flex", gap:4 }}>
              {(["diario","semanal","mensal"] as Periodo[]).map(p=>(
                <button key={p} onClick={()=>setPeriodoFat(p)} style={chip(periodoFat===p)}>{p==="diario"?"Diário":p==="semanal"?"Semanal":"Mensal"}</button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ fontSize:11, color: C.textSub, marginBottom:8 }}>Comparando {fmtD(dataInicio)}–{fmtD(dataFim)} vs período homólogo D-28: {fmtD(antIni)}–{fmtD(antFim)}</div>
        <div style={{ position:"relative", height:150 }}>
          <canvas id="chartFat" role="img" aria-label="Gráfico de faturamento">Faturamento por período.</canvas>
        </div>
      </div>

      {/* DRE */}
      <div style={card}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12, gap:8 }}>
          <span style={{ fontSize:12, fontWeight:500, color: C.textSub, textTransform:"uppercase", letterSpacing:"0.5px" }}>DRE Comparativa</span>
          <span style={{ fontSize:11, color: C.textSub }}>{fmtD(dataInicio)}–{fmtD(dataFim)} vs {fmtD(antIni)}–{fmtD(antFim)}</span>
        </div>
        <div style={{ ...th, gridTemplateColumns:"2fr 1fr 1fr 90px" }}>
          <div>Indicador</div><div style={{ textAlign:"right" }}>Atual</div><div style={{ textAlign:"right" }}>Anterior</div><div style={{ textAlign:"right" }}>Variação</div>
        </div>
        {dreRows.map(({ label, atual, ant }, i) => (
          <div key={label} style={{ ...trStyle(i===dreRows.length-1), gridTemplateColumns:"2fr 1fr 1fr 90px", fontWeight: i===dreRows.length-1 ? 500 : 400 }}>
            <div>{label}</div>
            <div style={{ textAlign:"right" }}>{fmt(atual)}</div>
            <div style={{ textAlign:"right", color: C.textSub }}>—</div>
            <div style={{ textAlign:"right", color: C.textSub }}>—</div>
          </div>
        ))}
      </div>

      {/* SEÇÃO 1 */}
      <div style={{ fontSize:11, color: C.textSub, textTransform:"uppercase", letterSpacing:1, margin:"16px 0 8px", fontWeight:500 }}>1. Operação em tempo real</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>

        <div style={{ ...card, marginBottom:0 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12, gap:8, flexWrap:"wrap" as const }}>
            <span style={{ fontSize:12, fontWeight:500, color: C.textSub, textTransform:"uppercase", letterSpacing:"0.5px" }}>Pedidos ativos</span>
            <div style={{ display:"flex", gap:4, flexWrap:"nowrap" as const }}>
              {(["todos","em_preparo","atrasado","entregue"] as FiltroStatus[]).map(s=>(
                <button key={s} onClick={()=>setFiltroStatus(s)} style={chip(filtroStatus===s)}>
                  {s==="todos"?"Todos":s==="em_preparo"?"Em preparo":s==="atrasado"?"Atrasado":"Entregue"}
                </button>
              ))}
            </div>
          </div>
          {vendasFiltradas.slice(0,5).length===0
            ? <div style={{ fontSize:12, color: C.textSub, padding:"12px 0" }}>Nenhum pedido.</div>
            : vendasFiltradas.slice(0,5).map(v => {
              const atrasado = v.previsao_entrega && new Date(v.previsao_entrega)<new Date() && v.status!=="entregue" && v.status!=="cancelado";
              return (
                <div key={v.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 0", borderBottom:`1px solid ${C.borderLt}`, fontSize:12 }}>
                  <span>{CANAL_EMOJI[v.canal]||"📦"}</span>
                  <div style={{ flex:1, color: C.text }}>{v.qtd_itens} item(s) · {fmt(v.total)}</div>
                  <span style={{ fontSize:11, color: C.textSub }}>{Math.round((Date.now()-new Date(v.created_at).getTime())/60000)}min</span>
                  {atrasado ? <span style={pill("#4a1a1a","#f87171")}>⚠ Atrasado</span>
                  : v.status==="em_preparo" ? <span style={pill("#4a3800","#fbbf24")}>Em preparo</span>
                  : v.status==="entregue"   ? <span style={pill("#1a3a1a","#4ade80")}>Entregue</span>
                  : <span style={pill(C.borderLt, C.textSub)}>{v.status}</span>}
                </div>
              );
            })
          }
        </div>

        <div style={{ ...card, marginBottom:0 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <span style={{ fontSize:12, fontWeight:500, color: C.textSub, textTransform:"uppercase", letterSpacing:"0.5px" }}>Alertas operacionais</span>
            <span style={{ fontSize:11, color: C.textSub }}>Clique para detalhes</span>
          </div>
          {estoque.filter(e=>e.nivel_estoque==="ruptura").map(e=>(
            <div key={e.id} onClick={() => router.push("/estoque")} style={{ display:"flex", gap:8, padding:"8px 10px", borderRadius:8, marginBottom:6, fontSize:12, background:"#3a1a1a", color:"#f87171", cursor:"pointer" }}>
              <span style={{ flexShrink:0 }}>⚠</span>
              <div><div><strong>Ruptura:</strong> {e.nome} zerado.</div><div style={{ fontSize:11, opacity:.7, textDecoration:"underline", marginTop:2 }}>Ver estoque →</div></div>
            </div>
          ))}
          {estoque.filter(e=>e.nivel_estoque==="risco").map(e=>(
            <div key={e.id} onClick={() => router.push("/estoque")} style={{ display:"flex", gap:8, padding:"8px 10px", borderRadius:8, marginBottom:6, fontSize:12, background:"#3a2a00", color:"#fbbf24", cursor:"pointer" }}>
              <span style={{ flexShrink:0 }}>⚡</span>
              <div><div><strong>Risco:</strong> {e.nome} para {e.cobertura_dias??"-"} dias.</div><div style={{ fontSize:11, opacity:.7, textDecoration:"underline", marginTop:2 }}>Ver estoque →</div></div>
            </div>
          ))}
          {estoque.filter(e=>e.nivel_estoque==="ruptura"||e.nivel_estoque==="risco").length===0 && (
            <div style={{ fontSize:12, color: C.textSub, padding:"12px 0" }}>✅ Nenhum alerta crítico.</div>
          )}
        </div>
      </div>

      {/* SEÇÃO 2 — ESTOQUE */}
      <div style={{ fontSize:11, color: C.textSub, textTransform:"uppercase", letterSpacing:1, margin:"16px 0 8px", fontWeight:500 }}>2. Estoque</div>
      <div style={card}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12, gap:8 }}>
          <span style={{ fontSize:12, fontWeight:500, color: C.textSub, textTransform:"uppercase", letterSpacing:"0.5px" }}>Estoque crítico</span>
          <div style={{ display:"flex", gap:4 }}>
            <button onClick={()=>setFiltroEstoque("todos")}    style={chip(filtroEstoque==="todos")}>Todos</button>
            <button onClick={()=>setFiltroEstoque("saudavel")} style={chip(filtroEstoque==="saudavel","#1a3a1a","#4ade80","#1a3a1a")}>
              <span style={{ width:6,height:6,background:"#4ade80",borderRadius:"50%",display:"inline-block",marginRight:4 }}></span>Ok
            </button>
            <button onClick={()=>setFiltroEstoque("risco")}    style={chip(filtroEstoque==="risco","#3a2a00","#fbbf24","#3a2a00")}>
              <span style={{ width:6,height:6,background:"#fbbf24",borderRadius:"50%",display:"inline-block",marginRight:4 }}></span>Risco
            </button>
            <button onClick={()=>setFiltroEstoque("ruptura")}  style={chip(filtroEstoque==="ruptura","#3a1a1a","#f87171","#3a1a1a")}>
              <span style={{ width:6,height:6,background:"#f87171",borderRadius:"50%",display:"inline-block",marginRight:4 }}></span>Ruptura
            </button>
          </div>
        </div>
        <div style={{ ...th, gridTemplateColumns:"2fr 1fr 1fr 1fr 100px" }}>
          <div>Ingrediente</div><div style={{ textAlign:"right" }}>Saldo</div><div style={{ textAlign:"right" }}>Cobertura</div><div style={{ textAlign:"right" }}>Agendado</div><div style={{ textAlign:"right" }}>Nível</div>
        </div>
        {estoqueFiltrado.length===0
          ? <div style={{ fontSize:12, color: C.textSub, padding:"12px 0" }}>Nenhum item.</div>
          : estoqueFiltrado.map((e,i)=>(
            <div key={e.id} style={{ ...trStyle(i===estoqueFiltrado.length-1), gridTemplateColumns:"2fr 1fr 1fr 1fr 100px" }}>
              <div>{e.nome}</div>
              <div style={{ textAlign:"right", color: e.saldo_atual<=0 ? C.red : C.textSub }}>{e.saldo_atual.toFixed(1)} {e.unidade}</div>
              <div style={{ textAlign:"right", color: (e.cobertura_dias||0)<=1 ? C.red : (e.cobertura_dias||0)<=3 ? C.yellow : C.green }}>{e.cobertura_dias!==null?`${e.cobertura_dias}d`:"—"}</div>
              <div style={{ textAlign:"right", color: C.textSub }}>{e.estoque_agendado>0?`${e.estoque_agendado}${e.unidade}`:"—"}</div>
              <div style={{ textAlign:"right" }}>
                {e.nivel_estoque==="ruptura" ? <span style={pill("#4a1a1a","#f87171")}>🔴 Ruptura</span>
                :e.nivel_estoque==="risco"   ? <span style={pill("#4a3800","#fbbf24")}>🟡 Risco</span>
                :                              <span style={pill("#1a3a1a","#4ade80")}>🟢 Ok</span>}
              </div>
            </div>
          ))
        }
      </div>

      <ChartLoader fatDias={fatDias} />
    </div>
  );
}

function ChartLoader({ fatDias }: { fatDias: FatDia[] }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const init = () => {
      const canvas = document.getElementById("chartFat") as HTMLCanvasElement;
      if (!canvas || !(window as any).Chart) return;
      if ((canvas as any)._chartInstance) (canvas as any)._chartInstance.destroy();
      const labels = fatDias.map(d => new Date(d.data + "T12:00:00").toLocaleDateString("pt-BR", { day:"2-digit", month:"2-digit" }));
      const valores = fatDias.map(d => d.faturamento_bruto);
      const inst = new (window as any).Chart(canvas, {
        type: "bar",
        data: { labels, datasets: [{ label:"Faturamento", data:valores, backgroundColor:"#3266ad", borderRadius:4 }] },
        options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } }, scales: { x:{ grid:{ display:false }, ticks:{ font:{ size:11 }, color:"#888780" } }, y:{ grid:{ color:"rgba(255,255,255,0.05)" }, ticks:{ font:{ size:11 }, color:"#888780", callback:(v:number)=>"R$"+v } } } }
      });
      (canvas as any)._chartInstance = inst;
    };
    if ((window as any).Chart) { init(); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
    s.onload = init;
    document.head.appendChild(s);
  }, [fatDias]);
  return null;
}