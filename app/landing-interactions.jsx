"use client";

import { useEffect } from "react";

export default function LandingInteractions() {
  useEffect(() => {
    const ageGate = document.querySelector(".age-gate");
    const ageEnter = document.querySelector("[data-age-enter]");
    const ageDecline = document.querySelector("[data-age-decline]");

    const dismissAgeGate = () => {
      ageGate?.classList.add("is-hidden");
      document.body.style.overflow = "";
      try {
        sessionStorage.setItem("lalianta_age_ok", "1");
      } catch (error) {}
    };

    try {
      if (sessionStorage.getItem("lalianta_age_ok") === "1") {
        ageGate?.classList.add("is-hidden");
      } else if (ageGate) {
        document.body.style.overflow = "hidden";
      }
    } catch (error) {
      if (ageGate) document.body.style.overflow = "hidden";
    }

    const declineAgeGate = (event) => {
      event.preventDefault();
      const inner = ageGate?.querySelector(".age-gate__inner");
      if (!inner) return;

      inner.innerHTML =
        '<div class="age-gate__monogram">L</div>' +
        "<h2>Vuelve cuando estes listo.</h2>" +
        '<p>Este sitio es exclusivo para mayores de 18 anos. Te esperamos.</p>';
    };

    ageEnter?.addEventListener("click", dismissAgeGate);
    ageDecline?.addEventListener("click", declineAgeGate);

    const nav = document.querySelector(".nav");
    const handleNavScroll = () => {
      nav?.classList.toggle("is-scrolled", window.scrollY > 24);
    };
    window.addEventListener("scroll", handleNavScroll, { passive: true });
    handleNavScroll();

    const toggle = document.querySelector(".nav__toggle");
    const toggleMenu = () => document.body.classList.toggle("menu-open");
    toggle?.addEventListener("click", toggleMenu);

    const closeMenu = () => document.body.classList.remove("menu-open");
    const navLinks = Array.from(document.querySelectorAll(".nav__links a"));
    navLinks.forEach((link) => link.addEventListener("click", closeMenu));

    const revealItems = Array.from(document.querySelectorAll(".reveal"));
    let observer;
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
      );
      revealItems.forEach((item) => observer.observe(item));
    } else {
      revealItems.forEach((item) => item.classList.add("is-visible"));
    }

    const parallaxItems = Array.from(document.querySelectorAll("[data-parallax]"));
    let ticking = false;
    const applyParallax = () => {
      const y = window.scrollY;
      parallaxItems.forEach((item) => {
        const speed = Number.parseFloat(item.dataset.parallax) || 0.1;
        item.style.transform = `translate3d(0, ${y * speed}px, 0)`;
      });
      ticking = false;
    };
    const handleParallaxScroll = () => {
      if (ticking) return;
      window.requestAnimationFrame(applyParallax);
      ticking = true;
    };
    window.addEventListener("scroll", handleParallaxScroll, { passive: true });

    const tabs = Array.from(document.querySelectorAll(".menu__tab"));
    const panels = Array.from(document.querySelectorAll(".menu__panel"));
    const tabHandlers = tabs.map((tab) => {
      const handler = () => {
        const target = tab.dataset.tab;
        tabs.forEach((item) => item.classList.toggle("is-active", item === tab));
        panels.forEach((panel) => {
          panel.classList.toggle("is-active", panel.dataset.panel === target);
        });
      };
      tab.addEventListener("click", handler);
      return [tab, handler];
    });

    const year = document.querySelector("[data-year]");
    if (year) year.textContent = String(new Date().getFullYear());

    return () => {
      ageEnter?.removeEventListener("click", dismissAgeGate);
      ageDecline?.removeEventListener("click", declineAgeGate);
      window.removeEventListener("scroll", handleNavScroll);
      toggle?.removeEventListener("click", toggleMenu);
      navLinks.forEach((link) => link.removeEventListener("click", closeMenu));
      observer?.disconnect();
      window.removeEventListener("scroll", handleParallaxScroll);
      tabHandlers.forEach(([tab, handler]) => tab.removeEventListener("click", handler));
      document.body.classList.remove("menu-open");
    };
  }, []);

  return null;
}
