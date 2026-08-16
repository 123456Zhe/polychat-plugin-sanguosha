import { callOllamaChatDetailed, listOllamaModels, probeOllamaConnectivity } from "./ollama.js";
import { buildAgentPrompt, buildInteractionPrompt, buildStrategyPrompt, pickReasoningLevel, REASONING_EFFORT, REASONING_THINKING_MULTIPLIER, } from "./prompt.js";
import { callQwen35PlusDetailed, probeQwenConnectivity } from "./qwen.js";
import { writeAiLog } from "../devlog/ailog.js";
import { parseStrategyReview, StrategyMemory } from "./strategy-memory.js";
const DEFAULT_MAX_CONTEXT_ROUNDS = 30;
const DEFAULT_THINKING_MS = 1200;
/** 复盘时只回看最近 8 个轮次，避免把整段共享历史重复塞入复盘 prompt。 */
const STRATEGY_REVIEW_MAX_ROUNDS = 8;
const delay = async (ms) => {
    await new Promise((resolve) => {
        setTimeout(() => resolve(), ms);
    });
};
/** 将子代理的分层策略记忆组装为 prompt 的 strategyNote 字段（空记忆不传）。 */
const strategyNoteFor = (agent) => {
    const block = agent.memory.composePromptBlock();
    return block ? { strategyNote: block } : {};
};
const normalizeJson = (text) => {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
        return fenced[1].trim();
    }
    return text.trim();
};
const parseJsonObject = (text) => {
    const payload = normalizeJson(text);
    try {
        const parsed = JSON.parse(payload);
        return parsed && typeof parsed === "object" ? parsed : null;
    }
    catch {
        const objectMatch = payload.match(/\{[\s\S]*\}/);
        if (!objectMatch) {
            return null;
        }
        try {
            const parsed = JSON.parse(objectMatch[0]);
            return parsed && typeof parsed === "object" ? parsed : null;
        }
        catch {
            return null;
        }
    }
};
const parseModelDecision = (text) => {
    const parsed = parseJsonObject(text);
    if (!parsed) {
        return null;
    }
    const actionIndex = parsed.actionIndex;
    const targetId = typeof parsed.targetId === "string" ? parsed.targetId : undefined;
    if (typeof actionIndex === "number" || (typeof actionIndex === "string" && /^\d+$/.test(actionIndex.trim()))) {
        return targetId ? { actionIndex, targetId } : { actionIndex };
    }
    return null;
};
const normalizeActionIndex = (value) => {
    if (typeof value === "number" && Number.isInteger(value)) {
        return value;
    }
    if (typeof value === "string" && /^\d+$/.test(value.trim())) {
        return Number.parseInt(value.trim(), 10);
    }
    return null;
};
export class GameAiLoop {
    rulesText;
    started;
    preferredProvider;
    providerStatus;
    failedAttempts;
    subAgents;
    lastFailureReason;
    preferredOllamaModel;
    previousRoundContexts;
    maxContextRounds;
    thinkingMs;
    reasoningMode;
    /** 联机断线托管：允许驱动 isAI=false 的人类座位（玩家掉线后由 AI 代打）。 */
    allowNonAiSeats = false;
    constructor(rulesText, preferredProvider = "qwen") {
        this.rulesText = rulesText;
        this.started = false;
        this.preferredProvider = preferredProvider;
        this.providerStatus = {
            qwen: "unknown",
            ollama: "unknown",
        };
        this.failedAttempts = 0;
        this.subAgents = new Map();
        this.lastFailureReason = null;
        this.preferredOllamaModel = null;
        this.previousRoundContexts = [];
        this.maxContextRounds = DEFAULT_MAX_CONTEXT_ROUNDS;
        this.thinkingMs = DEFAULT_THINKING_MS;
        this.reasoningMode = "auto";
    }
    setPreferredProvider(provider) {
        this.preferredProvider = provider;
        this.failedAttempts = 0;
        this.lastFailureReason = null;
    }
    setPreferredOllamaModel(model) {
        const normalized = model?.trim() ?? "";
        this.preferredOllamaModel = normalized.length > 0 ? normalized : null;
        this.failedAttempts = 0;
        this.lastFailureReason = null;
    }
    getPreferredOllamaModel() {
        return this.preferredOllamaModel;
    }
    getAvailableOllamaModels() {
        return listOllamaModels();
    }
    getPreferredProvider() {
        return this.preferredProvider;
    }
    getPreferredDriverLabel() {
        return this.preferredProvider === "ollama" ? "Ollama" : "Qwen";
    }
    setMaxContextRounds(rounds) {
        if (Number.isInteger(rounds) && rounds > 0) {
            this.maxContextRounds = rounds;
        }
    }
    getMaxContextRounds() {
        return this.maxContextRounds;
    }
    setThinkingMs(ms) {
        if (Number.isFinite(ms) && ms >= 0) {
            this.thinkingMs = ms;
        }
    }
    setReasoningMode(mode) {
        this.reasoningMode = mode;
    }
    getReasoningMode() {
        return this.reasoningMode;
    }
    /** 联机断线托管用：允许对 isAI=false 的人类座位做出牌/交互决策。 */
    setAllowNonAiSeats(enabled) {
        this.allowNonAiSeats = enabled;
    }
    /** 为断线托管的人类座位注册子代理，使 decide/decideInteraction 可为其工作。 */
    registerSeatForTakeover(playerId, name, role, general) {
        this.subAgents.set(playerId, { playerId, name, role, general, memory: new StrategyMemory() });
    }
    start(snapshot) {
        this.subAgents.clear();
        this.previousRoundContexts = [];
        this.providerStatus.qwen = "unknown";
        this.providerStatus.ollama = "unknown";
        this.failedAttempts = 0;
        this.lastFailureReason = null;
        for (const player of snapshot.players) {
            if (!player.isAI) {
                continue;
            }
            this.subAgents.set(player.id, {
                playerId: player.id,
                name: player.name,
                role: player.role,
                general: player.general,
                memory: new StrategyMemory(),
            });
        }
        this.previousRoundContexts = [];
        this.started = true;
        return this.subAgents.size;
    }
    stop() {
        this.started = false;
        this.providerStatus.qwen = "unknown";
        this.providerStatus.ollama = "unknown";
        this.failedAttempts = 0;
        this.subAgents.clear();
        this.previousRoundContexts = [];
        this.lastFailureReason = null;
    }
    setPreviousRoundContexts(contexts) {
        this.previousRoundContexts = contexts.slice(-this.maxContextRounds);
    }
    getLastFailureReason() {
        return this.lastFailureReason;
    }
    getStrategyNote(playerId) {
        const block = this.subAgents.get(playerId)?.memory.composePromptBlock();
        return block || undefined;
    }
    async probe() {
        const driverLabel = this.getPreferredDriverLabel();
        if (this.preferredProvider === "ollama") {
            try {
                const options = this.preferredOllamaModel
                    ? { model: this.preferredOllamaModel, temperature: 0 }
                    : { temperature: 0 };
                const result = await callOllamaChatDetailed([{ role: "user", content: "who are you" }], options);
                writeAiLog({
                    provider: "ollama",
                    model: result.model,
                    stage: "probe",
                    playerId: "system",
                    playerName: "system",
                    prompt: [{ role: "user", content: "who are you" }],
                    responseText: result.content,
                    promptTokens: result.promptTokens,
                    completionTokens: result.completionTokens,
                    totalTokens: result.totalTokens,
                });
                this.providerStatus.ollama = "ready";
                this.failedAttempts = 0;
                this.lastFailureReason = null;
                const brief = result.content.replace(/\s+/g, " ").trim().slice(0, 80);
                return { available: true, detail: brief, driverLabel };
            }
            catch (error) {
                const reason = error instanceof Error ? error.message : String(error);
                const connectivity = await probeOllamaConnectivity(undefined, this.preferredOllamaModel ?? undefined);
                this.providerStatus.ollama = "failed";
                this.failedAttempts += 1;
                this.lastFailureReason = `Ollama 不可用(${connectivity.detail || reason})`;
                return { available: false, detail: connectivity.detail || reason, driverLabel };
            }
        }
        try {
            const result = await callQwen35PlusDetailed([{ role: "user", content: "who are you" }], { temperature: 0 });
            writeAiLog({
                provider: "qwen",
                model: result.model,
                stage: "probe",
                playerId: "system",
                playerName: "system",
                prompt: [{ role: "user", content: "who are you" }],
                responseText: result.content,
                promptTokens: result.promptTokens,
                completionTokens: result.completionTokens,
                totalTokens: result.totalTokens,
            });
            this.providerStatus.qwen = "ready";
            this.failedAttempts = 0;
            this.lastFailureReason = null;
            const brief = result.content.replace(/\s+/g, " ").trim().slice(0, 80);
            return { available: true, detail: brief, driverLabel };
        }
        catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            const connectivity = await probeQwenConnectivity();
            if (connectivity.available) {
                this.providerStatus.qwen = "unknown";
                this.lastFailureReason = null;
                return { available: true, detail: `连通性已确认，运行中继续尝试(${connectivity.detail})`, driverLabel };
            }
            this.providerStatus.qwen = "failed";
            this.failedAttempts += 1;
            this.lastFailureReason = `网络不可达(${connectivity.detail || reason})`;
            return { available: false, detail: `网络不可达(${connectivity.detail || reason})`, driverLabel };
        }
    }
    resolveLevel(snapshot, viewerId) {
        return this.reasoningMode === "auto" ? pickReasoningLevel(snapshot, viewerId) : this.reasoningMode;
    }
    async think(level) {
        const ms = Math.round(this.thinkingMs * REASONING_THINKING_MULTIPLIER[level]);
        if (ms > 0) {
            await delay(ms);
        }
    }
    parseDecision(text, actions) {
        const parsed = parseModelDecision(text);
        const actionIndex = normalizeActionIndex(parsed?.actionIndex);
        if (!actionIndex) {
            return { ok: false, reason: "模型未返回可解析的 actionIndex" };
        }
        const action = actions[actionIndex - 1];
        if (!action) {
            return { ok: false, reason: `actionIndex 超出范围(${actionIndex})` };
        }
        if (action.type === "end" || !action.requiresTarget) {
            return { ok: true, action };
        }
        const preferredTargetId = action.targets.includes(parsed?.targetId ?? "") ? parsed?.targetId : action.targets[0];
        if (!preferredTargetId) {
            return { ok: false, reason: `动作 ${action.label} 缺少有效 targetId` };
        }
        return { ok: true, action, targetId: preferredTargetId };
    }
    parseInteractionDecision(text, request) {
        const parsed = parseJsonObject(text);
        if (!parsed) {
            return null;
        }
        const choice = parsed.choice;
        if (request.kind === "respond" || request.kind === "choose-discard") {
            if (choice === "pass") {
                return { choice: "pass" };
            }
            if (choice === "card") {
                const sourceId = typeof parsed.sourceId === "string" ? parsed.sourceId : "";
                if (!request.sources.some((source) => source.sourceId === sourceId)) {
                    return null;
                }
                return { choice: "card", sourceId };
            }
            return null;
        }
        if (request.kind === "collateral") {
            if (choice === "pass") {
                return { choice: "pass" };
            }
            if (choice === "target") {
                const targetId = typeof parsed.targetId === "string" ? parsed.targetId : "";
                if (!request.victims.includes(targetId)) {
                    return null;
                }
                const sourceId = typeof parsed.sourceId === "string" ? parsed.sourceId : undefined;
                if (sourceId && !request.sources.some((source) => source.sourceId === sourceId)) {
                    return { choice: "target", targetId };
                }
                return sourceId ? { choice: "target", targetId, sourceId } : { choice: "target", targetId };
            }
            return null;
        }
        if (request.kind === "optional-effect") {
            if (choice === "effect") {
                return { choice: "effect", enabled: Boolean(parsed.enabled) };
            }
            return null;
        }
        if (request.kind === "choose-suit") {
            if (choice === "suit") {
                const suit = typeof parsed.suit === "string" ? parsed.suit : "";
                if (!request.suits.includes(suit)) {
                    return null;
                }
                return { choice: "suit", suit: suit };
            }
            return null;
        }
        return null;
    }
    mapProviderResult(result) {
        return {
            content: result.content,
            model: result.model,
            promptTokens: result.promptTokens,
            completionTokens: result.completionTokens,
            totalTokens: result.totalTokens,
        };
    }
    async requestDecision(messages, level) {
        if (this.preferredProvider === "ollama") {
            const options = this.preferredOllamaModel
                ? { model: this.preferredOllamaModel, temperature: 0, timeoutMs: 120_000 }
                : { temperature: 0, timeoutMs: 120_000 };
            const result = await callOllamaChatDetailed(messages, options);
            return this.mapProviderResult(result);
        }
        const result = await callQwen35PlusDetailed(messages, {
            temperature: 0,
            timeoutMs: 45_000,
            reasoningEffort: REASONING_EFFORT[level],
        });
        return this.mapProviderResult(result);
    }
    async requestDecisionWithRetry(messages, level) {
        const driverLabel = this.getPreferredDriverLabel();
        try {
            const result = await this.requestDecision(messages, level);
            this.providerStatus[this.preferredProvider] = "ready";
            this.failedAttempts = 0;
            this.lastFailureReason = null;
            return result;
        }
        catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            const connectivity = this.preferredProvider === "ollama"
                ? await probeOllamaConnectivity(undefined, this.preferredOllamaModel ?? undefined)
                : await probeQwenConnectivity();
            if (connectivity.available) {
                try {
                    const result = await this.requestDecision(messages, level);
                    this.providerStatus[this.preferredProvider] = "ready";
                    this.failedAttempts = 0;
                    this.lastFailureReason = null;
                    return result;
                }
                catch (retryError) {
                    this.providerStatus[this.preferredProvider] = "failed";
                    this.failedAttempts += 1;
                    const retryReason = retryError instanceof Error ? retryError.message : String(retryError);
                    this.lastFailureReason = `${driverLabel} 决策请求失败：${retryReason}`;
                    return null;
                }
            }
            this.providerStatus[this.preferredProvider] = "failed";
            this.failedAttempts += 1;
            this.lastFailureReason = `${driverLabel} 决策请求失败：${reason}`;
            return null;
        }
    }
    writeDecisionLog(params) {
        writeAiLog({
            provider: this.preferredProvider,
            model: params.callResult.model ?? this.getPreferredDriverLabel(),
            stage: params.stage,
            playerId: params.playerId,
            playerName: params.playerName,
            prompt: params.prompt,
            responseText: params.responseText,
            promptTokens: params.callResult.promptTokens ?? null,
            completionTokens: params.callResult.completionTokens ?? null,
            totalTokens: params.callResult.totalTokens ?? null,
        });
    }
    buildRepairPrompt(kind) {
        return `你上一条回答无法被程序解析（${kind}）。请基于同一局面重新只输出符合要求的 JSON，禁止解释。`;
    }
    async decide(game, playerId) {
        if (!this.started) {
            return null;
        }
        const agent = this.subAgents.get(playerId);
        if (!agent) {
            return null;
        }
        const snapshot = game.getSnapshot();
        const current = snapshot.players.find((item) => item.id === playerId);
        if (!current || !current.alive || (!current.isAI && !this.allowNonAiSeats) || snapshot.currentPlayerId !== playerId) {
            return null;
        }
        const actions = game.getPlayableActions(playerId);
        if (actions.length <= 0) {
            return null;
        }
        const level = this.resolveLevel(snapshot, agent.playerId);
        await this.think(level);
        const promptPackage = buildAgentPrompt({
            rulesText: this.rulesText,
            snapshot,
            agent: {
                playerId: agent.playerId,
                name: agent.name,
                role: agent.role,
                general: agent.general,
            },
            actions,
            previousRoundContexts: this.previousRoundContexts,
            reasoningLevel: level,
            ...strategyNoteFor(agent),
        });
        const messages = [
            { role: "system", content: promptPackage.systemPrompt },
            { role: "user", content: promptPackage.userPrompt },
        ];
        const callResult = await this.requestDecisionWithRetry(messages, level);
        if (!callResult) {
            return null;
        }
        this.writeDecisionLog({
            callResult,
            stage: "decision",
            playerId: current.id,
            playerName: current.name,
            prompt: messages,
            responseText: callResult.content,
        });
        let decisionResult = this.parseDecision(callResult.content, actions);
        if (!decisionResult.ok) {
            const repairPrompt = this.buildRepairPrompt(decisionResult.reason);
            try {
                const repairMessages = [
                    ...messages,
                    { role: "assistant", content: callResult.content },
                    { role: "user", content: repairPrompt },
                ];
                const repairResult = await this.requestDecision(repairMessages, level);
                this.writeDecisionLog({
                    callResult: repairResult,
                    stage: "decision-repair",
                    playerId: current.id,
                    playerName: current.name,
                    prompt: repairMessages,
                    responseText: repairResult.content,
                });
                decisionResult = this.parseDecision(repairResult.content, actions);
            }
            catch (error) {
                const reason = error instanceof Error ? error.message : String(error);
                this.lastFailureReason = `${this.getPreferredDriverLabel()} 决策修正请求失败：${reason}`;
                return null;
            }
        }
        if (!decisionResult.ok) {
            this.lastFailureReason = decisionResult.reason;
            return null;
        }
        const decision = decisionResult.targetId
            ? { action: decisionResult.action, targetId: decisionResult.targetId, driverLabel: this.getPreferredDriverLabel() }
            : { action: decisionResult.action, driverLabel: this.getPreferredDriverLabel() };
        return decision;
    }
    async decideInteraction(game, playerId, request) {
        if (!this.started) {
            return null;
        }
        const agent = this.subAgents.get(playerId);
        if (!agent) {
            return null;
        }
        const snapshot = game.getSnapshot();
        const current = snapshot.players.find((item) => item.id === playerId);
        if (!current || !current.alive) {
            return null;
        }
        const level = this.resolveLevel(snapshot, agent.playerId);
        await this.think(level);
        const promptPackage = buildInteractionPrompt({
            rulesText: this.rulesText,
            snapshot,
            agent: {
                playerId: agent.playerId,
                name: agent.name,
                role: agent.role,
                general: agent.general,
            },
            request,
            previousRoundContexts: this.previousRoundContexts,
            reasoningLevel: level,
            ...strategyNoteFor(agent),
        });
        const messages = [
            { role: "system", content: promptPackage.systemPrompt },
            { role: "user", content: promptPackage.userPrompt },
        ];
        const callResult = await this.requestDecisionWithRetry(messages, level);
        if (!callResult) {
            return null;
        }
        this.writeDecisionLog({
            callResult,
            stage: "interaction",
            playerId: current.id,
            playerName: current.name,
            prompt: messages,
            responseText: callResult.content,
        });
        let decision = this.parseInteractionDecision(callResult.content, request);
        if (!decision) {
            try {
                const repairMessages = [
                    ...messages,
                    { role: "assistant", content: callResult.content },
                    { role: "user", content: this.buildRepairPrompt("交互决策") },
                ];
                const repairResult = await this.requestDecision(repairMessages, level);
                this.writeDecisionLog({
                    callResult: repairResult,
                    stage: "interaction-repair",
                    playerId: current.id,
                    playerName: current.name,
                    prompt: repairMessages,
                    responseText: repairResult.content,
                });
                decision = this.parseInteractionDecision(repairResult.content, request);
            }
            catch (error) {
                const reason = error instanceof Error ? error.message : String(error);
                this.lastFailureReason = `${this.getPreferredDriverLabel()} 交互决策修正请求失败：${reason}`;
                return null;
            }
        }
        if (!decision) {
            this.lastFailureReason = "交互决策解析失败";
            return null;
        }
        return decision;
    }
    /**
     * 回合末策略复盘：单次 deep 调用输出结构化复盘（执行回看 + 教训 + 新战术 + 方针更新），
     * 解析后写入分层策略记忆（战术笔记/战略方针/经验教训）。
     * 可在后台并行执行（传入调用时捕获的快照，避免与后续回合状态漂移）。
     */
    async reviewStrategy(game, playerId, snapshot) {
        if (!this.started) {
            return false;
        }
        const agent = this.subAgents.get(playerId);
        if (!agent) {
            return false;
        }
        const state = snapshot ?? game.getSnapshot();
        const current = state.players.find((item) => item.id === playerId);
        if (!current || !current.alive) {
            return false;
        }
        const level = "deep";
        await this.think(level);
        // 只回看「自上次复盘以来」的轮次（首次复盘退化为最近 4 轮历史）
        const roundsSinceLast = this.previousRoundContexts.filter((item) => item.round > agent.memory.lastReviewRound);
        const reviewContexts = roundsSinceLast.length > 0 ? roundsSinceLast.slice(-STRATEGY_REVIEW_MAX_ROUNDS) : this.previousRoundContexts.slice(-4);
        const previousBlock = agent.memory.composePromptBlock();
        const promptPackage = buildStrategyPrompt({
            rulesText: this.rulesText,
            snapshot: state,
            agent: {
                playerId: agent.playerId,
                name: agent.name,
                role: agent.role,
                general: agent.general,
            },
            previousRoundContexts: reviewContexts,
            ...(previousBlock ? { previousStrategyBlock: previousBlock } : {}),
        });
        const messages = [
            { role: "system", content: promptPackage.systemPrompt },
            { role: "user", content: promptPackage.userPrompt },
        ];
        const callResult = await this.requestDecisionWithRetry(messages, level);
        if (!callResult) {
            return false;
        }
        this.writeDecisionLog({
            callResult,
            stage: "strategy",
            playerId: current.id,
            playerName: current.name,
            prompt: messages,
            responseText: callResult.content,
        });
        const review = parseStrategyReview(callResult.content);
        if (!review) {
            this.lastFailureReason = `${this.getPreferredDriverLabel()} 策略复盘输出解析失败`;
            return false;
        }
        agent.memory.applyReviewResult(review, state.turn);
        return true;
    }
}
