import { query, transaction } from "../client.js";

export interface AgentRecord { id: string; name: string; version?: string; status?: string; config?: unknown; metadata?: unknown; }
export class PgAgentRepository {
  async getById(id: string) { const r = await query<AgentRecord>(`SELECT * FROM agents WHERE id=$1`, [id]); return r.rows[0] ?? null; }
  async list(limit=100) { const r = await query<AgentRecord>(`SELECT * FROM agents ORDER BY created_at DESC LIMIT $1`, [limit]); return r.rows; }
  async upsert(agent: AgentRecord) { const r = await query<AgentRecord>(`INSERT INTO agents(id,name,version,status,config,metadata) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,version=EXCLUDED.version,status=EXCLUDED.status,config=EXCLUDED.config,metadata=EXCLUDED.metadata RETURNING *`, [agent.id,agent.name,agent.version ?? null,agent.status ?? null,JSON.stringify(agent.config ?? {}),JSON.stringify(agent.metadata ?? {})]); return r.rows[0]; }
}

export interface WorkflowRecord { id: string; workflow_type?: string; status?: string; input?: unknown; context?: unknown; }
export class PgWorkflowRepository {
  async getById(id: string) { const r = await query<WorkflowRecord>(`SELECT * FROM workflows WHERE id=$1`, [id]); return r.rows[0] ?? null; }
  async listActive(limit=100) { const r = await query<WorkflowRecord>(`SELECT * FROM workflows WHERE status NOT IN ('completed','failed','cancelled') ORDER BY created_at LIMIT $1`, [limit]); return r.rows; }
  async updateStatus(id: string, status: string, context?: unknown) { const r = await query<WorkflowRecord>(`UPDATE workflows SET status=$2, context=COALESCE($3::jsonb,context), updated_at=now() WHERE id=$1 RETURNING *`, [id,status,context == null ? null : JSON.stringify(context)]); return r.rows[0] ?? null; }
}
