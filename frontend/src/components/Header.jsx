import { Link, useLocation } from "react-router-dom";

const SECTION_NAV = [
  {
    match: (path) => path === "/",
    sections: [
      { id: "visao-geral", label: "Visão geral" },
      { id: "destaques", label: "Destaques" },
      { id: "rede", label: "Rede" },
      { id: "campus", label: "Câmpus" },
      { id: "areas", label: "Áreas" },
    ],
  },
  {
    match: (path) => path.startsWith("/campus/"),
    sections: [
      { id: "visao-geral", label: "Visão geral" },
      { id: "areas-pesquisa", label: "Áreas de pesquisa" },
      { id: "intercampus", label: "Intercampus" },
      { id: "evolucao-temporal", label: "Evolução temporal" },
      { id: "areas-destaque", label: "Áreas em destaque" },
      { id: "pesquisadores-destaque", label: "Pesquisadores" },
    ],
  },
  {
    match: (path) => path.startsWith("/pesquisador/"),
    sections: [
      { id: "indicadores", label: "Indicadores" },
      { id: "rede-coautoria", label: "Rede de coautoria" },
      { id: "evolucao-temporal", label: "Evolução temporal" },
    ],
  },
  {
    match: (path) => path.startsWith("/area/"),
    sections: [
      { id: "visao-geral", label: "Visão geral" },
      { id: "distribuicao", label: "Distribuição" },
      { id: "evolucao-temporal", label: "Evolução temporal" },
      { id: "coocorrencia", label: "Coocorrência" },
    ],
  },
];

function scrollToSection(e, id) {
  const el = document.getElementById(id);
  if (!el) return; // seção condicional que não está presente nesta instância da página
  e.preventDefault();
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  history.replaceState(null, "", `#${id}`);
}

export default function Header() {
  const { pathname } = useLocation();
  const current = SECTION_NAV.find((entry) => entry.match(pathname));

  return (
    <header style={{ position: "sticky", top: 0, zIndex: 20, background: "#fff", borderBottom: "1px solid var(--line)" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "10px 24px", gap: 24, flexWrap: "wrap" }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, fontSize: 15, textDecoration: "none", color: "var(--ink)", flexShrink: 0 }}>
          <img src="/logo-ifg.svg" alt="IFG" style={{ height: 36, width: "auto", flexShrink: 0 }} />
          Sistema de Análise de Produção Científica do IFG
        </Link>

        {current && (
          <nav style={{ display: "flex", gap: 4, flexWrap: "wrap", marginLeft: "auto" }}>
            {current.sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={(e) => scrollToSection(e, s.id)}
                style={{
                  fontSize: 12.5, color: "var(--muted)", textDecoration: "none",
                  padding: "5px 10px", borderRadius: 6, whiteSpace: "nowrap",
                  transition: "background .15s, color .15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#f3f4f6"; e.currentTarget.style.color = "var(--accent)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--muted)"; }}
              >
                {s.label}
              </a>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
