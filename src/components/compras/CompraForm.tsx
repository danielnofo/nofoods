"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";

const UNIDADES = ["kg","g","litro","ml","unidade"] as const;
type Unidade = typeof UNIDADES[number];

interface Fornecedor { id: string; nome_fantasia: string; }
interface Ingrediente { id: string; nome: string; unidade: string; codigo_interno: string | null; }

interface LinhaItem {
  ingrediente_id: string;
  quantidade:     string;
  unidade:        Unidade;
  valor_unitario: string;
  lote:           string;
  validade:       string;
}

interface CompraFormData {
  fornecedor_id: string;
  data_compra:   string;
  data_entrega:  string;
  observacoes:   string;
}

interface Props {
  inicial?: Partial<CompraFormData> & { id?: string };
  onSalvo?: () => void;
  onCancelar?: () => void;
}

const hoje = new Date().toISOString().split("T")[0];

const vazio: CompraFormData = {
  fornecedor_id:"", data_compra:hoje, data_entrega:"", observacoes:"",
};

const linhaVazia = (): LinhaItem => ({
  ingrediente_id:"", quantidade:"", unidade:"kg", valor_unitario:"", lote:"", validade:"",
});

export default function CompraForm({ inicial, onSalvo, onCancelar }: Props) {
  const supabase = createClient();
  const editando = !!inicial?.id;

  const [form, setForm]               = useState<CompraFormData>({ ...vazio, ...inicial });
  const [linhas, setLinhas]           = useState<LinhaItem[]>([linhaVazia()]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [loading, setLoading]         = useState(false);
  const [erro, setErro]               = useState<string | null>(null);
  const [aba, setAba]                 = useState<"dados"|"itens">("dados");

  useEffect(() => {
    supabase.from("fornecedores").select("id,nome_fantasia").eq("ativo",true).order("nome_fantasia")
      .then(({ data }) => { if (data) setFornecedores(data); });
    supabase.from("ingredientes").select("id,nome,unidade,codigo_interno").eq("ativo",true).order("nome")
      .then(({ data }) => { if (data) setIngredientes(data); });
  }, []);

  useEffect(() => {
    if (!editando || !inicial?.id) return;
    supabase.from("compra_itens")
      .select("ingrediente_id,quantidade,unidade,valor_unitario,lote,validade")
      .eq("compra_id", inicial.id)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setLinhas(data.map((d: any) => ({
            ingrediente_id: d.ingrediente_id,
            quantidade:     String(d.quantidade),
            unidade:        d.unidade,
            valor_unitario: String(d.valor_unitario),
            lote:           d.lote || "",
            validade:       d.validade || "",
          })));
        }
      });
  }, [editando, inicial?.id]);

  function campo(key: keyof CompraFormData, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

function gerarLote(codigoInterno: string | null) {
  const agora = new Date();
  const data = agora.toISOString().slice(0,10).replace(/-/g,"");
  const hora = String(agora.getHours()).padStart(2,"0");
  const base = codigoInterno || "ING";
  return `${base}-${data}-${hora}`;
}

function atualizarLinha(i: number, key: keyof LinhaItem, value: string) {
  setLinhas(prev => {
    const novas = [...prev];
    if (key === "ingrediente_id") {
      const ing = ingredientes.find(x => x.id === value);
      novas[i] = {
        ...novas[i],
        ingrediente_id: value,
        unidade: (ing?.unidade as Unidade) || "kg",
        lote: gerarLote((ing as any)?.codigo_interno || null),
      };
    } else {
      novas[i] = { ...novas[i], [key]: value };
    }
    return novas;
  });
}

  function adicionarLinha() { setLinhas(prev => [...prev, linhaVazia()]); }
  function removerLinha(i: number) { setLinhas(prev => prev.filter((_,idx) => idx !== i)); }

  const linhasValidas = linhas.filter(l => l.ingrediente_id && l.quantidade && l.valor_unitario);

  const totalCompra = linhasValidas.reduce((s, l) => {
    return s + (parseFloat(l.quantidade)||0) * (parseFloat(l.valor_unitario)||0);
  }, 0);

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!form.data_compra)         return setErro("Data da compra é obrigatória.");
    if (linhasValidas.length === 0) return setErro("Adicione ao menos 1 item.");
    setLoading(true);

    const payload = {
      fornecedor_id: form.fornecedor_id || null,
      data_compra:   form.data_compra,
      data_entrega:  form.data_entrega || null,
      observacoes:   form.observacoes.trim() || null,
      status:        "pendente",
    };

    let compraId = inicial?.id;

    if (editando && compraId) {
      const { error } = await supabase.from("compras").update(payload).eq("id", compraId);
      if (error) { setLoading(false); return setErro(error.message); }
      await supabase.from("compra_itens").delete().eq("compra_id", compraId);
    } else {
      const { data, error } = await supabase.from("compras").insert(payload).select("id").single();
      if (error || !data) { setLoading(false); return setErro(error?.message || "Erro ao criar compra."); }
      compraId = data.id;
    }

    const itensInsert = linhasValidas.map(l => ({
      compra_id:      compraId,
      ingrediente_id: l.ingrediente_id,
      quantidade:     parseFloat(l.quantidade),
      unidade:        l.unidade,
      valor_unitario: parseFloat(l.valor_unitario),
      lote:           l.lote || null,
      validade:       l.validade || null,
    }));

    const { error: errItens } = await supabase.from("compra_itens").insert(itensInsert);
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

  return (
    <div style={{ position:"fixed", inset:0, zIndex:50, background:"rgba(0,0,0,.55)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#fff", borderRadius:16, width:"100%", maxWidth:720, maxHeight:"92vh", overflowY:"auto", boxShadow:"0 24px 60px rgba(0,0,0,.2)", display:"flex", flexDirection:"column" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", padding:"24px 24px 0", gap:12 }}>
          <div>
            <p style={{ fontSize:".65rem", letterSpacing:3, textTransform:"uppercase", color:"#0ea5e9", fontWeight:700, marginBottom:2 }}>FOODOS</p>
            <h2 style={{ fontSize:"1.35rem", fontWeight:700, color:"#111" }}>
              {editando ? "Editar Compra" : "Nova Compra"}
            </h2>
          </div>
          <button onClick={onCancelar} style={{ background:"#f4f4f5", border:"none", borderRadius:8, width:32, height:32, cursor:"pointer", fontSize:".9rem", color:"#666" }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", padding:"16px 24px 0", borderBottom:"1px solid #f0f0f0" }}>
          {[
            { key:"dados", label:"Dados da Compra" },
            { key:"itens", label:`Itens (${linhasValidas.length})` },
          ].map(t => (
            <button key={t.key} type="button" onClick={() => setAba(t.key as "dados"|"itens")}
              style={{ background:"none", border:"none", padding:"8px 16px", fontSize:".82rem", fontWeight:600, cursor:"pointer", color:aba===t.key ? "#0ea5e9" : "#999", borderBottom:aba===t.key ? "2px solid #0ea5e9" : "2px solid transparent", marginBottom:-1 }}>
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding:"20px 24px" }}>

            {/* ABA DADOS */}
            {aba === "dados" && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>

                <div style={{ gridColumn:"1/-1" }}>
                  <label style={labelStyle}>Fornecedor</label>
                  <select style={inputStyle} value={form.fornecedor_id} onChange={e => campo("fornecedor_id", e.target.value)}>
                    <option value="">Selecione o fornecedor...</option>
                    {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome_fantasia}</option>)}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Data da Compra *</label>
                  <input style={inputStyle} type="date" value={form.data_compra} onChange={e => campo("data_compra", e.target.value)} />
                </div>

                <div>
                  <label style={labelStyle}>Data de Entrega Prevista</label>
                  <input style={inputStyle} type="date" value={form.data_entrega} onChange={e => campo("data_entrega", e.target.value)} />
                </div>

                <div style={{ gridColumn:"1/-1" }}>
                  <label style={labelStyle}>Observações</label>
                  <textarea style={{ ...inputStyle, resize:"vertical" }} value={form.observacoes} onChange={e => campo("observacoes", e.target.value)} placeholder="Condições da compra, número do pedido..." rows={3} />
                </div>
              </div>
            )}

            {/* ABA ITENS */}
            {aba === "itens" && (
              <div>
                {/* Total */}
                {totalCompra > 0 && (
                  <div style={{ background:"#f0f9ff", border:"1px solid #bae6fd", borderRadius:10, padding:"12px 16px", marginBottom:16, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <span style={{ fontSize:".82rem", color:"#0369a1", fontWeight:600 }}>Total da compra</span>
                    <span style={{ fontSize:"1.3rem", fontWeight:800, color:"#0369a1" }}>{fmt(totalCompra)}</span>
                  </div>
                )}

                {/* Cabeçalho */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 80px 70px 90px 80px 90px 32px", gap:6, marginBottom:6 }}>
                  {["Ingrediente","Qtd","Unid","R$ Unit","Lote","Validade",""].map(h => (
                    <div key={h} style={{ fontSize:".62rem", fontWeight:700, color:"#aaa", textTransform:"uppercase", letterSpacing:1 }}>{h}</div>
                  ))}
                </div>

                {/* Linhas */}
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {linhas.map((linha, i) => (
                    <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 80px 70px 90px 80px 90px 32px", gap:6, alignItems:"center" }}>
                      <select value={linha.ingrediente_id} onChange={e => atualizarLinha(i,"ingrediente_id",e.target.value)} style={{ ...inputStyle, fontSize:".8rem" }}>
                        <option value="">Ingrediente...</option>
                        {ingredientes.map(ing => <option key={ing.id} value={ing.id}>{ing.nome}</option>)}
                      </select>
                      <input type="number" min="0" step="0.001" placeholder="0" value={linha.quantidade} onChange={e => atualizarLinha(i,"quantidade",e.target.value)} style={{ ...inputStyle, textAlign:"center", fontSize:".82rem" }} />
                      <select value={linha.unidade} onChange={e => atualizarLinha(i,"unidade",e.target.value)} style={{ ...inputStyle, fontSize:".8rem" }}>
                        {UNIDADES.map(u => <option key={u}>{u}</option>)}
                      </select>
                      <input type="number" min="0" step="0.0001" placeholder="0,00" value={linha.valor_unitario} onChange={e => atualizarLinha(i,"valor_unitario",e.target.value)} style={{ ...inputStyle, textAlign:"center", fontSize:".82rem" }} />
                      <input placeholder="Lote" value={linha.lote} onChange={e => atualizarLinha(i,"lote",e.target.value)} style={{ ...inputStyle, fontSize:".8rem" }} />
                      <input type="date" value={linha.validade} onChange={e => atualizarLinha(i,"validade",e.target.value)} style={{ ...inputStyle, fontSize:".78rem" }} />
                      <button type="button" onClick={() => removerLinha(i)}
                        style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:6, width:32, height:36, cursor:"pointer", color:"#dc2626", fontSize:"1rem", display:"flex", alignItems:"center", justifyContent:"center" }}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                <button type="button" onClick={adicionarLinha}
                  style={{ marginTop:12, background:"none", border:"1.5px dashed #bae6fd", borderRadius:8, padding:"8px 16px", fontSize:".82rem", fontWeight:600, color:"#0ea5e9", cursor:"pointer", width:"100%" }}>
                  + Adicionar item
                </button>
              </div>
            )}
          </div>

          {erro && (
            <div style={{ margin:"0 24px 8px", background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8, padding:"10px 14px", fontSize:".82rem", color:"#dc2626" }}>{erro}</div>
          )}

          <div style={{ display:"flex", gap:10, justifyContent:"space-between", padding:"16px 24px", borderTop:"1px solid #f0f0f0", alignItems:"center" }}>
            <div style={{ fontSize:".75rem", color:"#888" }}>
              {linhasValidas.length > 0 && `${linhasValidas.length} item${linhasValidas.length>1?"s":""} · Total: ${fmt(totalCompra)}`}
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button type="button" onClick={onCancelar} style={{ background:"none", border:"1.5px solid #e4e4e7", borderRadius:8, padding:"9px 20px", fontSize:".85rem", fontWeight:600, color:"#666", cursor:"pointer" }}>Cancelar</button>
              <button type="submit" disabled={loading} style={{ background:loading ? "#7dd3fc" : "#0ea5e9", border:"none", borderRadius:8, padding:"9px 24px", fontSize:".85rem", fontWeight:700, color:"#fff", cursor:loading?"not-allowed":"pointer" }}>
                {loading ? "Salvando..." : editando ? "Salvar Alterações" : "Registrar Compra"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}