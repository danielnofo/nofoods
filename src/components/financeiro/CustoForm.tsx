"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";

const CATEGORIAS = [
  "Aluguel","Funcionários","Energia","Água","Internet",
  "Marketing","Manutenção","Contabilidade","Embalagens","Outros",
] as const;

const TEMPORALIDADES = [
  "mensal","semanal","quinzenal","anual","unico",
] as const;

type Categoria     = typeof CATEGORIAS[number];
type Temporalidade = typeof TEMPORALIDADES[number];

interface CustoFormData {
  nome:           string;
  categoria:      Categoria | "";
  valor:          string;
  temporalidade:  Temporalidade;
  dia_vencimento: string;
  observacoes:    string;
  ativo:          boolean;
}

interface Props {
  inicial?: Partial<CustoFormData> & { id?: string };
  onSalvo?: () => void;
  onCancelar?: () => void;
}

const vazio: CustoFormData = {
  nome:"", categoria:"", valor:"", temporalidade:"mensal",
  dia_vencimento:"", observacoes:"", ativo:true,
};

export default function CustoForm({ inicial, onSalvo, onCancelar }: Props) {
  const supabase = createClient();
  const editando = !!inicial?.id;
  const [form, setForm]       = useState<CustoFormData>({ ...vazio, ...inicial });
  const [loading, setLoading] = useState(false);
  const [erro, setErro]       = useState<string | null>(null);

  function campo(key: keyof CustoFormData, value: string | boolean) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!form.nome.trim())  return setErro("Nome é obrigatório.");
    if (!form.categoria)    return setErro("Selecione uma categoria.");
    if (!form.valor)        return setErro("Informe o valor.");
    setLoading(true);

    const payload = {
      nome:           form.nome.trim(),
      categoria:      form.categoria,
      valor:          parseFloat(form.valor),
      temporalidade:  form.temporalidade,
      dia_vencimento: form.dia_vencimento ? parseInt(form.dia_vencimento) : null,
      observacoes:    form.observacoes.trim() || null,
      ativo:          form.ativo,
    };

    const { error } = editando
      ? await supabase.from("custos_operacionais").update(payload).eq("id", inicial!.id)
      : await supabase.from("custos_operacionais").insert(payload);

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

  const TEMP_LABEL: Record<string, string> = {
    mensal:"Mensal", semanal:"Semanal", quinzenal:"Quinzenal",
    anual:"Anual", unico:"Único",
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:50, background:"rgba(0,0,0,.55)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#fff", borderRadius:16, width:"100%", maxWidth:520, boxShadow:"0 24px 60px rgba(0,0,0,.2)" }}>

        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", padding:"24px 24px 0", gap:12 }}>
          <div>
            <p style={{ fontSize:".65rem", letterSpacing:3, textTransform:"uppercase", color:"#10b981", fontWeight:700, marginBottom:2 }}>FINANCEIRO</p>
            <h2 style={{ fontSize:"1.2rem", fontWeight:700, color:"#111" }}>
              {editando ? "Editar Custo" : "Novo Custo Operacional"}
            </h2>
          </div>
          <button onClick={onCancelar} style={{ background:"#f4f4f5", border:"none", borderRadius:8, width:32, height:32, cursor:"pointer", fontSize:".9rem", color:"#666" }}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding:"20px 24px", display:"flex", flexDirection:"column", gap:14 }}>

            <div>
              <label style={labelStyle}>Nome do Custo *</label>
              <input style={inputStyle} value={form.nome} onChange={e => campo("nome", e.target.value)} placeholder="Ex: Aluguel, Energia, Folha..." autoFocus />
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div>
                <label style={labelStyle}>Categoria *</label>
                <select style={inputStyle} value={form.categoria} onChange={e => campo("categoria", e.target.value as Categoria)}>
                  <option value="">Selecione...</option>
                  {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Valor (R$) *</label>
                <input style={inputStyle} type="number" min="0" step="0.01" value={form.valor} onChange={e => campo("valor", e.target.value)} placeholder="0,00" />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Frequência</label>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {TEMPORALIDADES.map(t => (
                  <button key={t} type="button" onClick={() => campo("temporalidade", t)}
                    style={{ background:form.temporalidade===t?"#ecfdf5":"#f4f4f5", border:`1.5px solid ${form.temporalidade===t?"#10b981":"#e4e4e7"}`, borderRadius:8, padding:"6px 14px", cursor:"pointer", fontSize:".8rem", fontWeight:600, color:form.temporalidade===t?"#065f46":"#666" }}>
                    {TEMP_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Dia do Vencimento</label>
              <div style={{ display:"flex", border:"1.5px solid #e4e4e7", borderRadius:8, overflow:"hidden", background:"#fafafa", maxWidth:160 }}>
                <input type="number" min="1" max="31" value={form.dia_vencimento} onChange={e => campo("dia_vencimento", e.target.value)} placeholder="Ex: 5"
                  style={{ border:"none", background:"transparent", flex:1, padding:"9px 12px", fontSize:".88rem", outline:"none", fontFamily:"inherit", textAlign:"center" }} />
                <span style={{ padding:"0 12px", background:"#f4f4f5", fontSize:".75rem", color:"#888", display:"flex", alignItems:"center", borderLeft:"1px solid #e4e4e7", fontWeight:600 }}>dia</span>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Observações</label>
              <textarea style={{ ...inputStyle, resize:"vertical" }} value={form.observacoes} onChange={e => campo("observacoes", e.target.value)} placeholder="Contrato, nota fiscal, etc..." rows={2} />
            </div>

            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 0", borderTop:"1px solid #f4f4f5" }}>
              <span style={{ fontSize:".85rem", color:"#444", fontWeight:500 }}>Custo ativo</span>
              <button type="button" onClick={() => campo("ativo", !form.ativo)}
                style={{ width:44, height:24, background:form.ativo?"#10b981":"#e4e4e7", border:"none", borderRadius:12, cursor:"pointer", position:"relative" }}>
                <span style={{ position:"absolute", top:2, left:form.ativo?22:2, width:20, height:20, background:"#fff", borderRadius:"50%", display:"block", boxShadow:"0 1px 3px rgba(0,0,0,.2)", transition:"left .2s" }} />
              </button>
            </div>
          </div>

          {erro && (
            <div style={{ margin:"0 24px 8px", background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8, padding:"10px 14px", fontSize:".82rem", color:"#dc2626" }}>{erro}</div>
          )}

          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", padding:"16px 24px", borderTop:"1px solid #f0f0f0" }}>
            <button type="button" onClick={onCancelar} style={{ background:"none", border:"1.5px solid #e4e4e7", borderRadius:8, padding:"9px 20px", fontSize:".85rem", fontWeight:600, color:"#666", cursor:"pointer" }}>Cancelar</button>
            <button type="submit" disabled={loading} style={{ background:loading?"#6ee7b7":"#10b981", border:"none", borderRadius:8, padding:"9px 24px", fontSize:".85rem", fontWeight:700, color:"#fff", cursor:loading?"not-allowed":"pointer" }}>
              {loading ? "Salvando..." : editando ? "Salvar Alterações" : "Cadastrar Custo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}