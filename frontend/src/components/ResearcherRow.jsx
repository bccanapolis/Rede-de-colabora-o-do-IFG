import { useNavigate } from "react-router-dom";
import { titleCase } from "../utils";

function initials(nome) {
  const parts = nome.split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function shortName(nome) {
  const parts = nome.split(" ").filter(Boolean);
  if (parts.length <= 2) return titleCase(nome);
  return `${parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase()} ${parts[parts.length - 1].charAt(0).toUpperCase() + parts[parts.length - 1].slice(1).toLowerCase()}`;
}

export default function ResearcherRow({ researcher, metricLabel, metricValue, badge }) {
  const navigate = useNavigate();
  return (
    <div className="item" style={{ cursor: "pointer" }} onClick={() => navigate(`/pesquisador/${researcher.id}`)}>
      <span className="av">{initials(researcher.nome)}</span>
      <span className="lnk">{shortName(researcher.nome)}</span>
      {badge && <span style={{ marginLeft: "auto", color: badge.color || "var(--muted)", fontSize: 12 }}>{badge.label}</span>}
      {metricValue !== undefined && !badge && (
        <span style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 12 }}>{metricValue}</span>
      )}
    </div>
  );
}
