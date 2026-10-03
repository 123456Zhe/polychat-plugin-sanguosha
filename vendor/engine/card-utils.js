import { CardType } from "./cards.js";
export function isWeaponCard(cardType) {
    return (cardType === CardType.Crossbow ||
        cardType === CardType.FemaleSword ||
        cardType === CardType.QinggangSword ||
        cardType === CardType.IceSword ||
        cardType === CardType.SilverMoonSpear ||
        cardType === CardType.GudingBlade ||
        cardType === CardType.SerpentSpear ||
        cardType === CardType.GreenDragonBlade ||
        cardType === CardType.RockCleavingAxe ||
        cardType === CardType.Halberd ||
        cardType === CardType.KylinBow ||
        cardType === CardType.VermilionFan);
}
export function isArmorCard(cardType) {
    return (cardType === CardType.EightDiagram ||
        cardType === CardType.RenWangShield ||
        cardType === CardType.VineArmor ||
        cardType === CardType.SilverLion);
}
export function isSlashCard(cardType) {
    return cardType === CardType.Slash || cardType === CardType.FireSlash || cardType === CardType.ThunderSlash;
}
export function isDefenseHorseCard(cardType) {
    return (cardType === CardType.Dilu ||
        cardType === CardType.JueYing ||
        cardType === CardType.ZhuaHuangFeiDian ||
        cardType === CardType.HuaLiu);
}
export function isAttackHorseCard(cardType) {
    return cardType === CardType.ChiTu || cardType === CardType.DaYuan || cardType === CardType.ZiXing;
}
export function isTreasureCard(cardType) {
    return cardType === CardType.WoodenOx;
}
export function isEquipCard(cardType) {
    return (isWeaponCard(cardType) ||
        isArmorCard(cardType) ||
        isDefenseHorseCard(cardType) ||
        isAttackHorseCard(cardType) ||
        isTreasureCard(cardType));
}
export function isDelayedTrickCard(cardType) {
    return cardType === CardType.Indulgence || cardType === CardType.SuppliesCut || cardType === CardType.Lightning;
}
export function isNonDelayedTrickCard(cardType) {
    return (cardType === CardType.Dismantle ||
        cardType === CardType.Snatch ||
        cardType === CardType.Duel ||
        cardType === CardType.ExNihilo ||
        cardType === CardType.Barbarian ||
        cardType === CardType.ArrowRain ||
        cardType === CardType.Collateral ||
        cardType === CardType.PeachGarden ||
        cardType === CardType.Harvest);
}
export function cardNeedsTarget(cardType) {
    return (isSlashCard(cardType) ||
        cardType === CardType.Dismantle ||
        cardType === CardType.Snatch ||
        cardType === CardType.Duel ||
        cardType === CardType.Collateral ||
        cardType === CardType.FireAttack ||
        cardType === CardType.IronChain ||
        cardType === CardType.Indulgence ||
        cardType === CardType.SuppliesCut);
}
export function usableCardCount(player) {
    return player.hand.length + player.treasureCards.length;
}
export function hasRemovableCard(player) {
    return (player.hand.length > 0 ||
        player.weapon !== null ||
        player.armor !== null ||
        player.defenseHorse !== null ||
        player.attackHorse !== null ||
        player.treasure !== null);
}
export function countRemovableSelfCards(player) {
    return (player.hand.length +
        (player.weapon ? 1 : 0) +
        (player.armor ? 1 : 0) +
        (player.defenseHorse ? 1 : 0) +
        (player.attackHorse ? 1 : 0) +
        (player.treasure ? 1 : 0));
}
export const SUIT_LABELS = {
    heart: "红桃",
    diamond: "方片",
    club: "梅花",
    spade: "黑桃",
    none: "",
};
const RANK_LABELS = {
    1: "A",
    11: "J",
    12: "Q",
    13: "K",
};
/** 点数显示：1→A，11/12/13→J/Q/K，其余用数字；0 或无效点数不显示 */
export function rankLabel(rank) {
    if (rank <= 0) {
        return "";
    }
    return RANK_LABELS[rank] ?? String(rank);
}
/**
 * 卡牌完整描述，如：杀[黑桃7]、闪[红桃A]。
 * 无花色/点数的牌（如虚拟牌）只显示牌名。
 */
export function describeCard(card) {
    const suit = SUIT_LABELS[card.suit] ?? "";
    const rank = rankLabel(card.rank);
    if (!suit && !rank) {
        return card.type;
    }
    return `${card.type}[${suit}${rank}]`;
}
/**
 * 判定一次杀攻击的属性。
 * 朱雀羽扇：装备者的普通杀视为火杀；雷杀不受影响。
 */
export function slashKindOf(attacker, cardType) {
    if (cardType === CardType.FireSlash) {
        return "fire";
    }
    if (cardType === CardType.ThunderSlash) {
        return "thunder";
    }
    if (attacker.weapon === CardType.VermilionFan) {
        return "fire";
    }
    return "normal";
}
/** 属性伤害类型（火/雷），普通伤害返回 null */
export function attributeDamageKind(cardType) {
    if (cardType === CardType.FireSlash || cardType === CardType.FireAttack) {
        return "fire";
    }
    if (cardType === CardType.ThunderSlash || cardType === CardType.Lightning) {
        return "thunder";
    }
    return null;
}
