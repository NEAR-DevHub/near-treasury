import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./globals.css";
import { NearWalletProvider } from "@/context/NearWalletContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { DaoProvider } from "@/context/DaoContext";
import { SocialAccountProvider } from "@/context/SocialAccountContext";
import { QueryClientProvider } from "@/context/QueryClientProvider";
import { ProposalToastProvider } from "@/context/ProposalToastContext";
import Navbar from "@/components/layout/Navbar";
import Script from "next/script";
import { Inter } from "next/font/google";
const inter = Inter();

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.className}>
      <body>
        <QueryClientProvider>
          <ThemeProvider>
            <NearWalletProvider>
              <SocialAccountProvider>
                <DaoProvider>
                  <ProposalToastProvider>
                    <div className="min-vh-100 d-flex flex-column">
                      <Navbar />
                      <main className="flex-grow-1">{children}</main>
                    </div>
                  </ProposalToastProvider>
                </DaoProvider>
              </SocialAccountProvider>
            </NearWalletProvider>
          </ThemeProvider>
        </QueryClientProvider>
        <Script
          src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
