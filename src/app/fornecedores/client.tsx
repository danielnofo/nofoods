"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import FornecedorForm from "@/components/fornecedores/FornecedorForm";

interface Fornecedor {
  id:               string;
  nome_fantasia:    string;
  razao_social:     string | null;
  categoria:        string;
  nome_contato:     string | null;
  whatsapp:         string | null;
  email:            string | null;
  ativo:            boolean;
  modelo_entrega:   string;
  prazo_dias_uteis: number | null;
}

const CATEGORIAS_FILTRO = [
  "Todas","Carnes e Proteínas","Hortifruti","Laticínios",
  "Bebidas","Grãos e Cereais","Temperos e Molhos","Embalagens","Limpeza","Outros",
];

const CATEGORIA_CORES: Record<string, string> = {
  "Carnes e Proteínas": "#fde68a:#92400e",
  "Hortifruti":         "#dcfce7:#166534",
  "Laticínios":         "#dbeafe:#1e40af",
  "Bebidas":            "#e0f2fe:#0369a1",
  "Grãos e Cereais":    "#fef3c7:#92400e",
  "Temperos e Molhos":  "#fce7f3:#9d174d",
  "Embalagens":         "#f3f4f6:#374151",
  "Limpeza":            "#ede9fe:#5b21b6",
  "Outros":             "#f3f4f6:#374151",
};

function CategoriaBadge({ cat }: { cat: string }) {
  const [bg, text] = (CATEGORIA_CORES[cat] || "#f3f4f6:#374151").split(":");
  return (
    <span style={{ background:bg, color:text, fontSize:".65rem", fontWeight:700, letterSpacing:"0.5px", padding:"2px 8px", borderRadius:20, textTransform:"uppercase", whiteSpace:"nowrap" }}>
      {cat}
    </span>
  );
}

function EntregaBadge({ modelo, prazo }: { modelo: string; prazo: number | null }) {
  const txt = modelo === "dias_uteis"
    ? `${prazo ?? "?"} dias úteis`
    : "Dia fixo";
  return (
    <span style={{ background:"#f0fdf4", color:"#15803d", fontSize:".7rem", fontWeight:600, padding:"2px 10px", borderRadius:20, whiteSpace:"nowrap" }}>
      🚚 {txt}
    </span>
  );
}

export default function FornecedoresClient() {
  const supabase = createClient();
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading]           = useState(true);
  const [busca, setBusca]               = useState("");
  const [catFiltro, setCatFiltro]       = useState("Todas");
  const [apenasAtivos, setApenasAtivos] = useState(true);
  const [formAberto, setFormAberto]     = useState(false);
  const [editando, setEditando]         = useState<Fornecedor | null>(null);

  const buscarFornecedores = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("fornecedores")
      .select("id,nome_fantasia,razao_social,categoria,nome_contato,whatsapp,email,ativo,modelo_entrega,prazo_dias_uteis")
      .order("nome_fantasia");
    if (apenasAtivos)          query = query.eq("ativo", true);
    if (catFiltro !== "Todas") query = query.eq("categoria", catFiltro);
    if (busca.trim())          query = query.ilike("nome_fantasia", `%${busca.trim()}%`);
    const { data, error } = await query;
    if (!error && data) setFornecedores(data);
    setLoading(false);
  }, [apenasAtivos, catFiltro, busca]);

  useEffect(() => {
    const t = setTimeout(buscarFornecedores, 300);
    return () => clearTimeout(t);
  }, [buscarFornecedores]);

  async function toggleAtivo(item: Fornecedor) {
    await supabase.from("fornecedores").update({ ativo: !item.ativo }).eq("id", item.id);
    buscarFornecedores();
  }

  const totalAtivos = fornecedores.filter(f => f.ativo).length;
  const totalCats   = new Set(fornecedores.map(f => f.categoria)).size;

  return (
    <div style={{ padding:24, maxWidth:1100, margin:"0 auto" }}>

      {/* HEADER */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16, marginBottom:24, flexWrap:"wrap" }}>
        <div>
          <p style={{ fontSize:".65rem", letterSpacing:3, textTransform:"uppercase", color:"#f59e0b", fontWeight:700, marginBottom:4 }}>Módulo 3</p>
          <h1 style={{ fontSize:"1.6rem", fontWeight:800, color:"#111", lineHeight:1.1 }}>Fornecedores</h1>
          <p style={{ fontSize:".82rem", color:"#888", marginTop:4 }}>Gerencie seus fornecedores e prazos de entrega</p>
        </div>
        <button onClick={() => { setEditando(null); setFormAberto(true); }} style={{ background:"#f59e0b", border:"none", borderRadius:10, padding:"10px 20px", fontSize:".85rem", fontWeight:700, color:"#fff", cursor:"pointer" }}>
          + Novo Fornecedor
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:24 }}>
        {[
          { num:fornecedores.length, label:"Total cadastrados", cor:"#111" },
          { num:totalAtivos,         label:"Ativos",            cor:"#f59e0b" },
          { num:totalCats,           label:"Categorias",        cor:"#6366f1" },
          { num:fornecedores.filter(f => f.modelo_entrega==="dia_fixo").length, label:"Entrega dia fixo", cor:"#22c55e" },
        ].map(({ num, label, cor }) => (
          <div key={label} style={{ background:"#fff", border:"1px solid #f0f0f0", borderRadius:12, padding:"16px 20px", boxShadow:"0 1px 3px rgba(0,0,0,.05)" }}>
            <div style={{ fontSize:"1.6rem", fontWeight:800, color:cor }}>{num}</div>
            <div style={{ fontSize:".72rem", color:"#888", fontWeight:500 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* FILTROS */}
      <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:16 }}>
        <input placeholder="🔍  Buscar fornecedor..." value={busca} onChange={e => setBusca(e.target.value)}
          style={{ border:"1.5px solid #e4e4e7", borderRadius:10, padding:"10px 16px", fontSize:".88rem", width:"100%", maxWidth:380, outline:"none" }} />
        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
          {CATEGORIAS_FILTRO.map(c => (
            <button key={c} onClick={() => setCatFiltro(c)} style={{ background: catFiltro===c ? "#fef3c7" : "#f4f4f5", border:`1.5px solid ${catFiltro===c ? "#f59e0b" : "#e4e4e7"}`, borderRadius:20, padding:"4px 14px", fontSize:".75rem", fontWeight:600, color: catFiltro===c ? "#92400e" : "#666", cursor:"pointer" }}>
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
        ) : fornecedores.length === 0 ? (
          <div style={{ padding:60, textAlign:"center", color:"#888" }}>
            <p style={{ marginBottom:16 }}>Nenhum fornecedor encontrado.</p>
            <button onClick={() => setFormAberto(true)} style={{ background:"#f59e0b", border:"none", borderRadius:10, padding:"10px 20px", fontSize:".85rem", fontWeight:700, color:"#fff", cursor:"pointer" }}>
              + Cadastrar primeiro fornecedor
            </button>
          </div>
        ) : (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"#f9fafb", borderBottom:"1px solid #f0f0f0" }}>
                {["Fornecedor","Categoria","Contato","WhatsApp","Entrega","Status",""].map(h => (
                  <th key={h} style={{ padding:"11px 16px", textAlign:"left", fontSize:".7rem", fontWeight:700, textTransform:"uppercase", letterSpacing:.5, color:"#888" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fornecedores.map(item => (
                <tr key={item.id} style={{ borderBottom:"1px solid #f9f9f9", opacity:item.ativo ? 1 : 0.5 }}>
                  <td style={{ padding:"12px 16px" }}>
                    <div style={{ fontWeight:600, color:"#111", fontSize:".88rem" }}>{item.nome_fantasia}</div>
                    {item.razao_social && <div style={{ fontSize:".68rem", color:"#aaa", marginTop:2 }}>{item.razao_social}</div>}
                  </td>
                  <td style={{ padding:"12px 16px" }}><CategoriaBadge cat={item.categoria} /></td>
                  <td style={{ padding:"12px 16px", fontSize:".85rem", color:"#666" }}>
                    {item.nome_contato || <span style={{color:"#ccc"}}>—</span>}
                  </td>
                  <td style={{ padding:"12px 16px", fontSize:".85rem" }}>
                    {item.whatsapp ? (
                      <a href={`https://wa.me/55${item.whatsapp.replace(/\D/g,"")}`} target="_blank" rel="noreferrer"
                        style={{ color:"#25D366", fontWeight:600, textDecoration:"none" }}>
                        📱 {item.whatsapp}
                      </a>
                    ) : <span style={{color:"#ccc"}}>—</span>}
                  </td>
                  <td style={{ padding:"12px 16px" }}>
                    <EntregaBadge modelo={item.modelo_entrega} prazo={item.prazo_dias_uteis} />
                  </td>
                  <td style={{ padding:"12px 16px", textAlign:"center" }}>
                    <span style={{ display:"inline-block", fontSize:".68rem", fontWeight:700, padding:"2px 10px", borderRadius:20, textTransform:"uppercase", background:item.ativo ? "#fef3c7" : "#f3f4f6", color:item.ativo ? "#92400e" : "#9ca3af" }}>
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
        <FornecedorForm
          inicial={editando ?? undefined}
          onSalvo={() => { setFormAberto(false); buscarFornecedores(); }}
          onCancelar={() => setFormAberto(false)}
        />
      )}
    </div>
  );
}
