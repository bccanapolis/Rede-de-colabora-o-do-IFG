import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Info } from "lucide-react";
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { getCampus, getCampusRede } from "../api";
import { titleCase, campusName } from "../utils";
import StatCard from "../components/StatCard";
import HealthTable from "../components/HealthTable";
import NetworkGraph from "../components/NetworkGraph";
import ResearcherRow from "../components/ResearcherRow";
import LoadingSpinner from "../components/LoadingSpinner";

const AREA_COLORS = ["#2d6cdf", "#3b8a4e", "#c08a14", "#6b46c1", "#c0392b", "#0891b2", "#be185d", "#b45309"];

function fmt(n) { return n != null ? n.toLocaleString("pt-BR") : "—"; }
function pct(v) { return v != null ? `${(v * 100).toFixed(1)}%` : "—"; }

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

export default function CampusProfile() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [rede, setRede] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([getCampus(slug), getCampusRede(slug)])
      .then(([d, r]) => { setData(d); setRede(r); })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <LoadingSpinner text="Carregando perfil do campus…" />;
  if (!data) return <div className="banner">Campus não encontrado.</div>;

  const displayName = campusName(data.nome);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, fontSize: 12, color: "var(--hint)" }}>
        <span style={{ cursor: "pointer", color: "var(--accent)" }} onClick={() => navigate("/")}>IFG</span>
        <span>›</span>
        <b style={{ color: "var(--muted)" }}>Perfil de Campus</b>
        <span>›</span>
        <span>{displayName}</span>
      </div>

      <h1 className="page">{displayName}</h1>
      <p className="page-sub">Cartão de saúde institucional · {data.nome}</p>

      {/* SEÇÃO 1 — IDENTIDADE */}
      <section className="sec" id="visao-geral">
        <h2 style={{ marginBottom: "24px" }}><span className="tag">Visão Geral do Câmpus</span></h2>
        <div className="grid g3">
          <StatCard label="Pesquisadores ativos" value={fmt(data.pesquisadores_ativos)} small={`/ ${fmt(data.total_pesquisadores)}`}
            tooltip="Pesquisadores do campus com ao menos uma publicação nos últimos 3 anos, em relação ao total de pesquisadores vinculados." />
          <StatCard label="Publicações (histórico)" value={fmt(data.total_publicacoes)}
            tooltip="Total de publicações científicas do campus registradas desde o início da coleta." />
          <StatCard label="Produção recente (3 anos)" value={fmt(data.publicacoes_recentes)}
            tooltip="Publicações do campus nos últimos 3 anos." />
        </div>
      </section>


      {/* SEÇÃO 3 — PERFIL TEMÁTICO */}
      <section className="sec" id="areas-pesquisa">
        <h2 style={{ marginBottom: "24px" }}><span className="tag">Áreas de pesquisa</span></h2>
        <div className="grid g2" style={{ gap: 32, marginTop: 12 }}>
          <div>
            <span style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 10 }}>
              <div className="chip">Ranking das publicações de cada áreas de pesquisa nesse câmpus (porcentagem)</div>
              <span className="hcard-info" style={{ position: "static", cursor: "help" }}>
                <Info size={13} strokeWidth={2} />
                <div className="hcard-tooltip" style={{ left: 0, right: "auto", top: 20, width: 220 }}>
                  % das publicações do campus em cada área.
                </div>
              </span>
            </span>
            {data.distribuicao_areas && data.distribuicao_areas.length > 0 ? (
              <div className="rowlist">
                {data.distribuicao_areas.map((a, i) => (
                  <div
                    key={a.area}
                    className="item"
                    style={{ cursor: "pointer" }}
                    onClick={() => navigate(`/area/${encodeURIComponent(a.area)}`)}
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
                    <span className="lnk">{a.area}</span>
                    <span style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 12 }}>
                      {a.pct}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="ph" style={{ height: 120 }}>Sem dados de área suficientes</div>
            )}
          </div>

          <div>
            <span style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 10 }}>
              <div className="chip">Ranking por pontuação do ifg produz (media)</div>
              <span className="hcard-info" style={{ position: "static", cursor: "help" }}>
                <Info size={13} strokeWidth={2} />
                <div className="hcard-tooltip" style={{ left: 0, right: "auto", top: 20, width: 260 }}>
                  Média da nota do IFG produz dos pesquisadores de cada área. Áreas com menos de 3 pesquisadores com nota
                  registrada não são exibidas.
                </div>
              </span>
            </span>
            {data.pontuacao_lattes_por_area && data.pontuacao_lattes_por_area.length > 0 ? (
              <div className="rowlist">
                {data.pontuacao_lattes_por_area.map((a, i) => (
                  <div
                    key={a.area}
                    className="item"
                    style={{ cursor: "pointer" }}
                    onClick={() => navigate(`/area/${encodeURIComponent(a.area)}`)}
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
                      <span className="lnk">{a.area}</span>
                      <div className="legend">{a.n_com_nota} de {a.n_total} pesquisadores com nota</div>
                    </span>
                    <span style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 12, whiteSpace: "nowrap" }}>
                      {a.media_nota} pts
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="ph" style={{ height: 120 }}>Sem áreas com pontuação suficiente</div>
            )}
          </div>
        </div>
      </section>

      {/* SEÇÃO 4 — POSIÇÃO NA REDE */}
      <section className="sec" id="intercampus">
        <h2 style={{ marginBottom: "24px" }}><span className="tag"> Rede de Colaborações intercampus</span></h2>
        <div className="grid g2">
          <div>
            {rede && (
              <NetworkGraph
                nodes={rede.nodes}
                edges={rede.edges}
                height={600}
                type="campus"
                onNodeClick={(nodeId) => {
                  const node = rede.nodes.find(n => n.id === nodeId);
                  if (node && node.slug && !node.selected) {
                    navigate(`/campus/${node.slug}`);
                  }
                }}
              />
            )}
          </div>
          <div>
            <div className="grid g2">
              <StatCard label="Colaborações intercampus" value={fmt(data.colaboracoes_intercampi)}
                tooltip="Total de coautorias entre pesquisadores deste campus e de outros câmpus do IFG." />
              <StatCard label="Pesquisadores-ponte" value={fmt(data.pesquisadores_ponte)}
                tooltip="Pesquisadores deste campus que colaboram com pesquisadores de 2 ou mais câmpus diferentes, conectando o campus ao restante da rede." />
            </div>
            {data.ranking_centralidade && (
              <div className="stat" style={{ marginTop: 10 }}>
                <div className="hcard-info">
                  <Info size={13} strokeWidth={2} />
                  <div className="hcard-tooltip">Posição do campus no ranking de colaborações intercampus, em relação aos demais câmpus do IFG.</div>
                </div>
                <div className="l">Centralidade do campus na rede institucional</div>
                <div className="v" style={{ fontSize: 16 }}>
                  {data.ranking_centralidade.nivel} <small>· {data.ranking_centralidade.rank}º de {data.ranking_centralidade.total}</small>
                </div>
              </div>
            )}
            {data.top_campi_parceiros && data.top_campi_parceiros.length > 0 && (
              <div style={{ marginTop: 12, fontSize: 12.5 }}>
                <b>Top campi parceiros</b>
                <div className="rowlist">
                  {data.top_campi_parceiros.slice(0, 5).map((p) => (
                    <div key={p.slug} className="item" style={{ cursor: "pointer" }} onClick={() => navigate(`/campus/${p.slug}`)}>
                      <span className="av" style={{ fontSize: 10 }}>
                        {campusName(p.campus).substring(0, 2).toUpperCase()}
                      </span>
                      <span className="lnk">
                        {campusName(p.campus)}
                      </span>
                      <span style={{ marginLeft: "auto", color: "var(--muted)" }}>{fmt(p.colaboracoes)} colab.</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SEÇÃO 5 — EVOLUÇÃO TEMPORAL */}
      <section className="sec" id="evolucao-temporal">
        <h2 style={{ marginBottom: "24px" }}><span className="tag">Evolução temporal de Publicações por Ano</span></h2>
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
        <div className="grid g3" style={{ marginTop: 12 }}>
          <StatCard
            label="Tendência (3 anos)"
            value={data.tendencia_classificacao || "Estável"}
            small={data.tendencia_producao != null ? `(${data.tendencia_producao > 0 ? "+" : ""}${data.tendencia_producao.toFixed(1)}%)` : ""}
            tooltip="Variação percentual média na produção científica do campus nos últimos 3 anos."
          />
          <StatCard label="Pico de produção" value={data.pico_producao || "—"}
            tooltip="Ano com o maior número de publicações registradas para este campus." />
          <StatCard label="Novos pesquisadores (2 anos)" value={fmt(data.novos_pesquisadores_recentes)}
            tooltip="Pesquisadores deste campus cuja primeira publicação registrada ocorreu nos últimos 2 anos." />
        </div>
      </section>

      {/* SEÇÃO 5B — ÁREAS DE PESQUISA EM DESTAQUE (E-I) */}
      <section className="sec" id="areas-destaque">
        <h2 style={{ marginBottom: "24px" }}>
          <span style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span className="tag">Análise de colaboração interno-externo</span>
            <span className="hcard-info" style={{ position: "static", cursor: "help" }}>
              <Info size={13} strokeWidth={2} />
              <div className="hcard-tooltip" style={{ left: 0, right: "auto", top: 22, width: 280 }}>
                Índice E-I por área de conhecimento, considerando as coautorias de
                pesquisadores deste campus (com colegas do mesmo campus ou de outros
                câmpus). Valores negativos (vermelho) indicam colaboração
                predominantemente dentro da própria área; valores positivos (verde)
                indicam maior abertura interdisciplinar.
              </div>
            </span>
          </span>
        </h2>
        {data.ei_por_area && data.ei_por_area.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(120, data.ei_por_area.length * 36)}>
            <BarChart
              data={data.ei_por_area}
              layout="vertical"
              margin={{ top: 4, right: 40, left: 8, bottom: 0 }}
            >
              <XAxis type="number" domain={[-1, 1]} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="area" width={150} tick={{ fontSize: 11.5 }} />
              <ReferenceLine x={0} stroke="var(--line)" />
              <Tooltip
                formatter={(v, name, props) => [
                  `${v} (${props.payload.n_pesquisadores} pesquisadores, ${props.payload.n_colaboracoes} colaborações)`,
                  "Índice E-I",
                ]}
              />
              <Bar dataKey="ei" radius={[3, 3, 3, 3]}>
                {data.ei_por_area.map((row) => (
                  <Cell key={row.area} fill={row.ei < 0 ? "var(--red)" : "var(--green)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="ph" style={{ height: 120 }}>Sem áreas com colaborações suficientes para calcular o E-I</div>
        )}
      </section>

      {/* SEÇÃO 6 — PESQUISADORES EM DESTAQUE */}
      <section className="sec" id="pesquisadores-destaque">
        <h2 style={{ marginBottom: "24px" }}><span className="tag">Pesquisadores em destaque</span></h2>
        <div className="grid g5">
          <div>
            <span style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 10 }}>
              <div className="chip">Número de Colaborações (Grau)</div>
              <span className="hcard-info" style={{ position: "static", cursor: "help" }}>
                <Info size={13} strokeWidth={2} />
                <div className="hcard-tooltip" style={{ left: 0, right: "auto", top: 20, width: 220 }}>
                  Quantas pessoas o pesquisador colaborou diretamente.
                </div>
              </span>
            </span>
            <div className="rowlist">
              {data.top_grau?.slice(0, 5).map((r) => (
                <ResearcherRow key={r.id} researcher={r} metricValue={r.grau} />
              ))}
            </div>
          </div>
          <div>
            <span style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 10 }}>
              <div className="chip">Conector entre Grupos (Intermediação)</div>
              <span className="hcard-info" style={{ position: "static", cursor: "help" }}>
                <Info size={13} strokeWidth={2} />
                <div className="hcard-tooltip" style={{ left: 0, right: "auto", top: 20, width: 220 }}>
                  Indica quem conecta diferentes grupos de pesquisadores.
                </div>
              </span>
            </span>
            <div className="rowlist">
              {data.top_intermediacao?.slice(0, 5).map((r) => (
                <ResearcherRow key={r.id} researcher={r} metricValue={r.betweenness?.toFixed(4)} />
              ))}
            </div>
          </div>
          <div>
            <span style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 10 }}>
              <div className="chip">Facilidade de Conexão (Proximidade)</div>
              <span className="hcard-info" style={{ position: "static", cursor: "help" }}>
                <Info size={13} strokeWidth={2} />
                <div className="hcard-tooltip" style={{ left: 0, right: "auto", top: 20, width: 220 }}>
                  Mostra quem consegue alcançar rapidamente os demais pesquisadores.
                </div>
              </span>
            </span>
            <div className="rowlist">
              {data.top_proximidade?.slice(0, 5).map((r) => (
                <ResearcherRow key={r.id} researcher={r} metricValue={r.closeness?.toFixed(4)} />
              ))}
            </div>
          </div>
          <div>
            <span style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 10 }}>
              <div className="chip">Prestígio Científico ou Relevância na Rede (Pagerank)</div>
              <span className="hcard-info" style={{ position: "static", cursor: "help" }}>
                <Info size={13} strokeWidth={2} />
                <div className="hcard-tooltip" style={{ left: 0, right: "auto", top: 20, width: 220 }}>
                    Mede a importância do nó pela influência das suas conexões.
                </div>
              </span>
            </span>
            <div className="rowlist">
              {data.top_pagerank?.slice(0, 5).map((r) => (
                <ResearcherRow key={r.id} researcher={r} metricValue={r.pagerank?.toFixed(4)} />
              ))}
            </div>
          </div>
          <div>
            <span style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 10 }}>
              <div className="chip">Ranking Nota IFG Produz</div>
              <span className="hcard-info" style={{ position: "static", cursor: "help" }}>
                <Info size={13} strokeWidth={2} />
                <div className="hcard-tooltip" style={{ left: 0, right: "auto", top: 20, width: 220 }}>
                  Ranking dos pesquisadores pela pontuação do IFG Produz.
                </div>
              </span>
            </span>
            <div className="rowlist">
              {data.top_nota_lattes?.slice(0, 5).map((r) => (
                <ResearcherRow key={r.id} researcher={r} metricValue={r.nota_lattes != null ? `${r.nota_lattes.toFixed(1)} pts` : "—"} />
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
