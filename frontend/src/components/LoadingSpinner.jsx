export default function LoadingSpinner({ text = "Carregando…" }) {
  return (
    <div style={{ textAlign: "center", padding: 40 }}>
      <div className="spinner" />
      <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 8 }}>{text}</p>
    </div>
  );
}
