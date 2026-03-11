import { loadSaveGame } from '$lib/data/store';
import { db } from '$lib/data/db';
import * as schema from '$lib/data/schema';
import { eq, and, count } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
  const save = loadSaveGame();
  
  if (!save) {
    return { hasSave: false };
  }

  const unreadInboxCount = db.select({ value: count() })
    .from(schema.inboxMessages)
    .where(and(
      eq(schema.inboxMessages.teamId, save.manager.teamId),
      eq(schema.inboxMessages.isRead, false)
    ))
    .get();

  return {
    hasSave: true,
    manager: save.manager,
    currentDate: save.currentDate,
    unreadInboxCount: unreadInboxCount?.value || 0
  };
};