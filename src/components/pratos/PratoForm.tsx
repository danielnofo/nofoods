"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";

const CATEGORIAS = [
  "Entrada","Prato Principal","Acompanhamento",
  "Sobremesa","Bebida","Combo","Porções","Outros",
] as const;

const UNIDADES = ["kg","g","litro","ml","unidade"] as const;

type Categoria = typeof CATEGORIAS[number];
type Unidade   = typeof UNIDADES[number];

interface Ingrediente {
  id:               string;
  nome:             string;
  unidade:          string;
  nut_calorias:     number | null;
  nut_proteinas:    number | null;
  nut_carboidratos: number | null;
  nut_gorduras:     number | null;
}

interface FatorCoccao {
  id:    string;
  nome:  string;
  fator: number;
}

interface LinhaIngrediente {
  ingrediente_id:    string;
  quantidade:        string;
  unidade:           Unidade;
  fator_coccao_id:   string;
  fator_coccao_valor:number;
  _nome?:            string;
}

interface PratoFormData {
  nome:            string;
  categoria:       Categoria | "";
  descricao:       string;
  preco_venda:     string;
  margem_desejada: string;
  ativo:           boolean;
  observacoes:     string;
}

interface Props {
  inicial?: Partial<PratoFormData> & { id?: string };
  onSalvo?: () => void;
  onCancelar?: () => void;
}

const vazio: PratoFormData = {
  nome:"", categoria:"", descricao:"",
  preco_venda:"", margem_desejada:"70",
  ativo:true, observacoes:"",
};

const linhaVazia = (fatores: FatorCoccao[]): LinhaIngrediente => {
  const cru = fatores.find(f => f.nome === "Cru");
  return {
    ingrediente_id:"", quantidade:"", unidade:"g",
    fator_coccao_id:   cru?.id || "",
    fator_coccao_valor:cru?.fator || 1.0,
  };
};

export default function PratoForm({ inicial, onSalvo, onCancelar }: Props) {
  const supabase = createClient();
  const editando = !!inicial?.id;

  const [form, setForm]               = useState<PratoFormData>({ ...vazio, ...inicial });
  const [linhas, setLinhas]           = useState<LinhaIngrediente[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [fatores, setFatores]         = useState<FatorCoccao[]>([]);
  const [loading, setLoading]         = useState(false);
  const [erro, setErro]               = useState<string | null>(null);
  const [aba, setAba]                 = useState<"dados"|"ingredientes">("dados");

  // Carregar ingredientes e fatores
  useEffect(() => {
    supabase.from("ingredientes")
      .select("id,nome,unidade,nut_calorias,nut_proteinas,nut_carboidratos,nut_gorduras")
      .eq("ativo", true).order("nome")
      .then(({ data }) => { if (data) setIngredientes(data); });

    supabase.from("fatores_coccao")
      .select("id,nome,fator").eq("ativo", true).order("nome")
      .then(({ data }) => {
        if (data) {
          setFatores(data);
          setLinhas([linhaVazia(data)]);
        }
      });
  }, []);

  // Carregar ingredientes do prato se editando
  useEffect(() => {
    if (!editando || !inicial?.id || fatores.length === 0) return;
    supabase.from("prato_ingredientes")
      .select("ingrediente_id,quantidade,unidade,fator_coccao_id,fator_coccao_valor,ingredientes(nome)")
      .eq("prato_id", inicial.id)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const cru = fatores.find(f => f.nome === "Cru");
          setLinhas(data.map((d: any) => ({
            ingrediente_id:    d.ingrediente_id,
            quantidade:        String(d.quantidade),
            unidade:           d.unidade,
            fator_coccao_id:   d.fator_coccao_id || cru?.id || "",
            fator_coccao_valor:d.fator_coccao_valor || 1.0,
            _nome:             d.ingredientes?.nome,
          })));
        }
      });
  }, [editando, inicial?.id, fatores]);

  function campo(key: keyof PratoFormData, value: string | boolean) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function atualizarLinha(i: number, key: keyof LinhaIngrediente, value: string) {
    setLinhas(prev => {
      const novas = [...prev];
      if (key === "ingrediente_id") {
        const ing = ingredientes.find(x => x.id === value);
        novas[i] = { ...novas[i], ingrediente_id:value, unidade:(ing?.unidade as Unidade)||"g", _nome:ing?.nome };
      } else if (key === "fator_coccao_id") {
        const fat = fatores.find(f => f.id === value);
        novas[i] = { ...novas[i], fator_coccao_id:value, fator_coccao_valor:fat?.fator||1.0 };
      } else {
        novas[i] = { ...novas[i], [key]: value };
      }
      return novas;
    });
  }

  function adicionarLinha() {
    setLinhas(prev => [...prev, linhaVazia(fatores)]);
  }

  function removerLinha(i: number) {
    setLinhas(prev => prev.filter((_, idx) => idx !== i));
  }

  // ── CÁLCULOS NUTRICIONAIS COM FATOR DE COCÇÃO ─────────────
  function calcularNutri(campo: "nut_calorias"|"nut_proteinas"|"nut_carboidratos"|"nut_gorduras") {
    return linhas.reduce((total, linha) => {
      const ing = ingredientes.find(x => x.id === linha.ingrediente_id);
      if (!ing || !ing[campo] || !linha.quantidade) return total;
      const qtd   = parseFloat(linha.quantidade) || 0;
      const fator = (linha.unidade === "g" || linha.unidade === "ml") ? qtd / 100 : qtd;
      const coccao = linha.fator_coccao_valor || 1.0;
      return total + ((ing[campo] as number) * fator * coccao);
    }, 0);
  }

  const calorias     = calcularNutri("nut_calorias");
  const proteinas    = calcularNutri("nut_proteinas");
  const carboidratos = calcularNutri("nut_carboidratos");
  const gorduras     = calcularNutri("nut_gorduras");
  const linhasValidas = linhas.filter(l => l.ingrediente_id && l.quantidade);

  // ── SALVAR ────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!form.nome.trim()) return setErro("Nome é obrigatório.");
    if (!form.categoria)   return setErro("Selecione uma categoria.");
    if (linhasValidas.length === 0) return setErro("Adicione ao menos 1 ingrediente.");
    setLoading(true);

    const payload = {
      nome:            form.nome.trim(),
      categoria:       form.categoria,
      descricao:       form.descricao.trim() || null,
      preco_venda:     parseFloat(form.preco_venda) || null,
      margem_desejada: parseFloat(form.margem_desejada) || 70,
      ativo:           form.ativo,
      observacoes:     form.observacoes.trim() || null,
    };

    let pratoId = inicial?.id;

    if (editando && pratoId) {
      const { error } = await supabase.from("pratos").update(payload).eq("id", pratoId);
      if (error) { setLoading(false); return setErro(error.message); }
      await supabase.from("prato_ingredientes").delete().eq("prato_id", pratoId);
    } else {
      const { data, error } = await supabase.from("pratos").insert(payload).select("id").single();
      if (error || !data) { setLoading(false); return setErro(error?.message || "Erro ao criar prato."); }
      pratoId = data.id;
    }

    const linhasInsert = linhasValidas.map(l => ({
      prato_id:          pratoId,
      ingrediente_id:    l.ingrediente_id,
      quantidade:        parseFloat(l.quantidade),
      unidade:           l.unidade,
      fator_coccao_id:   l.fator_coccao_id || null,
      fator_coccao_valor:l.fator_coccao_valor || 1.0,
    }));

    const { error: errIng } = await supabase.from("prato_ingredientes").insert(linhasInsert);
    setLoading(false);
    if (errIng) return setErro(errIng.message);
    onSalvo?.();
  }

  // ── ESTILOS ───────────────────────────────────────────────
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
            <p style={{ fontSize:".65rem", letterSpacing:3, textTransform:"uppercase", color:"#6366f1", fontWeight:700, marginBottom:2 }}>FOODOS</p>
            <h2 style={{ fontSize:"1.35rem", fontWeight:700, color:"#111" }}>
              {editando ? "Editar Prato" : "Novo Prato"}
            </h2>
          </div>
          <button onClick={onCancelar} style={{ background:"#f4f4f5", border:"none", borderRadius:8, width:32, height:32, cursor:"pointer", fontSize:".9rem", color:"#666" }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", padding:"16px 24px 0", borderBottom:"1px solid #f0f0f0" }}>
          {[
            { key:"dados",        label:"Dados do Prato" },
            { key:"ingredientes", label:`Ingredientes (${linhasValidas.length})` },
          ].map(t => (
            <button key={t.key} type="button" onClick={() => setAba(t.key as "dados"|"ingredientes")}
              style={{ background:"none", border:"none", padding:"8px 16px", fontSize:".82rem", fontWeight:600, cursor:"pointer", color:aba===t.key ? "#6366f1" : "#999", borderBottom:aba===t.key ? "2px solid #6366f1" : "2px solid transparent", marginBottom:-1 }}>
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding:"20px 24px" }}>

            {/* ── ABA DADOS ── */}
            {aba === "dados" && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                <div style={{ gridColumn:"1/-1" }}>
                  <label style={labelStyle}>Nome do Prato *</label>
                  <input style={inputStyle} value={form.nome} onChange={e => campo("nome", e.target.value)} placeholder="Ex: Filé ao Alho e Óleo" autoFocus />
                </div>
                <div>
                  <label style={labelStyle}>Categoria *</label>
                  <select style={inputStyle} value={form.categoria} onChange={e => campo("categoria", e.target.value as Categoria)}>
                    <option value="">Selecione...</option>
                    {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Margem Desejada (%)</label>
                  <div style={{ display:"flex", border:"1.5px solid #e4e4e7", borderRadius:8, overflow:"hidden", background:"#fafafa" }}>
                    <input type="number" min="0" max="100" step="1" value={form.margem_desejada} onChange={e => campo("margem_desejada", e.target.value)}
                      style={{ border:"none", background:"transparent", flex:1, padding:"9px 12px", fontSize:".88rem", outline:"none", fontFamily:"inherit" }} />
                    <span style={{ padding:"0 10px", background:"#f4f4f5", fontSize:".75rem", color:"#888", display:"flex", alignItems:"center", borderLeft:"1px solid #e4e4e7", fontWeight:600 }}>%</span>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Tempo de Preparo</label>
                  <div style={{ display:"flex", border:"1.5px solid #e4e4e7", borderRadius:8, overflow:"hidden", background:"#fafafa" }}>
                    <input type="number" min="1" max="120" step="1"
                      value={(form as any).tempo_preparo_min || "15"}
                      onChange={e => campo("tempo_preparo_min" as any, e.target.value)}
                      style={{ border:"none", background:"transparent", flex:1, padding:"9px 12px", fontSize:".88rem", outline:"none", fontFamily:"inherit" }} />
                    <span style={{ padding:"0 10px", background:"#f4f4f5", fontSize:".75rem", color:"#888", display:"flex", alignItems:"center", borderLeft:"1px solid #e4e4e7", fontWeight:600 }}>min</span>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Preço de Venda</label>
                  <div style={{ display:"flex", border:"1.5px solid #e4e4e7", borderRadius:8, overflow:"hidden", background:"#fafafa" }}>
                    <span style={{ padding:"0 10px", background:"#f4f4f5", fontSize:".75rem", color:"#888", display:"flex", alignItems:"center", borderRight:"1px solid #e4e4e7", fontWeight:600 }}>R$</span>
                    <input type="number" min="0" step="0.01" value={form.preco_venda} onChange={e => campo("preco_venda", e.target.value)} placeholder="0,00"
                      style={{ border:"none", background:"transparent", flex:1, padding:"9px 12px", fontSize:".88rem", outline:"none", fontFamily:"inherit" }} />
                  </div>
                </div>
                <div style={{ gridColumn:"1/-1" }}>
                  <label style={labelStyle}>Descrição</label>
                  <textarea style={{ ...inputStyle, resize:"vertical" }} value={form.descricao} onChange={e => campo("descricao", e.target.value)} placeholder="Descrição do prato para o cardápio..." rows={2} />
                </div>
                <div style={{ gridColumn:"1/-1" }}>
                  <label style={labelStyle}>Observações internas</label>
                  <textarea style={{ ...inputStyle, resize:"vertical" }} value={form.observacoes} onChange={e => campo("observacoes", e.target.value)} placeholder="Notas de preparo, temperatura, etc..." rows={2} />
                </div>
                <div style={{ gridColumn:"1/-1", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 0", borderTop:"1px solid #f4f4f5" }}>
                  <span style={{ fontSize:".85rem", color:"#444", fontWeight:500 }}>Prato ativo</span>
                  <button type="button" onClick={() => campo("ativo", !form.ativo)} style={{ width:44, height:24, background:form.ativo ? "#6366f1" : "#e4e4e7", border:"none", borderRadius:12, cursor:"pointer", position:"relative" }}>
                    <span style={{ position:"absolute", top:2, left:form.ativo ? 22 : 2, width:20, height:20, background:"#fff", borderRadius:"50%", display:"block", boxShadow:"0 1px 3px rgba(0,0,0,.2)", transition:"left .2s" }} />
                  </button>
                </div>
              </div>
            )}

            {/* ── ABA INGREDIENTES ── */}
            {aba === "ingredientes" && (
              <div>
                {/* Painel nutricional */}
                {calorias > 0 && (
                  <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:10, padding:"12px 16px", marginBottom:16, display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
                    {[
                      { label:"Calorias",     val:`${Math.round(calorias)} kcal` },
                      { label:"Proteínas",    val:`${proteinas.toFixed(1)}g` },
                      { label:"Carboidratos", val:`${carboidratos.toFixed(1)}g` },
                      { label:"Gorduras",     val:`${gorduras.toFixed(1)}g` },
                    ].map(({ label, val }) => (
                      <div key={label} style={{ textAlign:"center" }}>
                        <div style={{ fontSize:"1rem", fontWeight:800, color:"#15803d" }}>{val}</div>
                        <div style={{ fontSize:".65rem", color:"#888", textTransform:"uppercase", letterSpacing:1 }}>{label}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Cabeçalho das colunas */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 90px 80px 120px 32px", gap:8, marginBottom:6 }}>
                  {["Ingrediente","Qtd","Unidade","Preparo",""].map(h => (
                    <div key={h} style={{ fontSize:".65rem", fontWeight:700, color:"#aaa", textTransform:"uppercase", letterSpacing:1 }}>{h}</div>
                  ))}
                </div>

                {/* Linhas de ingredientes */}
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {linhas.map((linha, i) => (
                    <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 90px 80px 120px 32px", gap:8, alignItems:"center" }}>
                      <select value={linha.ingrediente_id} onChange={e => atualizarLinha(i, "ingrediente_id", e.target.value)} style={{ ...inputStyle, fontSize:".82rem" }}>
                        <option value="">Ingrediente...</option>
                        {ingredientes.map(ing => <option key={ing.id} value={ing.id}>{ing.nome}</option>)}
                      </select>

                      <input type="number" min="0" step="0.001" placeholder="Qtd" value={linha.quantidade} onChange={e => atualizarLinha(i, "quantidade", e.target.value)}
                        style={{ ...inputStyle, textAlign:"center" }} />

                      <select value={linha.unidade} onChange={e => atualizarLinha(i, "unidade", e.target.value)} style={{ ...inputStyle, fontSize:".82rem" }}>
                        {UNIDADES.map(u => <option key={u}>{u}</option>)}
                      </select>

                      {/* SELECT DE PREPARO */}
                      <select value={linha.fator_coccao_id} onChange={e => atualizarLinha(i, "fator_coccao_id", e.target.value)}
                        style={{ ...inputStyle, fontSize:".82rem", background: linha.fator_coccao_valor > 1 ? "#fef9c3" : linha.fator_coccao_valor < 1 ? "#f0fdf4" : "#fafafa" }}>
                        {fatores.map(f => (
                          <option key={f.id} value={f.id}>{f.nome} ({f.fator}x)</option>
                        ))}
                      </select>

                      <button type="button" onClick={() => removerLinha(i)}
                        style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:6, width:32, height:36, cursor:"pointer", color:"#dc2626", fontSize:"1rem", display:"flex", alignItems:"center", justifyContent:"center" }}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                <button type="button" onClick={adicionarLinha}
                  style={{ marginTop:12, background:"none", border:"1.5px dashed #c7d2fe", borderRadius:8, padding:"8px 16px", fontSize:".82rem", fontWeight:600, color:"#6366f1", cursor:"pointer", width:"100%" }}>
                  + Adicionar ingrediente
                </button>

                <div style={{ marginTop:12, fontSize:".72rem", color:"#aaa" }}>
                  💡 O fator de preparo ajusta automaticamente as calorias. Ex: Frito (1.6x) aumenta, Cozido (0.85x) reduz.
                </div>
              </div>
            )}
          </div>

          {erro && (
            <div style={{ margin:"0 24px 8px", background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8, padding:"10px 14px", fontSize:".82rem", color:"#dc2626" }}>{erro}</div>
          )}

          <div style={{ display:"flex", gap:10, justifyContent:"space-between", padding:"16px 24px", borderTop:"1px solid #f0f0f0", alignItems:"center" }}>
            <div style={{ fontSize:".75rem", color:"#888" }}>
              {linhasValidas.length > 0 && `${linhasValidas.length} ingrediente${linhasValidas.length > 1 ? "s" : ""} adicionado${linhasValidas.length > 1 ? "s" : ""}`}
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button type="button" onClick={onCancelar} style={{ background:"none", border:"1.5px solid #e4e4e7", borderRadius:8, padding:"9px 20px", fontSize:".85rem", fontWeight:600, color:"#666", cursor:"pointer" }}>Cancelar</button>
              <button type="submit" disabled={loading} style={{ background:loading ? "#a5b4fc" : "#6366f1", border:"none", borderRadius:8, padding:"9px 24px", fontSize:".85rem", fontWeight:700, color:"#fff", cursor:loading ? "not-allowed" : "pointer" }}>
                {loading ? "Salvando..." : editando ? "Salvar Alterações" : "Criar Prato"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
