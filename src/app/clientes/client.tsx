"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";

interface Cliente {
  id:          string;
  nome:        string;
  whatsapp:    string | null;
  email:       string | null;
  endereco:    string | null;
  observacoes: string | null;
  ativo:       boolean;
  created_at:  string;
}

export default function ClientesClient() {
  const supabase = createClient();
  const [clientes, setClientes]   = useState<Cliente[]>([]);
  const [loading, setLoading]     = useState(true);
  const [busca, setBusca]         = useState("");
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando]   = useState<Cliente | null>(null);
  const [form, setForm]           = useState({ nome:"", whatsapp:"", email:"", endereco:"", observacoes:"" });
  const [saving, setSaving]       = useState(false);

  const buscarClientes = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("clientes").select("*").order("nome");
    if (busca.trim()) query = query.ilike("nome", `%${busca.trim()}%`);
    const { data, error } = await query;
    if (!error && data) setClientes(data);
    setLoading(false);
  }, [busca]);

  useEffect(() => {
    const t = setTimeout(buscarClientes, 300);
    return () => clearTimeout(t);
  }, [buscarClientes]);

  function abrirNovo() {
    setEditando(null);
    setForm({ nome:"", whatsapp:"", email:"", endereco:"", observacoes:"" });
    setFormAberto(true);
  }

  function abrirEditar(c: Cliente) {
    setEditando(c);
    setForm({ nome:c.nome, whatsapp:c.whatsapp||"", email:c.email||"", endereco:c.endereco||"", observacoes:c.observacoes||"" });
    setFormAberto(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) return;
    setSaving(true);
    const payload = {
      nome:        form.nome.trim(),
      whatsapp:    form.whatsapp.trim() || null,
      email:       form.email.trim() || null,
      endereco:    form.endereco.trim() || null,
      observacoes: form.observacoes.trim() || null,
    };
    if (editando) {
      await supabase.from("clientes").update(payload).eq("id", editando.id);
    } else {
      await supabase.from("clientes").insert(payload);
    }
    setSaving(false);
    setFormAberto(false);
    buscarClientes();
  }

  async function toggleAtivo(c: Cliente) {
    await supabase.from("clientes").update({ ativo: !c.ativo }).eq("id", c.id);
    buscarClientes();
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
    <div style={{ padding:24, maxWidth:1000, margin:"0 auto" }}>

      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16, marginBottom:24, flexWrap:"wrap" }}>
        <div>
          <p style={{ fontSize:".65rem", letterSpacing:3, textTransform:"uppercase", color:"#ec4899", fontWeight:700, marginBottom:4 }}>Módulo 6</p>
          <h1 style={{ fontSize:"1.6rem", fontWeight:800, color:"#111", lineHeight:1.1 }}>Clientes</h1>
          <p style={{ fontSize:".82rem", color:"#888", marginTop:4 }}>Base de clientes para vincular às vendas</p>
        </div>
        <button onClick={abrirNovo}
          style={{ background:"#ec4899", border:"none", borderRadius:10, padding:"10px 20px", fontSize:".85rem", fontWeight:700, color:"#fff", cursor:"pointer" }}>
          + Novo Cliente
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:24 }}>
        {[
          { num:clientes.length,                    label:"Total clientes",  cor:"#111" },
          { num:clientes.filter(c=>c.ativo).length, label:"Ativos",          cor:"#ec4899" },
          { num:clientes.filter(c=>c.whatsapp).length, label:"Com WhatsApp", cor:"#25D366" },
        ].map(({ num, label, cor }) => (
          <div key={label} style={{ background:"#fff", border:"1px solid #f0f0f0", borderRadius:12, padding:"16px 20px", boxShadow:"0 1px 3px rgba(0,0,0,.05)" }}>
            <div style={{ fontSize:"1.6rem", fontWeight:800, color:cor }}>{num}</div>
            <div style={{ fontSize:".72rem", color:"#888", fontWeight:500 }}>{label}</div>
          </div>
        ))}
      </div>

      <input placeholder="🔍  Buscar cliente..." value={busca} onChange={e => setBusca(e.target.value)}
        style={{ ...inputStyle, maxWidth:380, marginBottom:16 }} />

      <div style={{ background:"#fff", border:"1px solid #f0f0f0", borderRadius:14, overflow:"hidden", boxShadow:"0 1px 6px rgba(0,0,0,.06)" }}>
        {loading ? (
          <div style={{ padding:40, textAlign:"center", color:"#888" }}>Carregando...</div>
        ) : clientes.length === 0 ? (
          <div style={{ padding:60, textAlign:"center", color:"#888" }}>
            <p style={{ marginBottom:16 }}>Nenhum cliente encontrado.</p>
            <button onClick={abrirNovo} style={{ background:"#ec4899", border:"none", borderRadius:10, padding:"10px 20px", fontSize:".85rem", fontWeight:700, color:"#fff", cursor:"pointer" }}>
              + Cadastrar primeiro cliente
            </button>
          </div>
        ) : (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"#f9fafb", borderBottom:"1px solid #f0f0f0" }}>
                {["Cliente","WhatsApp","Email","Cadastro","Status",""].map(h => (
                  <th key={h} style={{ padding:"11px 16px", textAlign:"left", fontSize:".7rem", fontWeight:700, textTransform:"uppercase", letterSpacing:.5, color:"#888" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clientes.map(c => (
                <tr key={c.id} style={{ borderBottom:"1px solid #f9f9f9", opacity:c.ativo?1:0.5 }}>
                  <td style={{ padding:"12px 16px", fontWeight:600, color:"#111", fontSize:".88rem" }}>{c.nome}</td>
                  <td style={{ padding:"12px 16px", fontSize:".85rem" }}>
                    {c.whatsapp ? (
                      <a href={`https://wa.me/55${c.whatsapp.replace(/\D/g,"")}`} target="_blank" rel="noreferrer"
                        style={{ color:"#25D366", fontWeight:600, textDecoration:"none" }}>
                        📱 {c.whatsapp}
                      </a>
                    ) : <span style={{color:"#ccc"}}>—</span>}
                  </td>
                  <td style={{ padding:"12px 16px", fontSize:".82rem", color:"#666" }}>
                    {c.email || <span style={{color:"#ccc"}}>—</span>}
                  </td>
                  <td style={{ padding:"12px 16px", fontSize:".78rem", color:"#aaa" }}>
                    {new Date(c.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td style={{ padding:"12px 16px" }}>
                    <span style={{ display:"inline-block", fontSize:".68rem", fontWeight:700, padding:"2px 10px", borderRadius:20, textTransform:"uppercase", background:c.ativo?"#fce7f3":"#f3f4f6", color:c.ativo?"#9d174d":"#9ca3af" }}>
                      {c.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td style={{ padding:"12px 16px" }}>
                    <div style={{ display:"flex", gap:4 }}>
                      <button onClick={() => abrirEditar(c)} style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 6px", borderRadius:6, fontSize:"1rem" }}>✏️</button>
                      <button onClick={() => toggleAtivo(c)} style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 6px", borderRadius:6, fontSize:"1rem" }}>
                        {c.ativo ? "🔴" : "🟢"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* FORM MODAL */}
      {formAberto && (
        <div style={{ position:"fixed", inset:0, zIndex:50, background:"rgba(0,0,0,.55)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#fff", borderRadius:16, width:"100%", maxWidth:500, boxShadow:"0 24px 60px rgba(0,0,0,.2)" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"24px 24px 0" }}>
              <div>
                <p style={{ fontSize:".65rem", letterSpacing:3, textTransform:"uppercase", color:"#ec4899", fontWeight:700, marginBottom:2 }}>FOODOS</p>
                <h2 style={{ fontSize:"1.2rem", fontWeight:700, color:"#111" }}>{editando ? "Editar Cliente" : "Novo Cliente"}</h2>
              </div>
              <button onClick={() => setFormAberto(false)} style={{ background:"#f4f4f5", border:"none", borderRadius:8, width:32, height:32, cursor:"pointer", fontSize:".9rem", color:"#666" }}>✕</button>
            </div>
            <form onSubmit={salvar}>
              <div style={{ padding:"20px 24px", display:"flex", flexDirection:"column", gap:12 }}>
                <div>
                  <label style={labelStyle}>Nome *</label>
                  <input style={inputStyle} value={form.nome} onChange={e => setForm(p=>({...p,nome:e.target.value}))} placeholder="Nome completo" autoFocus />
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                  <div>
                    <label style={labelStyle}>WhatsApp</label>
                    <input style={inputStyle} value={form.whatsapp} onChange={e => setForm(p=>({...p,whatsapp:e.target.value}))} placeholder="11999990000" />
                  </div>
                  <div>
                    <label style={labelStyle}>E-mail</label>
                    <input style={inputStyle} type="email" value={form.email} onChange={e => setForm(p=>({...p,email:e.target.value}))} placeholder="email@exemplo.com" />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Endereço</label>
                  <input style={inputStyle} value={form.endereco} onChange={e => setForm(p=>({...p,endereco:e.target.value}))} placeholder="Rua, número, bairro..." />
                </div>
                <div>
                  <label style={labelStyle}>Observações</label>
                  <textarea style={{ ...inputStyle, resize:"vertical" }} value={form.observacoes} onChange={e => setForm(p=>({...p,observacoes:e.target.value}))} rows={2} placeholder="Preferências, alergias..." />
                </div>
              </div>
              <div style={{ display:"flex", gap:10, justifyContent:"flex-end", padding:"16px 24px", borderTop:"1px solid #f0f0f0" }}>
                <button type="button" onClick={() => setFormAberto(false)} style={{ background:"none", border:"1.5px solid #e4e4e7", borderRadius:8, padding:"9px 20px", fontSize:".85rem", fontWeight:600, color:"#666", cursor:"pointer" }}>Cancelar</button>
                <button type="submit" disabled={saving} style={{ background:saving?"#f9a8d4":"#ec4899", border:"none", borderRadius:8, padding:"9px 24px", fontSize:".85rem", fontWeight:700, color:"#fff", cursor:saving?"not-allowed":"pointer" }}>
                  {saving ? "Salvando..." : editando ? "Salvar" : "Cadastrar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}