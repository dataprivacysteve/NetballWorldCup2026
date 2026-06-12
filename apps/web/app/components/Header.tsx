"use client";

import { useEffect, useState } from "react";
import { federation } from "../lib/config";

// Fixed top nav. Transparent over the hero, gains a blurred backdrop on scroll.
export function Header() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={scrolled ? "scrolled" : ""}>
      <div className="wrap nav">
        <a className="brandlogo" href="#top">
          Netball<b>Americas</b>
        </a>
        <nav className="nav-links">
          {federation.nav.map((n) => (
            <a key={n.label} href={n.href}>
              {n.label}
            </a>
          ))}
        </nav>
        <a className="nav-cta" href={federation.links.shop}>
          Shop now
        </a>
      </div>
    </header>
  );
}
