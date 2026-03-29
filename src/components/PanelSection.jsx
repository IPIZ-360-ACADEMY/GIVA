export default function PanelSection({ title, className = "panel", children }) {
  return (
    <section className={className}>
      {title ? <h3>{title}</h3> : null}
      {children}
    </section>
  );
}
