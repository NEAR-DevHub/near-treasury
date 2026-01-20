import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./globals.css";
import { NearWalletProvider } from "@/context/NearWalletContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { DaoProvider } from "@/context/DaoContext";
import { SocialAccountProvider } from "@/context/SocialAccountContext";
import { QueryClientProvider } from "@/context/QueryClientProvider";
import Navbar from "@/components/layout/Navbar";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import Script from "next/script";
import { Inter } from "next/font/google";
const inter = Inter();

export const metadata = {
  title: "NEAR Treasury",
  description: "Manage your DAO treasury on NEAR Protocol",
  icons: {
    icon: "https://cdn.prod.website-files.com/68800faa8d67015b1cfe30eb/688010ccfbb267e1f9647285_webclip.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.className}>
      <body>
        <GoogleAnalytics />
        <QueryClientProvider>
          <NearWalletProvider>
            <SocialAccountProvider>
              <DaoProvider>
                <ThemeProvider>
                  <div className="min-vh-100 d-flex flex-column">
                    <Navbar />
                    <main className="flex-grow-1">{children}</main>
                  </div>
                </ThemeProvider>
              </DaoProvider>
            </SocialAccountProvider>
          </NearWalletProvider>
        </QueryClientProvider>
        <Script
          src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
