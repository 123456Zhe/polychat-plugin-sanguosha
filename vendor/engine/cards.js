export var CardType;
(function (CardType) {
    CardType["Slash"] = "\u6740";
    CardType["FireSlash"] = "\u706B\u6740";
    CardType["Dodge"] = "\u95EA";
    CardType["Peach"] = "\u6843";
    CardType["Dismantle"] = "\u8FC7\u6CB3\u62C6\u6865";
    CardType["Snatch"] = "\u987A\u624B\u7275\u7F8A";
    CardType["Duel"] = "\u51B3\u6597";
    CardType["ExNihilo"] = "\u65E0\u4E2D\u751F\u6709";
    CardType["Barbarian"] = "\u5357\u86EE\u5165\u4FB5";
    CardType["ArrowRain"] = "\u4E07\u7BAD\u9F50\u53D1";
    CardType["Collateral"] = "\u501F\u5200\u6740\u4EBA";
    CardType["Negate"] = "\u65E0\u61C8\u53EF\u51FB";
    CardType["PeachGarden"] = "\u6843\u56ED\u7ED3\u4E49";
    CardType["Harvest"] = "\u4E94\u8C37\u4E30\u767B";
    CardType["Crossbow"] = "\u8BF8\u845B\u8FDE\u5F29";
    CardType["FemaleSword"] = "\u96CC\u96C4\u53CC\u80A1\u5251";
    CardType["QinggangSword"] = "\u9752\u91ED\u5251";
    CardType["IceSword"] = "\u5BD2\u51B0\u5251";
    CardType["GudingBlade"] = "\u53E4\u952D\u5200";
    CardType["SerpentSpear"] = "\u4E08\u516B\u86C7\u77DB";
    CardType["GreenDragonBlade"] = "\u9752\u9F99\u5043\u6708\u5200";
    CardType["RockCleavingAxe"] = "\u8D2F\u77F3\u65A7";
    CardType["Halberd"] = "\u65B9\u5929\u753B\u621F";
    CardType["KylinBow"] = "\u9E92\u9E9F\u5F13";
    CardType["EightDiagram"] = "\u516B\u5366\u9635";
    CardType["VineArmor"] = "\u85E4\u7532";
    CardType["SilverLion"] = "\u767D\u94F6\u72EE\u5B50";
    CardType["Dilu"] = "\u7684\u5362";
    CardType["JueYing"] = "\u7EDD\u5F71";
    CardType["ZhuaHuangFeiDian"] = "\u722A\u9EC4\u98DE\u7535";
    CardType["ChiTu"] = "\u8D64\u5154";
    CardType["DaYuan"] = "\u5927\u5B9B";
    CardType["ZiXing"] = "\u7D2B\u9A8D";
    CardType["WoodenOx"] = "\u6728\u725B\u6D41\u9A6C";
    // 延时锦囊
    CardType["Indulgence"] = "\u4E50\u4E0D\u601D\u8700";
    CardType["SuppliesCut"] = "\u5175\u7CAE\u5BF8\u65AD";
    CardType["Lightning"] = "\u95EA\u7535";
})(CardType || (CardType = {}));
const deckPattern = [];
const appendCards = (type, count, color = "colorless") => {
    for (let i = 0; i < count; i += 1) {
        deckPattern.push({ type, color });
    }
};
appendCards(CardType.Slash, 9, "red");
appendCards(CardType.Slash, 12, "black");
appendCards(CardType.FireSlash, 3, "red");
appendCards(CardType.Dodge, 6, "red");
appendCards(CardType.Dodge, 6, "black");
appendCards(CardType.Peach, 8, "red");
appendCards(CardType.Dismantle, 5);
appendCards(CardType.Snatch, 4);
appendCards(CardType.Duel, 3);
appendCards(CardType.ExNihilo, 4);
appendCards(CardType.Barbarian, 2);
appendCards(CardType.ArrowRain, 2);
appendCards(CardType.Collateral, 2);
appendCards(CardType.Negate, 4);
appendCards(CardType.PeachGarden, 2);
appendCards(CardType.Harvest, 2);
appendCards(CardType.Crossbow, 1);
appendCards(CardType.FemaleSword, 1);
appendCards(CardType.QinggangSword, 1);
appendCards(CardType.IceSword, 1);
appendCards(CardType.GudingBlade, 1);
appendCards(CardType.SerpentSpear, 1);
appendCards(CardType.GreenDragonBlade, 1);
appendCards(CardType.RockCleavingAxe, 1);
appendCards(CardType.Halberd, 1);
appendCards(CardType.KylinBow, 1);
appendCards(CardType.EightDiagram, 1);
appendCards(CardType.VineArmor, 1);
appendCards(CardType.SilverLion, 1);
appendCards(CardType.Dilu, 1);
appendCards(CardType.JueYing, 1);
appendCards(CardType.ZhuaHuangFeiDian, 1);
appendCards(CardType.ChiTu, 1);
appendCards(CardType.DaYuan, 1);
appendCards(CardType.ZiXing, 1);
appendCards(CardType.WoodenOx, 1);
appendCards(CardType.Indulgence, 3);
appendCards(CardType.SuppliesCut, 2);
appendCards(CardType.Lightning, 2);
export const CARD_LIBRARY = deckPattern.map((item, index) => {
    const suit = item.color === "red"
        ? (index % 2 === 0 ? "heart" : "diamond")
        : item.color === "black"
            ? (index % 2 === 0 ? "club" : "spade")
            : ["heart", "diamond", "club", "spade"][index % 4] ?? "spade";
    return {
        id: `${item.type}-${index + 1}`,
        type: item.type,
        color: suit === "heart" || suit === "diamond" ? "red" : "black",
        suit,
        rank: (index % 13) + 1,
    };
});
export const CARD_LIBRARY_SUMMARY = [
    { type: CardType.Slash, count: 21 },
    { type: CardType.FireSlash, count: 3 },
    { type: CardType.Dodge, count: 12 },
    { type: CardType.Peach, count: 8 },
    { type: CardType.Dismantle, count: 5 },
    { type: CardType.Snatch, count: 4 },
    { type: CardType.Duel, count: 3 },
    { type: CardType.ExNihilo, count: 4 },
    { type: CardType.Barbarian, count: 2 },
    { type: CardType.ArrowRain, count: 2 },
    { type: CardType.Collateral, count: 2 },
    { type: CardType.Negate, count: 4 },
    { type: CardType.PeachGarden, count: 2 },
    { type: CardType.Harvest, count: 2 },
    { type: CardType.Crossbow, count: 1 },
    { type: CardType.FemaleSword, count: 1 },
    { type: CardType.QinggangSword, count: 1 },
    { type: CardType.IceSword, count: 1 },
    { type: CardType.GudingBlade, count: 1 },
    { type: CardType.SerpentSpear, count: 1 },
    { type: CardType.GreenDragonBlade, count: 1 },
    { type: CardType.RockCleavingAxe, count: 1 },
    { type: CardType.Halberd, count: 1 },
    { type: CardType.KylinBow, count: 1 },
    { type: CardType.EightDiagram, count: 1 },
    { type: CardType.VineArmor, count: 1 },
    { type: CardType.SilverLion, count: 1 },
    { type: CardType.Dilu, count: 1 },
    { type: CardType.JueYing, count: 1 },
    { type: CardType.ZhuaHuangFeiDian, count: 1 },
    { type: CardType.ChiTu, count: 1 },
    { type: CardType.DaYuan, count: 1 },
    { type: CardType.ZiXing, count: 1 },
    { type: CardType.WoodenOx, count: 1 },
    { type: CardType.Indulgence, count: 3 },
    { type: CardType.SuppliesCut, count: 2 },
    { type: CardType.Lightning, count: 2 },
];
export const createDeck = () => [...CARD_LIBRARY];
export const shuffle = (items, rng) => {
    const copied = [...items];
    for (let i = copied.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        const current = copied[i];
        const target = copied[j];
        if (current === undefined || target === undefined) {
            continue;
        }
        copied[i] = target;
        copied[j] = current;
    }
    return copied;
};
