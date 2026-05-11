"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";

const CANAIS = ["Balcão","WhatsApp","iFood","99Food","Site"] as const;
const PAGAMENTOS = ["Dinheiro","Cartão Débito","Cartão Crédito","PIX","Online","Na Entrega","Fiado"] as const;
const STATUS = ["pendente","confirmado","em_preparo","entregue"] as const;

type Canal     = typeof CANAIS[number];
type Pagamento = typeof PAGAMENTOS[number];
type Status    = typeof STATUS[number];

interface Prato   { id: string; nome: string; categoria: string; preco_venda: number | null; tempo_preparo_min: number | null; }
interface Cliente { id: string; nome: string; whatsapp: string | null; }
interface Zona    { id: string; nome: string; descricao: string; tempo_min: number; }

interface LinhaItem {
  prato_id:   string;
  quantidade: number;
  preco_unit: number;
  _nome?:     string;
  _tempo?:    number;
}

interface Props {
  onSalvo?:    () => void;
  onCancelar?: () => void;
}

export default function VendaForm({ onSalvo, onCancelar }: Props) {
  const supabase = createClient();

  const [canal, setCanal]           = useState<Canal>("Balcão");
  const [pagamento, setPagamento]   = useState<Pagamento>("PIX");
  const [status, setStatus]         = useState<Status>("confirmado");
  const [clienteId, setClienteId]   = useState("");
  const [zonaId, setZonaId]         = useState("");
  const [taxaEntrega, setTaxaEntrega] = useState("0");
  const [desconto, setDesconto]     = useState("0");
  const [observacoes, setObs]       = useState("");
  const [linhas, setLinhas]         = useState<LinhaItem[]>([]);
  const [pratos, setPratos]         = useState<Prato[]>([]);
  const [clientes, setClientes]     = useState<Cliente[]>([]);
  const [zonas, setZonas]           = useState<Zona[]>([]);
  const [filaAte, setFilaAte]       = useState<Date | null>(null);
  const [loading, setLoading]       = useState(false);
  const [erro, setErro]             = useState<string | null>(null);
  const [aba, setAba]               = useState<"itens"|"dados">("itens");
  const [novoCliente, setNovoCliente] = useState(false);
  const [nomeCliente, setNomeCliente] = useState("");
  const [whatsCliente, setWhatsCliente] = useState("");

  useEffect(() => {
    supabase.from("pratos").select("id,nome,categoria,preco_venda,tempo_preparo_min").eq("ativo",true).order("categoria").order("nome")
      .then(({ data }) => { if (data) setPratos(data); });
    supabase.from("clientes").select("id,nome,whatsapp").eq("ativo",true).order("nome")
      .then(({ data }) => { if (data) setClientes(data); });
    supabase.from("zonas_entrega").select("id,nome,descricao,tempo_min").eq("ativo",true).order("tempo_min")
      .then(({ data }) => { if (data) setZonas(data); });
    // Calcular fila FIFO
    supabase.from("vendas").select("previsao_entrega").in("status",["confirmado","em_preparo"])
      .then(({ data }) => {
        if (data && data.length > 0) {
          const ultimas = data.filter(v => v.previsao_entrega).sort((a,b) =>
            new Date(b.previsao_entrega).getTime() - new Date(a.previsao_entrega).getTime()
          );
          if (ultimas[0]?.previsao_entrega) setFilaAte(new Date(ultimas[0].previsao_entrega));
        }
      });
  }, []);

  function adicionarPrato(pratoId: string) {
    const prato = pratos.find(p => p.id === pratoId);
    if (!prato) return;
    const existe = linhas.findIndex(l => l.prato_id === pratoId);
    if (existe >= 0) {
      setLinhas(prev => prev.map((l,i) => i===existe ? {...l, quantidade:l.quantidade+1} : l));
    } else {
      setLinhas(prev => [...prev, { prato_id:pratoId, quantidade:1, preco_unit:prato.preco_venda||0, _nome:prato.nome, _tempo:prato.tempo_preparo_min||15 }]);
    }
  }

  function mudarQtd(i: number, delta: number) {
    setLinhas(prev => {
      const novas = [...prev];
      novas[i] = { ...novas[i], quantidade: Math.max(0, novas[i].quantidade + delta) };
      return novas.filter(l => l.quantidade > 0);
    });
  }

  function mudarPreco(i: number, preco: string) {
    setLinhas(prev => prev.map((l,idx) => idx===i ? {...l, preco_unit:parseFloat(preco)||0} : l));
  }

  function calcularPrevisao() {
    if (linhas.length === 0) return null;
    const agora = new Date();
    const tempoPreparo = Math.max(...linhas.map(l => l._tempo || 15));
    const zona = zonas.find(z => z.id === zonaId);
    const tempoZona = canal !== "Balcão" ? (zona?.tempo_min || 0) : 0;
    const base = filaAte && filaAte > agora ? filaAte : agora;
    const totalMin = tempoPreparo + tempoZona;
    const previsao = new Date(base.getTime() + totalMin * 60000);
    return { totalMin, previsao };
  }

  const subtotal = linhas.reduce((s,l) => s + l.quantidade * l.preco_unit, 0);
  const total    = subtotal + (parseFloat(taxaEntrega)||0) - (parseFloat(desconto)||0);
  const fmt      = (n: number) => n.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
  const previsao = calcularPrevisao();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (linhas.length === 0) return setErro("Adicione ao menos 1 item.");
    setLoading(true);

    let clienteFinalId = clienteId || null;
    if (novoCliente && nomeCliente.trim()) {
      const { data: novoC } = await supabase.from("clientes")
        .insert({ nome:nomeCliente.trim(), whatsapp:whatsCliente.trim()||null })
        .select("id").single();
      if (novoC) clienteFinalId = novoC.id;
    }

    const { data: venda, error } = await supabase.from("vendas").insert({
      cliente_id:        clienteFinalId,
      canal,
      forma_pagamento:   pagamento,
      status,
      taxa_entrega:      parseFloat(taxaEntrega)||0,
      desconto:          parseFloat(desconto)||0,
      observacoes:       observacoes.trim()||null,
      zona_entrega_id:   zonaId||null,
      tempo_estimado_min: previsao?.totalMin||null,
      previsao_entrega:  previsao?.previsao.toISOString()||null,
    }).select("id").single();

    if (error || !venda) { setLoading(false); return setErro(error?.message||"Erro ao criar venda."); }

    const itens = linhas.map(l => ({ venda_id:venda.id, prato_id:l.prato_id, quantidade:l.quantidade, preco_unit:l.preco_unit }));
    const { error: errItens } = await supabase.from("venda_itens").insert(itens);

    // Baixar estoque FIFO
    for (const linha of linhas) {
      const { data: ings } = await supabase.from("prato_ingredientes")
        .select("ingrediente_id,quantidade,unidade").eq("prato_id", linha.prato_id);
      if (ings) {
        for (const ing of ings) {
          await supabase.from("estoque_movimentacoes").insert({
            ingrediente_id: ing.ingrediente_id,
            tipo:           "saida",
            quantidade:     ing.quantidade * linha.quantidade,
            unidade:        ing.unidade,
            motivo:         "venda",
            referencia_id:  venda.id,
          });
        }
      }
    }

    setLoading(false);
    if (errItens) return setErro(errItens.message);
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

  const pratosPorCategoria = pratos.reduce((acc, p) => {
    if (!acc[p.categoria]) acc[p.categoria] = [];
    acc[p.categoria].push(p);
    return acc;
  }, {} as Record<string, Prato[]>);

  return (
    <div style={{ position:"fixed", inset:0, zIndex:50, background:"rgba(0,0,0,.55)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#fff", borderRadius:16, width:"100%", maxWidth:740, maxHeight:"94vh", overflowY:"auto", boxShadow:"0 24px 60px rgba(0,0,0,.2)", display:"flex", flexDirection:"column" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", padding:"24px 24px 0", gap:12 }}>
          <div>
            <p style={{ fontSize:".65rem", letterSpacing:3, textTransform:"uppercase", color:"#ec4899", fontWeight:700, marginBottom:2 }}>FOODOS</p>
            <h2 style={{ fontSize:"1.35rem", fontWeight:700, color:"#111" }}>Nova Venda</h2>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            {total > 0 && (
              <div style={{ background:"#fdf2f8", border:"1px solid #fbcfe8", borderRadius:10, padding:"8px 16px", textAlign:"right" }}>
                <div style={{ fontSize:".65rem", color:"#9d174d", fontWeight:600, textTransform:"uppercase" }}>Total</div>
                <div style={{ fontSize:"1.2rem", fontWeight:800, color:"#ec4899" }}>{fmt(total)}</div>
              </div>
            )}
            <button onClick={onCancelar} style={{ background:"#f4f4f5", border:"none", borderRadius:8, width:32, height:32, cursor:"pointer", fontSize:".9rem", color:"#666" }}>✕</button>
          </div>
        </div>

        {/* Canal */}
        <div style={{ display:"flex", gap:8, padding:"16px 24px 0", overflowX:"auto" }}>
          {CANAIS.map(c => (
            <button key={c} type="button" onClick={() => setCanal(c)}
              style={{ background:canal===c?"#fdf2f8":"#f4f4f5", border:`2px solid ${canal===c?"#ec4899":"#e4e4e7"}`, borderRadius:10, padding:"8px 14px", cursor:"pointer", fontSize:".8rem", fontWeight:700, color:canal===c?"#9d174d":"#666", whiteSpace:"nowrap" }}>
              {c==="Balcão"?"🏪":c==="WhatsApp"?"📱":c==="Site"?"🌐":"🛵"} {c}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", padding:"12px 24px 0", borderBottom:"1px solid #f0f0f0" }}>
          {[
            { key:"itens", label:`🍽️ Itens (${linhas.length})` },
            { key:"dados", label:"⚙️ Dados da Venda" },
          ].map(t => (
            <button key={t.key} type="button" onClick={() => setAba(t.key as "itens"|"dados")}
              style={{ background:"none", border:"none", padding:"8px 16px", fontSize:".82rem", fontWeight:600, cursor:"pointer", color:aba===t.key?"#ec4899":"#999", borderBottom:aba===t.key?"2px solid #ec4899":"2px solid transparent", marginBottom:-1 }}>
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding:"20px 24px" }}>

            {/* ABA ITENS */}
            {aba === "itens" && (
              <div>
                {Object.entries(pratosPorCategoria).map(([cat, items]) => (
                  <div key={cat} style={{ marginBottom:16 }}>
                    <div style={{ fontSize:".7rem", fontWeight:700, color:"#aaa", textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>{cat}</div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                      {items.map(p => (
                        <button key={p.id} type="button" onClick={() => adicionarPrato(p.id)}
                          style={{ background:"#f9fafb", border:"1.5px solid #e4e4e7", borderRadius:10, padding:"8px 12px", cursor:"pointer", textAlign:"left" }}>
                          <div style={{ fontSize:".82rem", fontWeight:600, color:"#111" }}>{p.nome}</div>
                          <div style={{ fontSize:".68rem", color:"#aaa" }}>⏱️ {p.tempo_preparo_min||15}min</div>
                          <div style={{ fontSize:".72rem", color:"#ec4899", fontWeight:700 }}>
                            {p.preco_venda ? fmt(p.preco_venda) : "Consulte"}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {linhas.length > 0 && (
                  <div style={{ marginTop:16, borderTop:"1px solid #f0f0f0", paddingTop:16 }}>
                    <div style={{ fontSize:".7rem", fontWeight:700, color:"#aaa", textTransform:"uppercase", letterSpacing:2, marginBottom:10 }}>Itens do Pedido</div>
                    {linhas.map((l, i) => (
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:"1px solid #f9f9f9" }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:".85rem", fontWeight:600, color:"#111" }}>{l._nome}</div>
                          <div style={{ fontSize:".68rem", color:"#aaa" }}>⏱️ {l._tempo||15}min</div>
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                          <button type="button" onClick={() => mudarQtd(i,-1)} style={{ width:28, height:28, background:"#f4f4f5", border:"none", borderRadius:6, cursor:"pointer", fontWeight:700, fontSize:"1rem" }}>−</button>
                          <span style={{ minWidth:24, textAlign:"center", fontWeight:700 }}>{l.quantidade}</span>
                          <button type="button" onClick={() => mudarQtd(i,1)} style={{ width:28, height:28, background:"#f4f4f5", border:"none", borderRadius:6, cursor:"pointer", fontWeight:700, fontSize:"1rem" }}>+</button>
                        </div>
                        <div style={{ display:"flex", border:"1.5px solid #e4e4e7", borderRadius:6, overflow:"hidden", width:100 }}>
                          <span style={{ padding:"0 6px", background:"#f4f4f5", fontSize:".7rem", display:"flex", alignItems:"center", borderRight:"1px solid #e4e4e7", color:"#888" }}>R$</span>
                          <input type="number" min="0" step="0.01" value={l.preco_unit} onChange={e => mudarPreco(i, e.target.value)}
                            style={{ border:"none", background:"transparent", width:"100%", padding:"4px 6px", fontSize:".82rem", outline:"none" }} />
                        </div>
                        <div style={{ minWidth:70, textAlign:"right", fontWeight:700, fontSize:".85rem", color:"#ec4899" }}>
                          {fmt(l.quantidade * l.preco_unit)}
                        </div>
                      </div>
                    ))}

                    {/* Totais */}
                    <div style={{ marginTop:12, background:"#fdf2f8", borderRadius:10, padding:"12px 16px" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:".82rem", color:"#666", marginBottom:4 }}>
                        <span>Subtotal</span><span>{fmt(subtotal)}</span>
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:".82rem", color:"#666", marginBottom:4 }}>
                        <span>Taxa entrega</span>
                        <div style={{ display:"flex", border:"1px solid #fbcfe8", borderRadius:6, overflow:"hidden" }}>
                          <span style={{ padding:"2px 6px", background:"#fce7f3", fontSize:".7rem", display:"flex", alignItems:"center", color:"#9d174d" }}>R$</span>
                          <input type="number" min="0" step="0.01" value={taxaEntrega} onChange={e => setTaxaEntrega(e.target.value)}
                            style={{ border:"none", background:"transparent", width:70, padding:"2px 6px", fontSize:".82rem", outline:"none", textAlign:"right" }} />
                        </div>
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:".82rem", color:"#666", marginBottom:8 }}>
                        <span>Desconto</span>
                        <div style={{ display:"flex", border:"1px solid #fbcfe8", borderRadius:6, overflow:"hidden" }}>
                          <span style={{ padding:"2px 6px", background:"#fce7f3", fontSize:".7rem", display:"flex", alignItems:"center", color:"#9d174d" }}>R$</span>
                          <input type="number" min="0" step="0.01" value={desconto} onChange={e => setDesconto(e.target.value)}
                            style={{ border:"none", background:"transparent", width:70, padding:"2px 6px", fontSize:".82rem", outline:"none", textAlign:"right" }} />
                        </div>
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", fontWeight:800, fontSize:"1rem", color:"#ec4899", borderTop:"1px solid #fbcfe8", paddingTop:8 }}>
                        <span>Total</span><span>{fmt(total)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ABA DADOS */}
            {aba === "dados" && (
              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

                {/* Pagamento */}
                <div>
                  <label style={labelStyle}>Forma de Pagamento</label>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                    {PAGAMENTOS.map(p => (
                      <button key={p} type="button" onClick={() => setPagamento(p)}
                        style={{ background:pagamento===p?"#fdf2f8":"#f4f4f5", border:`1.5px solid ${pagamento===p?"#ec4899":"#e4e4e7"}`, borderRadius:8, padding:"6px 14px", cursor:"pointer", fontSize:".8rem", fontWeight:600, color:pagamento===p?"#9d174d":"#666" }}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status */}
                <div>
                  <label style={labelStyle}>Status</label>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {STATUS.map(s => (
                      <button key={s} type="button" onClick={() => setStatus(s)}
                        style={{ background:status===s?"#fdf2f8":"#f4f4f5", border:`1.5px solid ${status===s?"#ec4899":"#e4e4e7"}`, borderRadius:8, padding:"6px 14px", cursor:"pointer", fontSize:".8rem", fontWeight:600, color:status===s?"#9d174d":"#666" }}>
                        {s.replace("_"," ")}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Zona de entrega */}
                {canal !== "Balcão" && zonas.length > 0 && (
                  <div>
                    <label style={labelStyle}>Zona de Entrega</label>
                    <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                      {zonas.map(z => (
                        <button key={z.id} type="button" onClick={() => setZonaId(z.id)}
                          style={{ background:zonaId===z.id?"#fdf2f8":"#f4f4f5", border:`1.5px solid ${zonaId===z.id?"#ec4899":"#e4e4e7"}`, borderRadius:8, padding:"8px 14px", cursor:"pointer", textAlign:"left" }}>
                          <div style={{ fontSize:".82rem", fontWeight:700, color:zonaId===z.id?"#9d174d":"#111" }}>{z.nome}</div>
                          <div style={{ fontSize:".7rem", color:"#888" }}>{z.descricao} · +{z.tempo_min}min</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cliente */}
                <div>
                  <label style={labelStyle}>Cliente (opcional)</label>
                  <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                    <button type="button" onClick={() => setNovoCliente(false)}
                      style={{ background:!novoCliente?"#fdf2f8":"#f4f4f5", border:`1.5px solid ${!novoCliente?"#ec4899":"#e4e4e7"}`, borderRadius:8, padding:"6px 14px", cursor:"pointer", fontSize:".8rem", fontWeight:600, color:!novoCliente?"#9d174d":"#666" }}>
                      Cliente existente
                    </button>
                    <button type="button" onClick={() => setNovoCliente(true)}
                      style={{ background:novoCliente?"#fdf2f8":"#f4f4f5", border:`1.5px solid ${novoCliente?"#ec4899":"#e4e4e7"}`, borderRadius:8, padding:"6px 14px", cursor:"pointer", fontSize:".8rem", fontWeight:600, color:novoCliente?"#9d174d":"#666" }}>
                      + Novo cliente
                    </button>
                  </div>
                  {!novoCliente ? (
                    <select style={inputStyle} value={clienteId} onChange={e => setClienteId(e.target.value)}>
                      <option value="">Sem cliente vinculado</option>
                      {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}{c.whatsapp?` · ${c.whatsapp}`:""}</option>)}
                    </select>
                  ) : (
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                      <input style={inputStyle} placeholder="Nome do cliente" value={nomeCliente} onChange={e => setNomeCliente(e.target.value)} />
                      <input style={inputStyle} placeholder="WhatsApp" value={whatsCliente} onChange={e => setWhatsCliente(e.target.value)} />
                    </div>
                  )}
                </div>

                {/* Observações */}
                <div>
                  <label style={labelStyle}>Observações</label>
                  <textarea style={{ ...inputStyle, resize:"vertical" }} value={observacoes} onChange={e => setObs(e.target.value)} placeholder="Endereço de entrega, obs do pedido..." rows={3} />
                </div>
              </div>
            )}
          </div>

          {/* Previsão FIFO */}
          {previsao && (
            <div style={{ margin:"0 24px 12px", background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:10, padding:"12px 16px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:".7rem", color:"#15803d", fontWeight:700, textTransform:"uppercase", letterSpacing:1 }}>⏱️ Previsão de Entrega</div>
                  <div style={{ fontSize:"1.2rem", fontWeight:800, color:"#15803d" }}>
                    {previsao.previsao.toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" })}
                  </div>
                  {filaAte && filaAte > new Date() && (
                    <div style={{ fontSize:".68rem", color:"#16a34a" }}>Aguardando fila até {filaAte.toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" })}</div>
                  )}
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:".7rem", color:"#15803d" }}>Tempo total estimado</div>
                  <div style={{ fontSize:"1rem", fontWeight:700, color:"#15803d" }}>{previsao.totalMin} min</div>
                </div>
              </div>
            </div>
          )}

          {erro && (
            <div style={{ margin:"0 24px 8px", background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8, padding:"10px 14px", fontSize:".82rem", color:"#dc2626" }}>{erro}</div>
          )}

          <div style={{ display:"flex", gap:10, justifyContent:"space-between", padding:"16px 24px", borderTop:"1px solid #f0f0f0", alignItems:"center" }}>
            <div style={{ fontSize:".75rem", color:"#888" }}>
              {linhas.length > 0 && `${linhas.reduce((s,l)=>s+l.quantidade,0)} item(s) · ${fmt(total)}`}
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button type="button" onClick={onCancelar} style={{ background:"none", border:"1.5px solid #e4e4e7", borderRadius:8, padding:"9px 20px", fontSize:".85rem", fontWeight:600, color:"#666", cursor:"pointer" }}>Cancelar</button>
              <button type="submit" disabled={loading} style={{ background:loading?"#f9a8d4":"#ec4899", border:"none", borderRadius:8, padding:"9px 24px", fontSize:".85rem", fontWeight:700, color:"#fff", cursor:loading?"not-allowed":"pointer" }}>
                {loading ? "Salvando..." : "✓ Confirmar Venda"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}