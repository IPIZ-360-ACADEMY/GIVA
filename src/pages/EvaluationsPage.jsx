import { useOutletContext } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { matchesSearch } from "../utils/search.js";
import PageHeader from "../components/PageHeader.jsx";
import PanelSection from "../components/PanelSection.jsx";
import DataTable from "../components/DataTable.jsx";
import { canUseEvaluationsApi, createEvaluation, listEvaluations } from "../services/evaluationsService.js";

export default function EvaluationsPage() {
  const { query, showToast, t } = useOutletContext();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ aluno: "", curso: "TI", nota: "" });

  useEffect(() => {
    let active = true;

    async function loadItems() {
      if (!canUseEvaluationsApi()) {
        if (active) {
          setItems([]);
        }
        return;
      }

      try {
        const remote = await listEvaluations();
        if (!active) {
          return;
        }
        setItems(remote);
      } catch {
        if (active) {
          setItems([]);
          showToast("Falha ao carregar avaliações na base remota.", "error");
        }
      }
    }

    loadItems();

    return () => {
      active = false;
    };
  }, [showToast]);

  const filtered = useMemo(
    () => items.filter((item) => matchesSearch(query, `${item.aluno} ${item.curso} ${item.nota}`)),
    [items, query]
  );

  const columns = [
    { key: "aluno", label: t("common.student") },
    { key: "curso", label: t("common.course") },
    { key: "nota", label: t("evaluations.grade") }
  ];

  async function submitEvaluation(event) {
    event.preventDefault();
    if (!form.aluno.trim() || !form.nota.trim()) {
      showToast(t("evaluations.toast.required"), "error");
      return;
    }

    if (!canUseEvaluationsApi()) {
      showToast("Supabase não configurado para avaliações.", "error");
      return;
    }

    try {
      const created = await createEvaluation(form);
      setItems((current) => [created, ...current]);
      setForm({ aluno: "", curso: "TI", nota: "" });
      showToast(t("evaluations.toast.saved"));
    } catch {
      showToast("Falha ao guardar avaliação na base remota.", "error");
    }
  }

  return (
    <main className="page page-evaluations">
      <PageHeader title={t("evaluations.title")} description={t("evaluations.description")} />

      <PanelSection className="form-card" title={t("evaluations.launch")}>
        <form onSubmit={submitEvaluation}>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="ev-aluno">{t("common.student")}</label>
              <input id="ev-aluno" value={form.aluno} onChange={(event) => setForm((f) => ({ ...f, aluno: event.target.value }))} />
            </div>
            <div className="form-field">
              <label htmlFor="ev-curso">{t("common.course")}</label>
              <select id="ev-curso" value={form.curso} onChange={(event) => setForm((f) => ({ ...f, curso: event.target.value }))}>
                <option>TI</option>
                <option>EIE</option>
                <option>TLQB</option>
                <option>Mecanica</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="ev-nota">{t("evaluations.grade")}</label>
              <input id="ev-nota" value={form.nota} onChange={(event) => setForm((f) => ({ ...f, nota: event.target.value }))} />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn primary" type="submit">{t("evaluations.register")}</button>
          </div>
        </form>
      </PanelSection>

      <PanelSection title={t("evaluations.recent")}>
        <DataTable columns={columns} rows={filtered} />
      </PanelSection>
    </main>
  );
}
