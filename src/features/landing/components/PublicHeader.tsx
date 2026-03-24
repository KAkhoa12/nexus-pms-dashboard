import { ArrowRight } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";

const publicNavItems = [
  { label: "Trang chủ", to: "/" },
  { label: "Hướng dẫn", to: "/docs" },
  { label: "Demo", to: "/demo" },
];

export function PublicHeader() {
  return (
    <header className="mb-16 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-5">
        <img
          src="/logo.png"
          alt="QuanLyPhongTro"
          className="h-16 w-auto object-contain"
        />
        <div className="space-y-2">
          <span className="text-2xl font-bold">House Smart Business</span>
          <nav className="flex flex-wrap items-center gap-2">
            {publicNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-full px-3 py-1 text-sm font-medium transition ${
                    isActive
                      ? "bg-[#0f766e] text-white"
                      : "text-slate-700 hover:bg-white/80"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      <Button asChild className="bg-[#0f766e] text-white hover:bg-[#115e59]">
        <Link to="/dashboard/login">
          Đăng nhập hệ thống <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
    </header>
  );
}
