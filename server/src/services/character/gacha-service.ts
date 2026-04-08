import { eq, and } from 'drizzle-orm';
import { gachaBanners, characterTemplates } from '../../db/schema';
import { createCharacterFromTemplate } from './character-service';

const DEFAULT_RATES: Record<string, number> = {
  N: 0.50,
  R: 0.30,
  SR: 0.15,
  SSR: 0.04,
  UR: 0.01,
};

/** Roll gacha — returns created character ID */
export async function rollGacha(
  db: any,
  userId: string,
  bannerId: string,
): Promise<{ characterId: string; grade: string; templateName: string }> {
  // Get banner
  const [banner] = await db
    .select()
    .from(gachaBanners)
    .where(
      and(
        eq(gachaBanners.id, bannerId),
        eq(gachaBanners.isActive, true),
      ),
    )
    .limit(1);

  if (!banner) throw new Error(`Banner ${bannerId} not found or inactive`);

  // Parse rates
  const rates: Record<string, number> = (banner.ratesJson as Record<string, number>) || DEFAULT_RATES;

  // Roll grade
  const grade = rollGrade(rates);

  // Get available templates for this grade
  const templates = await db
    .select()
    .from(characterTemplates)
    .where(eq(characterTemplates.grade, grade as 'N' | 'R' | 'SR' | 'SSR' | 'UR'));

  if (templates.length === 0) {
    throw new Error(`No templates found for grade ${grade}`);
  }

  // Check featured characters
  const featured = (banner.featuredIds as string[]) || [];
  const featuredTemplates = templates.filter((t: any) => featured.includes(t.id));

  let chosenTemplate: (typeof templates)[0];
  if (featuredTemplates.length > 0 && Math.random() < 0.5) {
    // 50% chance to get featured character (within same grade)
    chosenTemplate = featuredTemplates[Math.floor(Math.random() * featuredTemplates.length)];
  } else {
    chosenTemplate = templates[Math.floor(Math.random() * templates.length)];
  }

  // Create character instance
  const characterId = await createCharacterFromTemplate(db, userId, chosenTemplate.id);

  return {
    characterId,
    grade,
    templateName: chosenTemplate.name,
  };
}

/** Weighted random grade selection */
function rollGrade(rates: Record<string, number>): string {
  const roll = Math.random();
  let cumulative = 0;

  for (const [grade, rate] of Object.entries(rates)) {
    cumulative += rate;
    if (roll < cumulative) return grade;
  }

  return 'N'; // fallback
}

/** Get active banners */
export async function getActiveBanners(db: any) {
  const now = new Date();
  const banners = await db
    .select()
    .from(gachaBanners)
    .where(eq(gachaBanners.isActive, true));

  // Filter by time (if limited)
  return banners.filter((b: any) => {
    if (b.type === 'limited') {
      if (b.startsAt && new Date(b.startsAt) > now) return false;
      if (b.endsAt && new Date(b.endsAt) < now) return false;
    }
    return true;
  });
}
