import { Info } from "lucide-react";

export default function StatCard({ label, value, small, tooltip }) {
  return (
    <div className="stat">
      {tooltip && (
        <div className="hcard-info">
          <Info size={13} strokeWidth={2} />
          <div className="hcard-tooltip">{tooltip}</div>
        </div>
      )}
      <div className="l">{label}</div>
      <div className="v">
        {value}
        {small && <small> {small}</small>}
      </div>
    </div>
  );
}
