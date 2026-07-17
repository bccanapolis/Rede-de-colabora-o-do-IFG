import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getStats, getCampuses, getAreas, getRedeEvolucao, search } from "../api";
import { titleCase, campusName } from "../utils";
import { Building2, User, Search, Network, TrendingUp, TrendingDown, Info, FlaskConical } from "lucide-react";
import StatCard from "../components/StatCard";
import LoadingSpinner from "../components/LoadingSpinner";
import NetworkEvolutionChart from "../components/NetworkEvolutionChart";

function HCard({ ico: Ico, bg, color, label, value, sub, onClick, tooltip }) {
  return (
    <div onClick={onClick}
      style={{ position: "relative", border: "1px solid var(--line2)", borderRadius: 11, padding: 14, cursor: onClick ? "pointer" : "default", transition: ".12s", background: "#fff", boxShadow: "0 2px 10px rgba(0,0,0,.07)" }}
      onMouseEnter={(e) => onClick && (e.currentTarget.style.borderColor = "var(--accent)")}
      onMouseLeave={(e) => onClick && (e.currentTarget.style.borderColor = "var(--line2)")}>
      {tooltip && (
        <div className="hcard-info" onClick={(e) => e.stopPropagation()}>
          <Info size={13} strokeWidth={2} />
          <div className="hcard-tooltip">{tooltip}</div>
        </div>
      )}
      <div style={{ width: 38, height: 38, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10, background: bg, color }}>
        {Ico && <Ico size={20} strokeWidth={1.75} />}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: "var(--hint)", marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function fmt(n) {
  if (!n && n !== 0) return "—";
  return n.toLocaleString("pt-BR");
}

function shortName(nome) {
  if (!nome) return "";
  const p = nome.split(" ").filter(Boolean);
  if (p.length <= 2) return titleCase(nome);
  return `${p[0].charAt(0).toUpperCase() + p[0].slice(1).toLowerCase()} ${p[p.length - 1].charAt(0).toUpperCase() + p[p.length - 1].slice(1).toLowerCase()}`;
}

export default function Home() {
  const [stats, setStats] = useState(null);
  const [campuses, setCampuses] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(false);
  const [redeHover, setRedeHover] = useState(false);
  const [evolucao, setEvolucao] = useState([]);
  const searchRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([getStats(), getCampuses(), getAreas()])
      .then(([s, c, a]) => { setStats(s); setCampuses(c); setAreas(a); })
      .finally(() => setLoading(false));
    getRedeEvolucao().then(setEvolucao).catch(() => setEvolucao([]));
  }, []);

  useEffect(() => {
    if (query.length < 2) { setResults(null); setOpen(false); return; }
    const t = setTimeout(() => {
      search(query).then((r) => { setResults(r); setOpen(true); });
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const handler = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (loading) return <LoadingSpinner text="Carregando dados da rede…" />;
  if (!stats) return <div className="banner">Erro ao carregar dados. Verifique se o backend está rodando.</div>;

  const topCampus = campuses
    .filter(c => c.total_pesquisadores > 0)
    .sort((a, b) => (b.total_publicacoes / b.total_pesquisadores) - (a.total_publicacoes / a.total_pesquisadores))[0];

  const topCampusRecente = campuses
    .filter(c => c.pesquisadores_ativos > 0)
    .sort((a, b) => (b.publicacoes_recentes / b.pesquisadores_ativos) - (a.publicacoes_recentes / a.pesquisadores_ativos))[0];

  return (
    <>
      {/* HERO */}
      <section className="sec" style={{ textAlign: "center", padding: "30px 20px" }}>
        <h1 className="page" style={{ fontSize: 40, margin: "12px 0 24px" }}>Rede de Colaboração Científica do IFG</h1>

        <p className="page-sub" style={{ margin: "0 0 52px", fontSize: 15 }}>
          Explore a produção científica e as colaborações entre os câmpus e os pesquisadores do Instituto Federal de Goiás.<br /> 
          Busque por área de pesquisa, campus ou pesquisador no campo de busca baixo. Ou selecione um Campus ou Área de Pesquisa abaixo.
        </p>

        <div>
          {/* Barra de busca livre */}
          <div ref={searchRef} style={{ position: "relative" }}>
            <div className="bigsearch">
              <Search size={16} style={{ color: "var(--muted)", flexShrink: 0 }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => results && setOpen(true)}
                placeholder="Buscar campus, pesquisador ou área de pesquisa…"
              />
              <span className="kbd">↵</span>
            </div>

            {/* Dropdown de resultados — todos os tipos juntos */}
            {open && results && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "#fff", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "0 6px 24px rgba(0,0,0,.1)", zIndex: 100, overflow: "hidden", textAlign: "left" }}>
                {results.campuses.length > 0 && (
                  <>
                    <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--muted)", padding: "8px 14px 4px" }}>Campus</div>
                    {results.campuses.map((c) => (
                      <div key={c.id} onClick={() => { navigate(`/campus/${c.slug}`); setOpen(false); setQuery(""); }}
                        style={{ padding: "10px 14px", cursor: "pointer", fontSize: 13.5, display: "flex", alignItems: "center", gap: 10, borderTop: "1px solid var(--line2)" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#f3f4f6"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                        <Building2 size={15} style={{ color: "var(--accent)", flexShrink: 0 }} />
                        <span style={{ fontWeight: 600 }}>{c.nome}</span>
                      </div>
                    ))}
                  </>
                )}
                {results.pesquisadores.length > 0 && (
                  <>
                    <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--muted)", padding: "8px 14px 4px" }}>Pesquisadores</div>
                    {results.pesquisadores.map((r) => (
                      <div key={r.id} onClick={() => { navigate(`/pesquisador/${r.id}`); setOpen(false); setQuery(""); }}
                        style={{ padding: "10px 14px", cursor: "pointer", fontSize: 13.5, display: "flex", alignItems: "center", gap: 10, borderTop: "1px solid var(--line2)" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#f3f4f6"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                        <User size={15} style={{ color: "var(--muted)", flexShrink: 0 }} />
                        <span style={{ fontWeight: 600 }}>{r.nome.toLowerCase().split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}</span>
                        <span style={{ marginLeft: "auto", color: "var(--hint)", fontSize: 11.5, flexShrink: 0 }}>{r.campus}</span>
                      </div>
                    ))}
                  </>
                )}
                {results.areas?.length > 0 && (
                  <>
                    <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--muted)", padding: "8px 14px 4px" }}>Áreas de pesquisa</div>
                    {results.areas.map((a) => (
                      <div key={a.nome} onClick={() => { navigate(`/area/${encodeURIComponent(a.nome)}`); setOpen(false); setQuery(""); }}
                        style={{ padding: "10px 14px", cursor: "pointer", fontSize: 13.5, display: "flex", alignItems: "center", gap: 10, borderTop: "1px solid var(--line2)" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#f3f4f6"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                        <FlaskConical size={15} style={{ color: "var(--accent)", flexShrink: 0 }} />
                        <span style={{ fontWeight: 600 }}>{a.nome}</span>
                      </div>
                    ))}
                  </>
                )}
                {results.campuses.length === 0 && results.pesquisadores.length === 0 && (results.areas?.length ?? 0) === 0 && (
                  <div style={{ padding: "14px", color: "var(--muted)", fontSize: 13 }}>Nenhum resultado para "{query}"</div>
                )}
              </div>
            )}
          </div>

        </div>
      </section>

      {/* MÉTRICAS GLOBAIS */}
      <section className="sec" id="visao-geral">
        <h2 style={{ marginBottom: "24px" }}><span className="tag">Visão geral da Topologia da Rede de Colaboração</span></h2>
        <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          <StatCard label="Pesquisadores (nós)" value={fmt(stats.total_pesquisadores)}
            tooltip="Total de pesquisadores do IFG cadastrados na rede de colaboração." />
          <StatCard label="Colaborações (arestas)" value={fmt(stats.total_colaboracoes)}
            tooltip="Número de pares de pesquisadores que publicaram pelo menos um artigo juntos." />
          <StatCard label="Publicações" value={fmt(stats.total_publicacoes)}
            tooltip="Total de publicações científicas indexadas no sistema." />
          <StatCard label="Campus" value={fmt(stats.total_campi)}
            tooltip="Número de campus do IFG representados na rede." />
        </div>
      </section>

      {/* CARDS DE DESTAQUE */}
      <section className="sec" id="destaques">
        <h2 style={{ marginBottom: "24px" }}><span className="tag">Destaques</span></h2>
        <div className="grid g3">

          {topCampus && (
            <HCard
              ico={Building2} bg="#f3eefb" color="var(--accent)"
              label="Campus mais produtivo (por pesquisador)"
              value={campusName(topCampus.nome)}
              sub={`${(topCampus.total_publicacoes / topCampus.total_pesquisadores).toFixed(1)} pub/pesquisador · ${fmt(topCampus.total_publicacoes)} no total`}
              onClick={() => navigate(`/campus/${topCampus.slug}`)}
              tooltip="Mostra qual campus publica mais em proporção de pesquisador."
            />
          )}

          {topCampusRecente && (
            <HCard
              ico={Building2} bg="#f0fdf4" color="var(--green)"
              label="Campus mais produtivo recentemente"
              value={campusName(topCampusRecente.nome)}
              sub={`${(topCampusRecente.publicacoes_recentes / topCampusRecente.pesquisadores_ativos).toFixed(1)} pub/ativo nos últimos 3 anos`}
              onClick={() => navigate(`/campus/${topCampusRecente.slug}`)}
              tooltip="Mostra qual campus está mais ativo hoje, levando em conta só as publicações recentes."
            />
          )}

          {stats.area_extincao && (
            <HCard
              ico={TrendingDown} bg="#fef2f2" color="var(--red)"
              label="Área em risco de extinção"
              value={stats.area_extincao.area}
              sub={`−${stats.area_extincao.queda_pct}% · de ${fmt(stats.area_extincao.publicacoes_anteriores)} para ${fmt(stats.area_extincao.publicacoes_recentes)} pub. (últimos 5 anos)`}
              onClick={() => navigate(`/area/${encodeURIComponent(stats.area_extincao.area)}`)}
              tooltip="Área que mais reduziu publicações nos últimos 5 anos em relação ao período anterior."
            />
          )}

          {stats.par_areas_conectadas && (
            <HCard
              ico={Network} bg="#f3eefb" color="var(--accent)"
              label="Par de áreas mais conectadas"
              value={`${stats.par_areas_conectadas.area1} × ${stats.par_areas_conectadas.area2}`}
              sub={`${fmt(stats.par_areas_conectadas.coocorrencias)} publicações em comum`}
              onClick={() => navigate(`/area/${encodeURIComponent(stats.par_areas_conectadas.area1)}`)}
              tooltip="As duas áreas que mais colaboram em publicações."
            />
          )}

          {stats.par_campi_colaborativos && (
            <HCard
              ico={Building2} bg="#f0fdf4" color="var(--green)"
              label="Par de campus mais colaborativos"
              value={`${campusName(stats.par_campi_colaborativos.campus1)} × ${campusName(stats.par_campi_colaborativos.campus2)}`}
              sub={`${fmt(stats.par_campi_colaborativos.colaboracoes)} colaborações`}
              onClick={() => navigate(`/campus/${stats.par_campi_colaborativos.slug1}`)}
              tooltip="Os dois campus que mais publicaram artigos juntos."
            />
          )}

          {stats.area_mais_crescimento && (
            <HCard
              ico={TrendingUp} bg="#f0fdf4" color="var(--green)"
              label="Área com maior crescimento (5 anos)"
              value={stats.area_mais_crescimento.area}
              sub={`+${fmt(stats.area_mais_crescimento.crescimento)} pub. vs. período anterior`}
              onClick={() => navigate(`/area/${encodeURIComponent(stats.area_mais_crescimento.area)}`)}
              tooltip="Área que mais cresceu em publicações nos últimos 5 anos comparando com os 5 anos anteriores."
            />
          )}

        </div>
      </section>

      {/* REDE COMPLETA */}
      <section className="sec" id="rede">
        <h2 style={{ marginBottom: "24px" }}><span className="tag">Rede De Coautoria</span></h2>
        <div
          style={{ position: "relative", cursor: "pointer", borderRadius: 8, overflow: "hidden", lineHeight: 0 }}
          onClick={() => window.open("/rede_coautoria_IFG.html?v=2", "_blank")}
          onMouseEnter={() => setRedeHover(true)}
          onMouseLeave={() => setRedeHover(false)}
        >
          <img
            src="/rede_preview.png"
            alt="Rede de coautoria IFG"
            style={{
              width: "100%",
              height: 560,
              objectFit: "cover",
              objectPosition: "center",
              display: "block",
              filter: redeHover ? "blur(4px) brightness(0.7)" : "none",
              transition: "filter .3s ease",
            }}
          />
          <div style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: redeHover ? 1 : 0,
            transition: "opacity .3s ease",
            pointerEvents: "none",
          }}>
            <span style={{
              color: "#fff",
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: ".03em",
              textShadow: "0 2px 12px rgba(0,0,0,.5)",
              padding: "14px 28px",
              border: "2px solid rgba(255,255,255,.7)",
              borderRadius: 10,
              background: "rgba(0,0,0,.25)",
            }}>
              Visualizar a rede completa
            </span>
          </div>
        </div>
      </section>

      {/* EVOLUÇÃO DA REDE */}
      {evolucao.length > 0 && (
        <section className="sec" id="evolucao-rede">
          <h2 style={{ marginBottom: "24px" }}><span className="tag">Evolução da Rede de Coautoria -- Considerando apenas pesquisadores do IFG </span></h2>
          <NetworkEvolutionChart data={evolucao} />
        </section>
      )}

      {/* LISTA DE CAMPI */}
      <section className="sec" id="campus">
        <h2 style={{ marginBottom: "24px" }}><span className="tag">Perfil de Câmpus</span></h2>
        <div className="grid g3">
          {campuses.filter((c) => c.slug !== "externo").sort((a, b) => b.total_publicacoes - a.total_publicacoes).map((c) => (
            <div key={c.id}
              onClick={() => navigate(`/campus/${c.slug}`)}
              style={{ border: "1px solid var(--line2)", borderRadius: 9, padding: "12px 14px", cursor: "pointer", background: "#fff", transition: ".12s", boxShadow: "0 2px 10px rgba(0,0,0,.07)" }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--line2)"}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                {campusName(c.nome)}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{fmt(c.total_publicacoes)} publicações · {fmt(c.total_pesquisadores)} pesquisadores</div>
              {c.area_dominante && <div style={{ fontSize: 11, color: "var(--hint)", marginTop: 2 }}>{c.area_dominante}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* LISTA DE ÁREAS DE PESQUISA */}
      <section className="sec" id="areas">
        <h2 style={{ marginBottom: "24px" }}><span className="tag">Perfil de Áreas de Pesquisa do Instituto</span></h2>
        <div className="grid g3">
          {areas.sort((a, b) => b.total_publicacoes - a.total_publicacoes).map((a) => (
            <div key={a.nome}
              onClick={() => navigate(`/area/${encodeURIComponent(a.nome)}`)}
              style={{ border: "1px solid var(--line2)", borderRadius: 9, padding: "12px 14px", cursor: "pointer", background: "#fff", transition: ".12s", boxShadow: "0 2px 10px rgba(0,0,0,.07)" }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--line2)"}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                {a.nome}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{fmt(a.total_publicacoes)} publicações · {fmt(a.total_pesquisadores)} pesquisadores</div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
