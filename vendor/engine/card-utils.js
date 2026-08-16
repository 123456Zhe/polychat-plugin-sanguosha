import { CardType } from "./cards.js";
export function isWeaponCard(cardType) {
    return (cardType === CardType.Crossbow ||
        cardType === CardType.FemaleSword ||
        cardType === CardType.QinggangSword ||
        cardType === CardType.IceSword ||
        cardType === CardType.GudingBlade ||
        cardType === CardType.SerpentSpear ||
        cardType === CardType.GreenDragonBlade ||
        cardType === CardType.RockCleavingAxe ||
        cardType === CardType.Halberd ||
        cardType === CardType.KylinBow);
}
export function isArmorCard(cardType) {
    return (cardType === CardType.EightDiagram ||
        cardType === CardType.VineArmor ||
        cardType === CardType.SilverLion);
}
export function isSlashCard(cardType) {
    return cardType === CardType.Slash || cardType === CardType.FireSlash;
}
export function isDefenseHorseCard(cardType) {
    return cardType === CardType.Dilu || cardType === CardType.JueYing || cardType === CardType.ZhuaHuangFeiDian;
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
