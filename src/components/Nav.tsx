"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MENU = [
  { group: "Visão Geral",   items: [
    { href: "/dashboard",    label: "Dashboard",    icon: "📊" },
  ]},
  { group: "Operação",      items: [
    { href: "/vendas",       label: "Vendas",       icon: "🛒" },
    { href: "/clientes",     label: "Clientes",     icon: "👥" },
  ]},
  { group: "Produtos",      items: [
    { href: "/pratos",       label: "Pratos",       icon: "🍽️" },
    { href: "/ingredientes", label: "Ingredientes", icon: "🥩" },
  ]},
  { group: "Abastecimento", items: [
    { href: "/estoque",      label: "Estoque",      icon: "📦" },
    { href: "/compras",      label: "Compras",      icon: "🛍️" },
    { href: "/fornecedores", label: "Fornecedores", icon: "🚚" },
  ]},
{ group: "Financeiro", items: [
  { href: "/financeiro", label: "Financeiro", icon: "💰" },
]},
{ group: "Compliance", items: [
  { href: "/lgpd", label: "LGPD", icon: "🔒" },
]},
];

export default function Nav() {
  const path = usePathname();

  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, bottom: 0,
      width: 220, background: "#161616",
      borderRight: "1px solid #2a2a2a",
      display: "flex", flexDirection: "column",
      padding: "0 0 16px", zIndex: 100,
      overflowY: "auto",
    }}>
      {/* Logo */}
      <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #2a2a2a" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#f0ede8", letterSpacing: 1 }}>FOODOS</div>
        <div style={{ fontSize: 11, color: "#555", marginTop: 2, letterSpacing: 2, textTransform: "uppercase" }}>Sistema Operacional</div>
      </div>

      {/* Menu */}
      <div style={{ flex: 1, padding: "12px 10px" }}>
        {MENU.map(({ group, items }) => (
          <div key={group} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#444", textTransform: "uppercase", letterSpacing: 1.5, padding: "0 10px", marginBottom: 4 }}>
              {group}
            </div>
            {items.map(({ href, label, icon }) => {
              const active = path === href || path.startsWith(href + "/");
              return (
                <Link key={href} href={href} style={{ textDecoration: "none" }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 10px", borderRadius: 8, marginBottom: 2,
                    background: active ? "#1e3a5f" : "transparent",
                    color: active ? "#60a5fa" : "#888780",
                    fontSize: 13, fontWeight: active ? 500 : 400,
                    cursor: "pointer", transition: "all 0.15s",
                    border: active ? "0.5px solid #1d4ed8" : "0.5px solid transparent",
                  }}>
                    <span style={{ fontSize: 15, width: 20, textAlign: "center" }}>{icon}</span>
                    {label}
                  </div>
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding: "12px 20px", borderTop: "1px solid #2a2a2a", fontSize: 11, color: "#444" }}>
        MVP v1.0 · {new Date().getFullYear()}
      </div>
    </nav>
  );
}