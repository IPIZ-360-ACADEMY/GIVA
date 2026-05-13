import { useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { resolveAccessProfile } from "../utils/accessControl.js";
import { canUsePetitionApi, createStudentPetition } from "../services/petitionService.js";

const petitionTypes = [
  {
    id: "estagio-profissional",
    icon: "work",
    label: "Carta de Estágio Profissional",
  },
  {
    id: "estagio-curricular",
    icon: "school",
    label: "Carta de Estágio Curricular",
  },
  {
    id: "recomendacao",
    icon: "star",
    label: "Carta de Recomendação",
  },
  {
    id: "emprego",
    icon: "person",
    label: "Carta de Emprego",
  },
];

const menuCards = [
  {
    id: "nova-peticao",
    icon: "post_add",
    title: "Nova Petição",
    description: "Solicite uma nova carta",
  },
  {
    id: "minhas-peticoes",
    icon: "folder_shared",
    title: "Minhas Petições",
    description: "Visualize suas petições",
  },
  {
    id: "modelos-cartas",
    icon: "article",
    title: "Modelos de Cartas",
    description: "Veja os modelos disponíveis",
  },
];

const initialFormState = {
  type: petitionTypes[0].id,
  fullName: "",
  email: "",
  course: "",
  targetArea: "",
  startDate: "",
  endDate: "",
  purpose: "",
};

export default function PedidosPage() {
  const { showToast, t } = useOutletContext();
  const { authProfile, userProfile, user } = useAuth();
  const navigate = useNavigate();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [formState, setFormState] = useState(initialFormState);

  const { isStudentUser } = useMemo(
    () => resolveAccessProfile({ role: authProfile?.role, type: userProfile?.type || authProfile?.type }),
    [authProfile?.role, authProfile?.type, userProfile?.type]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultFullName = userProfile?.display_name || authProfile?.displayName || "";
  const defaultEmail = user?.email || authProfile?.email || "";

  useEffect(() => {
    setFormState((prevState) => ({
      ...prevState,
      fullName: prevState.fullName || defaultFullName,
      email: prevState.email || defaultEmail,
    }));
  }, [defaultFullName, defaultEmail]);

  useEffect(() => {
    if (authProfile && !isStudentUser) {
      navigate("/", { replace: true });
    }
  }, [authProfile, isStudentUser, navigate]);

  const handleCardClick = (id) => {
    if (id === "nova-peticao") {
      setShowCreateForm(true);
      setShowTemplates(false);
      return;
    }

    if (id === "minhas-peticoes") {
      showToast("Visualização das suas petições disponível em breve", "info");
      return;
    }

    if (id === "modelos-cartas") {
      setShowTemplates(true);
      setShowCreateForm(false);
      return;
    }
  };

  const handleFieldChange = (key, value) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!canUsePetitionApi()) {
      showToast("O serviço de pedidos não está disponível no momento.", "error");
      return;
    }

    setIsSubmitting(true);

    try {
      await createStudentPetition({
        requesterId: user?.id ?? authProfile?.id ?? userProfile?.id,
        type: formState.type,
        fullName: formState.fullName,
        email: formState.email,
        course: formState.course,
        targetArea: formState.targetArea,
        startDate: formState.startDate,
        endDate: formState.endDate,
        purpose: formState.purpose,
      });

      showToast("Petição enviada com sucesso!", "success");
      setShowCreateForm(false);
      setFormState(initialFormState);
    } catch (error) {
      console.error("Falha ao criar petição:", error);
      const detail = error?.message || "Erro ao enviar a petição";
      showToast(detail, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setShowCreateForm(false);
    setShowTemplates(false);
  };

  const getTemplatePreview = (typeId) => {
    const templates = {
      "estagio-profissional": (
        <div className="template-letter">
          <div className="template-header">
            <p><strong>Instituto Politécnico de Portalegre</strong></p>
            <p>Escola Superior de Tecnologia e Gestão</p>
            <p>Portalegre, [DATA ATUAL]</p>
          </div>
          <div className="template-body">
            <p><strong>Carta de Estágio Profissional</strong></p>
            <br />
            <p>Ao responsável pela entidade [NOME DA ENTIDADE],</p>
            <br />
            <p>Venho por este meio certificar que [NOME DO ALUNO], estudante do curso de [CURSO], número [NÚMERO], se encontra inscrito no [ANO] ano do curso de [CURSO] da Escola Superior de Tecnologia e Gestão do Instituto Politécnico de Portalegre.</p>
            <br />
            <p>O aluno manifesta o interesse em realizar um estágio profissional na área de [ÁREA PRETENDIDA], com início previsto para [DATA INÍCIO] e término em [DATA FIM].</p>
            <br />
            <p>Para os devidos efeitos, solicita-se a emissão da respetiva carta de estágio profissional.</p>
            <br />
            <p>Atenciosamente,</p>
            <br />
            <p>[COORDENADOR DO CURSO]</p>
            <p>Coordenador do Curso de [CURSO]</p>
          </div>
        </div>
      ),
      "estagio-curricular": (
        <div className="template-letter">
          <div className="template-header">
            <p><strong>Instituto Politécnico de Portalegre</strong></p>
            <p>Escola Superior de Tecnologia e Gestão</p>
            <p>Portalegre, [DATA ATUAL]</p>
          </div>
          <div className="template-body">
            <p><strong>Carta de Estágio Curricular</strong></p>
            <br />
            <p>Ao responsável pela entidade [NOME DA ENTIDADE],</p>
            <br />
            <p>Venho por este meio certificar que [NOME DO ALUNO], estudante do curso de [CURSO], número [NÚMERO], se encontra inscrito no [ANO] ano do curso de [CURSO] da Escola Superior de Tecnologia e Gestão do Instituto Politécnico de Portalegre.</p>
            <br />
            <p>O aluno necessita de realizar um estágio curricular obrigatório no âmbito do seu plano curricular, na área de [ÁREA PRETENDIDA], com duração prevista de [DURAÇÃO] meses, com início em [DATA INÍCIO] e término em [DATA FIM].</p>
            <br />
            <p>Para os devidos efeitos, solicita-se a emissão da respetiva carta de estágio curricular.</p>
            <br />
            <p>Atenciosamente,</p>
            <br />
            <p>[COORDENADOR DO CURSO]</p>
            <p>Coordenador do Curso de [CURSO]</p>
          </div>
        </div>
      ),
      "recomendacao": (
        <div className="template-letter">
          <div className="template-header">
            <p><strong>Instituto Politécnico de Portalegre</strong></p>
            <p>Escola Superior de Tecnologia e Gestão</p>
            <p>Portalegre, [DATA ATUAL]</p>
          </div>
          <div className="template-body">
            <p><strong>Carta de Recomendação</strong></p>
            <br />
            <p>Ao responsável pela entidade [NOME DA ENTIDADE],</p>
            <br />
            <p>Venho por este meio recomendar [NOME DO ALUNO], estudante do curso de [CURSO], número [NÚMERO], da Escola Superior de Tecnologia e Gestão do Instituto Politécnico de Portalegre.</p>
            <br />
            <p>O aluno demonstrou excelentes capacidades na área de [ÁREA PRETENDIDA], destacando-se pelo seu desempenho académico e profissional.</p>
            <br />
            <p>Para os devidos efeitos, solicita-se a emissão da respetiva carta de recomendação.</p>
            <br />
            <p>Atenciosamente,</p>
            <br />
            <p>[COORDENADOR DO CURSO]</p>
            <p>Coordenador do Curso de [CURSO]</p>
          </div>
        </div>
      ),
      "emprego": (
        <div className="template-letter">
          <div className="template-header">
            <p><strong>Instituto Politécnico de Portalegre</strong></p>
            <p>Escola Superior de Tecnologia e Gestão</p>
            <p>Portalegre, [DATA ATUAL]</p>
          </div>
          <div className="template-body">
            <p><strong>Carta de Emprego</strong></p>
            <br />
            <p>Ao responsável pela entidade [NOME DA ENTIDADE],</p>
            <br />
            <p>Venho por este meio certificar que [NOME DO ALUNO], estudante do curso de [CURSO], número [NÚMERO], se encontra inscrito no [ANO] ano do curso de [CURSO] da Escola Superior de Tecnologia e Gestão do Instituto Politécnico de Portalegre.</p>
            <br />
            <p>O aluno manifesta o interesse em candidatar-se a uma oportunidade de emprego na área de [ÁREA PRETENDIDA].</p>
            <br />
            <p>Para os devidos efeitos, solicita-se a emissão da respetiva carta de emprego.</p>
            <br />
            <p>Atenciosamente,</p>
            <br />
            <p>[COORDENADOR DO CURSO]</p>
            <p>Coordenador do Curso de [CURSO]</p>
          </div>
        </div>
      ),
    };

    return templates[typeId] || <p>Modelo não disponível</p>;
  };

  return (
    <main className="page page-pedidos">
      <section className="pedidos-hero">
        <div className="pedidos-hero-copy">
          <span className="pedidos-hero-label">Carta</span>
          <h1>
            {showCreateForm ? "Nova Petição de Carta" : showTemplates ? "Modelos de Cartas" : "Petição de Cartas"}
          </h1>
          <p>
            {showCreateForm
              ? "Preencha os dados abaixo para gerar a sua carta."
              : showTemplates
              ? "Veja os modelos de cartas disponíveis para referência."
              : "Solicite cartas de forma simples e rápida."}
          </p>
        </div>
        <div className="pedidos-hero-grid">
          {menuCards.map((card) => (
            <button
              key={card.id}
              type="button"
              className="pedidos-card"
              onClick={() => handleCardClick(card.id)}
            >
              <div className="pedidos-card-icon">
                <span className="material-icons-sharp">{card.icon}</span>
              </div>
              <div className="pedidos-card-copy">
                <h2>{card.title}</h2>
                <p>{card.description}</p>
              </div>
              <div className="pedidos-card-action">
                <span className="material-icons-sharp">arrow_forward</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {showCreateForm && (
        <section className="pedidos-form">
          <div className="pedidos-create-card">
            <div className="pedidos-form-header">
              <div>
                <span className="pedidos-hero-label">Nova Petição</span>
                <h2>Escolha o tipo de carta e preencha os dados.</h2>
              </div>
              <button type="button" className="btn ghost" onClick={handleCancel}>
                Voltar
              </button>
            </div>

            <div className="petition-type-grid">
              {petitionTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  className={`petition-type-card${formState.type === type.id ? " --active" : ""}`}
                  onClick={() => handleFieldChange("type", type.id)}
                >
                  <div className="petition-type-icon">
                    <span className="material-icons-sharp">{type.icon}</span>
                  </div>
                  <div className="petition-type-copy">
                    <h3>{type.label}</h3>
                  </div>
                  <div className="petition-type-radio">
                    <span className="material-icons-sharp">{formState.type === type.id ? "radio_button_checked" : "radio_button_unchecked"}</span>
                  </div>
                </button>
              ))}
            </div>

            <form className="form-grid pedidos-request-form" onSubmit={handleSubmit}>
              <div className="form-field">
                <label htmlFor="petition-fullname">Nome completo</label>
                <input
                  id="petition-fullname"
                  type="text"
                  placeholder="Digite o nome completo"
                  value={formState.fullName}
                  onChange={(event) => handleFieldChange("fullName", event.target.value)}
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="petition-email">E-mail</label>
                <input
                  id="petition-email"
                  type="email"
                  placeholder="Digite o e-mail"
                  value={formState.email}
                  onChange={(event) => handleFieldChange("email", event.target.value)}
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="petition-course">Curso / Área de Formação</label>
                <input
                  id="petition-course"
                  type="text"
                  placeholder="Ex.: Engenharia Informática"
                  value={formState.course}
                  onChange={(event) => handleFieldChange("course", event.target.value)}
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="petition-target-area">Área Pretendida</label>
                <input
                  id="petition-target-area"
                  type="text"
                  placeholder="Ex.: Desenvolvimento de Software"
                  value={formState.targetArea}
                  onChange={(event) => handleFieldChange("targetArea", event.target.value)}
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="petition-start-date">Data de Início do Estágio</label>
                <input
                  id="petition-start-date"
                  type="date"
                  value={formState.startDate}
                  onChange={(event) => handleFieldChange("startDate", event.target.value)}
                />
              </div>

              <div className="form-field">
                <label htmlFor="petition-end-date">Data de Fim do Estágio</label>
                <input
                  id="petition-end-date"
                  type="date"
                  value={formState.endDate}
                  onChange={(event) => handleFieldChange("endDate", event.target.value)}
                />
              </div>

              <div className="form-field pedidos-full-width">
                <label htmlFor="petition-purpose">Finalidade da Carta</label>
                <textarea
                  id="petition-purpose"
                  rows="4"
                  placeholder="Explique a finalidade da carta..."
                  value={formState.purpose}
                  onChange={(event) => handleFieldChange("purpose", event.target.value)}
                  maxLength={500}
                  required
                />
              </div>

              <div className="pedidos-form-actions pedidos-full-width">
                <button
                  type="submit"
                  className="btn primary"
                  disabled={
                    isSubmitting ||
                    !formState.fullName ||
                    !formState.email ||
                    !formState.course ||
                    !formState.targetArea ||
                    !formState.purpose
                  }
                >
                  {isSubmitting ? "Enviando..." : "Enviar Petição"}
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      {showTemplates && (
        <section className="pedidos-templates">
          <div className="pedidos-templates-header">
            <div>
              <span className="pedidos-hero-label">Modelos</span>
              <h2>Modelos de Cartas Disponíveis</h2>
              <p>Estes são os modelos de cartas que podem ser gerados através do sistema.</p>
            </div>
            <button type="button" className="btn ghost" onClick={handleCancel}>
              Voltar
            </button>
          </div>

          <div className="templates-grid">
            {petitionTypes.map((type) => (
              <div key={type.id} className="template-card">
                <div className="template-card-header">
                  <div className="template-card-icon">
                    <span className="material-icons-sharp">{type.icon}</span>
                  </div>
                  <h3>{type.label}</h3>
                </div>
                <div className="template-card-content">
                  <div className="template-preview">
                    {getTemplatePreview(type.id)}
                  </div>
                </div>
                <div className="template-card-actions">
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => {
                      setFormState(prev => ({ ...prev, type: type.id }));
                      setShowTemplates(false);
                      setShowCreateForm(true);
                    }}
                  >
                    Usar Modelo
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {!showCreateForm && !showTemplates && (
        <section className="pedidos-footer">
          <div className="pedidos-footer-illustration">
            <span className="material-icons-sharp">mail_outline</span>
          </div>
          <div className="pedidos-footer-copy">
            <h2>Solicite suas cartas de forma fácil e segura.</h2>
            <p>Escolha uma das opções acima para começar.</p>
          </div>
        </section>
      )}
    </main>
  );
}
