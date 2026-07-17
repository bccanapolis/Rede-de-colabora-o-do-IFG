const STATUS_MAP = {
  verde: { cls: "g", dot: "dg", label: "Verde" },
  amarelo: { cls: "a", dot: "da", label: "Amarelo" },
  vermelho: { cls: "r", dot: "dr", label: "Vermelho" },
  cinza: { cls: "", dot: "", label: "—" },
};

function formatValue(key, val) {
  if (val === null || val === undefined) return "—";
  if (key === "tendencia_producao") return `${val > 0 ? "+" : ""}${val.toFixed(1)}%`;
  if (key === "taxa_colaboracao" || key === "taxa_ativos") return (val * 100).toFixed(0) + "%";
  if (key === "abertura_externa") return val.toFixed(2);
  if (key === "risco_concentracao") return (val * 100).toFixed(0) + "%";
  if (key === "diversidade_tematica") return String(val);
  return String(val);
}

export default function HealthTable({ health }) {
  if (!health) return null;
  return (
    <table className="health">
      <thead>
        <tr>
          <th>Indicador</th>
          <th>O que mede</th>
          <th style={{ width: 100 }}>Valor</th>
          <th style={{ width: 100 }}>Status</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(health).map(([key, item]) => {
          const s = STATUS_MAP[item.status] || STATUS_MAP.cinza;
          return (
            <tr key={key}>
              <td>{item.label}</td>
              <td style={{ color: "var(--muted)", fontSize: 12 }}>{item.descricao}</td>
              <td style={{ fontWeight: 600 }}>{formatValue(key, item.valor)}</td>
              <td>
                {s.cls ? (
                  <span className={`pill ${s.cls}`}>
                    <span className={`dot ${s.dot}`} />
                    {s.label}
                  </span>
                ) : (
                  <span style={{ color: "var(--hint)", fontSize: 12 }}>—</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
