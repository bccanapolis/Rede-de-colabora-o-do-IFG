import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { getArea, getAreaCoocorrencia } from "../api";
import { campusName } from "../utils";
import { FlaskConical, TrendingUp, TrendingDown, Minus } from "lucide-react";
import StatCard from "../components/StatCard";
import NetworkGraph from "../components/NetworkGraph";
import LoadingSpinner from "../components/LoadingSpinner";

const CAMPUS_COLORS = ["#2d6cdf", "#3b8a4e", "#c08a14", "#6b46c1", "#c0392b", "#0891b2", "#be185d", "#b45309"];

const STATUS_CFG = {
  verde:   { bg: "#f0fdf4", border: "#bfe3c9", dot: "#3b8a4e", label: "Bom" },
  amarelo: { bg: "#fdf4e0", border: "#f0d79a", dot: "#c08a14", label: "Atenção" },
  vermelho:{ bg: "#fdeceb", border: "#f3c4bf", dot: "#c0392b", label: "Crítico" },
  cinza:   { bg: "#f5f5f6", border: "#e4e7eb", dot: "#9ca3af", label: "Sem dados" },
};

function HealthCard({ label, descricao, valor_fmt, status }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.cinza;
  const TrendIcon = status === "verde" ? TrendingUp : status === "vermelho" ? TrendingDown : Minus;
  return (
    <div style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 10, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 600 }}>{label}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: cfg.dot }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.dot, display: "inline-block" }} />
          {cfg.label}
        </span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6, color: cfg.dot }}>{valor_fmt}</div>
      <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.4 }}>{descricao}</div>
    </div>
  );
}

function fmt(n) { return n != null ? n.toLocaleString("pt-BR") : "—"; }

function shortName(nome) {
  if (!nome) return "";
  const p = nome.split(" ").filter(Boolean);
  if (p.length <= 2) return p.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
  return `${p[0].charAt(0).toUpperCase() + p[0].slice(1).toLowerCase()} ${p[p.length - 1].charAt(0).toUpperCase() + p[p.length - 1].slice(1).toLowerCase()}`;
}

function initials(nome) {
  if (!nome) return "?";
  const p = nome.split(" ").filter(Boolean);
  return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

export default function AreaProfile() {
  const { nome } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [cooc, setCooc] = useState(null);
  const [loading, setLoading] = useState(true);
  const areaNome = decodeURIComponent(nome);

  useEffect(() => {
    setLoading(true);
    Promise.all([getArea(areaNome), getAreaCoocorrencia(areaNome)])
      .then(([d, c]) => { setData(d); setCooc(c); })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [areaNome]);

  if (loading) return <LoadingSpinner text="Carregando área de pesquisa…" />;
  if (!data) return <div className="banner">Área não encontrada.</div>;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, fontSize: 12, color: "var(--hint)" }}>
        <span style={{ cursor: "pointer", color: "var(--accent)" }} onClick={() => navigate("/")}>IFG</span>
        <span>›</span>
        <b style={{ color: "var(--muted)" }}>Área de Pesquisa</b>
        <span>›</span>
        <span>{data.nome}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <div style={{ width: 42, height: 42, borderRadius: 10, background: "#f3eefb", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", flexShrink: 0 }}>
          <FlaskConical size={22} strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="page" style={{ margin: 0 }}>{data.nome}</h1>
          <p className="page-sub" style={{ margin: "2px 0 0" }}>Área de pesquisa · IFG</p>
        </div>
      </div>

      {/* SEÇÃO 1 — MÉTRICAS GERAIS */}
      <section className="sec" id="visao-geral">
        <h2 style={{ marginBottom: "24px" }}><span className="tag">Visão geral da Área de Pesquisa</span></h2>
        <div className="grid g4">
          <StatCard label="Publicações na área" value={fmt(data.total_publicacoes)}
            tooltip="Total de publicações classificadas nesta área de conhecimento." />
          <StatCard label="Pesquisadores" value={fmt(data.total_pesquisadores)}
            tooltip="Número de pesquisadores do IFG com esta área de conhecimento como área principal." />
          <StatCard label="Pesquisadores ativos" value={fmt(data.pesquisadores_ativos)}
            tooltip="Pesquisadores desta área com ao menos uma publicação recente." />
          <StatCard label="Campus com presença" value={fmt(data.total_campi)}
            tooltip="Número de câmpus do IFG com ao menos um pesquisador nesta área." />
        </div>
      </section>

      {/* SEÇÃO 2 — DISTRIBUIÇÃO POR CAMPUS + TOP PESQUISADORES */}
      <section className="sec" id="distribuicao">
        <div className="grid g2" style={{ gap: 32 }}>
          <div>
            <h2 style={{ marginBottom: "24px" }}><span className="tag">Ranking Dos Câmpus que mais Publicam nessa Área</span></h2>
            <div className="rowlist">
              {data.distribuicao_campi?.map((c, i) => (
                <div
                  key={c.campus_slug}
                  className="item"
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate(`/campus/${c.campus_slug}`)}
                >
                  <span
                    className="av"
                    style={{
                      fontSize: 10,
                      background: i === 0 ? "var(--accent)" : "#e9e5f8",
                      color: i === 0 ? "#fff" : "var(--accent)",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span>
                    <span className="lnk">{campusName(c.campus_nome)}</span>
                    <div className="legend">{fmt(c.pesquisadores)} pesquisadores</div>
                  </span>
                  <span style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 12 }}>
                    {fmt(c.publicacoes)} pub.
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h2 style={{ marginBottom: 12 }}><span className="tag">Ranking por Nota dos principais pesquisadores dessa Área</span></h2>
            <div className="rowlist">
              {data.top_pesquisadores?.map((r) => (
                <div
                  key={r.id}
                  className="item"
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate(`/pesquisador/${r.id}`)}
                >
                  <span className="av">{initials(r.nome)}</span>
                  <span>
                    <span className="lnk">{shortName(r.nome)}</span>
                    <div className="legend">
                      {campusName(r.campus_nome)}
                      {r.atividade === "parcialmente_ativo" && (
                        <span style={{ color: "var(--amber)", marginLeft: 6, fontWeight: 600 }}>Parc. ativo</span>
                      )}
                      {r.atividade === "inativo" && (
                        <span style={{ color: "var(--red)", marginLeft: 6, fontWeight: 600 }}>Inativo</span>
                      )}
                    </div>
                  </span>
                  <span style={{ marginLeft: "auto", textAlign: "right", fontSize: 12 }}>
                    {r.nota_lattes != null ? (
                      <span style={{ color: "var(--accent)", fontWeight: 700 }}>
                        {r.nota_lattes.toFixed(1)} <span style={{ fontWeight: 400, color: "var(--muted)" }}>pts</span>
                      </span>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>{fmt(r.publicacoes_na_area)} pub.</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO 2.5 — ANÁLISE POR CAMPUS */}
      {data.distribuicao_campi && data.distribuicao_campi.length > 0 && (
        <section className="sec" id="analise-campus">
          <h2 style={{ marginBottom: "24px" }}><span className="tag">Análise por campus</span></h2>
          <div className="grid g3">
            {data.distribuicao_campi.map((c) => {
              return (
                <div key={c.campus_slug} style={{ border: "1px solid var(--line2)", borderRadius: 10, padding: "14px 16px", background: "#fff", boxShadow: "0 1px 5px rgba(0,0,0,.05)" }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 12, cursor: "pointer" }}
                    onClick={() => navigate(`/campus/${c.campus_slug}`)}>
                    <span className="lnk">{campusName(c.campus_nome)}</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--muted)" }}>Pesquisadores</span>
                      <span>
                        <b style={{ color: "var(--green)" }}>{c.pesquisadores_ativos}</b>
                        <span style={{ color: "var(--hint)" }}> ativos / {c.pesquisadores} total</span>
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--muted)" }}>Pub. recentes (5 anos)</span>
                      <span>
                        <b>{c.publicacoes_recentes}</b>
                        <span style={{ color: "var(--hint)" }}> / {c.publicacoes} total</span>
                      </span>
                    </div>
                  </div>

                  {c.top_pesquisadores && c.top_pesquisadores.length > 0 && (
                    <div style={{ borderTop: "1px solid var(--line2)", marginTop: 10, paddingTop: 8 }}>
                      <div style={{ color: "var(--hint)", fontSize: 11.5, marginBottom: 5 }}>Maiores produtores</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {c.top_pesquisadores.map((p, idx) => (
                          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5 }}>
                            <span style={{
                              width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                              background: idx === 0 ? "var(--accent-light)" : "#eef0f3",
                              color: idx === 0 ? "var(--accent)" : "var(--muted)",
                              fontSize: 9.5, fontWeight: 700,
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                              {idx + 1}
                            </span>
                            <span className="lnk" style={{ cursor: "pointer", flex: 1 }}
                              onClick={(e) => { e.stopPropagation(); navigate(`/pesquisador/${p.id}`); }}>
                              {shortName(p.nome)}
                            </span>
                            <span style={{ color: "var(--hint)", whiteSpace: "nowrap" }}>{fmt(p.pubs)} pub.</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}


      {/* SEÇÃO 4 — EVOLUÇÃO TEMPORAL */}
      <section className="sec" id="evolucao-temporal">
        <h2 style={{ marginBottom: "24px" }}><span className="tag">Evolução temporal de Publicações por Ano dessa Área</span></h2>
        {data.producao_anual && data.producao_anual.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.producao_anual} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [v, "Publicações"]} labelFormatter={(l) => `Ano ${l}`} />
              <Bar dataKey="count" fill="var(--accent)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="ph" style={{ height: 200 }}>Sem dados de produção anual</div>
        )}
      </section>

      {/* SEÇÃO 5 — REDE DE COOCORRÊNCIA */}
      <section className="sec" id="coocorrencia">
        <h2 style={{ marginBottom: "24px" }}><span className="tag">Rede de coocorrência</span></h2>
        {cooc && cooc.nodes.length > 1 ? (
          <>
            <div className="grid g2">
              <div>
                <NetworkGraph
                  nodes={cooc.nodes}
                  edges={cooc.edges}
                  height={480}
                  type="area"
                  onNodeClick={(nodeId) => {
                    if (nodeId === 0) return;
                    const node = cooc.nodes.find((n) => n.id === nodeId);
                    if (node) navigate(`/area/${encodeURIComponent(node.label)}`);
                  }}
                />
                <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--hint)", display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <span><span style={{ color: "#2d6cdf", fontWeight: 700 }}>●</span> {areaNome}</span>
                  <span><span style={{ color: "#6b46c1", fontWeight: 700 }}>●</span> Relacionadas</span>
                  <span>Espessura = pub. em comum</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--muted)" }}>
                  {fmt(cooc.total_areas_relacionadas)} áreas relacionadas
                </div>
                <div className="rowlist" style={{ maxHeight: 460, overflowY: "auto" }}>
                  {cooc.nodes
                    .filter((n) => n.id !== 0)
                    .sort((a, b) => b.value - a.value)
                    .map((n, i) => (
                      <div
                        key={n.id}
                        className="item"
                        style={{ cursor: "pointer" }}
                        onClick={() => navigate(`/area/${encodeURIComponent(n.label)}`)}
                      >
                        <span className="av" style={{ fontSize: 10, background: "#e9e5f8", color: "var(--accent)" }}>
                          {i + 1}
                        </span>
                        <span className="lnk">{n.label}</span>
                        <span style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 12, whiteSpace: "nowrap" }}>
                          {fmt(n.value)} pub. em comum
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="ph" style={{ height: 200 }}>Sem coocorrências registradas</div>
        )}
      </section>
      
    </>
  );
}
