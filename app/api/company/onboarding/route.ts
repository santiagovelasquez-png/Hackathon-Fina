import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const { company_name, sector, company_size, typical_roles } = body

    if (!company_name?.trim()) {
      return NextResponse.json({ error: "Nombre de empresa requerido" }, { status: 400 })
    }

    const service = createServiceClient()

    const { data: membership } = await service
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: "No tienes una empresa asociada" }, { status: 404 })
    }

    const { error } = await service
      .from("companies")
      .update({
        name: company_name.trim(),
        sector: sector ?? null,
        company_size: company_size ?? null,
        typical_roles: typical_roles ?? [],
        onboarding_completed: true,
      })
      .eq("id", membership.company_id)

    if (error) {
      console.error("Onboarding update error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("Onboarding route error:", e)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
