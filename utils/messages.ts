import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { MAX_MESSAGES, MESSAGE_ORDER } from '@/lib/config';
import type { Geometry } from '@/lib/geometry';
import { assignGridCells } from '@/utils/grid';

export interface Message {
  id: number;
  text: string;
  fontFamily: string;
  createdAt: string;
  updatedAt: string;
  /** Where the message sits on the card. Always present: rows without one get a computed place. */
  box: Geometry;
}

// Listed explicitly, so the edit token hash is never read for display.
const MESSAGE_SELECT = {
  id: true,
  text: true,
  fontFamily: true,
  createdAt: true,
  updatedAt: true,
  placeX: true,
  placeY: true,
  placeWidth: true,
  placeHeight: true,
  placeRotation: true,
} as const;

type Row = Prisma.MessageGetPayload<{ select: typeof MESSAGE_SELECT }>;

function storedBox(row: Row): Geometry | null {
  const { placeX, placeY, placeWidth, placeHeight, placeRotation } = row;
  if (
    placeX === null ||
    placeY === null ||
    placeWidth === null ||
    placeHeight === null ||
    placeRotation === null
  ) {
    return null;
  }
  return { x: placeX, y: placeY, width: placeWidth, height: placeHeight, rotation: placeRotation };
}

// Messages written when the card was a 4x4 grid have no place of their own. They keep a
// grid cell derived from their id, with a small turn so they still look handwritten.
const LEGACY_GRID = 4;
const LEGACY_SIZE = 0.2;

function legacyBoxes(ids: number[]): Map<number, Geometry> {
  const cells = assignGridCells(ids, LEGACY_GRID, LEGACY_GRID);
  const boxes = new Map<number, Geometry>();
  for (const [id, [row, col]] of cells) {
    boxes.set(id, {
      x: (col + 0.5) / LEGACY_GRID,
      y: (row + 0.5) / LEGACY_GRID,
      width: LEGACY_SIZE,
      height: LEGACY_SIZE,
      rotation: ((id * 37) % 13) - 6,
    });
  }
  return boxes;
}

function toMessages(rows: Row[]): Message[] {
  const legacy = legacyBoxes(rows.filter((row) => storedBox(row) === null).map((row) => row.id));
  const messages: Message[] = [];
  for (const row of rows) {
    const box = storedBox(row) ?? legacy.get(row.id);
    if (!box) continue;
    messages.push({
      id: row.id,
      text: row.text,
      fontFamily: row.fontFamily,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      box,
    });
  }
  return messages;
}

/**
 * Reads the card's messages straight from the database, each with its place on the card.
 * Throws if the database is unreachable. Pass a transaction to read inside it.
 */
export async function getMessages(
  db: Pick<Prisma.TransactionClient, 'message'> = prisma,
): Promise<Message[]> {
  const rows = await db.message.findMany({
    orderBy: MESSAGE_ORDER,
    take: MAX_MESSAGES,
    select: MESSAGE_SELECT,
  });
  return toMessages(rows);
}

/**
 * Writes the computed place of every message that still lacks one into the database.
 * Removing or moving one message must not change where the others sit, so layout changes
 * call this first, inside the layout lock. Messages that already have a place are untouched.
 */
export async function pinLegacyBoxes(db: Pick<Prisma.TransactionClient, 'message'>): Promise<void> {
  const rows = await db.message.findMany({ orderBy: MESSAGE_ORDER, select: MESSAGE_SELECT });
  const missing = rows.filter((row) => storedBox(row) === null);
  if (missing.length === 0) return;
  const boxes = legacyBoxes(missing.map((row) => row.id));
  for (const row of missing) {
    const box = boxes.get(row.id);
    if (!box) continue;
    await db.message.update({
      where: { id: row.id },
      data: {
        placeX: box.x,
        placeY: box.y,
        placeWidth: box.width,
        placeHeight: box.height,
        placeRotation: box.rotation,
        updatedAt: row.updatedAt,
      },
    });
  }
}
