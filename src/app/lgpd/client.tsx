"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";

interface Solicitacao {
  id:            string;
  cliente_id:    string | null;
  cliente_email: string | null;
  tipo:          string;
  status:        string;
  motivo:        string | null;
  resposta:      string | null;
  prazo_legal:   string | null;
  created_at:    string;
}

interface AuditLog {
  id:             string;
  usuario_email:  string | null;
  acao:           string;
  tabela:         string | null;
  created_at:     string;
}

interface Cliente {
  id:    string;
  nome:  string;
  email: string | null;
}

const C = {
  bg: "#111", card: "#1a1a1a", border: "#2a2a2a", borderLt: "#222",
  text: "#f0ede8", textSub: "#888780",
  green: "#4ade80", red: "#f87171", yellow: "#fbbf24", blue: "#60a5fa",
  blueBg: "#1e3a5f", blueBorder: "#1d4ed8",
};

const fmt = (s: string) => new Date(s).toLocaleDateString("pt-BR");
const fmtHora = (s: string) => new Date(s).toLocaleString("pt-BR");

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pendente:    { bg:"#3a2a00", color:"#fbbf24" },
  em_analise:  { bg:"#1e3a5f", color:"#60a5fa" },
  concluido:   { bg:"#1a3a1a", color:"#4ade80" },
  negado:      { bg:"#3a1a1a", color:"#f87171" },
};

const TIPO_LABEL: Record<string, string> = {
  exclusao:      "🗑️ Exclusão",
  portabilidade: "📤 Portabilidade",
  correcao:      "✏️ Correção",
  acesso:        "👁️ Acesso",
};

export default function LGPDClient() {
  const supabase = createClient();

  const [aba, setAba]                   = useState<"solicitacoes"|"auditoria"|"nova">("solicitacoes");
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [logs, setLogs]                 = useState<AuditLog[]>([]);
  const [clientes, setClientes]         = useState<Cliente[]>([]);
  const [loading, setLoading]           = useState(true);

  // Form nova solicitação
  const [clienteId, setClienteId]       = useState("");
  const [clienteEmail, setClienteEmail] = useState("");
  const [tipo, setTipo]                 = useState("exclusao");
  const [motivo, setMotivo]             = useState("");
  const [saving, setSaving]             = useState(false);
  const [sucesso, setSucesso]           = useState(false);

  const buscar = useCallback(async () => {
    setLoading(true);
    const [{ data: sol }, { data: lg }, { data: cli }] = await Promise.all([
      supabase.from("lgpd_solicitacoes").select("*").order("created_at", { ascending: false }),
      supabase.from("audit_logs").select("id,usuario_email,acao,tabela,created_at").order("created_at", { ascending: false }).limit(50),
      supabase.from("clientes").select("id,nome,email").eq("ativo", true).order("nome"),
    ]);
    if (sol) setSolicitacoes(sol);
    if (lg)  setLogs(lg);
    if (cli) setClientes(cli);
    setLoading(false);
  }, []);

  useEffect(() => { buscar(); }, [buscar]);

  async function atualizarStatus(id: string, status: string, resposta: string) {
    await supabase.from("lgpd_solicitacoes").update({ status, resposta }).eq("id", id);
    buscar();
  }

  async function executarExclusao(sol: Solicitacao) {
    if (!sol.cliente_id) return;
    await supabase.rpc("fn_excluir_dados_cliente", {
      p_cliente_id: sol.cliente_id,
      p_motivo: sol.motivo || "Solicitação LGPD",
    });
    await atualizarStatus(sol.id, "concluido", "Dados anonimizados conforme solicitação LGPD.");
  }

  async function handleNovaSolicitacao(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await supabase.from("lgpd_solicitacoes").insert({
      cliente_id:    clienteId || null,
      cliente_email: clienteEmail || null,
      tipo,
      motivo,
      status: "pendente",
    });
    setSaving(false);
    setSucesso(true);
    setClienteId(""); setClienteEmail(""); setMotivo("");
    setTimeout(() => { setSucesso(false); setAba("solicitacoes"); buscar(); }, 2000);
  }

  const pendentes = solicitacoes.filter(s => s.status === "pendente").length;

  const card: React.CSSProperties = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 12 };
  const th: React.CSSProperties = { display:"grid", fontSize:11, color:C.textSub, padding:"6px 0", borderBottom:`1px solid ${C.border}`, textTransform:"uppercase" as const, letterSpacing:"0.4px" };
  const tr = (last = false): React.CSSProperties => ({ display:"grid", padding:"8px 0", borderBottom: last ? "none" : `1px solid ${C.borderLt}`, fontSize:12, alignItems:"center", color:C.text });
  const pill = (bg: string, color: string): React.CSSProperties => ({ height:20, padding:"0 8px", fontSize:10, borderRadius:20, background:bg, color, display:"inline-flex", alignItems:"center", whiteSpace:"nowrap" as const });
  const chip = (active: boolean): React.CSSProperties => ({ height:24, padding:"0 12px", fontSize:11, borderRadius:20, border:`0.5px solid ${active ? C.blueBorder : C.border}`, background: active ? C.blueBg : "transparent", color: active ? C.blue : C.textSub, cursor:"pointer", whiteSpace:"nowrap" as const, display:"inline-flex", alignItems:"center", fontWeight: active ? 500 : 400 });
  const input: React.CSSProperties = { width:"100%", height:40, padding:"0 12px", fontSize:13, background:"#0d0d0d", border:`1px solid ${C.border}`, borderRadius:8, color:C.text, outline:"none" };
  const label: React.CSSProperties = { fontSize:11, color:C.textSub, textTransform:"uppercase" as const, letterSpacing:"0.5px", display:"block", marginBottom:6 };

  return (
    <div style={{ padding:24, maxWidth:1100, margin:"0 auto", background:C.bg, minHeight:"100vh", color:C.text }}>

      {/* HEADER */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:600, color:C.text }}>LGPD</h1>
          <p style={{ fontSize:12, color:C.textSub, marginTop:2 }}>Proteção de dados · Auditoria · Solicitações dos titulares</p>
        </div>
        <button onClick={() => setAba("nova")} style={{ height:36, padding:"0 16px", background:C.blueBg, border:`1px solid ${C.blueBorder}`, borderRadius:8, color:C.blue, fontSize:13, fontWeight:500, cursor:"pointer" }}>
          + Nova Solicitação
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:16 }}>
        {[
          { label:"Total solicitações", val:solicitacoes.length,                                cor:C.text },
          { label:"Pendentes",          val:pendentes,                                          cor:pendentes>0?C.yellow:C.green },
          { label:"Concluídas",         val:solicitacoes.filter(s=>s.status==="concluido").length, cor:C.green },
          { label:"Logs de auditoria",  val:logs.length,                                        cor:C.blue },
        ].map(({ label, val, cor }) => (
          <div key={label} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 16px" }}>
            <div style={{ fontSize:11, color:C.textSub, marginBottom:5, textTransform:"uppercase", letterSpacing:"0.4px" }}>{label}</div>
            <div style={{ fontSize:22, fontWeight:500, color:cor }}>{val}</div>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div style={{ display:"flex", gap:6, marginBottom:16 }}>
        <button onClick={() => setAba("solicitacoes")} style={chip(aba==="solicitacoes")}>📋 Solicitações</button>
        <button onClick={() => setAba("auditoria")}    style={chip(aba==="auditoria")}>🔍 Log de Auditoria</button>
        <button onClick={() => setAba("nova")}         style={chip(aba==="nova")}>+ Nova Solicitação</button>
      </div>

      {loading ? (
        <div style={{ padding:40, textAlign:"center", color:C.textSub }}>Carregando...</div>
      ) : (
        <>
          {/* ABA SOLICITAÇÕES */}
          {aba === "solicitacoes" && (
            <div style={card}>
              <div style={{ ...th, gridTemplateColumns:"1fr 1fr 1fr 80px 80px 140px" }}>
                <div>Cliente</div><div>Tipo</div><div>Motivo</div><div>Prazo</div><div>Status</div><div style={{ textAlign:"right" }}>Ações</div>
              </div>
              {solicitacoes.length === 0 ? (
                <div style={{ padding:"24px 0", textAlign:"center", color:C.textSub, fontSize:13 }}>Nenhuma solicitação registrada.</div>
              ) : solicitacoes.map((s, i) => {
                const st = STATUS_STYLE[s.status] || STATUS_STYLE.pendente;
                const vencido = s.prazo_legal && new Date(s.prazo_legal) < new Date() && s.status === "pendente";
                return (
                  <div key={s.id} style={{ ...tr(i===solicitacoes.length-1), gridTemplateColumns:"1fr 1fr 1fr 80px 80px 140px" }}>
                    <div style={{ color:C.text }}>{s.cliente_email || "—"}</div>
                    <div>{TIPO_LABEL[s.tipo] || s.tipo}</div>
                    <div style={{ color:C.textSub, fontSize:11 }}>{s.motivo ? s.motivo.substring(0,40)+"..." : "—"}</div>
                    <div style={{ color: vencido ? C.red : C.textSub, fontSize:11 }}>
                      {s.prazo_legal ? fmt(s.prazo_legal) : "—"}
                      {vencido && <div style={{ fontSize:10, color:C.red }}>⚠ Vencido</div>}
                    </div>
                    <div><span style={pill(st.bg, st.color)}>{s.status}</span></div>
                    <div style={{ display:"flex", gap:4, justifyContent:"flex-end" }}>
                      {s.status === "pendente" && (
                        <>
                          {s.tipo === "exclusao" && s.cliente_id && (
                            <button onClick={() => executarExclusao(s)}
                              style={{ height:24, padding:"0 8px", fontSize:10, background:"#3a1a1a", border:"1px solid #5a2a2a", borderRadius:6, color:C.red, cursor:"pointer" }}>
                              🗑️ Executar
                            </button>
                          )}
                          <button onClick={() => atualizarStatus(s.id, "em_analise", "")}
                            style={{ height:24, padding:"0 8px", fontSize:10, background:C.blueBg, border:`1px solid ${C.blueBorder}`, borderRadius:6, color:C.blue, cursor:"pointer" }}>
                            Analisar
                          </button>
                        </>
                      )}
                      {s.status === "em_analise" && (
                        <button onClick={() => atualizarStatus(s.id, "concluido", "Solicitação atendida.")}
                          style={{ height:24, padding:"0 8px", fontSize:10, background:"#1a3a1a", border:"1px solid #2a5a2a", borderRadius:6, color:C.green, cursor:"pointer" }}>
                          ✓ Concluir
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ABA AUDITORIA */}
          {aba === "auditoria" && (
            <div style={card}>
              <div style={{ marginBottom:10, fontSize:12, color:C.textSub }}>
                Últimos 50 registros de auditoria do sistema
              </div>
              <div style={{ ...th, gridTemplateColumns:"1fr 80px 1fr 120px" }}>
                <div>Usuário</div><div>Ação</div><div>Tabela</div><div>Data/Hora</div>
              </div>
              {logs.length === 0 ? (
                <div style={{ padding:"24px 0", textAlign:"center", color:C.textSub, fontSize:13 }}>Nenhum log registrado ainda.</div>
              ) : logs.map((l, i) => (
                <div key={l.id} style={{ ...tr(i===logs.length-1), gridTemplateColumns:"1fr 80px 1fr 120px" }}>
                  <div style={{ color:C.textSub, fontSize:11 }}>{l.usuario_email || "Sistema"}</div>
                  <div>
                    <span style={pill(
                      l.acao==="INSERT" ? "#1a3a1a" : l.acao==="DELETE"||l.acao==="DELETE_LGPD" ? "#3a1a1a" : "#1e3a5f",
                      l.acao==="INSERT" ? C.green : l.acao==="DELETE"||l.acao==="DELETE_LGPD" ? C.red : C.blue
                    )}>{l.acao}</span>
                  </div>
                  <div style={{ color:C.textSub, fontSize:11 }}>{l.tabela || "—"}</div>
                  <div style={{ color:C.textSub, fontSize:11 }}>{fmtHora(l.created_at)}</div>
                </div>
              ))}
            </div>
          )}

          {/* ABA NOVA SOLICITAÇÃO */}
          {aba === "nova" && (
            <div style={{ ...card, maxWidth:540 }}>
              <div style={{ fontSize:14, fontWeight:500, color:C.text, marginBottom:16 }}>Registrar Solicitação do Titular</div>

              {sucesso && (
                <div style={{ background:"#1a3a1a", border:"1px solid #2a5a2a", borderRadius:8, padding:"10px 12px", fontSize:12, color:C.green, marginBottom:14 }}>
                  ✅ Solicitação registrada com sucesso!
                </div>
              )}

              <form onSubmit={handleNovaSolicitacao}>
                <div style={{ marginBottom:14 }}>
                  <label style={label}>Tipo de Solicitação *</label>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" as const }}>
                    {Object.entries(TIPO_LABEL).map(([key, val]) => (
                      <button key={key} type="button" onClick={() => setTipo(key)} style={chip(tipo===key)}>
                        {val}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom:14 }}>
                  <label style={label}>Cliente (opcional)</label>
                  <select value={clienteId} onChange={e => setClienteId(e.target.value)}
                    style={{ ...input, background:"#0d0d0d" }}>
                    <option value="">Selecione o cliente...</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}{c.email ? ` · ${c.email}` : ""}</option>)}
                  </select>
                </div>

                <div style={{ marginBottom:14 }}>
                  <label style={label}>Email do Titular</label>
                  <input type="email" value={clienteEmail} onChange={e => setClienteEmail(e.target.value)} placeholder="email@titular.com"
                    style={input} />
                </div>

                <div style={{ marginBottom:20 }}>
                  <label style={label}>Descrição da Solicitação *</label>
                  <textarea value={motivo} onChange={e => setMotivo(e.target.value)} required rows={4}
                    placeholder="Descreva o que o titular está solicitando..."
                    style={{ ...input, height:"auto", padding:"10px 12px", resize:"vertical" as const }} />
                </div>

                <div style={{ background:"#1e3a5f22", border:`1px solid ${C.blueBorder}33`, borderRadius:8, padding:"10px 12px", fontSize:11, color:C.textSub, marginBottom:16 }}>
                  ℹ️ O prazo legal para resposta é de <strong style={{ color:C.blue }}>15 dias corridos</strong> conforme Art. 18 da LGPD.
                </div>

                <div style={{ display:"flex", gap:8 }}>
                  <button type="button" onClick={() => setAba("solicitacoes")}
                    style={{ flex:1, height:40, background:"transparent", border:`1px solid ${C.border}`, borderRadius:8, color:C.textSub, fontSize:13, cursor:"pointer" }}>
                    Cancelar
                  </button>
                  <button type="submit" disabled={saving}
                    style={{ flex:2, height:40, background:C.blueBg, border:`1px solid ${C.blueBorder}`, borderRadius:8, color:C.blue, fontSize:13, fontWeight:500, cursor:saving?"not-allowed":"pointer" }}>
                    {saving ? "Registrando..." : "Registrar Solicitação"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  );
}