import { useOutletContext } from "react-router-dom";
import { useMemo, useState } from "react";
import { matchesSearch } from "../utils/search.js";
import PageHeader from "../components/PageHeader.jsx";
import PanelSection from "../components/PanelSection.jsx";

const seedNotices = [
  { id: 1, titleKey: "notice1", prioridade: "high", lida: false },
  { id: 2, titleKey: "notice2", prioridade: "medium", lida: false },
  { id: 3, titleKey: "notice3", prioridade: "high", lida: true },
  { id: 4, titleKey: "notice4", prioridade: "high", lida: false }
];

function priorityLabel(priority, copy) {
  if (priority === "high") {
    return copy.high;
  }
  return copy.medium;
}

function noticeLabel(titleKey, t) {
  if (titleKey === "notice1") {
    return t("notifications.notice1");
  }
  if (titleKey === "notice2") {
    return t("notifications.notice2");
  }
  if (titleKey === "notice3") {
    return t("notifications.notice3");
  }
  return t("notifications.notice4");
}

export default function NotificationsPage() {
  const { query, showToast, t } = useOutletContext();
  const copy = {
    high: t("notifications.high"),
    medium: t("notifications.medium")
  };
  const [priority, setPriority] = useState("all");
  const [notices, setNotices] = useState(seedNotices);

  const filtered = useMemo(
    () =>
      notices.filter((n) => {
        const priorityOk = priority === "all" || n.prioridade === priority;
        const textOk = matchesSearch(query, `${noticeLabel(n.titleKey, t)} ${priorityLabel(n.prioridade, copy)}`);
        return priorityOk && textOk;
      }),
    [notices, priority, query]
  );

  function markAsRead(id) {
    setNotices((current) => current.map((notice) => (notice.id === id ? { ...notice, lida: true } : notice)));
    showToast(t("notifications.toast.read"));
  }

  return (
    <main className="page">
      <PageHeader
        title={t("notifications.title")}
        description={t("notifications.description")}
        meta={
          <span className="tag">
            <span className="material-icons-sharp">filter_list</span>
            <select value={priority} onChange={(event) => setPriority(event.target.value)}>
              <option value="all">{t("notifications.all")}</option>
              <option value="high">{t("notifications.high")}</option>
              <option value="medium">{t("notifications.medium")}</option>
            </select>
          </span>
        }
      />

      <PanelSection title={t("notifications.queue")}>
        <div className="list">
          {filtered.map((n) => (
            <div className="list-item" key={n.id}>
              <strong>{noticeLabel(n.titleKey, t)}</strong>
              <span className="meta">{t("notifications.priority")}: {priorityLabel(n.prioridade, copy)}</span>
              {!n.lida ? (
                <div className="form-actions">
                  <button className="btn ghost" type="button" onClick={() => markAsRead(n.id)}>
                    {t("notifications.markRead")}
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </PanelSection>
    </main>
  );
}
