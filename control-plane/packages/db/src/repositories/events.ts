import { randomUUID } from "node:crypto";
import { transaction } from "../client.js";

export interface EventRecord { id?: string; event_type: string; aggregate_type: string; aggregate_id: string; payload: unknown; metadata?: Record<string, unknown>; }
export interface EventRepository { append(event: EventRecord): Promise<string>; }

export class PgEventRepository implements EventRepository {
  async append(event: EventRecord): Promise<string> {
    return transaction(async (db) => {
      const id = event.id ?? randomUUID();
      // Table/column names follow the canonical Control Plane event + outbox contract.
      await db.query(`INSERT INTO events(id,event_type,aggregate_type,aggregate_id,payload,metadata) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb)`, [id,event.event_type,event.aggregate_type,event.aggregate_id,JSON.stringify(event.payload),JSON.stringify(event.metadata ?? {})]);
      await db.query(`INSERT INTO outbox_events(event_id,event_type,payload) VALUES($1,$2,$3::jsonb) ON CONFLICT DO NOTHING`, [id,event.event_type,JSON.stringify(event.payload)]);
      return id;
    });
  }
}
