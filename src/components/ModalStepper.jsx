import { useState } from "react";
import { createPortal } from "react-dom";

/**
 * ModalStepper - Modal multi-etapas para fluxos de registro profissionais.
 * Props:
 *  steps: [{ label, content }]
 *  onClose: () => void
 *  onFinish: (finalData) => void
 *  initialData: objeto opcional para preencher o formulário
 *  t: função de tradução
 */
export default function ModalStepper({ steps, onClose, onFinish, initialData = {}, t }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialData);
  const [errors, setErrors] = useState({});
  const totalSteps = steps.length;

  function handleNext() {
    if (steps[step].validate) {
      const err = steps[step].validate(form);
      setErrors(err || {});
      if (err && Object.keys(err).length > 0) return;
    }
    setStep((s) => Math.min(s + 1, totalSteps - 1));
  }

  function handlePrev() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function handleChange(partial) {
    setForm((f) => ({ ...f, ...partial }));
    setErrors({});
  }

  function handleFinish() {
    if (steps[step].validate) {
      const err = steps[step].validate(form);
      setErrors(err || {});
      if (err && Object.keys(err).length > 0) return;
    }
    onFinish(form);
    onClose();
  }

  return createPortal(
    <div className="pmodal-layer" role="presentation">
      <div className="pmodal-overlay" onClick={onClose} aria-hidden="true" />
      <div className="pmodal stepper" role="dialog" aria-modal="true">
        <div className="stepper-header">
          {steps.map((s, idx) => (
            <div key={s.label} className={`stepper-step${idx === step ? " active" : ""}${idx < step ? " done" : ""}`}>
              <span className="stepper-index">{idx + 1}</span>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
        <div className="stepper-content">
          {steps[step].content({ form, onChange: handleChange, errors, t })}
        </div>
        <div className="stepper-footer">
          <button type="button" className="btn" onClick={onClose}>{t ? t("actions.cancel") : "Cancelar"}</button>
          {step > 0 && (
            <button type="button" className="btn" onClick={handlePrev}>{t ? t("actions.back") : "Voltar"}</button>
          )}
          {step < totalSteps - 1 && (
            <button type="button" className="btn primary" onClick={handleNext}>{t ? t("actions.next") : "Próximo"}</button>
          )}
          {step === totalSteps - 1 && (
            <button type="button" className="btn primary" onClick={handleFinish}>{t ? t("actions.finish") : "Finalizar"}</button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
