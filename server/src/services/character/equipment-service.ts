import { eq } from 'drizzle-orm';
import { characters, itemTemplates, inventory } from '../../db/schema';

/** Equip a tool to a character's tool slot */
export async function equipTool(
  db: any,
  characterId: string,
  inventoryItemId: string,
): Promise<{ success: boolean; error?: string }> {
  // Verify item exists and is a tool
  const [invItem] = await db
    .select()
    .from(inventory)
    .where(eq(inventory.id, inventoryItemId))
    .limit(1);

  if (!invItem) return { success: false, error: 'Item not found' };

  const [template] = await db
    .select()
    .from(itemTemplates)
    .where(eq(itemTemplates.id, invItem.itemId))
    .limit(1);

  if (!template || template.type !== 'tool') {
    return { success: false, error: 'Item is not a tool' };
  }

  // Equip
  await db
    .update(characters)
    .set({ toolItemId: invItem.itemId })
    .where(eq(characters.id, characterId));

  return { success: true };
}

/** Equip an identity item to one of 3 identity slots */
export async function equipIdentity(
  db: any,
  characterId: string,
  inventoryItemId: string,
  slot: 1 | 2 | 3,
): Promise<{ success: boolean; error?: string }> {
  const [invItem] = await db
    .select()
    .from(inventory)
    .where(eq(inventory.id, inventoryItemId))
    .limit(1);

  if (!invItem) return { success: false, error: 'Item not found' };

  const [template] = await db
    .select()
    .from(itemTemplates)
    .where(eq(itemTemplates.id, invItem.itemId))
    .limit(1);

  if (!template || template.type !== 'identity') {
    return { success: false, error: 'Item is not an identity item' };
  }

  const slotField = `identity${slot}Id` as 'identity1Id' | 'identity2Id' | 'identity3Id';
  await db
    .update(characters)
    .set({ [slotField]: invItem.itemId })
    .where(eq(characters.id, characterId));

  return { success: true };
}

/** Unequip from a slot */
export async function unequipSlot(
  db: any,
  characterId: string,
  slotType: 'tool' | 'identity1' | 'identity2' | 'identity3',
): Promise<void> {
  const fieldMap: Record<string, string> = {
    tool: 'toolItemId',
    identity1: 'identity1Id',
    identity2: 'identity2Id',
    identity3: 'identity3Id',
  };
  const field = fieldMap[slotType];
  if (!field) return;

  await db
    .update(characters)
    .set({ [field]: null } as any)
    .where(eq(characters.id, characterId));
}

/** Calculate effective stats with equipment bonuses */
export async function getEffectiveStats(
  db: any,
  characterId: string,
): Promise<Record<string, number>> {
  const [char] = await db
    .select()
    .from(characters)
    .where(eq(characters.id, characterId))
    .limit(1);

  if (!char) throw new Error('Character not found');

  const baseStats: Record<string, number> = {
    stamina: char.stamina,
    efficiency: char.efficiency,
    precision: char.precision,
    mental: char.mental,
    initiative: char.initiative,
    discipline: char.discipline,
    luck: char.luck,
  };

  // Apply identity item effects
  const identityIds = [char.identity1Id, char.identity2Id, char.identity3Id].filter(Boolean);
  for (const itemId of identityIds) {
    if (!itemId) continue;
    const [item] = await db
      .select()
      .from(itemTemplates)
      .where(eq(itemTemplates.id, itemId))
      .limit(1);

    if (item?.effectJson) {
      const effects = item.effectJson as Record<string, unknown>;
      for (const [stat, mod] of Object.entries(effects)) {
        if (stat in baseStats && typeof mod === 'number') {
          baseStats[stat] = Math.max(1, Math.min(10, baseStats[stat] + mod));
        }
      }
    }
  }

  return baseStats;
}
