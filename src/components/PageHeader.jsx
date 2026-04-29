export default function PageHeader({ title, description, meta }) {
  return (
    <section className="page-header">
      <h2>{title}</h2>
      <p>{description}</p>
      {meta ? <div className="header-meta">{meta}</div> : null}
    </section>
  );
}
