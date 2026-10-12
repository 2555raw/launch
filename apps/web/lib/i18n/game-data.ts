/**
 * Chinese names and descriptions for game catalogue entries (buildings, troops, achievements).
 * The engine stays English; the UI looks up translations here by key.
 */
import type { Locale } from './index';

export const BUILDING_ZH: Record<string, { name: string; description: string }> = {
  town_hall: { name: '大本营', description: '你的聚落中心。升级它可以解锁新的建筑、更高的等级和更多部队。' },
  gold_mine: { name: '金矿', description: '从山丘中开采黄金。记得在矿满之前收取。' },
  elixir_collector: { name: '圣水收集器', description: '从地脉中汲取圣水，用于训练部队和研究。' },
  gold_storage: { name: '金库', description: '储存黄金。进攻者可以掠夺其中的一部分。' },
  elixir_storage: { name: '圣水瓶', description: '储存圣水。进攻者可以掠夺其中的一部分。' },
  barracks: { name: '兵营', description: '训练部队。等级越高，解锁的兵种越强。' },
  army_camp: { name: '军营', description: '在出征前安置训练好的部队。' },
  laboratory: { name: '实验室', description: '研究部队升级。' },
  builder_hut: { name: '建筑工人小屋', description: '每座小屋增加一名建筑工人。所有建造和升级都需要工人。' },
  clan_hall: { name: '部落大厅', description: '加入部落、请求援军并与部落成员聊天。' },
  crystal_mine: { name: '水晶矿', description: '从深层矿脉中缓慢产出水晶（高级货币）。' },
  arrow_tower: { name: '箭塔', description: '远程单体防御，可攻击地面和空中目标。' },
  cannon: { name: '加农炮', description: '便宜而结实的地面防御。' },
  mortar: { name: '迫击炮', description: '对成群的地面部队造成溅射伤害，无法攻击近处目标。' },
  mage_tower: { name: '法师塔', description: '短程溅射伤害，可攻击地面和空中目标。' },
  wall: { name: '城墙', description: '减缓地面部队。把重要建筑围起来。' },
};

export const TROOP_ZH: Record<string, { name: string; description: string }> = {
  grunt: { name: '蛮兵', description: '无畏的近战斗士。便宜、训练快，攻击最近的目标。' },
  ranger: { name: '游侠', description: '远程射击，可越过城墙攻击目标。' },
  brute: { name: '巨人', description: '行动缓慢的肌肉巨汉，直奔防御建筑。' },
  breacher: { name: '破墙者', description: '冲向最近的城墙并将其炸开。一次性使用。' },
  sky_scout: { name: '天空侦察兵', description: '有翼的掠夺者，完全无视城墙。只有对空防御能伤到它。' },
  pyromancer: { name: '炎术师', description: '投掷火焰，溅射到附近建筑。脆弱但毁灭性极强。' },
};

export const ACHIEVEMENT_ZH: Record<string, { name: string; description: string }> = {
  raider: { name: '掠夺者', description: '在对其他玩家的进攻中获胜。' },
  ascendant: { name: '登顶者', description: '达到奖杯里程碑。' },
  architect: { name: '建筑师', description: '完成建筑升级。' },
  drillmaster: { name: '教官', description: '训练部队。' },
  gold_hoarder: { name: '黄金囤积者', description: '从敌人处掠夺黄金。' },
  elixir_hoarder: { name: '圣水囤积者', description: '从敌人处掠夺圣水。' },
  bulwark: { name: '壁垒', description: '成功防守你的村庄。' },
  benefactor: { name: '恩主', description: '向部落成员捐赠部队。' },
  foundations: { name: '地基', description: '升级你的大本营。' },
};

export const CATEGORY_ZH: Record<string, string> = { all: '全部', core: '核心', resource: '资源', storage: '储存', defense: '防御', army: '军队', wall: '城墙', special: '特殊' };

export function buildingName(locale: Locale, type: string, fallback: string): string {
  return locale === 'zh' ? BUILDING_ZH[type]?.name ?? fallback : fallback;
}
export function buildingDescription(locale: Locale, type: string, fallback: string): string {
  return locale === 'zh' ? BUILDING_ZH[type]?.description ?? fallback : fallback;
}
export function troopName(locale: Locale, type: string, fallback: string): string {
  return locale === 'zh' ? TROOP_ZH[type]?.name ?? fallback : fallback;
}
export function troopDescription(locale: Locale, type: string, fallback: string): string {
  return locale === 'zh' ? TROOP_ZH[type]?.description ?? fallback : fallback;
}
export function achievementName(locale: Locale, key: string, fallback: string): string {
  return locale === 'zh' ? ACHIEVEMENT_ZH[key]?.name ?? fallback : fallback;
}
export function achievementDescription(locale: Locale, key: string, fallback: string): string {
  return locale === 'zh' ? ACHIEVEMENT_ZH[key]?.description ?? fallback : fallback;
}
export function categoryLabel(locale: Locale, key: string, fallback: string): string {
  return locale === 'zh' ? CATEGORY_ZH[key] ?? fallback : fallback;
}
