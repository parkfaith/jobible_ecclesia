"use client";

import "./globals.css";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "대시보드", icon: "📊" },
  { href: "/meetings", label: "회의 목록", icon: "📋" },
  { href: "/teams", label: "팀 관리", icon: "👥" },
  { href: "/templates", label: "양식 관리", icon: "📄" },
];

function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-56 min-h-screen bg-slate-900 text-white flex flex-col fixed top-0 left-0 z-10">
      <div className="px-6 py-5 border-b border-slate-700">
        <h1 className="text-xl font-bold tracking-tight">Ecclesia</h1>
        <p className="text-xs text-slate-400 mt-1">회의록 자동화</p>
      </div>
      <nav className="flex-1 py-4">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-6 py-3 text-sm transition-colors ${
                active
                  ? "bg-slate-700 text-white font-medium"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-6 py-4 border-t border-slate-700 text-xs text-slate-500">
        Phase 1 v0.1.0
      </div>
    </aside>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <Sidebar />
        <main className="ml-56 min-h-screen p-8">{children}</main>
      </body>
    </html>
  );
}
