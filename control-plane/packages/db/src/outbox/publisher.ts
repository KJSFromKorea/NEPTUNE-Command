import { query } from "../client.js";

export interface OutboxMessage { id: string; event_id: string; event_type: string; payload: unknown; created_at: string; }
export interface OutboxPublisherOptions { batchSize?: number; lockTimeoutSeconds?: number; }
export type Publish = (message: OutboxMessage) => Promise<void>;

export class OutboxPublisher {
  private readonly batchSize: number;
  private readonly lockTimeoutSeconds: number;
  constructor(private readonly publish: Publish, options: OutboxPublisherOptions = {}) { this.batchSize = options.batchSize ?? 100; this.lockTimeoutSeconds = options.lockTimeoutSeconds ?? 30; }

  async publishBatch(): Promise<number> {
    const claimed = await query<OutboxMessage>(`WITH claimed AS (
      SELECT id FROM outbox_events
      WHERE published_at IS NULL AND (locked_at IS NULL OR locked_at < now() - ($2 || ' seconds')::interval)
      ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT $1
    ) UPDATE outbox_events o SET locked_at=now() FROM claimed c WHERE o.id=c.id RETURNING o.id,o.event_id,o.event_type,o.payload,o.created_at`, [this.batchSize, this.lockTimeoutSeconds]);
    let published = 0;
    for (const message of claimed.rows) {
      try {
        await this.publish(message);
        await query(`UPDATE outbox_events SET published_at=now(), locked_at=NULL, attempts=COALESCE(attempts,0)+1 WHERE id=$1`, [message.id]);
        published++;
      } catch (error) {
        await query(`UPDATE outbox_events SET attempts=COALESCE(attempts,0)+1, last_error=$2, locked_at=NULL WHERE id=$1`, [message.id, error instanceof Error ? error.message : String(error)]);
      }
    }
    return published;
  }
}
