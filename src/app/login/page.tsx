"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const supabase = createClient();
  const router   = useRouter();

  const [email, setEmail]       = useState("");
  const [senha, setSenha]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [erro, setErro]         = useState<string | null>(null);
  const [modo, setModo]         = useState<"login"|"cadastro">("login");
  const [sucesso, setSucesso]   = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);  // ← regra para mostrar a senha

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setLoading(true);

    if (modo === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) { setErro("Email ou senha incorretos."); setLoading(false); return; }
      router.push("/dashboard");
      router.refresh();
    } else {
      const { error } = await supabase.auth.signUp({ email, password: senha });
      if (error) { setErro(error.message); setLoading(false); return; }
      setSucesso(true);
    }
    setLoading(false);
  }

  const C = {
    bg: "#111", card: "#1a1a1a", border: "#2a2a2a",
    text: "#f0ede8", textSub: "#888780",
    blue: "#60a5fa", blueBg: "#1e3a5f", blueBorder: "#1d4ed8",
  };

  if (sucesso) return (
    <div style={{ minHeight:"100vh", background: C.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background: C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:40, maxWidth:400, width:"100%", textAlign:"center" }}>
        <div style={{ fontSize:40, marginBottom:16 }}>📧</div>
        <h2 style={{ fontSize:20, fontWeight:600, color: C.text, marginBottom:8 }}>Verifique seu email</h2>
        <p style={{ fontSize:14, color: C.textSub, lineHeight:1.6 }}>
          Enviamos um link de confirmação para <strong style={{ color: C.text }}>{email}</strong>.<br/>
          Clique no link para ativar sua conta.
        </p>
        <button onClick={() => { setSucesso(false); setModo("login"); }}
          style={{ marginTop:24, width:"100%", height:40, background: C.blueBg, border:`1px solid ${C.blueBorder}`, borderRadius:8, color: C.blue, fontSize:14, fontWeight:500, cursor:"pointer" }}>
          Voltar para o login
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background: C.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background: C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:40, maxWidth:400, width:"100%" }}>

        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ fontSize:28, fontWeight:700, color: C.text, letterSpacing:2 }}>FOODOS</div>
          <div style={{ fontSize:11, color: C.textSub, marginTop:4, letterSpacing:3, textTransform:"uppercase" }}>Sistema Operacional</div>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden", marginBottom:24 }}>
          {(["login","cadastro"] as const).map(m => (
            <button key={m} onClick={() => { setModo(m); setErro(null); }}
              style={{ flex:1, height:36, border:"none", background: modo===m ? C.blueBg : "transparent", color: modo===m ? C.blue : C.textSub, fontSize:13, fontWeight: modo===m ? 500 : 400, cursor:"pointer" }}>
              {m === "login" ? "Entrar" : "Criar conta"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:11, color: C.textSub, textTransform:"uppercase", letterSpacing:"0.5px", display:"block", marginBottom:6 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required
              style={{ width:"100%", height:40, padding:"0 12px", fontSize:13, background:"#0d0d0d", border:`1px solid ${C.border}`, borderRadius:8, color: C.text, outline:"none" }} />
          </div>

          <div style={{ marginBottom:24 }}>
            <label style={{ fontSize:11, color: C.textSub, textTransform:"uppercase", letterSpacing:"0.5px", display:"block", marginBottom:6 }}>Senha</label>
            <div style={{ position:"relative" }}>
  <input type={mostrarSenha ? "text" : "password"} value={senha} onChange={e => setSenha(e.target.value)} placeholder="••••••••" required minLength={6}
    style={{ width:"100%", height:40, padding:"0 40px 0 12px", fontSize:13, background:"#0d0d0d", border:`1px solid ${C.border}`, borderRadius:8, color: C.text, outline:"none", boxSizing:"border-box" }} />
  <button type="button" onClick={() => setMostrarSenha(!mostrarSenha)}
    style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color: C.textSub, fontSize:16, padding:0, lineHeight:1 }}>
    {mostrarSenha ? "🙈" : "👁️"}
  </button>
</div>
          </div>

          {erro && (
            <div style={{ background:"#3a1a1a", border:"1px solid #5a2a2a", borderRadius:8, padding:"10px 12px", fontSize:12, color:"#f87171", marginBottom:14 }}>
              {erro}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{ width:"100%", height:40, background: loading ? "#1a2a4a" : C.blueBg, border:`1px solid ${C.blueBorder}`, borderRadius:8, color: C.blue, fontSize:14, fontWeight:500, cursor: loading ? "not-allowed" : "pointer" }}>
            {loading ? "Aguarde..." : modo === "login" ? "Entrar" : "Criar conta"}
          </button>
        </form>
      </div>
    </div>
  );
}