import { redirect } from "next/navigation"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import Link from "next/link"
import { LayoutDashboard, Upload, Briefcase, LogOut, Zap } from "lucide-react"

async function ensureCompany(userId: string, userEmail: string): Promise<{ companyId: string; onboardingCompleted: boolean }> {
  const service = createServiceClient()
  const { data: membership } = await service
    .from("company_members").select("company_id").eq("user_id", userId).single()

  if (membership) {
    const { data: company } = await service
      .from("companies").select("id, onboarding_completed").eq("id", membership.company_id).single()
    return { companyId: membership.company_id, onboardingCompleted: company?.onboarding_completed ?? false }
  }

  const companyName = userEmail.split("@")[0] ?? "My Company"
  const { data: company } = await service.from("companies").insert({ name: companyName }).select("id").single()
  if (!company) throw new Error("Failed to create company")
  await service.from("company_members").insert({ company_id: company.id, user_id: userId, role: "owner" })
  return { companyId: company.id, onboardingCompleted: false }
}

const NAV = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/jobs", label: "Cargos", Icon: Briefcase },
  { href: "/upload", label: "Subir CV", Icon: Upload },
] as const

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Talent users have their own dashboard
  const service2 = createServiceClient()
  const { data: profile } = await service2.from("profiles").select("user_type").eq("id", user.id).single()
  if (profile?.user_type === "talent") redirect("/talent/dashboard")

  const { onboardingCompleted } = await ensureCompany(user.id, user.email ?? "user")
  if (!onboardingCompleted) redirect("/onboarding")

  const initials = (user.email ?? "U").slice(0, 2).toUpperCase()

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      {/* Sidebar — dark navy glassmorphism */}
      <aside className="w-64 bg-[#0F172A] flex flex-col py-6 shrink-0 shadow-xl">
        {/* Logo */}
        <div className="px-6 mb-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shrink-0 shadow-lg shadow-blue-900/40">
              <Zap size={16} className="text-white" fill="white" />
            </div>
            <div>
              <span className="font-bold text-white text-base tracking-tight">OpenScout</span>
              <p className="text-xs text-blue-400/80 leading-none mt-0.5">AI Recruitment</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 flex-1 px-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-3 mb-2">Menú</p>
          {NAV.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-200 cursor-pointer group"
            >
              <Icon size={16} className="shrink-0 group-hover:text-blue-400 transition-colors" />
              {label}
            </Link>
          ))}
        </nav>

        {/* User */}
        <div className="px-3 pt-4 border-t border-white/10 mt-4">
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shrink-0">
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

      {/* Main */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
