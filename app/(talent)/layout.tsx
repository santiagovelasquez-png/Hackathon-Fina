import { redirect } from "next/navigation"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import Link from "next/link"
import { Zap, LayoutDashboard, Star, FileText, LogOut } from "lucide-react"

const NAV = [
  { href: "/talent/dashboard", label: "Inicio", Icon: LayoutDashboard },
  { href: "/talent/cv", label: "Mi CV", Icon: FileText },
  { href: "/talent/opportunities", label: "Oportunidades", Icon: Star },
] as const

export default async function TalentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const service = createServiceClient()
  const { data: profile } = await service
    .from("profiles")
    .select("user_type")
    .eq("id", user.id)
    .single()

  if (profile?.user_type !== "talent") redirect("/dashboard")

  const initials = (user.email ?? "T").slice(0, 2).toUpperCase()

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <aside className="w-64 bg-[#0F172A] flex flex-col py-6 shrink-0 shadow-xl">
        {/* Logo */}
        <div className="px-6 mb-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center shrink-0 shadow-lg shadow-violet-900/40">
              <Zap size={16} className="text-white" fill="white" />
            </div>
            <div>
              <span className="font-bold text-white text-base tracking-tight">OpenScout</span>
              <p className="text-xs text-violet-400/80 leading-none mt-0.5">Para Talentos</p>
            </div>
          </div>
        </div>

        <nav className="flex flex-col gap-1 flex-1 px-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-3 mb-2">Menú</p>
          {NAV.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-200 cursor-pointer group"
            >
              <Icon size={16} className="shrink-0 group-hover:text-violet-400 transition-colors" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="px-3 pt-4 border-t border-white/10 mt-4">
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-pink-600 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-white">{initials}</span>
            </div>
            <p className="text-xs text-slate-400 truncate flex-1">{user.email}</p>
          </div>
          <form action="/api/auth/signout" method="POST">
            <button type="submit"
              className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:text-white hover:bg-white/10 transition-all duration-200 cursor-pointer">
              <LogOut size={15} className="shrink-0" />
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
