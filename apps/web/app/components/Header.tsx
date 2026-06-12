"use client";

import { useEffect, useState } from "react";
import { federation } from "../lib/config";

// Fixed top nav. Transparent over the hero, gains a blurred backdrop on scroll.
export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const showLogo = federation.brand.logoSrc && !logoFailed;

  return (
    <header className={scrolled ? "scrolled" : ""}>
      <div className="wrap nav">
        <a className="brandlogo" href="#top">
          {showLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={federation.brand.logoSrc as string}
              alt={federation.brand.wordmark}
              style={{ height: 40, width: "auto", display: "block" }}
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <>
              Netball<b>Americas</b>
            </>
          )}
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
