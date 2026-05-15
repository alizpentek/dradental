// main.js
// Várakozás: a HTML-ben legyenek ezek az elemek/ID-k:
// - gomb: #menuBtn
// - mobil menü overlay: #sheet (aria-hidden="true|false")
// - bezárás gomb: #closeBtn
// - (opcionális) header: header
// Animációhoz jelöld az elemeket pl. data-animate="fade-up|zoom|slide-up" attribútummal
// vagy add rájuk a class-t: "reveal".

(() => {
  const prefersReducedMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  )?.matches;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // -----------------------
  // Mobile menu (sheet)
  // -----------------------
  const menuBtn = $("#menuBtn");
  const sheet = $("#sheet");
  const closeBtn = $("#closeBtn");

  const isSheetOpen = () =>
    sheet && sheet.getAttribute("aria-hidden") === "false";

  function openSheet() {
    if (!sheet) return;
    sheet.setAttribute("aria-hidden", "false");
    menuBtn?.setAttribute("aria-expanded", "true");
    // fókusz a bezárásra (hozzáférhetőség)
    setTimeout(() => closeBtn?.focus?.(), 0);
    document.body.style.overflow = "hidden";
  }

  function closeSheet() {
    if (!sheet) return;
    sheet.setAttribute("aria-hidden", "true");
    menuBtn?.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    menuBtn?.focus?.();
  }

  menuBtn?.addEventListener("click", () =>
    isSheetOpen() ? closeSheet() : openSheet(),
  );
  closeBtn?.addEventListener("click", closeSheet);

  // Kattintás az overlay-re bezárja
  sheet?.addEventListener("click", (e) => {
    if (e.target === sheet) closeSheet();
  });

  // ESC bezárja
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isSheetOpen()) closeSheet();
  });

  // -----------------------
  // Smooth scroll + sheet close
  // -----------------------
  document.addEventListener("click", (e) => {
    const a = e.target?.closest?.('a[href^="#"]');
    if (!a) return;

    const hash = a.getAttribute("href");
    if (!hash || hash === "#") return;

    const el = document.querySelector(hash);
    if (!el) return;

    e.preventDefault();
    el.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
    closeSheet();
  });

  // -----------------------
  // Header "scrolled" state (opcionális)
  // CSS-ben tudsz rá stílust adni: header.scrolled { ... }
  // -----------------------
  const header = $("header");
  let lastScrollY = window.scrollY;

  function onScroll() {
    const y = window.scrollY || 0;
    if (header) {
      if (y > 12) header.classList.add("scrolled");
      else header.classList.remove("scrolled");
    }
    lastScrollY = y;
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // -----------------------
  // Reveal / Interaktív animációk (IntersectionObserver)
  // -----------------------
  // Automatán "reveal" class-t adunk pár tipikus elemhez, ha nincs megjelölve.
  const autoTargets = [
    ...$$("[data-animate]"),
    ...$$(".card"),
    ...$$(".g"),
    ...$$(".stat"),
    ...$$(".item"),
  ];

  autoTargets.forEach((el) => {
    // Ne duplázzuk
    if (!el.classList.contains("reveal")) el.classList.add("reveal");
  });

  // Ha reduced motion, mutassunk mindent azonnal
  if (prefersReducedMotion) {
    $$(".reveal").forEach((el) => el.classList.add("is-visible"));
  } else if ("IntersectionObserver" in window) {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -10% 0px" },
    );

    $$(".reveal").forEach((el) => obs.observe(el));
  } else {
    // Fallback
    $$(".reveal").forEach((el) => el.classList.add("is-visible"));
  }

  // -----------------------
  // Aktív menüpont jelölése (szekció alapján)
  // Várakozás: nav linkek href="#sectionId"
  // CSS-ben: .active { ... }
  // -----------------------
  const navLinks = $$('nav a[href^="#"]');
  const sections = navLinks
    .map((a) => document.querySelector(a.getAttribute("href")))
    .filter(Boolean);

  function setActive(id) {
    navLinks.forEach((a) => {
      const href = a.getAttribute("href");
      if (href === `#${id}`) a.classList.add("active");
      else a.classList.remove("active");
    });
  }

  if (
    !prefersReducedMotion &&
    "IntersectionObserver" in window &&
    sections.length
  ) {
    const sectionObs = new IntersectionObserver(
      (entries) => {
        // a leginkább látszó szekció nyer
        const visible = entries
          .filter((x) => x.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) setActive(visible.target.id);
      },
      { threshold: [0.2, 0.35, 0.5, 0.65] },
    );
    sections.forEach((s) => sectionObs.observe(s));
  } else {
    // Fallback: scroll alapján (egyszerű)
    const sectionTops = () =>
      sections.map((s) => ({
        id: s.id,
        top: s.getBoundingClientRect().top + window.scrollY,
      }));

    let cached = sectionTops();
    window.addEventListener(
      "resize",
      () => {
        cached = sectionTops();
      },
      { passive: true },
    );

    window.addEventListener(
      "scroll",
      () => {
        const y = window.scrollY + 120;
        let current = cached[0]?.id;
        for (const s of cached) if (y >= s.top) current = s.id;
        if (current) setActive(current);
      },
      { passive: true },
    );
  }

  // -----------------------
  // Footer év frissítés (opcionális)
  // Várakozás: <span data-year></span>
  // -----------------------
  const yearEl = document.querySelector("[data-year]");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  
})();

// Click-to-enlarge for gallery images (no HTML changes needed)
(() => {
  const imgs = Array.from(document.querySelectorAll(".gallery img"));
  if (!imgs.length) return;

  // Create lightbox once
  const lb = document.createElement("div");
  lb.className = "lightbox";
  lb.setAttribute("role", "dialog");
  lb.setAttribute("aria-modal", "true");
  lb.setAttribute("aria-hidden", "true");

  lb.innerHTML = `
    <div class="lightbox__inner">
      <button class="lightbox__close" type="button" aria-label="Close">×</button>
      <img class="lightbox__img" alt="" />
      <div class="lightbox__caption"></div>
    </div>
  `;

  document.body.appendChild(lb);

  const lbImg = lb.querySelector(".lightbox__img");
  const lbCaption = lb.querySelector(".lightbox__caption");
  const lbClose = lb.querySelector(".lightbox__close");

  let currentIndex = -1;

  function openAt(index) {
    const img = imgs[index];
    if (!img) return;

    currentIndex = index;
    lbImg.src = img.currentSrc || img.src;
    lbImg.alt = img.alt || "";
    lbCaption.textContent = img.alt || "";

    lb.classList.add("is-open");
    lb.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    // focus close for accessibility
    setTimeout(() => lbClose?.focus?.(), 0);
  }

  function close() {
    lb.classList.remove("is-open");
    lb.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    lbImg.src = "";
    currentIndex = -1;
  }

  function step(dir) {
    if (currentIndex < 0) return;
    const n = imgs.length;
    openAt((currentIndex + dir + n) % n);
  }

  // Click on image -> open
  document.addEventListener("click", (e) => {
    const img = e.target?.closest?.(".gallery img");
    if (!img) return;
    const index = imgs.indexOf(img);
    if (index >= 0) openAt(index);
  });

  // Close handlers
  lbClose.addEventListener("click", close);
  lb.addEventListener("click", (e) => {
    // click outside the inner box closes
    if (e.target === lb) close();
  });

  document.addEventListener("keydown", (e) => {
    if (!lb.classList.contains("is-open")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowRight") step(1);
    if (e.key === "ArrowLeft") step(-1);
  });
})();




(() => {
  const btn = document.getElementById("toTop");
  if (!btn) return;

  const toggle = () => {
    const show = window.scrollY > 450;
    btn.classList.toggle("is-visible", show);
  };

  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  window.addEventListener("scroll", toggle, { passive: true });
  toggle();
})();
