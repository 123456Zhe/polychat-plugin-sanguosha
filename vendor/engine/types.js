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
 * 技能触发点 / 拦截点（Phase 0 的 4 个基础触发点 + Phase 6 新增的拦截点）。
 *
 * 前 4 个是"事件通知"（钩子可改写 payload 里的数值，如 `drawCount`）；
 * 后 7 个是 Phase 6 的拦截点（钩子可改写/否决引擎即将执行的行为，见各字段注释）。
 * 单一真相：`SkillTrigger` 由本数组派生，loader 校验与钩子分发都读它，避免多处清单漂移。
 */
export const SKILL_TRIGGERS = [
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
    "discard_phase_start",
];
export var PlayerRole;
(function (PlayerRole) {
    PlayerRole["Lord"] = "\u4E3B\u516C";
    PlayerRole["Loyalist"] = "\u5FE0\u81E3";
    PlayerRole["Rebel"] = "\u53CD\u8D3C";
    PlayerRole["Traitor"] = "\u5185\u5978";
})(PlayerRole || (PlayerRole = {}));
