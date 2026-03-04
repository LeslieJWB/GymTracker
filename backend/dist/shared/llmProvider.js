import OpenAI from "openai";
function buildPromptText(params) {
    const textParts = [params.prompt.trim()];
    if (params.userText !== undefined) {
        textParts.push(`User text: ${params.userText ?? "(none provided)"}`);
    }
    return textParts.join("\n\n");
}
function extractTextFromGeminiCandidates(payload) {
    return (payload.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim() ?? "");
}
class OpenAiCompatibleProvider {
    client;
    model;
    constructor(client, model) {
        this.client = client;
        this.model = model;
    }
    buildContent(params) {
        const textBlock = buildPromptText(params);
        const content = [{ type: "text", text: textBlock }];
        if (params.image) {
            content.push({
                type: "image_url",
                image_url: {
                    url: `data:${params.image.mimeType};base64,${params.image.dataBase64}`
                }
            });
        }
        return content;
    }
    async generateText(params) {
        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: [{ role: "user", content: this.buildContent(params) }]
        });
        const raw = response.choices[0]?.message?.content;
        return typeof raw === "string" ? raw.trim() : null;
    }
}
class KimiProvider extends OpenAiCompatibleProvider {
    name = "kimi";
}
class GeminiProvider extends OpenAiCompatibleProvider {
    name = "gemini";
}
class GeminiNativeProvider {
    name = "gemini";
    apiKey;
    model;
    baseUrl;
    constructor(apiKey, model, baseUrl) {
        this.apiKey = apiKey;
        this.model = model;
        this.baseUrl = baseUrl.replace(/\/+$/, "");
    }
    async callGenerateContent(parts) {
        const endpoint = `${this.baseUrl}/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents: [{ role: "user", parts }]
            })
        });
        if (!response.ok) {
            const raw = await response.text();
            throw new Error(raw || `Gemini native API failed with status ${response.status}`);
        }
        const payload = (await response.json());
        const text = extractTextFromGeminiCandidates(payload);
        return text && text.length > 0 ? text : null;
    }
    async generateText(params) {
        const parts = [
            { text: buildPromptText(params) }
        ];
        if (params.image) {
            parts.push({
                inline_data: {
                    mime_type: params.image.mimeType,
                    data: params.image.dataBase64
                }
            });
        }
        return this.callGenerateContent(parts);
    }
}
class VertexAiProvider {
    name = "vertex";
    apiKey;
    model;
    baseUrl;
    constructor(apiKey, model, baseUrl) {
        this.apiKey = apiKey;
        this.model = model;
        this.baseUrl = baseUrl.replace(/\/+$/, "");
    }
    parseStreamGenerateContent(rawText) {
        const normalized = rawText.trim();
        if (!normalized) {
            return null;
        }
        const joinTexts = (items) => items
            .map((item) => extractTextFromGeminiCandidates(item))
            .filter(Boolean)
            .join("")
            .trim();
        try {
            const parsed = JSON.parse(normalized);
            if (Array.isArray(parsed)) {
                const text = joinTexts(parsed);
                return text.length > 0 ? text : null;
            }
            if (parsed && typeof parsed === "object") {
                const text = extractTextFromGeminiCandidates(parsed);
                return text.length > 0 ? text : null;
            }
        }
        catch {
            // Some stream responses are line-delimited. Handle those below.
        }
        const chunks = normalized
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => (line.startsWith("data:") ? line.slice(5).trim() : line))
            .filter((line) => line && line !== "[DONE]");
        const parts = [];
        for (const chunk of chunks) {
            try {
                const parsedChunk = JSON.parse(chunk);
                const text = extractTextFromGeminiCandidates(parsedChunk);
                if (text) {
                    parts.push(text);
                }
            }
            catch {
                continue;
            }
        }
        const merged = parts.join("").trim();
        return merged.length > 0 ? merged : null;
    }
    async generateText(params) {
        const endpoint = `${this.baseUrl}/${encodeURIComponent(this.model)}:streamGenerateContent?key=${encodeURIComponent(this.apiKey)}`;
        const parts = [
            { text: buildPromptText(params) }
        ];
        if (params.image) {
            parts.push({
                inline_data: {
                    mime_type: params.image.mimeType,
                    data: params.image.dataBase64
                }
            });
        }
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents: [{ role: "user", parts }]
            })
        });
        if (!response.ok) {
            const raw = await response.text();
            throw new Error(raw || `Vertex AI API failed with status ${response.status}`);
        }
        const raw = await response.text();
        return this.parseStreamGenerateContent(raw);
    }
}
export function createLlmProvider(input) {
    if (input.selectedProvider === "gemini") {
        if (!input.gemini.apiKey) {
            return null;
        }
        const normalizedGeminiBase = input.gemini.baseUrl.trim().replace(/\/+$/, "");
        const usesNativeGeminiEndpoint = /\/v1beta\/models$/i.test(normalizedGeminiBase);
        // #region agent log
        fetch("http://127.0.0.1:7242/ingest/2dcdadeb-a66d-4c0e-a93d-8cc544bdbbcb", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "c5f43b" }, body: JSON.stringify({ sessionId: "c5f43b", runId: "post-fix", hypothesisId: "H6", location: "backend/src/shared/llmProvider.ts:createLlmProvider", message: "gemini provider initialization mode", data: { usesNativeGeminiEndpoint, baseUrl: normalizedGeminiBase, model: input.gemini.model }, timestamp: Date.now() }) }).catch(() => { });
        // #endregion
        if (usesNativeGeminiEndpoint) {
            return new GeminiNativeProvider(input.gemini.apiKey, input.gemini.model, normalizedGeminiBase);
        }
        return new GeminiProvider(new OpenAI({
            apiKey: input.gemini.apiKey,
            baseURL: normalizedGeminiBase
        }), input.gemini.model);
    }
    if (input.selectedProvider === "vertex") {
        if (!input.vertex.apiKey) {
            return null;
        }
        return new VertexAiProvider(input.vertex.apiKey, input.vertex.model, input.vertex.baseUrl);
    }
    if (input.selectedProvider === "kimi") {
        if (!input.kimi.apiKey) {
            return null;
        }
        return new KimiProvider(new OpenAI({
            apiKey: input.kimi.apiKey,
            baseURL: input.kimi.baseUrl
        }), input.kimi.model);
    }
    return null;
}
