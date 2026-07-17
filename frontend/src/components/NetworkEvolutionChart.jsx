import { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const SERIES = [
  { key: "n_nos", label: "Crescimento de Pesquisadores", color: "#2d6cdf", axis: "left", fmt: (v) => v.toLocaleString("pt-BR") },
  { key: "n_arestas", label: "Crescimento de Publicações", color: "#c08a14", axis: "left", fmt: (v) => v.toLocaleString("pt-BR") },
  { key: "fracao_lcc", label: "Maior Grupo Conectado na Rede", color: "#3b8a4e", axis: "right", fmt: (v) => `${Number(v).toFixed(1)}%` },
  { key: "densidade", label: "Densidade da Rede", color: "#6b46c1", axis: "densidade", fmt: (v) => Number(v).toFixed(5) },
];

const WINDOWS = [
  { value: "todos", label: "Todos os anos" },
  { value: "5", label: "Últimos 5 anos" },
  { value: "10", label: "Últimos 10 anos" },
];

function CustomTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0].payload;
  return (
    <div style={{
      background: "#fff", border: "1px solid var(--line2)", borderRadius: 8,
      padding: "8px 10px", fontSize: 11.5, color: "var(--muted)", lineHeight: 1.6,
      boxShadow: "0 6px 24px rgba(0,0,0,.1)",
    }}>
      <div style={{ color: "var(--ink)", fontWeight: 700, fontSize: 12, marginBottom: 2 }}>{row.ano}</div>
      {SERIES.map((s) => (
        <div key={s.key} style={{ color: s.color }}>{s.label}: <b>{s.fmt(row[s.key] ?? 0)}</b></div>
      ))}
    </div>
  );
}

export default function NetworkEvolutionChart({ data }) {
  const [visible, setVisible] = useState({ n_nos: true, n_arestas: true, fracao_lcc: true, densidade: true });
  const [janela, setJanela] = useState("todos");

  const sorted = useMemo(
    () => [...(data || [])].sort((a, b) => a.ano - b.ano),
    [data]
  );

  const minAno = sorted.length ? sorted[0].ano : 0;
  const maxAno = sorted.length ? sorted[sorted.length - 1].ano : 0;
  const [anoFim, setAnoFim] = useState(null);
  const fim = anoFim ?? maxAno;

  const winSize = janela === "todos" ? null : parseInt(janela, 10);
  const sliderMin = winSize ? Math.min(maxAno, minAno + winSize - 1) : minAno;
  const chartData = useMemo(() => {
    if (!winSize) return sorted;
    return sorted.filter((d) => d.ano > fim - winSize && d.ano <= fim);
  }, [sorted, winSize, fim]);

  if (!sorted.length) return null;

  const toggle = (key) => setVisible((v) => ({ ...v, [key]: !v[key] }));

  return (
    <div style={{
      background: "#fff", border: "1px solid var(--line2)", borderRadius: 11,
      padding: "16px 18px", marginTop: 16, color: "var(--muted)",
      boxShadow: "0 2px 10px rgba(0,0,0,.07)",
    }}>
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 14 }}>
        Rede cumulativa de coautoria interna do IFG, ano a ano: crescimento do número de pesquisadores
        e publicações, fração de pesquisadores no maior grupo conectado da rede (LCC) e densidade.
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {SERIES.map((s) => {
            const active = visible[s.key];
            return (
              <button
                key={s.key}
                onClick={() => toggle(s.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  border: `1px solid ${active ? s.color : "var(--line2)"}`,
                  background: active ? `${s.color}18` : "#f7f8fa",
                  color: active ? s.color : "var(--hint)",
                  borderRadius: 999, padding: "5px 12px", fontSize: 12, fontWeight: 600,
                  cursor: "pointer", transition: ".12s",
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: active ? s.color : "var(--line2)" }} />
                {s.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>Janela</span>
          <select
            value={janela}
            onChange={(e) => { setJanela(e.target.value); setAnoFim(null); }}
            style={{
              background: "#fff", color: "var(--ink)", border: "1px solid var(--line2)",
              borderRadius: 6, fontSize: 11, padding: "4px 8px", cursor: "pointer",
            }}
          >
            {WINDOWS.map((w) => (
              <option key={w.value} value={w.value}>{w.label}</option>
            ))}
          </select>
        </div>
      </div>

      {winSize && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <input
            type="range"
            min={sliderMin}
            max={maxAno}
            value={fim}
            onChange={(e) => setAnoFim(parseInt(e.target.value, 10))}
            style={{ flex: 1, accentColor: "var(--accent)" }}
          />
          <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>até {fim}</span>
        </div>
      )}

      <div style={{ width: "100%", height: 340 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -4 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--line2)" />
            <XAxis dataKey="ano" tick={{ fill: "var(--muted)", fontSize: 10.5 }} stroke="var(--line2)" tickLine={false} />
            <YAxis
              yAxisId="left"
              tick={{ fill: "var(--muted)", fontSize: 10.5 }}
              stroke="var(--line2)"
              tickLine={false}
              width={44}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: "#3b8a4e", fontSize: 10.5 }}
              stroke="var(--line2)"
              tickLine={false}
              width={42}
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis yAxisId="densidade" hide domain={["auto", "auto"]} />
            <Tooltip content={<CustomTooltip />} />
            {visible.n_nos && (
              <Line yAxisId="left" type="monotone" dataKey="n_nos" stroke="#2d6cdf" strokeWidth={2} dot={false} />
            )}
            {visible.n_arestas && (
              <Line yAxisId="left" type="monotone" dataKey="n_arestas" stroke="#c08a14" strokeWidth={2} dot={false} />
            )}
            {visible.fracao_lcc && (
              <Line yAxisId="right" type="monotone" dataKey="fracao_lcc" stroke="#3b8a4e" strokeWidth={2} dot={false} />
            )}
            {visible.densidade && (
              <Line yAxisId="densidade" type="monotone" dataKey="densidade" stroke="#6b46c1" strokeWidth={2} dot={false} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <details style={{ marginTop: 16, fontSize: 11.5 }}>
        <summary style={{ cursor: "pointer", color: "var(--ink)", fontWeight: 600, fontSize: 12 }}>
          Como interpretar
        </summary>

        <div style={{ display: "grid", gap: 5, margin: "10px 0 12px" }}>
          {SERIES.map((s) => (
            <div key={s.key} style={{ display: "flex", gap: 7, alignItems: "baseline" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, flexShrink: 0, alignSelf: "center" }} />
              <span>
                <b style={{ color: "var(--ink)" }}>{s.label}:</b>{" "}
                {s.key === "n_nos" && "quantos pesquisadores do IFG já têm ao menos uma colaboração interna registrada até aquele ano."}
                {s.key === "n_arestas" && "quantos pares distintos de pesquisadores já colaboraram entre si até aquele ano (arestas da rede)."}
                {s.key === "fracao_lcc" && "% dos pesquisadores conectados que pertencem ao mesmo grupo, o maior bloco de colaboração da rede (LCC)."}
                {s.key === "densidade" && "quão perto a rede está de ter todo mundo colaborando com todo mundo (1 = todos conectados entre si)."}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <div style={{
            background: "var(--accent-light)", border: "1px solid #c9d8f7",
            borderRadius: 6, padding: "8px 10px", lineHeight: 1.6, color: "#274690",
          }}>
            <b>Pesquisadores × Publicações:</b> quando as duas linhas sobem juntas, a rede está crescendo
            por novos pesquisadores entrando. Quando Publicações sobe mais rápido que Pesquisadores, os
            mesmos pesquisadores estão colaborando com mais frequência entre si.
          </div>
          <div style={{
            border: "1px solid var(--green-border)", background: "var(--green-bg)",
            borderRadius: 6, padding: "8px 10px", lineHeight: 1.6, color: "var(--ink)",
          }}>
            <b style={{ color: "var(--green)" }}>Integração:</b> se o maior grupo conectado <b>sobe</b> mais
            rápido do que pesquisadores e publicações, isso indica que grupos antes isolados estão se unindo
            ao núcleo principal da rede, e não apenas formando novos grupos separados.
          </div>
          <div style={{
            border: "1px solid var(--amber-border)", background: "var(--amber-bg)",
            borderRadius: 6, padding: "8px 10px", lineHeight: 1.6, color: "var(--ink)",
          }}>
            <b style={{ color: "var(--amber)" }}>Densidade:</b> tende a cair conforme a rede cresce (mais
            pesquisadores possíveis de conectar), mesmo com o número de colaborações aumentando — é o padrão
            típico de redes de coautoria científica de grande escala, e não um sinal de enfraquecimento.
          </div>
        </div>
      </details>
    </div>
  );
}
