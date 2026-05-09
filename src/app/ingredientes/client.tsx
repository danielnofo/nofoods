"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import IngredienteForm from "@/components/ingredientes/IngredienteForm";

interface Ingrediente {
  id:             string;
  nome:           string;
  codigo_interno: string | null;
  categoria:      string;
  subcategoria:   string | null;
  unidade:        string;
  estoque_minimo: number;
  ativo:          boolean;
  nut_calorias:   number | null;
  created_at:     string;
}

const CATEGORIAS_FILTRO = [
  "Todas","Proteínas","Carboidratos","Vegetais","Legumes",
  "Temperos","Molhos","Bebidas","Embalagens","Outros",
];

const BADGE_CORES: Record<string, string> = {
  "Proteínas":    "#fde68a:#92400e",
  "Carboidratos": "#dbeafe:#1e40af",
  "Vegetais":     "#dcfce7:#166534",
  "Legumes":      "#d1fae5:#065f46",
  "Temperos":     "#fce7f3:#9d174d",
  "Molhos":       "#ede9fe:#5b21b6",
  "Bebidas":      "#e0f2fe:#0369a1",
  "Embalagens":   "#f3f4f6:#374151",
  "Outros":       "#f3f4f6:#374151",
};

function CategoriaBadge({ cat }: { cat: string }) {
  const [bg, text] = (BADGE_CORES[cat] || "#f3f4f6:#374151").split(":");
  return (
    <span style={{ background:bg, color:text, fontSize:".65rem", fontWeight:700, letterSpacing:"0.5px", padding:"2px 8px", borderRadius:20, textTransform:"uppercase", whiteSpace:"nowrap" }}>
      {cat}
    </span>
  );
}

export default function IngredientesClient() {
  const supabase = createClient();
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [loading, setLoading]           = useState(true);
  const [busca, setBusca]               = useState("");
  const [catFiltro, setCatFiltro]       = useState("Todas");
  const [apenasAtivos, setApenasAtivos] = useState(true);
  const [formAberto, setFormAberto]     = useState(false);
  const [editando, setEditando]         = useState<Ingrediente | null>(null);

  const buscarIngredientes = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("ingredientes")
      .select("id,nome,codigo_interno,categoria,subcategoria,unidade,estoque_minimo,ativo,nut_calorias,created_at")
      .order("categoria").order("nome");
    if (apenasAtivos)          query = query.eq("ativo", true);
    if (catFiltro !== "Todas") query = query.eq("categoria", catFiltro);
    if (busca.trim())          query = query.ilike("nome", `%${busca.trim()}%`);
    const { data, error } = await query;
    if (!error && data) setIngredientes(data);
    setLoading(false);
  }, [apenasAtivos, catFiltro, busca]);

  useEffect(() => {
    const t = setTimeout(buscarIngredientes, 300);
    return () => clearTimeout(t);
  }, [buscarIngredientes]);

  async function toggleAtivo(item: Ingrediente) {
    await supabase.from("ingredientes").update({ ativo: !item.ativo }).eq("id", item.id);
    buscarIngredientes();
  }

  const totalAtivos = ingredientes.filter(i => i.ativo).length;
  const totalCategs = new Set(ingredientes.map(i => i.categoria)).size;

  return (
    <div style={{ padding:24, maxWidth:1100, margin:"0 auto" }}>

      {/* HEADER */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16, marginBottom:24, flexWrap:"wrap" }}>
        <div>
          <p style={{ fontSize:".65rem", letterSpacing:3, textTransform:"uppercase", color:"#22c55e", fontWeight:700, marginBottom:4 }}>Módulo 1</p>
          <h1 style={{ fontSize:"1.6rem", fontWeight:800, color:"#111", lineHeight:1.1 }}>Ingredientes</h1>
          <p style={{ fontSize:".82rem", color:"#888", marginTop:4 }}>Cadastro base de todos os insumos da operação</p>
        </div>
        <button onClick={() => { setEditando(null); setFormAberto(true); }} style={{ background:"#22c55e", border:"none", borderRadius:10, padding:"10px 20px", fontSize:".85rem", fontWeight:700, color:"#fff", cursor:"pointer" }}>
          + Novo Ingrediente
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:24 }}>
        {[
          { num:ingredientes.length, label:"Total cadastrados", cor:"#111" },
          { num:totalAtivos,         label:"Ativos",            cor:"#22c55e" },
          { num:totalCategs,         label:"Categorias",        cor:"#6366f1" },
          { num:ingredientes.filter(i => i.estoque_minimo > 0).length, label:"Com estoque mínimo", cor:"#f59e0b" },
        ].map(({ num, label, cor }) => (
          <div key={label} style={{ background:"#fff", border:"1px solid #f0f0f0", borderRadius:12, padding:"16px 20px", boxShadow:"0 1px 3px rgba(0,0,0,.05)" }}>
            <div style={{ fontSize:"1.6rem", fontWeight:800, color:cor }}>{num}</div>
            <div style={{ fontSize:".72rem", color:"#888", fontWeight:500 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* FILTROS */}
      <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:16 }}>
        <input
          placeholder="🔍  Buscar ingrediente..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ border:"1.5px solid #e4e4e7", borderRadius:10, padding:"10px 16px", fontSize:".88rem", width:"100%", maxWidth:380, outline:"none" }}
        />
        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
          {CATEGORIAS_FILTRO.map(c => (
            <button key={c} onClick={() => setCatFiltro(c)} style={{ background: catFiltro===c ? "#dcfce7" : "#f4f4f5", border:`1.5px solid ${catFiltro===c ? "#22c55e" : "#e4e4e7"}`, borderRadius:20, padding:"4px 14px", fontSize:".75rem", fontWeight:600, color: catFiltro===c ? "#15803d" : "#666", cursor:"pointer" }}>
              {c}
            </button>
          ))}
        </div>
        <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:".8rem", color:"#666", cursor:"pointer" }}>
          <input type="checkbox" checked={apenasAtivos} onChange={e => setApenasAtivos(e.target.checked)} />
          Apenas ativos
        </label>
      </div>

      {/* TABELA */}
      <div style={{ background:"#fff", border:"1px solid #f0f0f0", borderRadius:14, overflow:"hidden", boxShadow:"0 1px 6px rgba(0,0,0,.06)" }}>
        {loading ? (
          <div style={{ padding:40, textAlign:"center", color:"#888" }}>Carregando...</div>
        ) : ingredientes.length === 0 ? (
          <div style={{ padding:60, textAlign:"center", color:"#888" }}>
            <p style={{ marginBottom:16 }}>Nenhum ingrediente encontrado.</p>
            <button onClick={() => setFormAberto(true)} style={{ background:"#22c55e", border:"none", borderRadius:10, padding:"10px 20px", fontSize:".85rem", fontWeight:700, color:"#fff", cursor:"pointer" }}>
              + Cadastrar primeiro ingrediente
            </button>
          </div>
        ) : (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"#f9fafb", borderBottom:"1px solid #f0f0f0" }}>
                {["Ingrediente","Categoria","Unidade","Est. Mínimo","Calorias","Status",""].map(h => (
                  <th key={h} style={{ padding:"11px 16px", textAlign:"left", fontSize:".7rem", fontWeight:700, textTransform:"uppercase", letterSpacing:.5, color:"#888" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ingredientes.map(item => (
                <tr key={item.id} style={{ borderBottom:"1px solid #f9f9f9", opacity: item.ativo ? 1 : 0.5 }}>
                  <td style={{ padding:"12px 16px" }}>
                    <div style={{ fontWeight:600, color:"#111", fontSize:".88rem" }}>{item.nome}</div>
                    {item.codigo_interno && <div style={{ fontSize:".68rem", color:"#aaa", fontFamily:"monospace" }}>{item.codigo_interno}</div>}
                  </td>
                  <td style={{ padding:"12px 16px" }}><CategoriaBadge cat={item.categoria} /></td>
                  <td style={{ padding:"12px 16px", textAlign:"center", fontSize:".85rem" }}>{item.unidade}</td>
                  <td style={{ padding:"12px 16px", textAlign:"center", fontSize:".85rem" }}>
                    {item.estoque_minimo > 0 ? `${item.estoque_minimo} ${item.unidade}` : <span style={{color:"#ccc"}}>—</span>}
                  </td>
                  <td style={{ padding:"12px 16px", textAlign:"center", fontSize:".85rem" }}>
                    {item.nut_calorias != null ? `${item.nut_calorias} kcal` : <span style={{color:"#ccc"}}>—</span>}
                  </td>
                  <td style={{ padding:"12px 16px", textAlign:"center" }}>
                    <span style={{ display:"inline-block", fontSize:".68rem", fontWeight:700, padding:"2px 10px", borderRadius:20, textTransform:"uppercase", background: item.ativo ? "#dcfce7" : "#f3f4f6", color: item.ativo ? "#15803d" : "#9ca3af" }}>
                      {item.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td style={{ padding:"12px 16px" }}>
                    <div style={{ display:"flex", gap:4, justifyContent:"flex-end" }}>
                      <button onClick={() => { setEditando(item); setFormAberto(true); }} style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 6px", borderRadius:6, fontSize:"1rem" }}>✏️</button>
                      <button onClick={() => toggleAtivo(item)} style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 6px", borderRadius:6, fontSize:"1rem" }}>
                        {item.ativo ? "🔴" : "🟢"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {formAberto && (
        <IngredienteForm
          inicial={editando ?? undefined}
          onSalvo={() => { setFormAberto(false); buscarIngredientes(); }}
          onCancelar={() => setFormAberto(false)}
        />
      )}
    </div>
  );
}
