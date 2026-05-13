import { createServiceClient } from "@/lib/supabase/server"

export type AuditAction =
  | "view_pii"
  | "generate_report"
  | "invite_candidate"
  | "ingest_candidate"
  | "score_candidate"
  | "start_interview"
  | "complete_interview"
  | "grant_access"
  | "revoke_access"

interface AuditLogParams {
  actor_id: string | null
  company_id: string | null
  action: AuditAction
  resource_type: string
  resource_id?: string
  metadata?: Record<string, unknown>
}

export async function logAuditEvent(params: AuditLogParams): Promise<void> {
  const supabase = createServiceClient()
  await supabase.from("audit_logs").insert({
    actor_id: params.actor_id,
    company_id: params.company_id,
    action: params.action,
    resource_type: params.resource_type,
    resource_id: params.resource_id ?? null,
    metadata: params.metadata ?? {},
  })
}
