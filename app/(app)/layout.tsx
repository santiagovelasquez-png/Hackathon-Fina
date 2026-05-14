import { redirect } from "next/navigation"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import Link from "next/link"
import { LayoutDashboard, Upload, Briefcase, BarChart3, LogOut } from "lucide-react"

async function ensureCompany(userId: string, userEmail: string): Promise<string> {
  const service = createServiceClient()

  const { data: membership } = await service
    .from("company_members")
    .select("company_id")
    .eq("user_id", userId)
    .single()

  if (membership) return membership.company_id

  // Auto-provision a company for demo
  const companyName = userEmail.split("@")[0] ?? "My Company"

  const { data: company } = await service
    .from("companies")
    .insert({ name: companyName })
    .select("id")
    .single()

  if (!company) throw new Error("Failed to create company")

  await service.from("company_members").insert({
    company_id: company.id,
    user_id: userId,
    role: "owner",
  })

  return company.id
}

const NAV = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/jobs", label: "Jobs", Icon: Briefcase },
  { href: "/upload", label: "Upload CV", Icon: Upload },
] as const

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  await ensureCompany(user.id, user.email ?? "user")

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-56 border-r border-border flex flex-col py-6 px-4 gap-1 shrink-0">
        <div className="mb-6 px-2">
          <span className="font-bold text-lg tracking-tight">OpenScout</span>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {NAV.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors text-foreground/80 hover:text-foreground"
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>

        <form action="/api/auth/signout" method="POST">
          <button
            type="submit"
            className="flex w-full items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </form>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
