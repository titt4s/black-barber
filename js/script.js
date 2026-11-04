/* =========================================================
   BLACK BARBER · script.js
   Usa únicamente los ids y clases que existen en index.html
   y las clases de estado que define style.css.
   ========================================================= */

(function () {
  "use strict";

  /* Activa los estilos de aparición al hacer scroll (html.js .reveal) */
  document.documentElement.classList.add("js");

  /* ---------- Configuración ---------- */
  const SHOP_TIMEZONE = "Europe/Madrid"; // Zona horaria de la barbería
  const SLOT_MINUTES = 30;               // Duración de cada hueco de cita
  const DAYS_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const DAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  /* ---------- Utilidades ---------- */
  const $ = (selector, ctx = document) => ctx.querySelector(selector);
  const $$ = (selector, ctx = document) => Array.from(ctx.querySelectorAll(selector));

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function setScrollLock(locked) {
    document.body.style.overflow = locked ? "hidden" : "";
  }

  const pad = (n) => String(n).padStart(2, "0");
  const formatMinutes = (total) => pad(Math.floor(total / 60)) + ":" + pad(total % 60);

  /* Fecha y hora actuales en la zona horaria de la barbería */
  function getShopNow() {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: SHOP_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(new Date());
      const get = (type) => parts.find((p) => p.type === type).value;
      return {
        day: DAYS_EN.indexOf(get("weekday")),
        minutes: (parseInt(get("hour"), 10) % 24) * 60 + parseInt(get("minute"), 10),
        dateStr: get("year") + "-" + get("month") + "-" + get("day"),
      };
    } catch (error) {
      const d = new Date();
      return {
        day: d.getDay(),
        minutes: d.getHours() * 60 + d.getMinutes(),
        dateStr: d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()),
      };
    }
  }

  /* El horario se lee de la tabla .hours__table (una sola fuente de datos).
     Resultado: { 0: {open, close} | null, 1: ..., ... } en minutos desde las 00:00 */
  function readSchedule() {
    const schedule = {};
    $$(".hours__table tr[data-day]").forEach((row) => {
      const day = Number(row.dataset.day);
      const cell = $("td", row);
      const match = cell && cell.textContent.match(/(\d{1,2}):(\d{2})\s*[–—-]\s*(\d{1,2}):(\d{2})/);
      schedule[day] = match
        ? { open: +match[1] * 60 + +match[2], close: +match[3] * 60 + +match[4] }
        : null;
    });
    return schedule;
  }

  const schedule = readSchedule();

  /* ---------- 1. Menú móvil (#nav-toggle, #nav-menu) ---------- */
  function initMenu() {
    const toggle = $("#nav-toggle");
    const menu = $("#nav-menu");
    if (!toggle || !menu) return;

    const desktop = window.matchMedia("(min-width: 900px)");
    const isOpen = () => menu.classList.contains("is-open");

    function setOpen(open) {
      menu.classList.toggle("is-open", open);
      toggle.classList.toggle("is-active", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
      setScrollLock(open);
    }

    toggle.addEventListener("click", () => setOpen(!isOpen()));

    // Cierra el menú al pulsar cualquier enlace (antes de que se desplace a la sección)
    menu.addEventListener("click", (e) => {
      if (e.target.closest("a")) setOpen(false);
    });

    // Cierra al pulsar fuera del panel
    document.addEventListener("click", (e) => {
      if (isOpen() && !menu.contains(e.target) && !toggle.contains(e.target)) setOpen(false);
    });

    // Cierra con la tecla Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isOpen()) {
        setOpen(false);
        toggle.focus();
      }
    });

    // Si se pasa a pantalla de escritorio, se cierra y se libera el scroll
    const onBreakpoint = (e) => {
      if (e.matches && isOpen()) setOpen(false);
    };
    if (desktop.addEventListener) desktop.addEventListener("change", onBreakpoint);
    else desktop.addListener(onBreakpoint);
  }

  /* ---------- 2. Cabecera, volver arriba y botón flotante ---------- */
  function initScrollUI() {
    const header = $(".header");
    const backToTop = $("#back-to-top");
    const floatingCta = $(".floating-cta");
    const booking = $("#cita");
    let ticking = false;

    function update() {
      const y = window.pageYOffset || document.documentElement.scrollTop;
      const vh = window.innerHeight;

      if (header) header.classList.toggle("is-scrolled", y > 50);
      if (backToTop) backToTop.classList.toggle("is-visible", y > 600);

      if (floatingCta) {
        // Se muestra tras la portada y se oculta mientras se ve el formulario de cita
        let bookingInView = false;
        if (booking) {
          const rect = booking.getBoundingClientRect();
          bookingInView = rect.top < vh * 0.85 && rect.bottom > vh * 0.15;
        }
        floatingCta.classList.toggle("is-visible", y > vh * 0.7 && !bookingInView);
      }
      ticking = false;
    }

    window.addEventListener(
      "scroll",
      () => {
        if (!ticking) {
          ticking = true;
          window.requestAnimationFrame(update);
        }
      },
      { passive: true }
    );
    window.addEventListener("resize", update);
    update();

    if (backToTop) {
      backToTop.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
      });
    }
  }

  /* Marca el enlace del menú (.nav__link) de la sección visible */
  function initScrollSpy() {
    const links = $$(".nav__link");
    if (!links.length || !("IntersectionObserver" in window)) return;

    const sections = $$("section[id]").filter((s) => s.id !== "inicio-header");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          links.forEach((link) => {
            link.classList.toggle("is-active", link.getAttribute("href") === "#" + entry.target.id);
          });
        });
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    sections.forEach((section) => observer.observe(section));
  }

  /* ---------- 3. Animaciones al desplazarse (.reveal) ---------- */
  function initReveal() {
    const elements = $$(".reveal");
    if (!elements.length) return;

    if (!("IntersectionObserver" in window)) {
      elements.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    elements.forEach((el) => observer.observe(el));
  }

  /* ---------- 4. Galería y visor (.gallery__item, #lightbox) ---------- */
  function initLightbox() {
    const lightbox = $("#lightbox");
    const lightboxImg = $("#lightbox-img");
    const closeBtn = $("#lightbox-close");
    const items = $$(".gallery__item");
    if (!lightbox || !lightboxImg || !closeBtn || !items.length) return;

    let current = -1;
    let lastFocus = null;
    let touchStartX = null;

    lightbox.setAttribute("role", "dialog");
    lightbox.setAttribute("aria-modal", "true");
    lightbox.setAttribute("aria-label", "Foto ampliada");

    // Versión grande de la imagen (si la URL admite el parámetro w=)
    function getLargeSrc(img) {
      const src = img.currentSrc || img.src;
      return src.replace(/([?&]w=)\d+/, (match, prefix) => prefix + "1600");
    }

    function show(index) {
      current = (index + items.length) % items.length;
      const img = $("img", items[current]);
      if (!img) return;
      lightboxImg.src = getLargeSrc(img);
      lightboxImg.alt = img.alt;
    }

    function open(index) {
      lastFocus = document.activeElement;
      show(index);
      lightbox.classList.add("is-open");
      lightbox.setAttribute("aria-hidden", "false");
      setScrollLock(true);
      closeBtn.focus();
    }

    function close() {
      lightbox.classList.remove("is-open");
      lightbox.setAttribute("aria-hidden", "true");
      setScrollLock(false);
      if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
      // Se vacía la imagen una vez terminada la transición de cierre
      setTimeout(() => {
        if (!lightbox.classList.contains("is-open")) lightboxImg.removeAttribute("src");
      }, 400);
    }

    items.forEach((item, index) => {
      const img = $("img", item);
      item.setAttribute("tabindex", "0");
      item.setAttribute("role", "button");
      item.setAttribute("aria-label", "Ampliar foto" + (img && img.alt ? ": " + img.alt : ""));
      item.addEventListener("click", () => open(index));
      item.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open(index);
        }
      });
    });

    closeBtn.addEventListener("click", close);

    // Clic en el fondo oscuro (no en la imagen) cierra el visor
    lightbox.addEventListener("click", (e) => {
      if (e.target === lightbox) close();
    });

    document.addEventListener("keydown", (e) => {
      if (!lightbox.classList.contains("is-open")) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") show(current + 1);
      else if (e.key === "ArrowLeft") show(current - 1);
      else if (e.key === "Tab") {
        e.preventDefault();
        closeBtn.focus();
      }
    });

    // Deslizar el dedo para cambiar de foto en móvil
    lightbox.addEventListener("touchstart", (e) => {
      touchStartX = e.changedTouches[0].clientX;
    }, { passive: true });

    lightbox.addEventListener("touchend", (e) => {
      if (touchStartX === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      touchStartX = null;
      if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
    }, { passive: true });
  }

  /* ---------- 5. Horarios (#open-status, .hours__table) ---------- */
  function initHours() {
    const status = $("#open-status");
    const rows = $$(".hours__table tr[data-day]");
    if (!status && !rows.length) return;

    function update() {
      const now = getShopNow();
      const today = schedule[now.day];

      // Resalta el día de hoy en la tabla
      rows.forEach((row) => row.classList.toggle("is-today", Number(row.dataset.day) === now.day));

      if (!status || !Object.keys(schedule).length) return;

      let message;
      let open = false;

      if (today && now.minutes >= today.open && now.minutes < today.close) {
        open = true;
        message = "Abierto ahora · cierra a las " + formatMinutes(today.close);
      } else if (today && now.minutes < today.open) {
        message = "Cerrado ahora · abrimos hoy a las " + formatMinutes(today.open);
      } else {
        message = "Cerrado ahora";
        for (let i = 1; i <= 7; i++) {
          const day = (now.day + i) % 7;
          if (schedule[day]) {
            const when = i === 1 ? "mañana" : "el " + DAYS_ES[day];
            message += " · abrimos " + when + " a las " + formatMinutes(schedule[day].open);
            break;
          }
        }
      }

      status.textContent = message;
      status.classList.toggle("is-open", open);
      status.classList.toggle("is-closed", !open);
    }

    update();
    setInterval(update, 60000); // Se actualiza cada minuto
  }

  /* ---------- 6. Formulario de reservas (#booking-form) ---------- */

  // Huecos disponibles para una fecha (YYYY-MM-DD) según el horario de la tabla
  function getSlotsFor(dateStr) {
    const dayOfWeek = new Date(dateStr + "T12:00:00").getDay();
    const day = schedule[dayOfWeek];
    if (!day) return { closed: true, slots: [] };

    const now = getShopNow();
    const slots = [];
    for (let m = day.open; m + SLOT_MINUTES <= day.close; m += SLOT_MINUTES) {
      // Si es hoy, solo horas que aún no han pasado
      if (dateStr === now.dateStr && m <= now.minutes) continue;
      slots.push(m);
    }
    return { closed: false, slots };
  }

  function initBooking() {
    const form = $("#booking-form");
    if (!form) return;

    const success = $("#form-success");
    const fecha = form.elements.fecha;
    const hora = form.elements.hora;
    const fieldNames = ["nombre", "telefono", "servicio", "fecha", "hora"];

    // No se pueden elegir fechas pasadas
    if (fecha) fecha.min = getShopNow().dateStr;

    /* Mensajes de error: devuelven "" si el campo es válido */
    const validators = {
      nombre(value) {
        if (value.length < 2) return "Escribe tu nombre (mínimo 2 caracteres).";
        if (!/^\p{L}[\p{L}\s'.-]*$/u.test(value)) return "El nombre solo puede contener letras.";
        return "";
      },
      telefono(value) {
        if (!value) return "Escribe tu número de teléfono.";
        const cleaned = value.replace(/[\s.\-()]/g, "");
        if (!/^\+?\d{9,15}$/.test(cleaned)) return "Introduce un teléfono válido (entre 9 y 15 dígitos).";
        return "";
      },
      servicio(value) {
        return value ? "" : "Selecciona un servicio.";
      },
      fecha(value) {
        if (!value) return "Elige una fecha.";
        if (value < getShopNow().dateStr) return "La fecha no puede ser anterior a hoy.";
        const { closed, slots } = getSlotsFor(value);
        if (closed) return "Ese día estamos cerrados. Elige otro día.";
        if (!slots.length) return "Hoy ya no quedan horas disponibles. Elige otro día.";
        return "";
      },
      hora(value) {
        return value ? "" : "Selecciona una hora.";
      },
    };

    function setFieldError(field, message) {
      const group = field.closest(".form__group");
      const errorEl = group && $(".form__error", group);
      if (group) group.classList.toggle("is-error", Boolean(message));
      field.setAttribute("aria-invalid", message ? "true" : "false");
      if (errorEl) {
        if (!errorEl.id) errorEl.id = "error-" + field.name;
        errorEl.textContent = message;
        field.setAttribute("aria-describedby", errorEl.id);
      }
    }

    function validateField(field) {
      const message = validators[field.name](field.value.trim());
      setFieldError(field, message);
      return message === "";
    }

    function clearAllErrors() {
      fieldNames.forEach((name) => setFieldError(form.elements[name], ""));
    }

    /* Rellena el desplegable de horas según la fecha elegida */
    function populateHours() {
      if (!hora) return;
      const placeholder = hora.options[0];
      while (hora.options.length > 1) hora.remove(1);
      hora.value = "";

      if (!fecha || !fecha.value) {
        placeholder.textContent = "Primero elige una fecha";
        hora.disabled = true;
        return;
      }

      const { closed, slots } = getSlotsFor(fecha.value);
      if (closed || !slots.length) {
        placeholder.textContent = "Sin horas disponibles";
        hora.disabled = true;
        return;
      }

      placeholder.textContent = "Selecciona una hora";
      hora.disabled = false;
      slots.forEach((minutes) => {
        const option = document.createElement("option");
        option.value = option.textContent = formatMinutes(minutes);
        hora.appendChild(option);
      });
    }

    populateHours();

    // Al cambiar la fecha se recalculan las horas disponibles
    if (fecha) {
      fecha.addEventListener("change", () => {
        populateHours();
        setFieldError(hora, "");
        validateField(fecha);
      });
    }

    // Validación en directo: al salir de un campo con contenido, y al corregir un error
    form.addEventListener("focusout", (e) => {
      const field = e.target;
      if (fieldNames.includes(field.name) && field.value !== "") validateField(field);
    });

    form.addEventListener("input", (e) => {
      const field = e.target;
      if (success) success.textContent = "";
      const group = field.closest && field.closest(".form__group");
      if (fieldNames.includes(field.name) && group && group.classList.contains("is-error")) {
        validateField(field);
      }
    });

    form.addEventListener("change", (e) => {
      const field = e.target;
      const group = field.closest && field.closest(".form__group");
      if (fieldNames.includes(field.name) && group && group.classList.contains("is-error")) {
        validateField(field);
      }
    });

    /* Envío */
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (success) success.textContent = "";

      let firstInvalid = null;
      fieldNames.forEach((name) => {
        const field = form.elements[name];
        if (!validateField(field) && !firstInvalid) firstInvalid = field;
      });

      if (firstInvalid) {
        firstInvalid.focus();
        return;
      }

      const data = Object.fromEntries(new FormData(form).entries());
      handleBookingData(data);

      const prettyDate = new Date(data.fecha + "T12:00:00").toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      form.reset();
      clearAllErrors();
      populateHours();

      if (success) {
        success.textContent =
          "¡Gracias, " + data.nombre.trim() + "! Hemos recibido tu solicitud: " +
          data.servicio + ", el " + prettyDate + " a las " + data.hora +
          ". Te confirmaremos la cita por teléfono lo antes posible.";
        success.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "nearest" });
      }
    });
  }

  /* Aquí se recibe la solicitud ya validada.
     De momento solo se muestra en la consola (la web es una demo y no hay servidor).
     Para enviarla de verdad, haz aquí un fetch() a tu servidor o a un servicio de formularios. */
  function handleBookingData(data) {
    console.log("Solicitud de cita (demo):", data);
  }

  /* ---------- 7. Pie de página: año actual (#year) ---------- */
  function initYear() {
    const year = $("#year");
    if (year) year.textContent = new Date().getFullYear();
  }

  /* ---------- Inicio ---------- */
  initMenu();
  initScrollUI();
  initScrollSpy();
  initReveal();
  initLightbox();
  initHours();
  initBooking();
  initYear();
})();
