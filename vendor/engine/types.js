export var TurnPhase;
(function (TurnPhase) {
    TurnPhase["Judgment"] = "\u5224\u5B9A\u9636\u6BB5";
    TurnPhase["Draw"] = "\u6478\u724C\u9636\u6BB5";
    TurnPhase["Play"] = "\u51FA\u724C\u9636\u6BB5";
    TurnPhase["Discard"] = "\u5F03\u724C\u9636\u6BB5";
    TurnPhase["End"] = "\u7ED3\u675F\u9636\u6BB5";
})(TurnPhase || (TurnPhase = {}));
export const SkillName = {
    Heroic: "英姿",
    Roar: "咆哮",
    Assault: "强袭",
    JuShou: "据守",
    JieWei: "解围",
    JianXiong: "奸雄",
    HuJia: "护驾",
    QingGuo: "倾国",
    LuoShen: "洛神",
    GangLie: "刚烈",
    LuoYi: "裸衣",
    TuXi: "突袭",
    TianDu: "天妒",
    YiJi: "遗计",
    FanKui: "反馈",
    GuiCai: "鬼才",
    RenDe: "仁德",
    JiJiang: "激将",
    WuSheng: "武圣",
    LongDan: "龙胆",
    MaShu: "马术",
    TieQi: "铁骑",
    GuanXing: "观星",
    KongCheng: "空城",
    JiZhi: "集智",
    QiCai: "奇才",
    ZhiHeng: "制衡",
    JiuYuan: "救援",
    FanJian: "反间",
    KuRou: "苦肉",
    QianXun: "谦逊",
    LianYing: "连营",
    GuoSe: "国色",
    LiuLi: "流离",
    JieYin: "结姻",
    XiaoJi: "枭姬",
    WuShuang: "无双",
    LiJian: "离间",
    BiYue: "闭月",
    QingNang: "青囊",
    JiJiu: "急救",
    JiAng: "激昂",
    HunZi: "魂姿",
    YingHun: "英魂",
    ZhiBa: "制霸",
};
/** 势力常量。外部包可用自定义势力字符串。 */
export const KINGDOM = {
    Wei: "魏",
    Shu: "蜀",
    Wu: "吴",
    Qun: "群雄",
};
/**
 * 技能触发点 / 拦截点（Phase 0 的 4 个基础触发点 + Phase 6 的 7 个拦截点 + Phase 7 的 `provide_response`
 * + Phase 8 的准备/结束阶段触发点 + Phase 9 的 `dying` + Phase 10 的 `card_discarded`，共 16 个）。
 *
 * 事件类触发点只通知（钩子可改写 payload 里的数值，如 `drawCount`）；
 * 拦截类触发点可改写/否决引擎即将执行的行为（`judgment` / `slash_targeted` / `peach_save` /
 * `discard_phase_start` / `provide_response`，见各字段注释）。
 * `dying` 是事件类（`actor` 为濒死者，`reason` 为"濒死"），在桃救援之前发出：
 * 钩子可直接回复濒死者体力救人（如挽危/约俭），体力回到 1 点以上后救援循环自动跳过；
 * 监听"其他角色濒死"时技能须声明 `globalHook: true`。
 * `card_discarded` 是事件类（`actor` 为牌的原主，`card` 为进入弃牌堆的牌，`reason` 为"弃置"/"判定"），
 * 在牌置入弃牌堆后逐张发出：钩子可把该牌从弃牌堆移走获得之（如落英）；监听"其他角色弃牌"时
 * 技能须声明 `globalHook: true`。只有"弃置/判定"原因的入堆才发此触发点，"使用/打出"的牌入堆不发
 * （如使用过的杀、打出的闪）；装备重建牌、拼点牌、洛神红牌也不发。
 * 单一真相：`SkillTrigger` 由本数组派生，loader 校验与钩子分发都读它，避免多处清单漂移。
 */
export const SKILL_TRIGGERS = [
    // Phase 8：准备阶段（回合开始、判定阶段之前）与结束阶段（弃牌阶段之后、回合结束之前）。
    "prepare_phase_start",
    "turn_start",
    "before_draw",
    "before_damage",
    "after_damage",
    "judgment",
    "slash_targeted",
    "hand_card_lost",
    "equip_lost",
    "card_used",
    "peach_save",
    // Phase 9：进入濒死状态时（桃救援之前发出；钩子可直接回复濒死者体力救人）。
    "dying",
    // Phase 10：牌因弃置/判定进入弃牌堆时（逐张发出，见 `card`/`reason` 字段注释）。
    "card_discarded",
    "discard_phase_start",
    "end_phase_start",
    "provide_response",
];
export var PlayerRole;
(function (PlayerRole) {
    PlayerRole["Lord"] = "\u4E3B\u516C";
    PlayerRole["Loyalist"] = "\u5FE0\u81E3";
    PlayerRole["Rebel"] = "\u53CD\u8D3C";
    PlayerRole["Traitor"] = "\u5185\u5978";
})(PlayerRole || (PlayerRole = {}));
