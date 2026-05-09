"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";

const CATEGORIAS = [
  "Carnes e Proteínas","Hortifruti","Laticínios","Bebidas",
  "Grãos e Cereais","Temperos e Molhos","Embalagens","Limpeza","Outros",
] as const;

const DIAS_SEMANA = ["Segunda","Terça","Quarta","Quinta","Sexta","Sábado","Domingo"] as const;

type Categoria    = typeof CATEGORIAS[number];
type ModeloEntrega = "dias_uteis" | "dia_fixo";

interface FornecedorFormData {
  nome_fantasia:     string;
  razao_social:      string;
  cnpj:              string;
  nome_contato:      string;
  whatsapp:          string;
  email:             string;
  categoria:         Categoria | "";
  ativo:             boolean;
  observacoes:       string;
  modelo_entrega:    ModeloEntrega;
  prazo_dias_uteis:  string;
  frequencia_semanas:string;
}

interface Props {
  inicial?: Partial<FornecedorFormData> & { id?: string };
  onSalvo?: () => void;
  onCancelar?: () => void;
}

const vazio: FornecedorFormData = {
  nome_fantasia:"", razao_social:"", cnpj:"", nome_contato:"",
  whatsapp:"", email:"", categoria:"", ativo:true, observacoes:"",
  modelo_entrega:"dias_uteis", prazo_dias_uteis:"3", frequencia_semanas:"1",
};

export default function FornecedorForm({ inicial, onSalvo, onCancelar }: Props) {
  const supabase = createClient();
  const editando = !!inicial?.id;

  const [form, setForm]         = useState<FornecedorFormData>({ ...vazio, ...inicial });
  const [diasSelecionados, setDiasSelecionados] = useState<string[]>([]);
  const [loading, setLoading]   = useState(false);
  const [erro, setErro]         = useState<string | null>(null);
  const [aba, setAba]           = useState<"dados"|"entrega">("dados");

  // Carregar dias fixos se editando
  useEffect(() => {
    if (!editando || !inicial?.id) return;
    supabase.from("fornecedor_dias_entrega")
      .select("dia").eq("fornecedor_id", inicial.id)
      .then(({ data }) => {
        if (data) setDiasSelecionados(data.map((d: any) => d.dia));
      });
  }, [editando, inicial?.id]);

  function campo(key: keyof FornecedorFormData, value: string | boolean) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function toggleDia(dia: string) {
    setDiasSelecionados(prev =>
      prev.includes(dia) ? prev.filter(d => d !== dia) : [...prev, dia]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!form.nome_fantasia.trim()) return setErro("Nome fantasia é obrigatório.");
    if (!form.categoria)            return setErro("Selecione uma categoria.");
    if (form.modelo_entrega === "dia_fixo" && diasSelecionados.length === 0)
      return setErro("Selecione ao menos um dia de entrega.");

    setLoading(true);

    const payload = {
      nome_fantasia:      form.nome_fantasia.trim(),
      razao_social:       form.razao_social.trim() || null,
      cnpj:               form.cnpj.trim() || null,
      nome_contato:       form.nome_contato.trim() || null,
      whatsapp:           form.whatsapp.trim() || null,
      email:              form.email.trim() || null,
      categoria:          form.categoria,
      ativo:              form.ativo,
      observacoes:        form.observacoes.trim() || null,
      modelo_entrega:     form.modelo_entrega,
      prazo_dias_uteis:   form.modelo_entrega === "dias_uteis" ? parseInt(form.prazo_dias_uteis) || null : null,
      frequencia_semanas: form.modelo_entrega === "dia_fixo"   ? parseInt(form.frequencia_semanas) || 1 : null,
    };

    let fornId = inicial?.id;

    if (editando && fornId) {
      const { error } = await supabase.from("fornecedores").update(payload).eq("id", fornId);
      if (error) { setLoading(false); return setErro(error.message); }
      await supabase.from("fornecedor_dias_entrega").delete().eq("fornecedor_id", fornId);
    } else {
      const { data, error } = await supabase.from("fornecedores").insert(payload).select("id").single();
      if (error || !data) { setLoading(false); return setErro(error?.message || "Erro ao criar fornecedor."); }
      fornId = data.id;
    }

    if (form.modelo_entrega === "dia_fixo" && diasSelecionados.length > 0) {
      await supabase.from("fornecedor_dias_entrega").insert(
        diasSelecionados.map(dia => ({ fornecedor_id: fornId, dia }))
      );
    }

    setLoading(false);
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
      <div style={{ background:"#fff", borderRadius:16, width:"100%", maxWidth:620, maxHeight:"92vh", overflowY:"auto", boxShadow:"0 24px 60px rgba(0,0,0,.2)", display:"flex", flexDirection:"column" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", padding:"24px 24px 0", gap:12 }}>
          <div>
            <p style={{ fontSize:".65rem", letterSpacing:3, textTransform:"uppercase", color:"#f59e0b", fontWeight:700, marginBottom:2 }}>FOODOS</p>
            <h2 style={{ fontSize:"1.35rem", fontWeight:700, color:"#111" }}>
              {editando ? "Editar Fornecedor" : "Novo Fornecedor"}
            </h2>
          </div>
          <button onClick={onCancelar} style={{ background:"#f4f4f5", border:"none", borderRadius:8, width:32, height:32, cursor:"pointer", fontSize:".9rem", color:"#666" }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", padding:"16px 24px 0", borderBottom:"1px solid #f0f0f0" }}>
          {[
            { key:"dados",   label:"Dados do Fornecedor" },
            { key:"entrega", label:"Modelo de Entrega" },
          ].map(t => (
            <button key={t.key} type="button" onClick={() => setAba(t.key as "dados"|"entrega")}
              style={{ background:"none", border:"none", padding:"8px 16px", fontSize:".82rem", fontWeight:600, cursor:"pointer", color:aba===t.key ? "#f59e0b" : "#999", borderBottom:aba===t.key ? "2px solid #f59e0b" : "2px solid transparent", marginBottom:-1 }}>
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
                  <label style={labelStyle}>Nome Fantasia *</label>
                  <input style={inputStyle} value={form.nome_fantasia} onChange={e => campo("nome_fantasia", e.target.value)} placeholder="Ex: Frigorífico Central" autoFocus />
                </div>

                <div>
                  <label style={labelStyle}>Razão Social</label>
                  <input style={inputStyle} value={form.razao_social} onChange={e => campo("razao_social", e.target.value)} placeholder="Razão social completa" />
                </div>

                <div>
                  <label style={labelStyle}>CNPJ</label>
                  <input style={inputStyle} value={form.cnpj} onChange={e => campo("cnpj", e.target.value)} placeholder="00.000.000/0001-00" />
                </div>

                <div>
                  <label style={labelStyle}>Categoria *</label>
                  <select style={inputStyle} value={form.categoria} onChange={e => campo("categoria", e.target.value as Categoria)}>
                    <option value="">Selecione...</option>
                    {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Nome do Contato</label>
                  <input style={inputStyle} value={form.nome_contato} onChange={e => campo("nome_contato", e.target.value)} placeholder="Nome do responsável" />
                </div>

                <div>
                  <label style={labelStyle}>WhatsApp</label>
                  <input style={inputStyle} value={form.whatsapp} onChange={e => campo("whatsapp", e.target.value)} placeholder="11999990000" />
                </div>

                <div>
                  <label style={labelStyle}>E-mail</label>
                  <input style={inputStyle} type="email" value={form.email} onChange={e => campo("email", e.target.value)} placeholder="contato@fornecedor.com" />
                </div>

                <div style={{ gridColumn:"1/-1" }}>
                  <label style={labelStyle}>Observações</label>
                  <textarea style={{ ...inputStyle, resize:"vertical" }} value={form.observacoes} onChange={e => campo("observacoes", e.target.value)} placeholder="Condições comerciais, observações gerais..." rows={3} />
                </div>

                <div style={{ gridColumn:"1/-1", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 0", borderTop:"1px solid #f4f4f5" }}>
                  <span style={{ fontSize:".85rem", color:"#444", fontWeight:500 }}>Fornecedor ativo</span>
                  <button type="button" onClick={() => campo("ativo", !form.ativo)} style={{ width:44, height:24, background:form.ativo ? "#f59e0b" : "#e4e4e7", border:"none", borderRadius:12, cursor:"pointer", position:"relative" }}>
                    <span style={{ position:"absolute", top:2, left:form.ativo ? 22 : 2, width:20, height:20, background:"#fff", borderRadius:"50%", display:"block", boxShadow:"0 1px 3px rgba(0,0,0,.2)", transition:"left .2s" }} />
                  </button>
                </div>
              </div>
            )}

            {/* ABA ENTREGA */}
            {aba === "entrega" && (
              <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

                {/* Tipo de modelo */}
                <div>
                  <label style={labelStyle}>Modelo de Entrega *</label>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                    {[
                      { key:"dias_uteis", label:"Prazo em dias úteis", desc:"Ex: entrega em 3 dias úteis", icon:"📅" },
                      { key:"dia_fixo",   label:"Dia(s) fixo(s)",       desc:"Ex: toda terça e sexta",      icon:"🗓️" },
                    ].map(op => (
                      <button key={op.key} type="button" onClick={() => campo("modelo_entrega", op.key)}
                        style={{ background: form.modelo_entrega===op.key ? "#fef3c7" : "#f9fafb", border:`2px solid ${form.modelo_entrega===op.key ? "#f59e0b" : "#e4e4e7"}`, borderRadius:10, padding:"14px", cursor:"pointer", textAlign:"left" }}>
                        <div style={{ fontSize:"1.4rem", marginBottom:6 }}>{op.icon}</div>
                        <div style={{ fontSize:".85rem", fontWeight:700, color:"#111" }}>{op.label}</div>
                        <div style={{ fontSize:".72rem", color:"#888", marginTop:3 }}>{op.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Configuração dias úteis */}
                {form.modelo_entrega === "dias_uteis" && (
                  <div>
                    <label style={labelStyle}>Prazo de Entrega</label>
                    <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                      <div style={{ display:"flex", border:"1.5px solid #e4e4e7", borderRadius:8, overflow:"hidden", background:"#fafafa", maxWidth:160 }}>
                        <input type="number" min="1" max="30" value={form.prazo_dias_uteis} onChange={e => campo("prazo_dias_uteis", e.target.value)}
                          style={{ border:"none", background:"transparent", flex:1, padding:"9px 12px", fontSize:".88rem", outline:"none", fontFamily:"inherit", textAlign:"center" }} />
                        <span style={{ padding:"0 12px", background:"#f4f4f5", fontSize:".75rem", color:"#888", display:"flex", alignItems:"center", borderLeft:"1px solid #e4e4e7", fontWeight:600, whiteSpace:"nowrap" }}>dias úteis</span>
                      </div>
                      <span style={{ fontSize:".8rem", color:"#888" }}>após o pedido</span>
                    </div>
                  </div>
                )}

                {/* Configuração dia fixo */}
                {form.modelo_entrega === "dia_fixo" && (
                  <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                    <div>
                      <label style={labelStyle}>Dias de Entrega *</label>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                        {DIAS_SEMANA.map(dia => (
                          <button key={dia} type="button" onClick={() => toggleDia(dia)}
                            style={{ background: diasSelecionados.includes(dia) ? "#fef3c7" : "#f4f4f5", border:`1.5px solid ${diasSelecionados.includes(dia) ? "#f59e0b" : "#e4e4e7"}`, borderRadius:8, padding:"8px 14px", fontSize:".82rem", fontWeight:600, color: diasSelecionados.includes(dia) ? "#92400e" : "#666", cursor:"pointer" }}>
                            {dia}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Frequência</label>
                      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                        <span style={{ fontSize:".85rem", color:"#666" }}>A cada</span>
                        <div style={{ display:"flex", border:"1.5px solid #e4e4e7", borderRadius:8, overflow:"hidden", background:"#fafafa", maxWidth:120 }}>
                          <input type="number" min="1" max="4" value={form.frequencia_semanas} onChange={e => campo("frequencia_semanas", e.target.value)}
                            style={{ border:"none", background:"transparent", flex:1, padding:"9px 12px", fontSize:".88rem", outline:"none", fontFamily:"inherit", textAlign:"center" }} />
                          <span style={{ padding:"0 10px", background:"#f4f4f5", fontSize:".75rem", color:"#888", display:"flex", alignItems:"center", borderLeft:"1px solid #e4e4e7", fontWeight:600 }}>sem.</span>
                        </div>
                      </div>
                    </div>
                    {diasSelecionados.length > 0 && (
                      <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:8, padding:"10px 14px", fontSize:".78rem", color:"#15803d" }}>
                        ✅ Entrega toda(s) <strong>{diasSelecionados.join(", ")}</strong>, a cada <strong>{form.frequencia_semanas} semana{parseInt(form.frequencia_semanas)>1?"s":""}</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {erro && (
            <div style={{ margin:"0 24px 8px", background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8, padding:"10px 14px", fontSize:".82rem", color:"#dc2626" }}>{erro}</div>
          )}

          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", padding:"16px 24px", borderTop:"1px solid #f0f0f0" }}>
            <button type="button" onClick={onCancelar} style={{ background:"none", border:"1.5px solid #e4e4e7", borderRadius:8, padding:"9px 20px", fontSize:".85rem", fontWeight:600, color:"#666", cursor:"pointer" }}>Cancelar</button>
            <button type="submit" disabled={loading} style={{ background:loading ? "#fcd34d" : "#f59e0b", border:"none", borderRadius:8, padding:"9px 24px", fontSize:".85rem", fontWeight:700, color:"#fff", cursor:loading ? "not-allowed" : "pointer" }}>
              {loading ? "Salvando..." : editando ? "Salvar Alterações" : "Cadastrar Fornecedor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
