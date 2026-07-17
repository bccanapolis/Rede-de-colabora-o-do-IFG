import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { getPesquisador, getEgoGraph } from "../api";
import { titleCase, campusName } from "../utils";
import { Link2, Target, Globe, Star, Sprout, Compass, Building2, TrendingDown, User, Info } from "lucide-react";
import StatCard from "../components/StatCard";
import NetworkGraph from "../components/NetworkGraph";
import LoadingSpinner from "../components/LoadingSpinner";

function fmt(n) { return n != null ? n.toLocaleString("pt-BR") : "—"; }

function shortName(nome) {
  if (!nome) return "";
  const p = nome.split(" ").filter(Boolean);
  if (p.length <= 2) return titleCase(nome);
  return `${p[0].charAt(0).toUpperCase() + p[0].slice(1).toLowerCase()} ${p[p.length - 1].charAt(0).toUpperCase() + p[p.length - 1].slice(1).toLowerCase()}`;
}

function initials(nome) {
  if (!nome) return "?";
  const p = nome.split(" ").filter(Boolean);
  return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

const ROLE_ICONS = {
  conector: Link2, especialista: Target, embaixador: Globe, hub_tematico: Star,
  emergente: Sprout, solitario: Compass, veterano: Building2, declinio: TrendingDown, indefinido: User,
};

const ROLE_DESCRIPTIONS = {
  conector: "Alto betweenness · múltiplos campi → ponte estratégica",
  especialista: "Alto grau interno · poucas conexões externas → referência interna",
  embaixador: "Maioria de coautores fora do IFG → porta de parcerias externas",
  hub_tematico: "Alto eigenvector/PageRank na área → influência no tema",
  emergente: "Produção e centralidade crescendo → alto potencial",
  solitario: "Produz, mas pouco conectado → estimular colaboração",
  veterano: "Trajetória longa e consistente → mentoria",
  declinio: "Histórico relevante com queda → acompanhamento",
  indefinido: "Perfil ainda não classificado",
};

const NATUREZA_CFG = {
  "Artigo":              { color: "#1e40af", bg: "#dbeafe", label: "Artigo" },
  "Trabalho em Evento":  { color: "#6d28d9", bg: "#ede9fe", label: "Evento" },
  "Resumo de Trabalhos": { color: "#4338ca", bg: "#e0e7ff", label: "Resumo" },
  "Orientação":          { color: "#c2410c", bg: "#ffedd5", label: "Orientação" },
  "Banca":               { color: "#6b7280", bg: "#f3f4f6", label: "Banca" },
  "Producao Técnica":    { color: "#0f766e", bg: "#ccfbf1", label: "Prod. Técnica" },
  "Software":            { color: "#15803d", bg: "#dcfce7", label: "Software" },
  "Projeto de Pesquisa": { color: "#92400e", bg: "#fef3c7", label: "Projeto" },
};

const QUALIS_COLOR = {
  A1: "#166534", A2: "#15803d", A3: "#0891b2", A4: "#0369a1",
  B1: "#7c3aed", B2: "#7c3aed", B3: "#7c3aed", B4: "#7c3aed",
  C: "#9ca3af",
};

function naturezaLabel(nat) {
  return NATUREZA_CFG[nat]?.label ?? nat;
}

export default function ResearcherProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [ego, setEgo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [natFilter, setNatFilter] = useState("Artigo");

  useEffect(() => {
    setLoading(true);
    Promise.all([getPesquisador(id), getEgoGraph(id)])
      .then(([d, e]) => { setData(d); setEgo(e); })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingSpinner text="Carregando perfil do pesquisador…" />;
  if (!data) return <div className="banner">Pesquisador não encontrado.</div>;

  const displayName = shortName(data.nome);
  const atividade = data.atividade ?? (data.is_ativo ? "ativo" : "inativo");
  const ATIV_CFG = {
    ativo:              { pill: "g",  dot: "dg",  label: "Ativo" },
    parcialmente_ativo: { pill: "a",  dot: "da",  label: "Parcialmente ativo" },
    inativo:            { pill: "r",  dot: "dr",  label: "Inativo" },
  };
  const atividadeCfg = ATIV_CFG[atividade] ?? ATIV_CFG.inativo;

  const careerSpan = data.ultima_publicacao && data.primeira_publicacao
    ? data.ultima_publicacao - data.primeira_publicacao
    : null;

  const ALL_ROLES = Object.keys(ROLE_ICONS).filter(k => k !== "indefinido");

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, fontSize: 12, color: "var(--hint)" }}>
        <span style={{ cursor: "pointer", color: "var(--accent)" }} onClick={() => navigate("/")}>IFG</span>
        <span>›</span>
        <span style={{ cursor: "pointer", color: "var(--accent)" }} onClick={() => navigate(`/campus/${data.campus_slug}`)}>
          {campusName(data.campus_nome)}
        </span>
        <span>›</span>
        <b style={{ color: "var(--muted)" }}>{displayName}</b>
      </div>

      {/* SEÇÃO 1 — IDENTIDADE */}
      <section className="sec">
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
          <div className="av" style={{ width: 54, height: 54, fontSize: 18 }}>{initials(data.nome)}</div>
          <div>
            <h1 className="page" style={{ margin: 0 }}>{displayName}</h1>
            <p className="page-sub" style={{ margin: "2px 0 0" }}>
              Campus{" "}
              <span className="lnk" onClick={() => navigate(`/campus/${data.campus_slug}`)}>
                {campusName(data.campus_nome)}
              </span>
              {data.area_principal && ` · Área principal: ${data.area_principal}`}
            </p>
          </div>

          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <span style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span className={`pill ${atividadeCfg.pill}`}>
                <span className={`dot ${atividadeCfg.dot}`} />
                {atividadeCfg.label}
              </span>
              <span className="hcard-info" style={{ position: "static", cursor: "help" }}>
                <Info size={13} strokeWidth={2} />
                <div className="hcard-tooltip" style={{ right: 0, left: "auto", top: 22, width: 260 }}>
                  <div style={{ marginBottom: 6 }}>
                    <b>Ativo</b>: 5 ou mais publicações nos últimos 5 anos considerados na base (2020–2024).
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <b>Parcialmente ativo</b>: 1 a 4 publicações nesse mesmo período de 5 anos.
                  </div>
                  <div>
                    <b>Inativo</b>: nenhuma publicação nesse período de 5 anos.
                  </div>
                </div>
              </span>
            </span>
            <div className="legend">
              {atividade !== "inativo"
                ? `Publicou em ${data.ultima_publicacao}`
                : `Última pub.: ${data.ultima_publicacao || "—"}`}
            </div>
          </div>
        </div>

        {data.lattes?.resumo && (
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.65, margin: "10px 0 0", borderTop: "1px solid var(--line2)", paddingTop: 10 }}>
            {data.lattes.resumo}
          </p>
        )}
        {data.lattes?.link_curriculo && (
          <div style={{ marginTop: 8 }}>
            <a href={data.lattes.link_curriculo} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 12, color: "var(--accent)" }}>
              Ver currículo Lattes →
            </a>
          </div>
        )}

      </section>
      {/* SEÇÃO 2 — INDICADORES NUMÉRICOS */}
      <section className="sec" id="indicadores">
        <h2><span className="tag">Indicadores</span></h2>
        <div className="grid g4">
          <StatCard label="Publicações (histórico)" value={fmt(data.total_publicacoes)}
            tooltip="Total de publicações do pesquisador desde o início da coleta." />
          <StatCard label="Publicações (3 anos)" value={fmt(data.publicacoes_recentes)}
            tooltip="Publicações do pesquisador nos últimos 3 anos." />
          <StatCard label="Coautores únicos" value={fmt(data.coautores_unicos)}
            tooltip="Número de colaboradores distintos com quem o pesquisador já publicou." />
          <StatCard label="Campi colaborados" value={fmt(data.campi_colaborados)}
            tooltip="Número de câmpus diferentes de onde vêm os coautores deste pesquisador." />
          <StatCard label="Áreas de coautores" value={fmt(data.areas_distintas)}
            tooltip="Número de áreas de conhecimento distintas entre os coautores deste pesquisador." />
          <StatCard label="1ª publicação" value={data.primeira_publicacao || "—"}
            tooltip="Ano da primeira publicação registrada deste pesquisador." />
          <StatCard label="Última publicação" value={data.ultima_publicacao || "—"}
            tooltip="Ano da publicação mais recente registrada deste pesquisador." />
          <StatCard label="Anos de carreira" value={careerSpan != null ? `${careerSpan} anos` : "—"}
            tooltip="Intervalo entre a primeira e a última publicação registrada." />
        </div>

        <div className="grid g4" style={{ marginTop: 12 }}>
          <div className="stat">
            <div className="hcard-info"><Info size={13} strokeWidth={2} /><div className="hcard-tooltip">Proporção de coautores diretos em relação ao total de pesquisadores da rede.</div></div>
            <div className="l">Degree centrality</div><div className="v" style={{ fontSize: 16 }}>{data.degree_cent?.toFixed(4) || "—"}</div>
          </div>
          <div className="stat">
            <div className="hcard-info"><Info size={13} strokeWidth={2} /><div className="hcard-tooltip">Frequência com que o pesquisador aparece nos caminhos mais curtos entre outros pares de pesquisadores da rede — mede seu papel de ponte.</div></div>
            <div className="l">Betweenness</div><div className="v" style={{ fontSize: 16 }}>{data.betweenness?.toFixed(4) || "—"}</div>
          </div>
          <div className="stat">
            <div className="hcard-info"><Info size={13} strokeWidth={2} /><div className="hcard-tooltip">Quão rapidamente o pesquisador consegue alcançar todos os demais pesquisadores da rede através de coautorias.</div></div>
            <div className="l">Closeness</div><div className="v" style={{ fontSize: 16 }}>{data.closeness?.toFixed(4) || "—"}</div>
          </div>
          <div className="stat">
            <div className="hcard-info"><Info size={13} strokeWidth={2} /><div className="hcard-tooltip">Importância do pesquisador na rede, considerando não só o número, mas também a relevância de seus coautores.</div></div>
            <div className="l">PageRank</div><div className="v" style={{ fontSize: 16 }}>{data.pagerank?.toFixed(6) || "—"}</div>
          </div>
        </div>
      </section>

      {/* SEÇÃO 2.5 — QUALIDADE DA PRODUÇÃO (QUALIS) */}
      {data.lattes && (
        <section className="sec" id="qualidade-producao">
          <h2><span className="tag">Qualidade da produção</span></h2>

          <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600, marginBottom: 8 }}>Distribuição Qualis</div>
          <div className="grid g4">
            <StatCard label="Qualis A1" value={fmt(data.lattes.artigos_a1)} small="artigos"
              tooltip="Artigos publicados em periódicos do estrato A1 do Qualis CAPES — o mais alto nível de relevância científica." />
            <StatCard label="Qualis A2" value={fmt(data.lattes.artigos_a2)} small="artigos"
              tooltip="Artigos em periódicos A2 do Qualis CAPES. Alta relevância científica, logo abaixo do A1." />
            <StatCard label="Qualis A3" value={fmt(data.lattes.artigos_a3)} small="artigos"
              tooltip="Artigos em periódicos A3 do Qualis CAPES. Boa relevância científica reconhecida pela CAPES." />
            <StatCard label="Qualis A4" value={fmt(data.lattes.artigos_a4)} small="artigos"
              tooltip="Artigos em periódicos A4 do Qualis CAPES. Relevância científica média-alta." />
            <StatCard label="Qualis B (B1–B4)" value={fmt(data.lattes.artigos_b)} small="artigos"
              tooltip="Artigos nos estratos B1 a B4 do Qualis CAPES. Relevância científica média, agrupados por simplificação." />
            <StatCard label="Qualis C" value={fmt(data.lattes.artigos_c)} small="artigos"
              tooltip="Artigos em periódicos do estrato C do Qualis CAPES. Relevância científica mais limitada." />
            <StatCard label="Sem Qualis" value={fmt(data.lattes.artigos_sem_qualis)} small="artigos"
              tooltip="Artigos em periódicos ainda não classificados no sistema Qualis CAPES." />
          </div>

          <div style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600, margin: "18px 0 8px" }}>Pontuação Lattes</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
            <StatCard label="Titulação" value={(data.lattes.nota_titulacao ?? 0).toFixed(1)} small="pts"
              tooltip="Pontuação pela formação acadêmica do pesquisador: graduação, especialização, mestrado e doutorado." />
            <StatCard label="Produção científica" value={(data.lattes.nota_producao ?? 0).toFixed(1)} small="pts"
              tooltip="Pontuação pelos artigos publicados, trabalhos em eventos, livros e produções técnicas, ponderados pelo Qualis." />
            <StatCard label="Orientações" value={(data.lattes.nota_orientacao ?? 0).toFixed(1)} small="pts"
              tooltip="Pontuação pelas orientações concluídas: TCC, iniciação científica, dissertações de mestrado e teses de doutorado." />
            <StatCard label="Bancas" value={(data.lattes.nota_bancas ?? 0).toFixed(1)} small="pts"
              tooltip="Pontuação pela participação em bancas de avaliação de trabalhos acadêmicos." />
            <StatCard label="Total geral" value={(data.lattes.nota_total ?? 0).toFixed(1)} small="pts"
              tooltip="Nota consolidada que soma titulação, produção científica, orientações e bancas. Usada para comparar o desempenho acadêmico entre pesquisadores." />
          </div>
        </section>
      )}

      {/* SEÇÃO 2.6 — LISTA DE PRODUÇÕES */}
      {data.lattes?.producoes?.length > 0 && (() => {
        const natures = [...new Set(data.lattes.producoes.map(p => p.natureza))];
        const active = natures.includes(natFilter) ? natFilter : natures[0];
        const filtered = data.lattes.producoes.filter(p => p.natureza === active);
        const counts = Object.fromEntries(natures.map(n => [n, data.lattes.producoes.filter(p => p.natureza === n).length]));

        return (
          <section className="sec" id="producoes">
            <h2><span className="tag">Produções</span></h2>

            {/* Tabs por natureza */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
              {natures.map(nat => {
                const cfg = NATUREZA_CFG[nat] ?? { color: "#6b7280", bg: "#f3f4f6" };
                const isActive = nat === active;
                return (
                  <button
                    key={nat}
                    onClick={() => setNatFilter(nat)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 20,
                      border: `1.5px solid ${isActive ? cfg.color : "var(--line2)"}`,
                      background: isActive ? cfg.bg : "transparent",
                      color: isActive ? cfg.color : "var(--muted)",
                      fontSize: 12,
                      fontWeight: isActive ? 700 : 400,
                      cursor: "pointer",
                      transition: "all .15s",
                    }}
                  >
                    {naturezaLabel(nat)} <span style={{ opacity: 0.65 }}>({counts[nat]})</span>
                  </button>
                );
              })}
            </div>

            {/* Lista filtrada */}
            <div className="rowlist" style={{ maxHeight: 480, overflowY: "auto" }}>
              {filtered.map((p, i) => {
                const cfg = NATUREZA_CFG[p.natureza] ?? { color: "#6b7280", bg: "#f3f4f6" };
                const qColor = p.qualis ? (QUALIS_COLOR[p.qualis] ?? "#6b7280") : null;
                return (
                  <div key={i} className="item" style={{ alignItems: "flex-start", gap: 10 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 38, alignItems: "center", paddingTop: 2 }}>
                      {p.ano && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--hint)" }}>{p.ano}</span>
                      )}
                      {p.qualis && (
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          color: qColor, background: `${qColor}18`,
                          border: `1px solid ${qColor}44`,
                          borderRadius: 4, padding: "1px 5px",
                          whiteSpace: "nowrap",
                        }}>
                          {p.qualis}
                        </span>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {p.doi ? (
                        <a
                          href={p.doi}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 13, fontWeight: 500, color: "var(--accent)", textDecoration: "none", lineHeight: 1.4, display: "block" }}
                          onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                          onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
                        >
                          {p.titulo}
                        </a>
                      ) : (
                        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", lineHeight: 1.4, display: "block" }}>
                          {p.titulo}
                        </span>
                      )}
                      {p.venue && (
                        <span style={{ fontSize: 11.5, color: "var(--hint)", marginTop: 2, display: "block" }}>
                          {p.venue}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })()}

      {/* SEÇÃO 3 — REDE EGOCÊNTRICA */}
      <section className="sec" id="rede-coautoria">
        <h2><span className="tag">Rede de coautoria</span></h2>
        <div className="grid g2">
          <div>
            {ego && ego.nodes.length > 0 ? (
              <NetworkGraph
                nodes={ego.nodes}
                edges={ego.edges}
                height={640}
                type="ego"
                onNodeClick={(nodeId) => {
                  if (typeof nodeId === "number" && nodeId > 0 && nodeId !== parseInt(id))
                    navigate(`/pesquisador/${nodeId}`);
                }}
              />
            ) : (
              <div className="ph" style={{ height: 640 }}>Pesquisador sem colaborações registradas</div>
            )}
          </div>
          <div>
            <div style={{ fontSize: 12.5 }}>
              <b>Coautores ({data.coautores_frequentes?.length ?? 0})</b>
              <div className="rowlist" style={{ maxHeight: 560, overflowY: "auto" }}>
                {data.coautores_frequentes?.map((c, i) => (
                  <div key={c.id ?? `ext-${i}`} className="item"
                    style={{ cursor: c.externo ? "default" : "pointer" }}
                    onClick={() => !c.externo && navigate(`/pesquisador/${c.id}`)}>
                    <span className="av" style={c.externo ? { background: "#fdeceb", color: "var(--red)" } : {}}>
                      {initials(c.nome)}
                    </span>
                    <span>
                      <span className={c.externo ? undefined : "lnk"}>{shortName(c.nome)}</span>
                      <div className="legend">
                        {c.externo
                          ? <span style={{ color: "var(--red)", fontWeight: 600 }}>Externo</span>
                          : campusName(c.campus)}
                      </div>
                    </span>
                    <span style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 12 }}>×{c.coautorias}</span>
                  </div>
                ))}
                {(!data.coautores_frequentes || data.coautores_frequentes.length === 0) && (
                  <div style={{ fontSize: 12, color: "var(--hint)", padding: "8px 0" }}>Sem coautores registrados</div>
                )}
              </div>
            </div>
            {ego && (
              <div className="grid g4" style={{ marginTop: 12 }}>
                <StatCard label="Mesmo campus" value={fmt(ego.stats?.internos)}
                  tooltip="Coautores deste pesquisador que também são do mesmo campus." />
                <StatCard label="Outros campi" value={fmt(ego.stats?.externos)}
                  tooltip="Coautores deste pesquisador vinculados a outros câmpus do IFG." />
                <StatCard label="Externos IFG" value={fmt(ego.stats?.externos_ifg)}
                  tooltip="Coautores deste pesquisador que não são servidores do IFG." />
                <StatCard label="Campi IFG" value={fmt(ego.stats?.campi)}
                  tooltip="Número de câmpus do IFG distintos entre os coautores deste pesquisador." />
              </div>
            )}
          </div>
        </div>
        {ego?.nodes.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--hint)" }}>
            Legenda: <span style={{ color: "var(--green)", fontWeight: 600 }}>● Mesmo campus</span> &nbsp;
            <span style={{ color: "var(--amber)", fontWeight: 600 }}>● Outros campi IFG</span> &nbsp;
            <span style={{ color: "var(--red)", fontWeight: 600 }}>● Externo</span>
          </div>
        )}
      </section>

      {/* SEÇÃO 4 — TRAJETÓRIA TEMPORAL */}
      <section className="sec" id="evolucao-temporal">
        <h2><span className="tag">Evolução temporal</span></h2>
        {data.producao_anual && data.producao_anual.length > 0 ? (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.producao_anual} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [v, "Publicações"]} labelFormatter={(l) => `Ano ${l}`} />
              <Bar dataKey="count" fill="var(--accent)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="ph" style={{ height: 180 }}>Sem dados de produção anual</div>
        )}
      </section>
{/*
      {data.areas && data.areas.length > 0 && (
        <section className="sec">
          <h2><span className="tag">Áreas de pesquisa</span></h2>
          <div className="rowlist">
            {data.areas.slice(0, 8).map((a) => (
              <div key={a.area} className="item">
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{a.area}</div>
                  <div style={{ height: 6, background: "var(--line2)", borderRadius: 3, marginTop: 4 }}>
                    <div style={{
                      height: 6,
                      borderRadius: 3,
                      background: "var(--accent)",
                      width: `${Math.min(100, (a.count / data.areas[0].count) * 100)}%`,
                    }} />
                  </div>
                </div>
                <span style={{ color: "var(--muted)", fontSize: 12, marginLeft: 12, minWidth: 30, textAlign: "right" }}>{a.count}</span>
              </div>
            ))}
          </div>
        </section>
      )}
*/}
    </>
  );
}
