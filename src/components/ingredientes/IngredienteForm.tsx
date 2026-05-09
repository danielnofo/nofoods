"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";

const CATEGORIAS = [
  "Proteínas","Carboidratos","Vegetais","Legumes",
  "Temperos","Molhos","Bebidas","Embalagens","Outros",
] as const;

const UNIDADES = ["kg","g","litro","ml","unidade"] as const;

type Categoria = typeof CATEGORIAS[number];
type Unidade   = typeof UNIDADES[number];

interface IngredienteFormData {
  nome:             string;
  codigo_interno:   string;
  categoria:        Categoria | "";
  subcategoria:     string;
  unidade:          Unidade | "";
  estoque_minimo:   string;
  observacoes:      string;
  ativo:            boolean;
  nut_calorias:     string;
  nut_proteinas:    string;
  nut_carboidratos: string;
  nut_gorduras:     string;
  nut_sodio:        string;
  nut_fibras:       string;
}

interface Props {
  inicial?: Partial<IngredienteFormData> & { id?: string };
  onSalvo?: () => void;
  onCancelar?: () => void;
}

const vazio: IngredienteFormData = {
  nome:"", codigo_interno:"", categoria:"", subcategoria:"",
  unidade:"", estoque_minimo:"0", observacoes:"", ativo:true,
  nut_calorias:"", nut_proteinas:"", nut_carboidratos:"",
  nut_gorduras:"", nut_sodio:"", nut_fibras:"",
};

export default function IngredienteForm({ inicial, onSalvo, onCancelar }: Props) {
  const supabase = createClient();
  const [form, setForm]         = useState<IngredienteFormData>({ ...vazio, ...inicial });
  const [loading, setLoading]   = useState(false);
  const [erro, setErro]         = useState<string | null>(null);
  const [abaNutri, setAbaNutri] = useState(false);
  const editando = !!inicial?.id;

  function campo(key: keyof IngredienteFormData, value: string | boolean) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function numOuNull(v: string) {
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!form.nome.trim()) return setErro("Nome é obrigatório.");
    if (!form.categoria)   return setErro("Selecione uma categoria.");
    if (!form.unidade)     return setErro("Selecione uma unidade de medida.");
    setLoading(true);

    const payload = {
      nome:             form.nome.trim(),
      codigo_interno:   form.codigo_interno.trim() || null,
      categoria:        form.categoria,
      subcategoria:     form.subcategoria.trim() || null,
      unidade:          form.unidade,
      estoque_minimo:   numOuNull(form.estoque_minimo) ?? 0,
      observacoes:      form.observacoes.trim() || null,
      ativo:            form.ativo,
      nut_calorias:     numOuNull(form.nut_calorias),
      nut_proteinas:    numOuNull(form.nut_proteinas),
      nut_carboidratos: numOuNull(form.nut_carboidratos),
      nut_gorduras:     numOuNull(form.nut_gorduras),
      nut_sodio:        numOuNull(form.nut_sodio),
      nut_fibras:       numOuNull(form.nut_fibras),
    };

    const { error } = editando
      ? await supabase.from("ingredientes").update(payload).eq("id", inicial!.id)
      : await supabase.from("ingredientes").insert(payload);

    setLoading(false);
    if (error) setErro(error.message);
    else onSalvo?.();
  }

  const inputStyle = {
    border: "1.5px solid #e4e4e7", borderRadius: 8,
    padding: "9px 12px", fontSize: ".88rem", color: "#111",
    background: "#fafafa", width: "100%", outline: "none",
    fontFamily: "inherit",
  };

  const labelStyle = {
    fontSize: ".75rem", fontWeight: 700 as const, color: "#555",
    textTransform: "uppercase" as const, letterSpacing: ".5px",
    marginBottom: 5, display: "block",
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:50, background:"rgba(0,0,0,.55)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#fff", borderRadius:16, width:"100%", maxWidth:600, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 24px 60px rgba(0,0,0,.2)", display:"flex", flexDirection:"column" }}>

        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", padding:"24px 24px 0", gap:12 }}>
          <div>
            <p style={{ fontSize:".65rem", letterSpacing:3, textTransform:"uppercase", color:"#22c55e", fontWeight:700, marginBottom:2 }}>FOODOS</p>
            <h2 style={{ fontSize:"1.35rem", fontWeight:700, color:"#111" }}>
              {editando ? "Editar Ingrediente" : "Novo Ingrediente"}
            </h2>
          </div>
          <button onClick={onCancelar} style={{ background:"#f4f4f5", border:"none", borderRadius:8, width:32, height:32, cursor:"pointer", fontSize:".9rem", color:"#666" }}>✕</button>
        </div>

        <div style={{ display:"flex", padding:"16px 24px 0", borderBottom:"1px solid #f0f0f0" }}>
          {["Dados Gerais","Tabela Nutricional"].map((tab, i) => (
            <button key={tab} type="button" onClick={() => setAbaNutri(i === 1)} style={{ background:"none", border:"none", padding:"8px 16px", fontSize:".82rem", fontWeight:600, cursor:"pointer", color: abaNutri === (i===1) ? "#22c55e" : "#999", borderBottom: abaNutri === (i===1) ? "2px solid #22c55e" : "2px solid transparent", marginBottom:-1 }}>
              {tab}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding:"20px 24px" }}>
            {!abaNutri && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                <div style={{ gridColumn:"1/-1" }}>
                  <label style={labelStyle}>Nome do Ingrediente *</label>
                  <input style={inputStyle} value={form.nome} onChange={e => campo("nome", e.target.value)} placeholder="Ex: Filé Mignon" autoFocus />
                </div>
                <div>
                  <label style={labelStyle}>Código Interno</label>
                  <input style={inputStyle} value={form.codigo_interno} onChange={e => campo("codigo_interno", e.target.value)} placeholder="Ex: PRO-001" />
                </div>
                <div>
                  <label style={labelStyle}>Categoria *</label>
                  <select style={inputStyle} value={form.categoria} onChange={e => campo("categoria", e.target.value as Categoria)}>
                    <option value="">Selecione...</option>
                    {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Subcategoria</label>
                  <input style={inputStyle} value={form.subcategoria} onChange={e => campo("subcategoria", e.target.value)} placeholder="Ex: Bovino, Integral..." />
                </div>
                <div>
                  <label style={labelStyle}>Unidade de Medida *</label>
                  <select style={inputStyle} value={form.unidade} onChange={e => campo("unidade", e.target.value as Unidade)}>
                    <option value="">Selecione...</option>
                    {UNIDADES.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Estoque Mínimo</label>
                  <input style={inputStyle} type="number" min="0" step="0.001" value={form.estoque_minimo} onChange={e => campo("estoque_minimo", e.target.value)} />
                </div>
                <div style={{ gridColumn:"1/-1" }}>
                  <label style={labelStyle}>Observações</label>
                  <textarea style={{ ...inputStyle, resize:"vertical" }} value={form.observacoes} onChange={e => campo("observacoes", e.target.value)} placeholder="Notas internas..." rows={3} />
                </div>
                <div style={{ gridColumn:"1/-1", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 0", borderTop:"1px solid #f4f4f5" }}>
                  <span style={{ fontSize:".85rem", color:"#444", fontWeight:500 }}>Ingrediente ativo</span>
                  <button type="button" onClick={() => campo("ativo", !form.ativo)} style={{ width:44, height:24, background: form.ativo ? "#22c55e" : "#e4e4e7", border:"none", borderRadius:12, cursor:"pointer", position:"relative" }}>
                    <span style={{ position:"absolute", top:2, left: form.ativo ? 22 : 2, width:20, height:20, background:"#fff", borderRadius:"50%", display:"block", boxShadow:"0 1px 3px rgba(0,0,0,.2)", transition:"left .2s" }} />
                  </button>
                </div>
              </div>
            )}

            {abaNutri && (
              <div>
                <div style={{ fontSize:".78rem", color:"#888", marginBottom:16, background:"#f9fafb", borderRadius:8, padding:"10px 12px", borderLeft:"3px solid #22c55e" }}>
                  Valores por <strong>100g</strong> ou <strong>100ml</strong>. Deixe em branco se não souber.
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                  {[
                    { key:"nut_calorias",     label:"Calorias",        unit:"kcal" },
                    { key:"nut_proteinas",    label:"Proteínas",       unit:"g" },
                    { key:"nut_carboidratos", label:"Carboidratos",    unit:"g" },
                    { key:"nut_gorduras",     label:"Gorduras Totais", unit:"g" },
                    { key:"nut_sodio",        label:"Sódio",           unit:"mg" },
                    { key:"nut_fibras",       label:"Fibras",          unit:"g" },
                  ].map(({ key, label, unit }) => (
                    <div key={key}>
                      <label style={labelStyle}>{label}</label>
                      <div style={{ display:"flex", border:"1.5px solid #e4e4e7", borderRadius:8, overflow:"hidden", background:"#fafafa" }}>
                        <input type="number" min="0" step="0.01" value={form[key as keyof IngredienteFormData] as string} onChange={e => campo(key as keyof IngredienteFormData, e.target.value)} placeholder="0" style={{ border:"none", background:"transparent", flex:1, padding:"9px 12px", fontSize:".88rem", outline:"none", fontFamily:"inherit" }} />
                        <span style={{ padding:"0 10px", background:"#f4f4f5", fontSize:".75rem", color:"#888", display:"flex", alignItems:"center", borderLeft:"1px solid #e4e4e7", fontWeight:600 }}>{unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {erro && (
            <div style={{ margin:"0 24px 8px", background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8, padding:"10px 14px", fontSize:".82rem", color:"#dc2626" }}>{erro}</div>
          )}

          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", padding:"16px 24px", borderTop:"1px solid #f0f0f0" }}>
            <button type="button" onClick={onCancelar} style={{ background:"none", border:"1.5px solid #e4e4e7", borderRadius:8, padding:"9px 20px", fontSize:".85rem", fontWeight:600, color:"#666", cursor:"pointer" }}>Cancelar</button>
            <button type="submit" disabled={loading} style={{ background: loading ? "#86efac" : "#22c55e", border:"none", borderRadius:8, padding:"9px 24px", fontSize:".85rem", fontWeight:700, color:"#fff", cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? "Salvando..." : editando ? "Salvar Alterações" : "Cadastrar Ingrediente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
