/**
 * Session — a named workspace grouping related conversations.
 * First install has exactly one empty session.
 * Versioned for future migration support.
 */
export interface Session {
  id: string;
  name: string;
  /** Ordering hint for the sidebar. Lower = earlier. */
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  /** Schema version for future migrations */
  schemaVersion: number;
}
