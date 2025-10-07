import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./globals.css";
import { NearWalletProvider } from "@/context/NearWalletContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { DaoProvider } from "@/context/DaoContext";
import Script from "next/script";
import { Inter } from "next/font/google";
const inter = Inter();

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.className}>
      <body>
        <ThemeProvider>
          <NearWalletProvider>
            <DaoProvider>
              {children}
            </DaoProvider>
          </NearWalletProvider>
        </ThemeProvider>
        <Script
          src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
