"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNearWallet } from "@/context/NearWalletContext";
import { useTheme } from "@/context/ThemeContext";
import { useDao } from "@/context/DaoContext";
import { NAVIGATION_LINKS, NEAR_TREASURY_CONFIG } from "@/constants/navigation";
import NearTreasuryLogo from "@/components/icons/Logo";
import Profile from "@/components/ui/Profile";
import MyTreasuries from "@/app/[daoId]/dashboard/MyTreasuries";

const Navbar = () => {
  const { accountId, connect, disconnect } = useNearWallet();
  const { isDarkTheme, toggleTheme } = useTheme();
  const { daoId, customConfig } = useDao();
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
    let currentPath = pathname.toLowerCase();

    // Remove leading slash
    if (currentPath.startsWith("/")) {
      currentPath = currentPath.substring(1);
    }

    // If we have a daoId, remove it from the path
    if (daoId && currentPath.startsWith(daoId.toLowerCase())) {
      currentPath = currentPath.substring(daoId.length);
      // Remove leading slash if present
      if (currentPath.startsWith("/")) {
        currentPath = currentPath.substring(1);
      }
    }

    // If current path is empty (root), treat it as dashboard
    if (currentPath === "") {
      currentPath = "dashboard";
    }

    return linkPath === currentPath ? "text-color" : "text-secondary";
  };

  const getCurrentPageTitle = () => {
    let currentPath = pathname.toLowerCase();

    // Remove leading slash
    if (currentPath.startsWith("/")) {
      currentPath = currentPath.substring(1);
    }

    // If we have a daoId, remove it from the path
    if (daoId && currentPath.startsWith(daoId.toLowerCase())) {
      currentPath = currentPath.substring(daoId.length);
      // Remove leading slash if present
      if (currentPath.startsWith("/")) {
        currentPath = currentPath.substring(1);
      }
    }

    // If current path is empty (root), treat it as dashboard
    if (currentPath === "") {
      currentPath = "dashboard";
    }

    // Find matching navigation link
    const matchingLink = NAVIGATION_LINKS.find((link) => {
      const linkPath = link.href.substring(1); // Remove leading slash
      return linkPath === currentPath;
    });

    return matchingLink ? matchingLink.title : null;
  };

  // Filter navigation links based on DAO config
  const getFilteredNavigationLinks = () => {
    return NAVIGATION_LINKS.filter((link) => {
      // Show Function Call only if enabled in config
      if (link.title === "Function Call") {
        return customConfig?.showFunctionCall ?? false;
      }
      // Show all other links
      return true;
    });
  };

  return (
    <div className="d-flex flex-column gap-2">
      <nav className="navbar navbar-expand-lg border-bottom navbar-theme">
        <div className="container-fluid d-flex justify-content-between align-items-center">
          {/* Logo */}
          <Link href="/" className="navbar-brand">
            <NearTreasuryLogo />
          </Link>

          <div className="d-flex justify-content-between align-items-center gap-3">
            {/* Navigation content - only show if daoId exists */}
            {daoId && (
              <div className="collapse navbar-collapse" id="navbarNav">
                <ul className="navbar-nav me-auto mx-1">
                  {getFilteredNavigationLinks().map((link, idx) => (
                    <li key={idx} className="nav-item">
                      <Link
                        href={`/${daoId}${link.href}`}
                        className={`nav-link ${isActive(link.title)}`}
                      >
                        {link.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

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
                    className="btn btn-outline-secondary border-0 d-flex align-items-center gap-2"
                    data-bs-toggle="dropdown"
                    style={{ maxWidth: "300px" }}
                  >
                    <Profile
                      accountId={accountId}
                      showKYC={false}
                      displayImage={true}
                      displayName={true}
                      displayHoverCard={false}
                    />
                    <i className="bi bi-chevron-down"></i>
                  </button>
                  <ul className="dropdown-menu w-100">
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

            {/* Mobile toggle button - only show if daoId exists */}
            {daoId && (
              <div
                className="navbar-toggler"
                data-bs-toggle="collapse"
                data-bs-target="#navbarNav"
              >
                <i className="bi bi-list"></i>
              </div>
            )}
          </div>
        </div>
      </nav>
      {daoId && (
        <div className="px-4 mt-1 d-flex gap-3 align-items-center">
          <MyTreasuries />
          <div className="h4 mb-0 text-color">{getCurrentPageTitle()}</div>
        </div>
      )}
    </div>
  );
};

export default Navbar;
