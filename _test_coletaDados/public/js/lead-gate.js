(() => {
  "use strict";

  // Se o front-end ficar em outro domínio, defina antes deste script:
  // <script>window.MAXIMIANOS_API_BASE = "https://api.seudominio.com";</script>
  const API = window.MAXIMIANOS_API_BASE || "";
  const KEY = "maximianos_lead_v1";

  const modal = document.querySelector("#lead-modal");
  const form = document.querySelector("#lead-form");
  const emailInput = document.querySelector("#lead-email");
  const phoneInput = document.querySelector("#lead-phone");
  const consentInput = document.querySelector("#lead-consent");
  const formError = document.querySelector("#lead-form-error");
  const submitBtn = document.querySelector("#lead-submit");

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function getLead() { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } }
  function setLead(lead) { try { localStorage.setItem(KEY, JSON.stringify(lead)); } catch { /* modo privado */ } }

  function fieldError(name, message) {
    const el = document.querySelector(`[data-error-for="${name}"]`);
    if (el) el.textContent = message || "";
  }

  function openModal() {
    modal.hidden = false;
    document.body.classList.add("lead-open");
    emailInput.focus();
  }
  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove("lead-open");
  }

  // Mantém o foco dentro do modal (ele é obrigatório, não fecha com ESC).
  modal.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const items = [...modal.querySelectorAll("input, button")].filter((el) => !el.disabled);
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    const phoneDigits = phoneInput.value.replace(/\D/g, "");
    let ok = true;

    fieldError("email", ""); fieldError("phone", ""); fieldError("consent", ""); formError.textContent = "";

    if (!email && !phoneDigits) { formError.textContent = "Informe seu e-mail e/ou telefone para continuar."; ok = false; }
    if (email && !EMAIL_RE.test(email)) { fieldError("email", "E-mail inválido."); ok = false; }
    if (phoneDigits && (phoneDigits.length < 10 || phoneDigits.length > 15)) { fieldError("phone", "Informe o DDD + número."); ok = false; }
    if (!consentInput.checked) { fieldError("consent", "É necessário concordar para continuar."); ok = false; }
    if (!ok) return;

    const params = new URLSearchParams(location.search);
    const utm = {};
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach((k) => { if (params.get(k)) utm[k] = params.get(k); });

    submitBtn.disabled = true;
    submitBtn.textContent = "Enviando...";
    try {
      const res = await fetch(`${API}/api/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email || undefined,
          phone: phoneDigits ? phoneInput.value.trim() : undefined,
          consent: true,
          utm,
          referrer: document.referrer || undefined,
          landingPath: location.pathname + location.search
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.leadId) throw new Error(data.error || "Falha ao salvar");
      setLead({ leadId: data.leadId });
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: "lead_captured" });
      closeModal();
    } catch (err) {
      formError.textContent = "Não foi possível enviar agora. Verifique os dados e tente novamente.";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Continuar";
    }
  });

  // API usada pelo app.js: registra a pesquisa antes do redirecionamento.
  window.MaximianosAPI = {
    logSearch(payload) {
      const lead = getLead();
      if (!lead?.leadId) return;
      const body = JSON.stringify({ ...payload, leadId: lead.leadId });
      const url = `${API}/api/searches`;
      // sendBeacon/keepalive sobrevivem à navegação para o site do parceiro.
      try {
        if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: "application/json" }))) return;
      } catch { /* cai no fetch */ }
      fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    }
  };

  if (!getLead()?.leadId) openModal();
})();
