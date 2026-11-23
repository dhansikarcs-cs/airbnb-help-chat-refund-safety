import Link from "next/link";
import { AvatarIcon, BrandMark, Globe, MenuIcon } from "@/components/icons";

export function SiteHeader({ email }: { email?: string | null }) {
  const initial = email?.charAt(0).toUpperCase() ?? "?";
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="brand" aria-label="Airbnb guest support home">
          <BrandMark />
          <span>airbnb</span>
        </Link>

        <nav className="header-nav" aria-label="Main navigation">
          <span className="nav-item active">Explore</span>
          <span className="nav-item">Wishlists</span>
          <span className="nav-item">Trips</span>
          <Link href="/chat" className="nav-item">Help chat</Link>
          <Link href="/screen" className="nav-item">Safety screen</Link>
        </nav>

        <div className="header-actions">
          <span className="host-link">Airbnb your home</span>
          <button className="header-icon" type="button" aria-label="Choose a language">
            <Globe />
          </button>
          <div className="account-pill">
            <MenuIcon />
            <span className="avatar">{initial}</span>
          </div>
          {email && <span className="header-email">{email}</span>}
        </div>
      </div>
    </header>
  );
}
