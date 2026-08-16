import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_OLLAMA_MODEL = "gemma4:latest";
const loadDotEnv = () => {
    const envFile = resolve(process.cwd(), ".env");
    let content = "";
    try {
        content = readFileSync(envFile, "utf-8");
    }
    catch {
        return;
    }
    const lines = content.split(/\r?\n/);
    for (const raw of lines) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) {
            continue;
        }
        const sep = line.indexOf("=");
        if (sep <= 0) {
            continue;
        }
        const key = line.slice(0, sep).trim();
        const value = line.slice(sep + 1).trim().replace(/^"(.*)"$/, "$1");
        if (!key || process.env[key] !== undefined) {
            continue;
        }
        process.env[key] = value;
    }
};
const getModelName = (provided) => {
    loadDotEnv();
    return provided ?? process.env.OLLAMA_MODEL ?? DEFAULT_OLLAMA_MODEL;
};
const normalizeBaseUrl = (input) => {
    loadDotEnv();
    const raw = (input ?? process.env.OLLAMA_BASE_URL ?? DEFAULT_OLLAMA_BASE_URL).trim().replace(/^"(.*)"$/, "$1");
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
    return withProtocol.replace(/\/+$/, "");
};
const extractModelNames = (payload) => {
    const names = payload.models?.flatMap((item) => [item.name, item.model].filter(Boolean)) ?? [];
    const unique = Array.from(new Set(names.map((item) => item.trim()).filter((item) => item.length > 0)));
    return unique;
};
export const listOllamaModels = async (baseUrl) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    const url = `${normalizeBaseUrl(baseUrl)}/api/tags`;
    try {
        const response = await fetch(url, {
            method: "GET",
            signal: controller.signal,
        });
        if (!response.ok) {
            throw new Error(`服务返回 ${response.status}`);
        }
        const payload = (await response.json());
        return extractModelNames(payload);
    }
    catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(reason.replace(/\s+/g, " ").trim());
    }
    finally {
        clearTimeout(timer);
    }
};
export const probeOllamaConnectivity = async (baseUrl, modelName) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    const url = `${normalizeBaseUrl(baseUrl)}/api/tags`;
    try {
        const response = await fetch(url, {
            method: "GET",
            signal: controller.signal,
        });
        if (!response.ok) {
            return { available: false, detail: `服务返回 ${response.status}` };
        }
        const payload = (await response.json());
        const model = getModelName(modelName);
        const modelNames = extractModelNames(payload);
        const matched = modelNames.some((item) => item === model);
        if (!matched) {
            return { available: false, detail: `本地 Ollama 服务可用，但未找到模型 ${model}` };
        }
        return { available: true, detail: `本地 Ollama 服务可用，模型 ${model} 已就绪` };
    }
    catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return { available: false, detail: reason.replace(/\s+/g, " ").trim() };
    }
    finally {
        clearTimeout(timer);
    }
};
export const callOllamaChatDetailed = async (messages, options = {}) => {
    if (messages.length <= 0) {
        throw new Error("messages 不能为空");
    }
    const model = getModelName(options.model);
    const baseUrl = normalizeBaseUrl(options.baseUrl);
    const timeoutMs = options.timeoutMs ?? 60_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(`${baseUrl}/api/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model,
                messages,
                format: "json",
                stream: false,
                options: {
                    temperature: options.temperature ?? 0,
                },
            }),
            signal: controller.signal,
        });
        if (!response.ok) {
            const detail = await response.text();
            throw new Error(`Ollama 调用失败: ${response.status} ${detail}`);
        }
        const payload = (await response.json());
        const text = payload.message?.content?.trim();
        if (!text) {
            throw new Error("Ollama 返回内容为空");
        }
        const promptTokens = payload.prompt_eval_count ?? null;
        const completionTokens = payload.eval_count ?? null;
        const totalTokens = promptTokens === null || completionTokens === null ? null : promptTokens + completionTokens;
        return {
            content: text,
            model: payload.model ?? model,
            promptTokens,
            completionTokens,
            totalTokens,
        };
    }
    catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`Ollama 连接失败: ${reason.replace(/\s+/g, " ").trim()}`);
    }
    finally {
        clearTimeout(timer);
    }
};
export const callOllamaChat = async (messages, options = {}) => {
    const result = await callOllamaChatDetailed(messages, options);
    return result.content;
};
