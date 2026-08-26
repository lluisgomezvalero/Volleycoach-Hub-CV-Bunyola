export default function PlaceholderPage({ title, text }) {
  return (
    <section className="page-card module-placeholder">
      <p className="eyebrow">Migración React</p>
      <h1>{title}</h1>
      <p>{text}</p>
      <div className="placeholder-note">Este módulo todavía usa únicamente la nueva navegación. Se migrará después de validar Login, Inicio y Perfil.</div>
    </section>
  );
}
