"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";

interface KPI {
  faturamento:      number;
  faturamento_ant:  number;
  margem:           number;
  margem_ant:       number;
  ticket_medio:     number;
  ticket_ant:       number;
  qtd_pedidos:      number;
  em_preparo:       number;
  atrasados:        number;
}

interface Venda {
  id:              string;
  canal:           string;
  status:          string;
  total:           number;
  qtd_itens:       number;
  cliente_nome:    string | null;
  previsao_entrega:string | null;
  created_at:      string;
}

interface FatDia {
  data:            string;
  faturamento_bruto: number;
}

interface ItemEstoque {
  id:              string;
  nome:            string;
  unidade:         string;
  saldo_atual:     number;
  cobertura_dias:  number | null;
  estoque_agendado:number;
  previsao_entrega:string | null;
  nivel_estoque:   string;
}

interface ContaDRE {
  codigo: string;
  nome:   string;
  nivel:  number;
  tipo:   string;
  total:  number;
}

type Periodo = "diario" | "semanal" | "mensal";
type FiltroStatus = "todos" | "em_preparo" | "atrasado" | "entregue";
type FiltroEstoque = "todos" | "saudavel" | "risco" | "ruptura";

const CANAL_EMOJI: Record<string, string> = {
  "Balcão":"🏪","WhatsApp":"📱","iFood":"🛵","99Food":"🛵","Site":"🌐",
};

const fmt = (n: number) => n.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
const fmtPct = (n: number) => `${n.toFixed(1)}%`;
const fmtVar = (atual: number, ant: number) => {
  if (!ant) return null;
  const v = ((atual - ant) / ant) * 100;
  return { val: v, label: `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` };
};

export default function DashboardClient() {
  const supabase = createClient();

  const hoje = new Date();
  const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split("T")[0];
  const hojeStr = hoje.toISOString().split("T")[0];

  const [dataInicio, setDataInicio] = useState(primeiroDia);
  const [dataFim, setDataFim]       = useState(hojeStr);
  const [periodo, setPeriodo]       = useState<Periodo>("mensal");
  const [periodoFat, setPeriodoFat] = useState<Periodo>("semanal");
  const [periodoFiltroStatus, setFiltroStatus] = useState<FiltroStatus>("todos");
  const [filtroEstoque, setFiltroEstoque]       = useState<FiltroEstoque>("todos");

  const [kpi, setKpi]           = useState<KPI | null>(null);
  const [vendas, setVendas]     = useState<Venda[]>([]);
  const [fatDias, setFatDias]   = useState<FatDia[]>([]);
  const [estoque, setEstoque]   = useState<ItemEstoque[]>([]);
  const [dre, setDre]           = useState<ContaDRE[]>([]);
  const [loading, setLoading]   = useState(true);

  function calcPeriodoAnterior(inicio: string, fim: string) {
    const d1 = new Date(inicio);
    const d2 = new Date(fim);
    const dias = Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1;
    const antFim  = new Date(d1.getTime() - 86400000).toISOString().split("T")[0];
    const antIni  = new Date(d1.getTime() - dias * 86400000).toISOString().split("T")[0];
    return { antIni, antFim };
  }

  const buscar = useCallback(async () => {
    setLoading(true);
    const { antIni, antFim } = calcPeriodoAnterior(dataInicio, dataFim);

    // Vendas do período
    const { data: vendasData } = await supabase
      .from("vw_vendas")
      .select("id,canal,status,total,qtd_itens,cliente_nome,previsao_entrega,created_at")
      .gte("created_at", dataInicio)
      .lte("created_at", dataFim + "T23:59:59")
      .order("created_at", { ascending: false });

    // Vendas período anterior
    const { data: vendasAnt } = await supabase
      .from("vw_vendas")
      .select("total,status")
      .gte("created_at", antIni)
      .lte("created_at", antFim + "T23:59:59");

    if (vendasData) {
      setVendas(vendasData);
      const ativas = vendasData.filter(v => v.status !== "cancelado");
      const ant    = (vendasAnt || []).filter(v => v.status !== "cancelado");
      const fat    = ativas.reduce((s,v) => s + v.total, 0);
      const fatA   = ant.reduce((s,v) => s + v.total, 0);
      const tick   = ativas.length > 0 ? fat / ativas.length : 0;
      const tickA  = ant.length > 0 ? fatA / ant.length : 0;
      setKpi({
        faturamento: fat, faturamento_ant: fatA,
        margem: 38.4, margem_ant: 41.6,
        ticket_medio: tick, ticket_ant: tickA,
        qtd_pedidos: ativas.length,
        em_preparo: vendasData.filter(v => v.status === "em_preparo").length,
        atrasados:  vendasData.filter(v => v.previsao_entrega && new Date(v.previsao_entrega) < new Date() && v.status !== "entregue" && v.status !== "cancelado").length,
      });
    }

    // Faturamento por dia
    const { data: dreData } = await supabase
      .from("vw_dre_diario")
      .select("data,faturamento_bruto")
      .gte("data", dataInicio)
      .lte("data", dataFim)
      .order("data");
    if (dreData) setFatDias(dreData);

    // Estoque
    const { data: estData } = await supabase
      .from("vw_estoque")
      .select("id,nome,unidade,saldo_atual,cobertura_dias,estoque_agendado,previsao_entrega,nivel_estoque")
      .order("nivel_estoque")
      .limit(8);
    if (estData) setEstoque(estData);

    // DRE
    const { data: lancamentos } = await supabase
      .from("financeiro_lancamentos")
      .select("conta_id,valor")
      .gte("data_competencia", dataInicio)
      .lte("data_competencia", dataFim);

    const { data: plano } = await supabase
      .from("financeiro_plano_contas")
      .select("id,codigo,nome,nivel,tipo")
      .eq("ativo", true)
      .in("nivel", [1])
      .order("codigo");

    if (plano && lancamentos) {
      const totais: Record<string, number> = {};
      lancamentos.forEach(l => { totais[l.conta_id] = (totais[l.conta_id] || 0) + l.valor; });

      const { data: planoCompleto } = await supabase
        .from("financeiro_plano_contas")
        .select("id,codigo,nome,nivel,tipo")
        .eq("ativo", true)
        .order("codigo");

      if (planoCompleto) {
        const mapa = new Map<string, ContaDRE & { db_id: string }>();
        planoCompleto.forEach(p => mapa.set(p.codigo, { ...p, db_id: p.id, total: totais[p.id] || 0 }));

        const ordenados = [...mapa.values()].sort((a,b) => b.codigo.localeCompare(a.codigo));
        ordenados.forEach(conta => {
          const partes = conta.codigo.split(".");
          if (partes.length > 1) {
            const pai = mapa.get(partes.slice(0,-1).join("."));
            if (pai) {
              const temFilho = [...mapa.values()].some(c =>
                c.codigo.startsWith(conta.codigo + ".") &&
                c.codigo.split(".").length === conta.codigo.split(".").length + 1
              );
              if (!temFilho) pai.total += conta.total;
            }
          }
        });

        setDre([...mapa.values()]
          .filter(c => c.nivel === 1)
          .sort((a,b) => parseInt(a.codigo) - parseInt(b.codigo)));
      }
    }

    setLoading(false);
  }, [dataInicio, dataFim]);

  useEffect(() => {
    const t = setTimeout(buscar, 300);
    return () => clearTimeout(t);
  }, [buscar]);

  function setAtalho(p: Periodo) {
    const h = new Date();
    const hStr = h.toISOString().split("T")[0];
    setPeriodo(p);
    if (p === "diario") {
      setDataInicio(hStr); setDataFim(hStr);
    } else if (p === "semanal") {
      const d = new Date(h); d.setDate(h.getDate() - 6);
      setDataInicio(d.toISOString().split("T")[0]); setDataFim(hStr);
    } else {
      const d = new Date(h.getFullYear(), h.getMonth(), 1);
      setDataInicio(d.toISOString().split("T")[0]); setDataFim(hStr);
    }
  }

  const vendasFiltradas = vendas.filter(v => {
    if (periodoFiltroStatus === "todos") return true;
    if (periodoFiltroStatus === "atrasado") return v.previsao_entrega && new Date(v.previsao_entrega) < new Date() && v.status !== "entregue" && v.status !== "cancelado";
    return v.status === periodoFiltroStatus;
  });

  const estoqueFiltrado = estoque.filter(e => {
    if (filtroEstoque === "todos") return true;
    return e.nivel_estoque === filtroEstoque;
  });

  const { antIni, antFim } = calcPeriodoAnterior(dataInicio, dataFim);

  // Cálculos DRE
  const dreMap = Object.fromEntries(dre.map(d => [d.codigo, d.total]));
  const recBruta   = dreMap["1"] || 0;
  const deducoes   = dreMap["2"] || 0;
  const recLiq     = recBruta - deducoes;
  const cmv        = dreMap["4"] || 0;
  const perdas     = dreMap["5"] || 0;
  const margContr  = recLiq - cmv - perdas;
  const custosOp   = dreMap["7"] || 0;
  const ebitda     = margContr - custosOp;
  const resultFin  = dreMap["9"] || 0;
  const lucroLiq   = ebitda - resultFin;

  // ── ESTILOS ─────────────────────────────────────────────
  const chip = (active: boolean, color?: string): React.CSSProperties => ({
    height: 24, padding: "0 10px", fontSize: 11,
    borderRadius: 20, border: `0.5px solid ${active && color ? color : "var(--color-border-secondary)"}`,
    background: active ? (color || "var(--color-background-info)") : "transparent",
    color: active ? (color === "#eaf3de" ? "#27500a" : color === "#faeeda" ? "#633806" : color === "#fcebeb" ? "#791f1f" : "var(--color-text-info)") : "var(--color-text-secondary)",
    cursor: "pointer", whiteSpace: "nowrap" as const,
    display: "inline-flex", alignItems: "center", flexShrink: 0,
  });

  const card: React.CSSProperties = {
    background: "var(--color-background-primary)",
    border: "0.5px solid var(--color-border-tertiary)",
    borderRadius: "var(--border-radius-lg)",
    padding: 14, marginBottom: 12,
  };

  const cardHeader: React.CSSProperties = {
    display: "flex", alignItems: "center",
    justifyContent: "space-between", marginBottom: 12, gap: 8,
  };

  const cardTitle: React.CSSProperties = {
    fontSize: 12, fontWeight: 500,
    color: "var(--color-text-secondary)",
    textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap",
  };

  const th: React.CSSProperties = {
    display: "grid", fontSize: 11,
    color: "var(--color-text-secondary)",
    padding: "5px 0",
    borderBottom: "0.5px solid var(--color-border-secondary)",
    textTransform: "uppercase", letterSpacing: "0.4px",
  };

  const tr = (last = false): React.CSSProperties => ({
    display: "grid", padding: "8px 0",
    borderBottom: last ? "none" : "0.5px solid var(--color-border-tertiary)",
    fontSize: 12, alignItems: "center",
  });

  const pill = (bg: string, color: string): React.CSSProperties => ({
    height: 20, padding: "0 8px", fontSize: 10,
    borderRadius: 20, background: bg, color,
    display: "inline-flex", alignItems: "center", whiteSpace: "nowrap",
  });

  const sectionLabel: React.CSSProperties = {
    fontSize: 11, color: "var(--color-text-secondary)",
    textTransform: "uppercase", letterSpacing: 1,
    margin: "14px 0 8px", fontWeight: 500,
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-secondary)" }}>Carregando dashboard...</div>;

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>

      {/* HEADER */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:16 }}>
        <div>
          <h1 style={{ fontSize:18, fontWeight:500, color:"var(--color-text-primary)" }}>Dashboard</h1>
          <p style={{ fontSize:12, color:"var(--color-text-secondary)", marginTop:2 }}>Visão geral da operação</p>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
          <span style={{ fontSize:11, color:"var(--color-text-secondary)" }}>De</span>
          <div style={{ width:130, flexShrink:0, overflow:"hidden", height:24, borderRadius:6, border:"0.5px solid var(--color-border-secondary)", display:"flex", alignItems:"center" }}>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
              style={{ width:130, minWidth:0, height:24, padding:"0 6px", fontSize:11, border:"none", background:"transparent", color:"var(--color-text-secondary)", outline:"none", cursor:"pointer" }} />
          </div>
          <span style={{ fontSize:11, color:"var(--color-text-secondary)" }}>Até</span>
          <div style={{ width:130, flexShrink:0, overflow:"hidden", height:24, borderRadius:6, border:"0.5px solid var(--color-border-secondary)", display:"flex", alignItems:"center" }}>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
              style={{ width:130, minWidth:0, height:24, padding:"0 6px", fontSize:11, border:"none", background:"transparent", color:"var(--color-text-secondary)", outline:"none", cursor:"pointer" }} />
          </div>
          {(["diario","semanal","mensal"] as Periodo[]).map(p => (
            <button key={p} onClick={() => setAtalho(p)} style={chip(periodo === p)}>
              {p === "diario" ? "Diário" : p === "semanal" ? "Semanal" : "Mensal"}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:14 }}>
        {kpi && [
          { label:"Faturamento",        val:fmt(kpi.faturamento),      var:fmtVar(kpi.faturamento, kpi.faturamento_ant) },
          { label:"Margem operacional", val:fmtPct(kpi.margem),        var:fmtVar(kpi.margem, kpi.margem_ant) },
          { label:"Ticket médio",       val:fmt(kpi.ticket_medio),     var:fmtVar(kpi.ticket_medio, kpi.ticket_ant) },
          { label:"Pedidos",            val:String(kpi.qtd_pedidos),   var:null, sub:`${kpi.em_preparo} em preparo · ${kpi.atrasados} atrasado${kpi.atrasados !== 1 ? "s" : ""}` },
        ].map(({ label, val, var: v, sub }) => (
          <div key={label} style={{ background:"var(--color-background-secondary)", borderRadius:"var(--border-radius-md)", padding:"12px 14px" }}>
            <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.4px" }}>{label}</div>
            <div style={{ fontSize:20, fontWeight:500, color:"var(--color-text-primary)" }}>{val}</div>
            {v && <div style={{ fontSize:11, marginTop:3, color: v.val >= 0 ? "var(--color-text-success)" : "var(--color-text-danger)" }}>{v.val >= 0 ? "↑" : "↓"} {v.label} vs período anterior</div>}
            {sub && <div style={{ fontSize:11, marginTop:3, color:"var(--color-text-secondary)" }}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* GRÁFICO FATURAMENTO */}
      <div style={card}>
        <div style={cardHeader}>
          <span style={cardTitle}>Evolução do faturamento</span>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ display:"flex", gap:8, fontSize:11, color:"var(--color-text-secondary)", alignItems:"center" }}>
              <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:10, height:2, background:"#3266ad", display:"inline-block", borderRadius:2 }}></span>Atual</span>
              <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:10, height:2, background:"#b4b2a9", display:"inline-block", borderRadius:2 }}></span>Anterior</span>
            </div>
            <div style={{ display:"flex", gap:6 }}>
              {(["diario","semanal","mensal"] as Periodo[]).map(p => (
                <button key={p} onClick={() => setPeriodoFat(p)} style={chip(periodoFat === p)}>
                  {p === "diario" ? "Diário" : p === "semanal" ? "Semanal" : "Mensal"}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:8 }}>
          Comparando {dataInicio.split("-").reverse().join("/")} – {dataFim.split("-").reverse().join("/")} vs período homólogo D-28: {antIni.split("-").reverse().join("/")} – {antFim.split("-").reverse().join("/")}
        </div>
        <div style={{ position:"relative", height:150 }}>
          <canvas id="chartFat" role="img" aria-label="Gráfico de faturamento por período">Evolução do faturamento.</canvas>
        </div>
      </div>

      {/* DRE COMPARATIVA */}
      <div style={card}>
        <div style={cardHeader}>
          <span style={cardTitle}>DRE comparativa</span>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:11, color:"var(--color-text-secondary)" }}>
              {dataInicio.split("-").reverse().join("/")} – {dataFim.split("-").reverse().join("/")} vs {antIni.split("-").reverse().join("/")} – {antFim.split("-").reverse().join("/")}
            </span>
          </div>
        </div>
        <div style={{ ...th, gridTemplateColumns:"2fr 1fr 1fr 90px" }}>
          <div>Indicador</div><div style={{ textAlign:"right" }}>Atual</div><div style={{ textAlign:"right" }}>Anterior</div><div style={{ textAlign:"right" }}>Variação</div>
        </div>
        {[
          { label:"Faturamento bruto",      atual:recBruta,  ant:0 },
          { label:"CMV",                    atual:cmv,       ant:0 },
          { label:"Margem de contribuição", atual:margContr, ant:0 },
          { label:"Custos operacionais",    atual:custosOp,  ant:0 },
          { label:"Resultado operacional",  atual:ebitda,    ant:0, bold:true },
        ].map(({ label, atual, ant: a, bold }, i, arr) => (
          <div key={label} style={{ ...tr(i === arr.length - 1), gridTemplateColumns:"2fr 1fr 1fr 90px", fontWeight: bold ? 500 : 400 }}>
            <div>{label}</div>
            <div style={{ textAlign:"right", fontWeight:500 }}>{fmt(atual)}</div>
            <div style={{ textAlign:"right", color:"var(--color-text-secondary)" }}>—</div>
            <div style={{ textAlign:"right", color:"var(--color-text-secondary)" }}>—</div>
          </div>
        ))}
      </div>

      {/* SEÇÃO 1 */}
      <div style={sectionLabel}>1. Operação em tempo real</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>

        {/* Pedidos ativos */}
        <div style={card}>
          <div style={cardHeader}>
            <span style={cardTitle}>Pedidos ativos</span>
            <div style={{ display:"flex", gap:4 }}>
              {(["todos","em_preparo","atrasado","entregue"] as FiltroStatus[]).map(s => (
                <button key={s} onClick={() => setFiltroStatus(s)} style={chip(periodoFiltroStatus === s)}>
                  {s === "todos" ? "Todos" : s === "em_preparo" ? "Em preparo" : s === "atrasado" ? "Atrasado" : "Entregue"}
                </button>
              ))}
            </div>
          </div>
          {vendasFiltradas.slice(0, 5).length === 0 ? (
            <div style={{ fontSize:12, color:"var(--color-text-secondary)", padding:"12px 0" }}>Nenhum pedido encontrado.</div>
          ) : vendasFiltradas.slice(0, 5).map(v => {
            const atrasado = v.previsao_entrega && new Date(v.previsao_entrega) < new Date() && v.status !== "entregue" && v.status !== "cancelado";
            return (
              <div key={v.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 0", borderBottom:"0.5px solid var(--color-border-tertiary)", fontSize:12 }}>
                <span>{CANAL_EMOJI[v.canal] || "📦"}</span>
                <div style={{ flex:1, color:"var(--color-text-primary)" }}>{v.qtd_itens} item(s) · {fmt(v.total)}</div>
                <span style={{ fontSize:11, color:"var(--color-text-secondary)" }}>
                  {Math.round((Date.now() - new Date(v.created_at).getTime()) / 60000)}min
                </span>
                {atrasado
                  ? <span style={pill("#fcebeb","#791f1f")}>⚠ Atrasado</span>
                  : v.status === "em_preparo"
                  ? <span style={pill("#faeeda","#633806")}>Em preparo</span>
                  : v.status === "entregue"
                  ? <span style={pill("#eaf3de","#27500a")}>Entregue</span>
                  : <span style={pill("var(--color-background-secondary)","var(--color-text-secondary)")}>{v.status}</span>
                }
              </div>
            );
          })}
        </div>

        {/* Alertas */}
        <div style={{ ...card, marginBottom: 0 }}>
          <div style={cardHeader}>
            <span style={cardTitle}>Alertas operacionais</span>
            <span style={{ fontSize:11, color:"var(--color-text-secondary)" }}>Clique para detalhes</span>
          </div>
          {estoque.filter(e => e.nivel_estoque === "ruptura").map(e => (
            <div key={e.id} style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"8px 10px", borderRadius:"var(--border-radius-md)", marginBottom:6, fontSize:12, background:"var(--color-background-danger)", color:"var(--color-text-danger)", cursor:"pointer" }}>
              <span style={{ fontSize:15, flexShrink:0 }}>⚠</span>
              <div>
                <div><strong>Ruptura:</strong> {e.nome} zerado. {e.previsao_entrega ? `Previsão entrega: ${new Date(e.previsao_entrega).toLocaleDateString("pt-BR")}` : "Sem compra agendada."}</div>
                <div style={{ fontSize:11, opacity:.7, textDecoration:"underline", marginTop:2 }}>Ver estoque →</div>
              </div>
            </div>
          ))}
          {estoque.filter(e => e.nivel_estoque === "risco").map(e => (
            <div key={e.id} style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"8px 10px", borderRadius:"var(--border-radius-md)", marginBottom:6, fontSize:12, background:"var(--color-background-warning)", color:"var(--color-text-warning)", cursor:"pointer" }}>
              <span style={{ fontSize:15, flexShrink:0 }}>⚡</span>
              <div>
                <div><strong>Risco:</strong> {e.nome} para {e.cobertura_dias ?? "?"} dias. Estoque mínimo atingido.</div>
                <div style={{ fontSize:11, opacity:.7, textDecoration:"underline", marginTop:2 }}>Ver estoque e sugerir compra →</div>
              </div>
            </div>
          ))}
          {estoque.filter(e => e.nivel_estoque === "ruptura" || e.nivel_estoque === "risco").length === 0 && (
            <div style={{ fontSize:12, color:"var(--color-text-secondary)", padding:"12px 0" }}>✅ Nenhum alerta crítico no momento.</div>
          )}
        </div>
      </div>

      {/* SEÇÃO 2 */}
      <div style={sectionLabel}>2. Estoque</div>
      <div style={card}>
        <div style={cardHeader}>
          <span style={cardTitle}>Estoque crítico</span>
          <div style={{ display:"flex", gap:4 }}>
            <button onClick={() => setFiltroEstoque("todos")}   style={chip(filtroEstoque === "todos")}>Todos</button>
            <button onClick={() => setFiltroEstoque("saudavel")} style={chip(filtroEstoque === "saudavel", "#eaf3de")}><span style={{ width:6, height:6, background:"#27500a", borderRadius:"50%", display:"inline-block", marginRight:4 }}></span>Ok</button>
            <button onClick={() => setFiltroEstoque("risco")}   style={chip(filtroEstoque === "risco", "#faeeda")}><span style={{ width:6, height:6, background:"#633806", borderRadius:"50%", display:"inline-block", marginRight:4 }}></span>Risco</button>
            <button onClick={() => setFiltroEstoque("ruptura")} style={chip(filtroEstoque === "ruptura", "#fcebeb")}><span style={{ width:6, height:6, background:"#791f1f", borderRadius:"50%", display:"inline-block", marginRight:4 }}></span>Ruptura</button>
          </div>
        </div>
        <div style={{ ...th, gridTemplateColumns:"2fr 1fr 1fr 1fr 100px" }}>
          <div>Ingrediente</div><div style={{ textAlign:"right" }}>Saldo</div><div style={{ textAlign:"right" }}>Cobertura</div><div style={{ textAlign:"right" }}>Agendado</div><div style={{ textAlign:"right" }}>Nível</div>
        </div>
        {estoqueFiltrado.length === 0 ? (
          <div style={{ fontSize:12, color:"var(--color-text-secondary)", padding:"12px 0" }}>Nenhum item encontrado.</div>
        ) : estoqueFiltrado.map((e, i) => (
          <div key={e.id} style={{ ...tr(i === estoqueFiltrado.length - 1), gridTemplateColumns:"2fr 1fr 1fr 1fr 100px" }}>
            <div>{e.nome}</div>
            <div style={{ textAlign:"right", color: e.saldo_atual <= 0 ? "var(--color-text-danger)" : "var(--color-text-secondary)" }}>{e.saldo_atual.toFixed(1)} {e.unidade}</div>
            <div style={{ textAlign:"right", color: (e.cobertura_dias || 0) <= 1 ? "var(--color-text-danger)" : (e.cobertura_dias || 0) <= 3 ? "var(--color-text-warning)" : "var(--color-text-success)" }}>
              {e.cobertura_dias !== null ? `${e.cobertura_dias}d` : "—"}
            </div>
            <div style={{ textAlign:"right", color:"var(--color-text-secondary)" }}>
              {e.estoque_agendado > 0 ? `${e.estoque_agendado}${e.unidade}` : "—"}
            </div>
            <div style={{ textAlign:"right" }}>
              {e.nivel_estoque === "ruptura"
                ? <span style={pill("#fcebeb","#791f1f")}>🔴 Ruptura</span>
                : e.nivel_estoque === "risco"
                ? <span style={pill("#faeeda","#633806")}>🟡 Risco</span>
                : <span style={pill("#eaf3de","#27500a")}>🟢 Ok</span>
              }
            </div>
          </div>
        ))}
      </div>

      {/* CHARTS */}
      <ChartLoader fatDias={fatDias} />
    </div>
  );
}

function ChartLoader({ fatDias }: { fatDias: { data: string; faturamento_bruto: number }[] }) {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
    script.onload = () => {
      const canvas = document.getElementById("chartFat") as HTMLCanvasElement;
      if (!canvas || !(window as any).Chart) return;
      const labels = fatDias.map(d => new Date(d.data).toLocaleDateString("pt-BR", { day:"2-digit", month:"2-digit" }));
      const valores = fatDias.map(d => d.faturamento_bruto);
      new (window as any).Chart(canvas, {
        type: "bar",
        data: {
          labels,
          datasets: [{
            label: "Faturamento",
            data: valores,
            backgroundColor: "#3266ad",
            borderRadius: 4,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11 }, color: "#888780" } },
            y: { grid: { color: "rgba(0,0,0,0.05)" }, ticks: { font: { size: 11 }, color: "#888780", callback: (v: number) => "R$" + v } }
          }
        }
      });
    };
    document.head.appendChild(script);
  }, [fatDias]);
  return null;
}