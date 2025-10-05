import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./globals.css";
import { NearWalletProvider } from "@/context/NearWalletContext";
import { ThemeProvider } from "@/context/ThemeContext";
import Navbar from "@/components/layout/Navbar";
import Script from "next/script";


export default function RootLayout({ children }) {
  return (
      <html lang="en">
        <body>
          <ThemeProvider>
            <NearWalletProvider>
              <div className="min-vh-100 d-flex flex-column ">
                <Navbar />
                <main className="flex-grow-1">
                  {children}
                </main>
              </div>
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
