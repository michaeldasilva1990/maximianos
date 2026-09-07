(() => {
  "use strict";

  const BASE = "https://www.comprarviagem.com.br/maximianos";
  const STORAGE_KEY = "maximianos_recent_searches_v3";
  const form = document.querySelector("#flight-search");
  if (!form) return;

  const widget = document.querySelector(".booking-widget");
  const originInput = document.querySelector("#origin");
  const destinationInput = document.querySelector("#destination");
  const departureInput = document.querySelector("#departure-date");
  const returnInput = document.querySelector("#return-date");
  const departureLabel = document.querySelector("#departure-date-label");
  const returnLabel = document.querySelector("#return-date-label");
  const returnField = document.querySelector(".return-field");
  const directOnlyInput = document.querySelector("#direct-only");
  const differentLocationInput = document.querySelector("#car-different-location");
  const passengerTrigger = document.querySelector(".passenger-trigger");
  const passengerPopover = document.querySelector("#passenger-popover");
  const passengerSummary = document.querySelector("#passenger-summary");
  const calendar = document.querySelector("#calendar-popover");
  const calendarMonths = document.querySelector("#calendar-months");
  const rangeSummary = document.querySelector("#calendar-range-summary");
  const pickupTime = document.querySelector("#pickup-time");
  const returnTime = document.querySelector("#return-time");
  const menuToggle = document.querySelector(".menu-toggle");
  const mobileMenu = document.querySelector("#mobile-menu");
  const header = document.querySelector(".site-header");

  const travelers = { adults: 1, children: 0, infants: 0, rooms: 1 };
  let selectedStart = null;
  let selectedEnd = null;
  let viewMonth = startOfMonth(new Date());
  let activeService = "flights";
  let calendarSelectionMode = "departure";

  const airportOptions = [...document.querySelectorAll("#airports option")].map((o) => ({
    value: o.value,
    iata: o.dataset.iata,
    city: o.dataset.city,
    country: o.dataset.country,
    name: o.dataset.name,
    hotelId: o.dataset.hotelId || "",
    locationType: o.dataset.locationType || "1"
  }));

  function localISO(date) {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }
  function dateTimeISO(date, time = "00:00", withZ = false) {
    const suffix = withZ ? ":00.000Z" : ":00";
    return `${localISO(date)}T${time}${suffix}`;
  }
  function parseISO(value) { return value ? new Date(`${value}T12:00:00`) : null; }
  function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1, 12); }
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1, 12); }
  function fmt(d) { return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(d).replace(" de ", " ").replace(" de ", " "); }
  function sameDay(a, b) { return a && b && localISO(a) === localISO(b); }
  function between(d, a, b) { return a && b && d > a && d < b; }
  function track(event, data = {}) { window.dataLayer = window.dataLayer || []; window.dataLayer.push({ event, ...data }); }

  function findAirport(raw) {
    const value = raw.trim().toLowerCase();
    const code = raw.toUpperCase().match(/\b[A-Z]{3}\b/);
    return airportOptions.find((a) => a.value.toLowerCase() === value || a.iata.toLowerCase() === value || (code && a.iata === code[0]));
  }
  function inferAirport(raw) {
    const found = findAirport(raw);
    if (found) return found;
    const code = raw.toUpperCase().match(/\b([A-Z]{3})\b/);
    if (!code) return null;
    const city = raw.replace(/[-–—]?\s*\b[A-Z]{3}\b/i, "").trim() || code[1];
    return { value: raw.trim(), iata: code[1], city, country: "Brasil", name: `${city} - (${code[1]})`, hotelId: "", locationType: "1" };
  }
  function setError(input, message) {
    const field = input.closest(".field");
    field?.classList.toggle("invalid", Boolean(message));
    const error = field?.querySelector(".error-text");
    if (error) error.textContent = message || "";
  }

  function allowsTripType() { return activeService === "flights" || activeService === "packages"; }
  function isRoundTrip() {
    const selected = document.querySelector('input[name="tripType"]:checked');
    return allowsTripType() && (!selected || selected.value === "roundtrip");
  }
  function needsReturnDate() { return activeService === "hotels" || activeService === "cars" || isRoundTrip(); }

  function updateDateUI() {
    departureInput.value = selectedStart ? localISO(selectedStart) : "";
    returnInput.value = selectedEnd ? localISO(selectedEnd) : "";
    departureLabel.textContent = selectedStart ? fmt(selectedStart) : "Escolha a data";
    returnLabel.textContent = selectedEnd ? fmt(selectedEnd) : "Escolha a data";
    rangeSummary.textContent = selectedStart
      ? `${fmt(selectedStart)}${needsReturnDate() ? (selectedEnd ? ` → ${fmt(selectedEnd)}` : " → escolha a volta") : ""}`
      : (needsReturnDate() ? "Selecione ida e volta" : "Selecione a data de ida");
  }

  function renderCalendar() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    calendarMonths.innerHTML = "";
    [viewMonth, addMonths(viewMonth, 1)].forEach((month) => {
      const wrap = document.createElement("div");
      wrap.className = "calendar-month";
      const title = document.createElement("h4");
      title.innerHTML = `${new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(month)} <span>${month.getFullYear()}</span>`;
      wrap.appendChild(title);
      const grid = document.createElement("div");
      grid.className = "calendar-grid";
      ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"].forEach((weekday) => {
        const label = document.createElement("div");
        label.className = "calendar-weekday";
        label.textContent = weekday;
        grid.appendChild(label);
      });
      for (let i = 0; i < month.getDay(); i += 1) {
        const empty = document.createElement("div");
        empty.className = "calendar-empty";
        grid.appendChild(empty);
      }
      const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
      for (let day = 1; day <= days; day += 1) {
        const date = new Date(month.getFullYear(), month.getMonth(), day, 12);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "calendar-day";
        button.textContent = day;
        button.dataset.date = localISO(date);
        button.disabled = date < today;
        if (sameDay(date, selectedStart) || sameDay(date, selectedEnd)) button.classList.add("selected");
        if (between(date, selectedStart, selectedEnd)) button.classList.add("in-range");
        if (sameDay(date, selectedStart) && selectedEnd) button.classList.add("range-start");
        if (sameDay(date, selectedEnd) && selectedStart) button.classList.add("range-end");
        button.addEventListener("click", () => selectDate(date));
        grid.appendChild(button);
      }
      wrap.appendChild(grid);
      calendarMonths.appendChild(wrap);
    });
  }

  function selectDate(date) {
    if (!needsReturnDate()) {
      selectedStart = date;
      selectedEnd = null;
      calendarSelectionMode = "departure";
    } else if (!selectedStart || selectedEnd || calendarSelectionMode === "departure") {
      selectedStart = date;
      selectedEnd = null;
      calendarSelectionMode = "return";
    } else if (date < selectedStart) {
      selectedStart = date;
      selectedEnd = null;
      calendarSelectionMode = "return";
    } else {
      selectedEnd = date;
      calendarSelectionMode = "departure";
    }
    updateDateUI();
    renderCalendar();
  }

  function openCalendar(event) {
    calendarSelectionMode = event.currentTarget.id === "return-date-button" ? "return" : "departure";
    if (calendarSelectionMode === "return" && !selectedStart) calendarSelectionMode = "departure";
    calendar.hidden = false;
    passengerPopover.hidden = true;
    renderCalendar();
  }

  document.querySelectorAll(".date-trigger").forEach((button) => button.addEventListener("click", openCalendar));
  document.querySelector("#calendar-close").onclick = () => { calendar.hidden = true; };
  document.querySelector("#calendar-prev").onclick = () => { viewMonth = addMonths(viewMonth, -1); renderCalendar(); };
  document.querySelector("#calendar-next").onclick = () => { viewMonth = addMonths(viewMonth, 1); renderCalendar(); };
  document.querySelector("#calendar-clear").onclick = () => { selectedStart = null; selectedEnd = null; updateDateUI(); renderCalendar(); };
  document.querySelector("#calendar-apply").onclick = () => {
    if (selectedStart && (!needsReturnDate() || selectedEnd)) calendar.hidden = true;
  };
  document.querySelectorAll("[data-shortcut]").forEach((button) => {
    button.onclick = () => {
      const now = new Date();
      if (button.dataset.shortcut === "tomorrow") {
        selectedStart = addDays(now, 1);
        selectedEnd = needsReturnDate() ? addDays(now, 2) : null;
      } else {
        const days = (5 - now.getDay() + 7) % 7 || 7;
        selectedStart = addDays(now, days);
        selectedEnd = needsReturnDate() ? addDays(now, days + 2) : null;
      }
      viewMonth = startOfMonth(selectedStart);
      updateDateUI();
      renderCalendar();
    };
  });

  function updateTravelers() {
    ["adults", "children", "infants", "rooms"].forEach((key) => {
      const output = document.querySelector(`#${key}-value`);
      if (output) output.textContent = travelers[key];
    });
    const guests = travelers.adults + travelers.children + travelers.infants;
    if (activeService === "hotels") passengerSummary.textContent = `${travelers.rooms} ${travelers.rooms === 1 ? "Quarto" : "Quartos"}, ${guests} ${guests === 1 ? "Hóspede" : "Hóspedes"}`;
    else if (activeService === "packages") passengerSummary.textContent = `${travelers.rooms} ${travelers.rooms === 1 ? "Quarto" : "Quartos"}, ${guests} ${guests === 1 ? "Viajante" : "Viajantes"}`;
    else passengerSummary.textContent = `${guests} ${guests === 1 ? "Viajante" : "Viajantes"}`;
  }

  passengerTrigger.onclick = () => {
    const open = passengerPopover.hidden;
    passengerPopover.hidden = !open;
    passengerTrigger.setAttribute("aria-expanded", String(open));
    calendar.hidden = true;
  };
  document.querySelector(".passenger-done").onclick = () => {
    passengerPopover.hidden = true;
    passengerTrigger.setAttribute("aria-expanded", "false");
  };
  document.querySelectorAll(".stepper button").forEach((button) => {
    button.onclick = () => {
      const key = button.dataset.target;
      const delta = button.dataset.action === "plus" ? 1 : -1;
      const total = travelers.adults + travelers.children + travelers.infants;
      if (key !== "rooms" && delta > 0 && total >= 9) return;
      if (key === "adults") travelers[key] = Math.min(9, Math.max(1, travelers[key] + delta));
      else if (key === "rooms") travelers[key] = Math.min(5, Math.max(1, travelers[key] + delta));
      else travelers[key] = Math.min(8, Math.max(0, travelers[key] + delta));
      if (travelers.infants > travelers.adults) travelers.infants = travelers.adults;
      updateTravelers();
    };
  });

  function setService(service) {
    activeService = service;
    widget.dataset.service = activeService;
    document.querySelectorAll(".booking-tab").forEach((tab) => {
      const active = tab.dataset.service === service;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });

    const tripType = document.querySelector(".trip-type");
    const directOption = document.querySelector(".direct-option");
    const differentLocation = document.querySelector(".car-different-location");
    const passengerField = document.querySelector(".passengers-field");
    const roomRow = document.querySelector(".rooms-row");
    const carTimeFields = document.querySelectorAll(".car-time-field");
    const swapButton = document.querySelector(".swap-route");
    const fields = form.querySelectorAll(".modern-search .field > span");
    const searchGrid = document.querySelector(".modern-search");

    tripType.hidden = !allowsTripType();
    directOption.hidden = service !== "flights";
    differentLocation.hidden = service !== "cars";
    passengerField.hidden = service === "cars";
    roomRow.hidden = !(service === "hotels" || service === "packages");
    carTimeFields.forEach((field) => { field.hidden = service !== "cars"; });
    swapButton.hidden = service === "hotels" || service === "cars";
    searchGrid.classList.toggle("is-car-search", service === "cars");
    searchGrid.classList.toggle("is-hotel-search", service === "hotels");

    const names = {
      flights: ["De onde sairemos?", "Para onde vamos?", "Data ida", "Data volta"],
      hotels: ["", "Para onde vamos?", "Check-in", "Check-out"],
      packages: ["De onde sairemos?", "Para onde vamos?", "Data ida", "Data volta"],
      cars: ["Local de retirada", "Local de devolução", "Data da retirada", "Data da devolução"]
    };
    fields[0].textContent = names[service][0];
    fields[1].textContent = names[service][1];
    document.querySelector(".date-field > span").textContent = names[service][2];
    returnField.querySelector(":scope > span").textContent = names[service][3];

    originInput.closest("label").hidden = service === "hotels";
    destinationInput.closest("label").hidden = false;
    originInput.placeholder = service === "cars" ? "Local de retirada" : "De onde você vai sair?";
    destinationInput.placeholder = service === "hotels" ? "Cidade ou hotel" : (service === "cars" ? "Local de devolução" : "Para onde você vai?");

    if (service === "cars" && !differentLocationInput.checked) destinationInput.value = originInput.value;
    if (allowsTripType()) {
      const round = document.querySelector('input[name="tripType"]:checked')?.value !== "oneway";
      returnField.hidden = !round;
      if (!round) selectedEnd = null;
    } else {
      returnField.hidden = false;
    }
    updateTravelers();
    updateDateUI();
    renderCalendar();
  }

  document.querySelectorAll(".booking-tab").forEach((tab) => tab.addEventListener("click", () => setService(tab.dataset.service)));
  document.querySelector(".swap-route").onclick = () => { [originInput.value, destinationInput.value] = [destinationInput.value, originInput.value]; };
  differentLocationInput.onchange = () => {
    if (!differentLocationInput.checked) destinationInput.value = originInput.value;
    destinationInput.closest("label").hidden = !differentLocationInput.checked;
  };
  originInput.addEventListener("change", () => {
    if (activeService === "cars" && !differentLocationInput.checked) destinationInput.value = originInput.value;
  });
  document.querySelectorAll('input[name="tripType"]').forEach((input) => {
    input.onchange = () => {
      if (!input.checked) return;
      const round = input.value === "roundtrip";
      returnField.hidden = !round;
      if (!round) { selectedEnd = null; calendarSelectionMode = "departure"; }
      else if (selectedStart && !selectedEnd) calendarSelectionMode = "return";
      updateDateUI();
      renderCalendar();
    };
  });

  function roomPayload(includeTeenager = false) {
    const rooms = [];
    for (let roomNum = 0; roomNum < travelers.rooms; roomNum += 1) {
      const adults = Math.max(1, Math.floor(travelers.adults / travelers.rooms) + (roomNum < travelers.adults % travelers.rooms ? 1 : 0));
      const children = Math.floor(travelers.children / travelers.rooms) + (roomNum < travelers.children % travelers.rooms ? 1 : 0);
      const infants = Math.floor(travelers.infants / travelers.rooms) + (roomNum < travelers.infants % travelers.rooms ? 1 : 0);
      const room = { numberOfAdults: adults, numberOfInfant: infants, numberOfChilds: children, agesOfChild: [], roomNum };
      if (includeTeenager) room.teenagerCount = 0;
      rooms.push(room);
    }
    return rooms;
  }

  function recent() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; } }
  function saveRecent(item) {
    const items = recent().filter((saved) => !(saved.service === item.service && saved.origin === item.origin && saved.destination === item.destination && saved.departure === item.departure));
    items.unshift(item);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 3)));
    renderRecent();
  }
  function renderRecent() {
    const items = recent();
    const box = document.querySelector("#recent-searches");
    const list = document.querySelector("#recent-search-list");
    box.hidden = !items.length;
    list.innerHTML = "";
    items.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "recent-search-item";
      button.textContent = `${item.serviceLabel}: ${item.route} · ${item.departureLabel}`;
      button.onclick = () => {
        setService(item.service);
        originInput.value = item.originValue || "";
        destinationInput.value = item.destinationValue || "";
        selectedStart = parseISO(item.departure);
        selectedEnd = parseISO(item.returnDate);
        Object.assign(travelers, item.travelers || {});
        updateTravelers();
        updateDateUI();
        viewMonth = startOfMonth(selectedStart || new Date());
      };
      list.appendChild(button);
    });
  }

  function validate() {
    let ok = true;
    const origin = activeService === "hotels" ? null : inferAirport(originInput.value);
    const destination = inferAirport(destinationInput.value);
    const round = isRoundTrip();

    if (activeService !== "hotels" && !origin) { setError(originInput, "Selecione um local com código IATA."); ok = false; } else setError(originInput, "");
    if (!destination) { setError(destinationInput, "Selecione um destino com código IATA."); ok = false; } else setError(destinationInput, "");
    if ((activeService === "flights" || activeService === "packages") && origin && destination && origin.iata === destination.iata) {
      setError(destinationInput, "Origem e destino precisam ser diferentes."); ok = false;
    }
    if ((activeService === "hotels" || activeService === "packages") && destination && !destination.hotelId) {
      setError(destinationInput, "Este destino ainda não possui o ID de hotel configurado."); ok = false;
    }
    if (!selectedStart) { setError(departureInput, "Escolha a data inicial."); ok = false; } else setError(departureInput, "");
    if (needsReturnDate() && !selectedEnd) { setError(returnInput, "Escolha a data final."); ok = false; } else setError(returnInput, "");
    return { ok, origin, destination, round };
  }

  function buildFlightUrl(data) {
    const params = new URLSearchParams({
      isRoundTrip: String(data.round),
      adultsCount: String(travelers.adults),
      childCount: String(travelers.children),
      infantCount: String(travelers.infants),
      teenagerCount: "0",
      departureIata: data.origin.iata,
      isDepartureIataCity: "false",
      departureName: data.origin.name,
      departureCity: data.origin.city,
      departureCountry: data.origin.country,
      arrivalIata: data.destination.iata,
      isArrivalIataCity: "false",
      arrivalName: data.destination.name,
      arrivalCity: data.destination.city,
      arrivalCountry: data.destination.country,
      departureDate: dateTimeISO(selectedStart, "00:00", true),
      returnDate: data.round && selectedEnd ? dateTimeISO(selectedEnd, "00:00", true) : "",
      nonstopFlights: String(directOnlyInput.checked),
      directFlightsOnly: String(directOnlyInput.checked),
      source: "f"
    });
    return `${BASE}/flight-list?${params}`;
  }

  function buildHotelUrl(data) {
    const params = new URLSearchParams({
      rooms: JSON.stringify(roomPayload(false)),
      numberOfAdults: String(travelers.adults),
      numberOfChild: String(travelers.children),
      numberOfInfant: String(travelers.infants),
      numberOfRooms: String(travelers.rooms),
      cityName: data.destination.city,
      id: data.destination.hotelId,
      type: data.destination.locationType || "1",
      startDate: dateTimeISO(selectedStart, "00:00", true),
      endDate: dateTimeISO(selectedEnd, "00:00", true),
      source: "h"
    });
    return `${BASE}/hotel-list?${params}`;
  }

  function buildPackageUrl(data) {
    const params = new URLSearchParams({
      isRoundTrip: String(data.round),
      departureIata: data.origin.iata,
      isDepartureIataCity: "false",
      departureDate: dateTimeISO(selectedStart, "00:00", true),
      returnDate: data.round && selectedEnd ? dateTimeISO(selectedEnd, "00:00", true) : "",
      hotelSerachId: data.destination.hotelId,
      rooms: JSON.stringify(roomPayload(true)),
      type: data.destination.locationType || "1",
      departureCity: data.origin.city,
      source: "p"
    });
    return `${BASE}/checkout/cart-package?${params}`;
  }

  function buildCarUrl(data) {
    const returnLocation = differentLocationInput.checked ? data.destination : data.origin;
    const params = new URLSearchParams({
      isReturnDifferentLocation: String(differentLocationInput.checked),
      pickupDateAndTime: dateTimeISO(selectedStart, pickupTime.value, false),
      pickupTime: pickupTime.value,
      locationNamePickup: data.origin.name.replace(/^.*? - \(/, `${data.origin.city} (`),
      valuePickup: data.origin.iata,
      returnDateAndTime: dateTimeISO(selectedEnd, returnTime.value, false),
      returnTime: returnTime.value,
      locationNameReturn: returnLocation.name.replace(/^.*? - \(/, `${returnLocation.city} (`),
      valueReturn: returnLocation.iata,
      pickupLocation: "[object Object]",
      returnLocation: "[object Object]",
      pickupLocationType: data.origin.locationType || "1",
      pickupLocationIata: data.origin.iata,
      pickupLocationGeoPoint: "null",
      returnLocationType: returnLocation.locationType || "1",
      returnLocationIata: returnLocation.iata,
      returnLocationGeoPoint: "null",
      source: "c"
    });
    return `${BASE}/public/car-list?${params}`;
  }

  form.onsubmit = (event) => {
    event.preventDefault();
    const data = validate();
    if (!data.ok) return;

    const labels = { flights: "Voos", hotels: "Hotéis", packages: "Pacotes", cars: "Carros" };
    saveRecent({
      service: activeService,
      serviceLabel: labels[activeService],
      origin: data.origin?.iata || "",
      destination: data.destination?.iata || "",
      originValue: originInput.value,
      destinationValue: destinationInput.value,
      route: activeService === "hotels" ? data.destination.city : `${data.origin.city} → ${data.destination.city}`,
      departure: localISO(selectedStart),
      returnDate: selectedEnd ? localISO(selectedEnd) : "",
      departureLabel: fmt(selectedStart),
      travelers: { ...travelers }
    });

    const builders = { flights: buildFlightUrl, hotels: buildHotelUrl, packages: buildPackageUrl, cars: buildCarUrl };
    track("travel_service_search", { service: activeService });
    window.location.href = builders[activeService](data);
  };

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".passengers-field")) {
      passengerPopover.hidden = true;
      passengerTrigger.setAttribute("aria-expanded", "false");
    }
    if (!event.target.closest(".calendar-popover") && !event.target.closest(".date-trigger")) calendar.hidden = true;
  });

  if (menuToggle && mobileMenu) {
    menuToggle.onclick = () => {
      const open = mobileMenu.hidden;
      mobileMenu.hidden = !open;
      menuToggle.setAttribute("aria-expanded", String(open));
      document.body.classList.toggle("menu-open", open);
    };
    mobileMenu.querySelectorAll("a").forEach((link) => { link.onclick = () => { mobileMenu.hidden = true; document.body.classList.remove("menu-open"); }; });
  }
  document.querySelectorAll(".js-track-whatsapp").forEach((link) => { link.onclick = () => track("whatsapp_click"); });
  const observer = "IntersectionObserver" in window ? new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (entry.isIntersecting) { entry.target.classList.add("visible"); observer.unobserve(entry.target); }
  }), { threshold: 0.12 }) : null;
  document.querySelectorAll(".reveal").forEach((element) => observer ? observer.observe(element) : element.classList.add("visible"));
  addEventListener("scroll", () => header?.classList.toggle("scrolled", scrollY > 12), { passive: true });
  const year = document.querySelector("#current-year");
  if (year) year.textContent = new Date().getFullYear();

  setService("flights");
  updateTravelers();
  updateDateUI();
  renderRecent();
})();
