import Navbar from "@/components/layout/Navbar";

export default function DaoLayout({ children }) {
  return (
    <div className="min-vh-100 d-flex flex-column">
      <Navbar />
      <main className="flex-grow-1">{children}</main>
    </div>
  );
}
