import { resolveSkillDescriptor } from "./skill-registry.js";
const rulesOf = (id) => resolveSkillDescriptor(id).rules;
/** 合并玩家拥有的全部技能的 rules：数值求和、布尔 OR、responseMultiplier 取最大、targetImmunity 取并集。 */
export function getSkillRules(player) {
    const resolved = {
        distanceDelta: 0,
        trickDistanceExempt: false,
        slashLimitExempt: false,
        responseMultiplier: 1,
        targetImmunity: [],
        peachSaveBonus: 0,
        skipDiscardPhaseIfNoSlash: false,
        handLimitDelta: 0,
    };
    for (const skillId of new Set(player.skills)) {
        const rules = rulesOf(skillId);
        if (!rules) {
            continue;
        }
        if (typeof rules.distanceDelta === "number") {
            resolved.distanceDelta += rules.distanceDelta;
        }
        if (rules.trickDistanceExempt) {
            resolved.trickDistanceExempt = true;
        }
        if (rules.slashLimitExempt) {
            resolved.slashLimitExempt = true;
        }
        if (rules.skipDiscardPhaseIfNoSlash) {
            resolved.skipDiscardPhaseIfNoSlash = true;
        }
        if (typeof rules.responseMultiplier === "number") {
            resolved.responseMultiplier = Math.max(resolved.responseMultiplier, rules.responseMultiplier);
        }
        if (typeof rules.peachSaveBonus === "number") {
            resolved.peachSaveBonus += rules.peachSaveBonus;
        }
        if (typeof rules.handLimitDelta === "number") {
            resolved.handLimitDelta += rules.handLimitDelta;
        }
        if (rules.targetImmunity && rules.targetImmunity.cards.length > 0) {
            resolved.targetImmunity.push({
                skillId,
                cards: new Set(rules.targetImmunity.cards),
                requireEmptyHand: rules.targetImmunity.requireEmptyHand ?? false,
            });
        }
    }
    return resolved;
}
/**
 * 「本回合已发动技能」的数值规则求和：用于裸衣 `damageDelta`、英姿/裸衣 `drawPhaseDelta` 这类
 * 发动后才生效的效果。`isUsed` 通常传 `(id) => ctx.isSkillUsed(player.id, id)`。
 */
export function sumActivatedRules(player, key, isUsed) {
    let total = 0;
    for (const skillId of new Set(player.skills)) {
        if (!isUsed(skillId)) {
            continue;
        }
        const value = rulesOf(skillId)?.[key];
        if (typeof value === "number") {
            total += value;
        }
    }
    return total;
}
/**
 * 手牌上限（默认 = 当前体力值 + `rules.handLimitDelta` 之和 + 代码技能的 `handLimit(player)`，下限 0）。
 * 纯函数：只读 `player.hp` 与 `player.skills`，因此引擎与 UI（`render-lines.ts`）能对同一份快照算出同一个数。
 * 弃牌阶段的"该弃几张"必须统一走它，别再写 `player.hand.length - player.hp`。
 */
export function getHandLimit(player) {
    let delta = getSkillRules(player).handLimitDelta;
    for (const skillId of new Set(player.skills)) {
        // 代码技能可以给"运行时变量"的手牌上限修正（如绝境 X = 已损失体力值）。
        const computed = resolveSkillDescriptor(skillId).handLimit?.(player);
        if (typeof computed === "number" && Number.isFinite(computed)) {
            delta += computed;
        }
    }
    return Math.max(0, player.hp + delta);
}
/** 目标免疫：命中任一技能的 targetImmunity.cards，且满足 requireEmptyHand 条件（空城需空手）。 */
export function isImmuneTo(player, card) {
    return immunitySource(player, card) !== undefined;
}
/** 返回实际生效的免疫来源技能 id（第一个命中的；无免疫时返回 undefined）。 */
export function immunitySource(player, card) {
    for (const entry of getSkillRules(player).targetImmunity) {
        if (!entry.cards.has(card)) {
            continue;
        }
        if (entry.requireEmptyHand && player.hand.length > 0) {
            continue;
        }
        return entry.skillId;
    }
    return undefined;
}
/** 免疫来源技能的展示名（日志用；无免疫时返回 undefined）。 */
export function immunitySourceName(player, card) {
    const skillId = immunitySource(player, card);
    return skillId === undefined ? undefined : (resolveSkillDescriptor(skillId).displayName ?? skillId);
}
/**
 * 找出玩家拥有的、声明了该布尔规则的第一个技能 id。
 * 用于"需要为哪个技能询问是否发动"的场景（如克己跳弃牌），调用方据此拿展示名做提示。
 * 只返回第一个声明者：同一玩家带多个同类技能时不做合并询问（与 rules 的 OR 合并语义一致）。
 */
export function findSkillWithBooleanRule(player, key) {
    for (const skillId of new Set(player.skills)) {
        if (rulesOf(skillId)?.[key]) {
            return skillId;
        }
    }
    return null;
}
