const REGISTRY_KEY = "__sanguoPackRegistry__";
const getRegistry = () => {
    const holder = globalThis;
    const existed = holder[REGISTRY_KEY];
    if (existed) {
        return existed;
    }
    const created = { skills: new Map() };
    holder[REGISTRY_KEY] = created;
    return created;
};
export function registerPackSkill(entry) {
    getRegistry().skills.set(entry.id, entry);
}
export function getPackSkill(id) {
    return getRegistry().skills.get(id);
}
export function getPackSkills() {
    return [...getRegistry().skills.values()];
}
export function getPackHooksFor(trigger) {
    return getPackSkills().filter((entry) => typeof entry.onTrigger?.[trigger] === "function");
}
export function resetPackSkills() {
    getRegistry().skills.clear();
}
