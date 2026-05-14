import { redirect } from "next/navigation"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import Link from "next/link"
import { LayoutDashboard, Upload, Briefcase, LogOut, Zap } from "lucide-react"

async function ensureCompany(userId: string, userEmail: string): Promise<string> {
  const service = createServiceClient()
  const { data: membership } = await service
    .from("company_members").select("company_id").eq("user_id", userId).single()
  if (membership) return membership.company_id

  const companyName = userEmail.split("@")[0] ?? "My Company"
  const { data: company } = await service.from("companies").insert({ name: companyName }).select("id").single()
  if (!company) throw new Error("Failed to create company")
  await service.from("company_members").insert({ company_id: company.id, user_id: userId, role: "owner" })
  return company.id
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

  await ensureCompany(user.id, user.email ?? "user")

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-60 bg-card border-r border-border flex flex-col py-6 shrink-0">
        {/* Logo */}
        <div className="px-6 mb-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <Zap size={16} className="text-primary-foreground" />
            </div>
            <span className="font-bold text-base tracking-tight">OpenScout</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 pl-10">AI Recruitment</p>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 flex-1 px-3">
          {NAV.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all group"
            >
              <Icon size={16} className="shrink-0 group-hover:text-primary transition-colors" />
              {label}
            </Link>
          ))}
        </nav>

        {/* User + sign out */}
        <div className="px-3 pt-4 border-t border-border mt-4">
          <div className="px-3 py-2 mb-1">
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
          <form action="/api/auth/signout" method="POST">
            <button type="submit"
              className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
              <LogOut size={16} className="shrink-0" />
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto bg-background">{children}</main>
    </div>
  )
}
