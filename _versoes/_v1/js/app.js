(() => {
  "use strict";

  const SEARCH_BASE = "https://www.comprarviagem.com.br/maximianos/flight-list";
  const form = document.querySelector("#flight-search");
  const originInput = document.querySelector("#origin");
  const destinationInput = document.querySelector("#destination");
  const departureInput = document.querySelector("#departure-date");
  const returnInput = document.querySelector("#return-date");
  const returnField = document.querySelector(".return-field");
  const directOnlyInput = document.querySelector("#direct-only");
  const passengerTrigger = document.querySelector(".passenger-trigger");
  const passengerPopover = document.querySelector("#passenger-popover");
  const passengerSummary = document.querySelector("#passenger-summary");
  const menuToggle = document.querySelector(".menu-toggle");
  const mobileMenu = document.querySelector("#mobile-menu");
  const header = document.querySelector(".site-header");

  const passengers = { adults: 1, children: 0, infants: 0 };

  const airportOptions = [...document.querySelectorAll("#airports option")].map(option => ({
    value: option.value,
    iata: option.dataset.iata,
    city: option.dataset.city,
    country: option.dataset.country,
    name: option.dataset.name
  }));

  function todayLocal() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 10);
  }

  const today = todayLocal();
  departureInput.min = today;
  returnInput.min = today;

  function addDays(dateString, days) {
    const date = dateString ? new Date(`${dateString}T12:00:00`) : new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }

  if (!departureInput.value) departureInput.value = addDays(today, 30);
  if (!returnInput.value) returnInput.value = addDays(today, 37);

  departureInput.addEventListener("change", () => {
    returnInput.min = departureInput.value || today;
    if (returnInput.value && returnInput.value < departureInput.value) {
      returnInput.value = addDays(departureInput.value, 7);
    }
  });

  function findAirport(rawValue) {
    const value = rawValue.trim().toLowerCase();
    const iataMatch = rawValue.toUpperCase().match(/\b[A-Z]{3}\b/);
    return airportOptions.find(airport =>
      airport.value.toLowerCase() === value ||
      airport.iata.toLowerCase() === value ||
      (iataMatch && airport.iata === iataMatch[0])
    );
  }

  function inferAirport(rawValue) {
    const existing = findAirport(rawValue);
    if (existing) return existing;

    const match = rawValue.toUpperCase().match(/\b([A-Z]{3})\b/);
    if (!match) return null;
    const iata = match[1];
    const city = rawValue.replace(/[-–—]?\s*\b[A-Z]{3}\b/i, "").trim() || iata;
    return {
      value: rawValue.trim(),
      iata,
      city,
      country: "Brasil",
      name: `${city} - (${iata})`
    };
  }

  function setFieldError(input, message) {
    const field = input.closest(".field");
    field.classList.toggle("invalid", Boolean(message));
    const error = field.querySelector(".error-text");
    if (error) error.textContent = message || "";
  }

  function validate() {
    let valid = true;
    const origin = inferAirport(originInput.value);
    const destination = inferAirport(destinationInput.value);
    const roundTrip = document.querySelector('input[name="tripType"]:checked').value === "roundtrip";

    if (!origin) {
      setFieldError(originInput, "Selecione uma opção com código IATA, como São Paulo - GRU.");
      valid = false;
    } else {
      setFieldError(originInput, "");
    }

    if (!destination) {
      setFieldError(destinationInput, "Selecione uma opção com código IATA, como Recife - REC.");
      valid = false;
    } else {
      setFieldError(destinationInput, "");
    }

    if (origin && destination && origin.iata === destination.iata) {
      setFieldError(destinationInput, "Origem e destino precisam ser diferentes.");
      valid = false;
    }

    if (!departureInput.value || departureInput.value < today) {
      setFieldError(departureInput, "Escolha uma data de ida válida.");
      valid = false;
    } else {
      setFieldError(departureInput, "");
    }

    if (roundTrip && (!returnInput.value || returnInput.value < departureInput.value)) {
      setFieldError(returnInput, "A volta deve ser igual ou posterior à ida.");
      valid = false;
    } else {
      setFieldError(returnInput, "");
    }

    return { valid, origin, destination, roundTrip };
  }

  function toUTCISOString(dateString) {
    return `${dateString}T00:00:00.000Z`;
  }

  function track(event, data = {}) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, ...data });
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    const result = validate();
    if (!result.valid) {
      form.querySelector(".invalid input")?.focus();
      track("flight_search_validation_error");
      return;
    }

    const params = new URLSearchParams({
      isRoundTrip: String(result.roundTrip),
      adultsCount: String(passengers.adults),
      childCount: String(passengers.children),
      infantCount: String(passengers.infants),
      teenagerCount: "0",
      departureIata: result.origin.iata,
      isDepartureIataCity: "false",
      departureName: result.origin.name,
      departureCity: result.origin.city,
      departureCountry: result.origin.country,
      arrivalIata: result.destination.iata,
      isArrivalIataCity: "false",
      arrivalName: result.destination.name,
      arrivalCity: result.destination.city,
      arrivalCountry: result.destination.country,
      departureDate: toUTCISOString(departureInput.value),
      returnDate: result.roundTrip ? toUTCISOString(returnInput.value) : "",
      nonstopFlights: String(directOnlyInput.checked),
      directFlightsOnly: String(directOnlyInput.checked),
      source: "landing_ads"
    });

    track("flight_search_submit", {
      origin: result.origin.iata,
      destination: result.destination.iata,
      trip_type: result.roundTrip ? "roundtrip" : "oneway",
      travelers: passengers.adults + passengers.children + passengers.infants
    });

    window.location.href = `${SEARCH_BASE}?${params.toString()}`;
  });

  document.querySelector(".swap-route").addEventListener("click", () => {
    const current = originInput.value;
    originInput.value = destinationInput.value;
    destinationInput.value = current;
    track("flight_route_swap");
  });

  document.querySelectorAll('input[name="tripType"]').forEach(input => {
    input.addEventListener("change", () => {
      const roundTrip = input.value === "roundtrip" && input.checked;
      if (input.checked) {
        returnField.hidden = !roundTrip;
        returnInput.required = roundTrip;
      }
    });
  });

  function updatePassengerUI() {
    document.querySelector("#adults-value").textContent = passengers.adults;
    document.querySelector("#children-value").textContent = passengers.children;
    document.querySelector("#infants-value").textContent = passengers.infants;
    const total = passengers.adults + passengers.children + passengers.infants;
    passengerSummary.textContent = `${total} ${total === 1 ? "viajante" : "viajantes"}`;
  }

  passengerTrigger.addEventListener("click", () => {
    const willOpen = passengerPopover.hidden;
    passengerPopover.hidden = !willOpen;
    passengerTrigger.setAttribute("aria-expanded", String(willOpen));
  });

  document.querySelectorAll(".stepper button").forEach(button => {
    button.addEventListener("click", () => {
      const target = button.dataset.target;
      const change = button.dataset.action === "plus" ? 1 : -1;
      const total = passengers.adults + passengers.children + passengers.infants;

      if (target === "adults") {
        passengers.adults = Math.min(9, Math.max(1, passengers.adults + change));
      } else if (target === "children") {
        if (change > 0 && total >= 9) return;
        passengers.children = Math.min(8, Math.max(0, passengers.children + change));
      } else {
        if (change > 0 && total >= 9) return;
        passengers.infants = Math.min(passengers.adults, Math.max(0, passengers.infants + change));
      }

      if (passengers.infants > passengers.adults) passengers.infants = passengers.adults;
      updatePassengerUI();
    });
  });

  document.addEventListener("click", event => {
    if (!event.target.closest(".passengers-field")) {
      passengerPopover.hidden = true;
      passengerTrigger.setAttribute("aria-expanded", "false");
    }
  });

  menuToggle.addEventListener("click", () => {
    const open = mobileMenu.hidden;
    mobileMenu.hidden = !open;
    menuToggle.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("menu-open", open);
  });

  mobileMenu.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      mobileMenu.hidden = true;
      menuToggle.setAttribute("aria-expanded", "false");
      document.body.classList.remove("menu-open");
    });
  });

  document.querySelectorAll(".js-track-whatsapp").forEach(link => {
    link.addEventListener("click", () => track("whatsapp_click", { location: link.className }));
  });

  const observer = "IntersectionObserver" in window
    ? new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12 })
    : null;

  document.querySelectorAll(".reveal").forEach(element => {
    if (observer) observer.observe(element);
    else element.classList.add("visible");
  });

  window.addEventListener("scroll", () => header.classList.toggle("scrolled", window.scrollY > 12), { passive: true });
  document.querySelector("#current-year").textContent = new Date().getFullYear();
  updatePassengerUI();
})();
