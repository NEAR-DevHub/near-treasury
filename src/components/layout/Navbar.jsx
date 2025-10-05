"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNearWallet } from "@/context/NearWalletContext";
import { useTheme } from "@/context/ThemeContext";
import { NAVIGATION_LINKS } from "@/constants/navigation";
import NearTreasuryLogo from "@/components/ui/Logo";

const Navbar = () => {
  const { accountId, connect, disconnect } = useNearWallet();
  const { isDarkTheme, toggleTheme } = useTheme();
  const pathname = usePathname();

  const handleSignIn = async () => {
    try {
      await connect();
    } catch (error) {
      console.error("Sign in error:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await disconnect();
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const isActive = (linkTitle) => {
    const linkPath = linkTitle.toLowerCase().replace(/ /g, "-");
    let currentPath = pathname.toLowerCase().replace("/", "");

    // If current path is empty (root), treat it as dashboard
    if (currentPath === "") {
      currentPath = "dashboard";
    }

    return linkPath === currentPath ? "text-color" : "text-secondary";
  };

  return (
    <nav className="navbar navbar-expand-lg shadow-sm border-bottom navbar-theme">
      <div className="container-fluid d-flex justify-content-between align-items-center">
        {/* Logo */}
        <Link href="/" className="navbar-brand">
          <NearTreasuryLogo />
        </Link>

        <div className="d-flex justify-content-between align-items-center gap-3">
          {/* Navigation content */}
          <div className="collapse navbar-collapse" id="navbarNav">
            <ul className="navbar-nav me-auto">
              {NAVIGATION_LINKS.map((link, idx) => (
                <li key={idx} className="nav-item">
                  <Link
                    href={link.href}
                    className={`nav-link ${isActive(link.title)}`}
                  >
                    {link.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Right side buttons */}
          <div className="d-flex align-items-center gap-3">
            {/* Theme toggle */}
            <div onClick={toggleTheme} className="cursor-pointer">
              {isDarkTheme ? (
                <i className="bi bi-sun-fill"></i>
              ) : (
                <i className="bi bi-moon-fill"></i>
              )}
            </div>

            {/* Wallet */}
            {accountId ? (
              <div className="dropdown">
                <button
                  className="btn btn-outline-secondary d-flex align-items-center gap-2"
                  data-bs-toggle="dropdown"
                  style={{ maxWidth: "300px" }}
                >
                  <span className="text-truncate flex-grow-1">{accountId}</span>
                  <i class="bi bi-chevron-down"></i>
                </button>
                <ul className="dropdown-menu">
                  <li>
                    <div
                      className="dropdown-item w-100 cursor-pointer"
                      onClick={handleSignOut}
                    >
                      <i className="bi bi-box-arrow-right me-2"></i>Sign out
                    </div>
                  </li>
                </ul>
              </div>
            ) : (
              <button className="btn theme-btn" onClick={handleSignIn}>
                Sign in
              </button>
            )}
          </div>

          {/* Mobile toggle button */}
          <div
            className="navbar-toggler"
            data-bs-toggle="collapse"
            data-bs-target="#navbarNav"
          >
            <i className="bi bi-list"></i>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
