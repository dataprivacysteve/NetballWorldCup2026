"use client";

import { useEffect, useState } from "react";
import { federation } from "../lib/config";

// Fixed top nav. Transparent over the hero, gains a blurred backdrop on scroll.
export function Header({
  logoSrc,
  shopUrl,
}: {
  logoSrc?: string | null;
  shopUrl?: string | null;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const resolvedLogo = logoSrc ?? federation.brand.logoSrc;
  const showLogo = resolvedLogo && !logoFailed;

  return (
    <header className={scrolled ? "scrolled" : ""}>
      <div className="wrap nav">
        <a className="brandlogo" href="#top">
          {showLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolvedLogo as string}
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
        <a className="nav-cta" href={shopUrl ?? federation.links.shop}>
          Shop now
        </a>
      </div>
    </header>
  );
}
