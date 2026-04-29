import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * TopProgressBar — barra de progresso estilo GitHub/YouTube.
 * Inicia quando o Suspense começa a carregar (location muda)
 * e termina quando o componente da página monta.
 *
 * Não usa nenhuma biblioteca externa — pura CSS + useEffect.
 */
let _resolveLoad = null;

/** Exportado para páginas chamarem quando terminam de carregar os seus dados. */
export function finishPageLoad() {
  _resolveLoad?.();
}

export default function TopProgressBar() {
  const location = useLocation();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const rafRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  // Simula progresso até ~85%, depois espera finishPageLoad ou timeout
  function startProgress() {
    setVisible(true);
    setProgress(0);
    startTimeRef.current = performance.now();

    let p = 0;
    function tick() {
      const elapsed = performance.now() - startTimeRef.current;
      // Curva: rápido no início, abranda a partir de 70%
      if (p < 70) p += 1.8;
      else if (p < 85) p += 0.4;
      setProgress(Math.min(p, 85));
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  function completeProgress() {
    cancelAnimationFrame(rafRef.current);
    setProgress(100);
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 320);
  }

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    clearTimeout(timerRef.current);
    startProgress();

    // Timeout de segurança: se a página demorar >4s, completa de qualquer forma
    const safetyTimer = setTimeout(completeProgress, 4000);

    // Promise que pode ser resolvida pelas páginas via finishPageLoad()
    new Promise((resolve) => { _resolveLoad = resolve; })
      .then(() => {
        clearTimeout(safetyTimer);
        completeProgress();
      });

    return () => {
      clearTimeout(safetyTimer);
      cancelAnimationFrame(rafRef.current);
      clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  if (!visible) return null;

  return (
    <div
      className="top-progress-bar"
      role="progressbar"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="A carregar página"
      style={{ "--prog": `${progress}%` }}
    />
  );
}
