export default function PanelSection({ title, actions = null, className = "panel", children }) {
  return (
    <section className={className}>
      {title || actions ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          {title ? <h3 style={{ marginBottom: 0 }}>{title}</h3> : <span />}
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}
