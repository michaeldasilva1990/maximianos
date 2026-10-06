(() => {
  "use strict";

  const AIRPORTS = window.MAXIMIANOS_AIRPORTS || [];
  const POPULAR_BR = ["GRU", "GIG", "BSB", "CNF", "SSA", "REC", "FOR", "POA"];
  const POPULAR_INTL = ["LIS", "MIA", "MCO", "JFK", "EZE", "SCL", "MAD", "CDG"];
  const MAX_RESULTS = 12;

  const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const byIata = new Map(AIRPORTS.map((a) => [a.iata, a]));

  const index = AIRPORTS.map((a, order) => {
    const e = { a, order, city: norm(a.city), iata: a.iata.toLowerCase(), airport: norm(a.airport), country: norm(a.country), alias: norm(a.aliases) };
    e.key = `${e.city} ${e.iata} ${e.airport} ${e.country} ${e.alias}`;
    return e;
  });

  const wordStart = (text, t) => ` ${text}`.includes(` ${t}`);

  function score(e, tokens, full) {
    for (const t of tokens) if (!e.key.includes(t)) return -1;
    const t0 = tokens[0];
    let s = 20;
    if (e.iata === full) s = 100;
    else if (e.city === full) s = 95;
    else if (e.city.startsWith(full)) s = 85;
    else if (tokens.length > 1) s = e.city.includes(full) || e.alias.includes(full) ? 75 : e.airport.includes(full) ? 45 : 30;
    else if (wordStart(e.city, t0) || wordStart(e.alias, t0)) s = 70;
    else if (tokens.length === 1 && e.iata.startsWith(t0)) s = 65;
    else if (e.city.includes(t0)) s = 50;
    else if (wordStart(e.airport, t0)) s = 35;
    else if (e.country.startsWith(t0)) s = 25;
    if (e.a.popular) s += 3;
    if (e.a.region === "Brasil") s += 1;
    return s;
  }

  // Busca sem acentos, em qualquer parte: cidade, código IATA, nome do aeroporto, país ou apelidos.
  function search(query, limit = MAX_RESULTS) {
    const full = norm(query);
    if (!full) return [];
    const tokens = full.split(/\s+/);
    const hits = index
      .map((e) => ({ e, s: score(e, tokens, full) }))
      .filter((x) => x.s >= 0)
      .sort((x, y) => y.s - x.s || x.e.order - y.e.order);
    const floor = hits.length && hits[0].s >= 50 ? 40 : 0; // descarta ruído quando há bons resultados
    return hits.filter((x) => x.s >= floor).slice(0, limit).map((x) => x.e.a);
  }

  function highlight(parent, text, query) {
    const t = norm(text);
    const tokens = norm(query).split(/\s+/).filter(Boolean).sort((a, b) => b.length - a.length);
    const hit = tokens.map((tok) => ({ tok, i: t.indexOf(tok) })).find((x) => x.i >= 0);
    if (!hit) { parent.textContent = text; return; }
    parent.append(text.slice(0, hit.i));
    const mark = document.createElement("mark");
    mark.textContent = text.slice(hit.i, hit.i + hit.tok.length);
    parent.append(mark, text.slice(hit.i + hit.tok.length));
  }

  const planeSvg = () => {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", "M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z");
    svg.appendChild(path);
    return svg;
  };

  function attach(input, opts = {}) {
    const requiresHotel = opts.requiresHotel || (() => false);
    const list = document.createElement("div");
    list.className = "ap-list";
    list.id = `${input.id}-listbox`;
    list.setAttribute("role", "listbox");
    list.hidden = true;
    document.body.appendChild(list);

    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", list.id);
    input.setAttribute("autocomplete", "off");
    input.setAttribute("autocapitalize", "off");
    input.setAttribute("spellcheck", "false");

    let rows = [];      // aeroportos selecionáveis, na ordem em que aparecem
    let active = -1;
    let typed = false;  // o usuário digitou desde que o campo recebeu foco?

    const isOpen = () => !list.hidden;

    function position() {
      const box = (input.closest(".input-wrap") || input).getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(Math.max(box.width, 400), vw - 16);
      const left = Math.min(Math.max(8, box.left), vw - width - 8);
      const below = vh - box.bottom - 14;
      const above = box.top - 14;
      list.style.width = `${width}px`;
      list.style.left = `${left}px`;
      if (below >= 280 || below >= above) {
        list.style.top = `${box.bottom + 6}px`;
        list.style.bottom = "auto";
        list.style.maxHeight = `${Math.max(180, Math.min(420, below))}px`;
      } else {
        list.style.bottom = `${vh - box.top + 6}px`;
        list.style.top = "auto";
        list.style.maxHeight = `${Math.max(180, Math.min(420, above))}px`;
      }
    }

    function setActive(i, scroll = true) {
      const items = list.querySelectorAll(".ap-item:not(.is-disabled)");
      items.forEach((el, n) => el.classList.toggle("is-active", n === i));
      active = i;
      const el = items[i];
      input.setAttribute("aria-activedescendant", el ? el.id : "");
      if (el && scroll) el.scrollIntoView({ block: "nearest" });
    }

    function section(title) {
      const h = document.createElement("div");
      h.className = "ap-section";
      h.setAttribute("role", "presentation");
      h.textContent = title;
      list.appendChild(h);
    }

    function item(a, query, disabled) {
      const el = document.createElement("div");
      el.className = "ap-item" + (disabled ? " is-disabled" : "");
      el.setAttribute("role", "option");
      if (disabled) el.setAttribute("aria-disabled", "true");
      el.id = `${input.id}-opt-${a.iata}`;
      const ico = document.createElement("span");
      ico.className = "ap-ico";
      ico.appendChild(planeSvg());
      const main = document.createElement("span");
      main.className = "ap-main";
      const city = document.createElement("span");
      city.className = "ap-city";
      highlight(city, a.city, query);
      const sub = document.createElement("span");
      sub.className = "ap-sub";
      highlight(sub, a.airport, query);
      sub.append(` · ${a.country}`);
      main.append(city, sub);
      const code = document.createElement("span");
      code.className = disabled ? "ap-tag" : "ap-code";
      code.textContent = disabled ? "Só voos" : a.iata;
      el.append(ico, main, code);
      if (!disabled) {
        el.addEventListener("mousemove", () => { const n = rows.indexOf(a); if (n !== active) setActive(n, false); });
        el.addEventListener("click", () => choose(a));
      }
      return el;
    }

    function render() {
      const current = AIRPORTS.some((a) => a.value === input.value);
      const query = typed || !current ? input.value : "";
      const hotelOnly = requiresHotel();
      list.textContent = "";
      rows = [];
      const q = norm(query);

      if (!q) {
        const pick = (codes) => codes.map((c) => byIata.get(c)).filter(Boolean);
        [["Brasil · mais buscados", pick(POPULAR_BR)], ["Internacional · mais buscados", pick(POPULAR_INTL)]].forEach(([title, group]) => {
          const ok = group.filter((a) => !hotelOnly || a.hotelId);
          if (!ok.length) return;
          section(title);
          ok.forEach((a) => { rows.push(a); list.appendChild(item(a, "", false)); });
        });
        const hint = document.createElement("div");
        hint.className = "ap-hint";
        hint.textContent = hotelOnly
          ? "Digite uma cidade ou hotel. Hotéis estão disponíveis nos destinos com parceiro ativo."
          : `Digite cidade, aeroporto ou código IATA · ${AIRPORTS.length} aeroportos`;
        list.appendChild(hint);
        if (hotelOnly && !rows.length) { list.removeChild(list.lastChild); empty(query); }
      } else {
        const found = search(query);
        const usable = hotelOnly ? found.filter((a) => a.hotelId) : found;
        const blocked = hotelOnly ? found.filter((a) => !a.hotelId) : [];
        if (!found.length) empty(query);
        else {
          if (usable.length) { section(`${usable.length} ${usable.length === 1 ? "resultado" : "resultados"}`); usable.forEach((a) => { rows.push(a); list.appendChild(item(a, query, false)); }); }
          if (blocked.length) { section("Sem hotéis neste destino"); blocked.forEach((a) => list.appendChild(item(a, query, true))); }
        }
      }
      setActive(rows.length && q ? 0 : -1);
    }

    function empty(query) {
      const e = document.createElement("div");
      e.className = "ap-empty";
      const strong = document.createElement("strong");
      strong.textContent = query ? `Nenhum resultado para “${query}”` : "Nenhum destino disponível";
      const span = document.createElement("span");
      span.textContent = "Tente o nome da cidade, do aeroporto ou o código de 3 letras (ex.: GRU).";
      e.append(strong, span);
      list.appendChild(e);
    }

    function open() {
      render();
      position();
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }
    function close() {
      list.hidden = true;
      input.setAttribute("aria-expanded", "false");
      input.setAttribute("aria-activedescendant", "");
    }
    function choose(a) {
      input.value = a.value;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      close();
      if (opts.onSelect) opts.onSelect(a);
    }

    input.addEventListener("focus", () => { typed = false; input.select(); open(); });
    input.addEventListener("click", () => { if (!isOpen()) open(); });
    input.addEventListener("input", () => { typed = true; open(); });
    input.addEventListener("blur", close);
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!isOpen()) { open(); return; }
        if (!rows.length) return;
        const next = e.key === "ArrowDown" ? (active + 1) % rows.length : (active - 1 + rows.length) % rows.length;
        setActive(next);
      } else if (e.key === "Enter" && isOpen() && active >= 0 && rows[active]) {
        e.preventDefault();
        choose(rows[active]);
      } else if (e.key === "Escape" && isOpen()) {
        e.preventDefault();
        close();
      } else if (e.key === "Tab" && isOpen() && typed && active >= 0 && rows[active] && !AIRPORTS.some((a) => a.value === input.value)) {
        choose(rows[active]); // Tab confirma a melhor sugestão
      }
    });
    list.addEventListener("mousedown", (e) => e.preventDefault()); // mantém o foco no campo
    window.addEventListener("resize", () => { if (isOpen()) position(); });
    window.addEventListener("scroll", () => { if (isOpen()) position(); }, true);
  }

  window.MaximianosAirports = { attach, search, norm, all: AIRPORTS };
})();
