"use strict";

/* ============================================================
   LEO'S BAR -- Main JS
   - Loader dismiss (1.2s hold, 0.4s fade)
   - Nav scroll + hamburger
   - Hero parallax (JS-based for iOS Safari compatibility)
   - Scroll-reveal (IntersectionObserver)
   - Gallery lightbox with language-aware captions
   - Scroll cue hide on first scroll
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {

  /* ── Loader ─────────────────────────────────────────────── */
  const loader = document.getElementById("loader");
  if (loader) {
    setTimeout(() => {
      loader.classList.add("fade-out");
      setTimeout(() => {
        loader.style.display = "none";
      }, 450);
    }, 1200);
  }

  /* ── Nav scroll ─────────────────────────────────────────── */
  const nav = document.querySelector("nav");
  const SCROLL_THRESHOLD = 60;

  function updateNav() {
    if (window.scrollY > SCROLL_THRESHOLD) {
      nav.classList.add("scrolled");
    } else {
      nav.classList.remove("scrolled");
    }
  }

  window.addEventListener("scroll", updateNav, { passive: true });
  updateNav();

  /* ── Hamburger + drawer ──────────────────────────────────── */
  const hamburger = document.querySelector(".nav-hamburger");
  const drawer = document.querySelector(".nav-drawer");

  if (hamburger && drawer) {
    hamburger.addEventListener("click", () => {
      const isOpen = drawer.classList.toggle("open");
      hamburger.classList.toggle("open", isOpen);
      hamburger.setAttribute("aria-expanded", isOpen ? "true" : "false");
      document.body.style.overflow = isOpen ? "hidden" : "";
    });

    drawer.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        drawer.classList.remove("open");
        hamburger.classList.remove("open");
        hamburger.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
      });
    });
  }

  /* ── Hero parallax (JS avoids iOS background-attachment:fixed bug) */
  const heroImg = document.querySelector(".hero-img");
  const heroSection = document.getElementById("hero");

  if (heroImg && heroSection) {
    function parallaxHero() {
      const scrollY = window.scrollY;
      const heroHeight = heroSection.offsetHeight;
      if (scrollY <= heroHeight) {
        heroImg.style.transform = "translateY(" + (scrollY * 0.08) + "px)";
      }
    }
    window.addEventListener("scroll", parallaxHero, { passive: true });
  }

  /* ── Scroll cue hide ─────────────────────────────────────── */
  const scrollCue = document.querySelector(".hero-scroll-cue");
  let scrollCueHidden = false;

  if (scrollCue) {
    function hideScrollCue() {
      if (!scrollCueHidden && window.scrollY > 40) {
        scrollCue.classList.add("hidden");
        scrollCueHidden = true;
        window.removeEventListener("scroll", hideScrollCue);
      }
    }
    window.addEventListener("scroll", hideScrollCue, { passive: true });
  }

  /* ── Scroll-reveal (IntersectionObserver) ────────────────── */
  const reveals = document.querySelectorAll(".reveal");

  if (reveals.length && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    reveals.forEach((el) => observer.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("visible"));
  }

  /* ── Gallery lightbox ────────────────────────────────────── */
  const galleryItems = document.querySelectorAll(".gallery-item");
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const lightboxCaption = document.getElementById("lightbox-caption");
  const lightboxClose = document.getElementById("lightbox-close");

  if (lightbox && lightboxImg && galleryItems.length) {

    function openLightbox(src, captionEs, captionEn) {
      lightboxImg.src = src;
      lightboxImg.alt = captionEs;

      const lang = document.body.dataset.lang || "es";
      lightboxCaption.textContent = lang === "en" ? captionEn : captionEs;

      lightbox.classList.add("open");
      document.body.style.overflow = "hidden";
    }

    function closeLightbox() {
      lightbox.classList.remove("open");
      document.body.style.overflow = "";
      lightboxImg.src = "";
    }

    galleryItems.forEach((item) => {
      item.addEventListener("click", () => {
        const img = item.querySelector("img");
        const captionEs = item.dataset.captionEs || "";
        const captionEn = item.dataset.captionEn || "";
        openLightbox(img.src, captionEs, captionEn);
      });

      item.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          item.click();
        }
      });
    });

    lightboxClose.addEventListener("click", closeLightbox);

    lightbox.addEventListener("click", (e) => {
      if (e.target === lightbox) closeLightbox();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && lightbox.classList.contains("open")) {
        closeLightbox();
      }
    });

    // Update lightbox caption when language toggles
    const langObserver = new MutationObserver(() => {
      if (lightbox.classList.contains("open")) {
        const lang = document.body.dataset.lang || "es";
        const activeItem = [...galleryItems].find((item) => {
          const img = item.querySelector("img");
          return img && img.src === lightboxImg.src;
        });
        if (activeItem) {
          lightboxCaption.textContent =
            lang === "en"
              ? activeItem.dataset.captionEn || ""
              : activeItem.dataset.captionEs || "";
        }
      }
    });

    langObserver.observe(document.body, { attributes: true, attributeFilter: ["data-lang"] });
  }

});
