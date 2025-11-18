import { extractFirstJsonObject } from '../bots/util';

export type ChatProviderId = 'ai:openai' | 'ai:deepseek' | 'ai:kimi' | 'ai:qwen';

interface ProviderMeta {
  id: ChatProviderId;
  label: string;
  base: string;
  allowBaseOverride?: boolean;
}

const PROVIDERS: Record<ChatProviderId, ProviderMeta> = {
  'ai:openai': {
    id: 'ai:openai',
    label: 'OpenAI',
    base: 'https://api.openai.com',
    allowBaseOverride: true,
  },
  'ai:deepseek': {
    id: 'ai:deepseek',
    label: 'DeepSeek',
    base: 'https://api.deepseek.com',
    allowBaseOverride: true,
  },
  'ai:kimi': {
    id: 'ai:kimi',
    label: 'Kimi',
    base: 'https://api.moonshot.cn',
    allowBaseOverride: true,
  },
  'ai:qwen': {
    id: 'ai:qwen',
    label: 'Qwen',
    base: 'https://dashscope.aliyuncs.com/compatible-mode',
  },
};

export function chatProviderLabel(provider: string): string {
  return PROVIDERS[provider as ChatProviderId]?.label ?? provider;
}

export function isChatProvider(value: any): value is ChatProviderId {
  return Boolean(PROVIDERS[value as ChatProviderId]);
}

export interface ChatCompletionRequest {
  provider: ChatProviderId;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  system: string;
  user: string;
  temperature?: number;
}

function normalizeBase(raw?: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, '');
}

function buildOverrideEndpoint(raw: string | undefined, defaultVersionSegment: string): string | null {
  const base = normalizeBase(raw);
  if (!base) return null;
  if (/\/chat\/completions$/i.test(base)) {
    return base;
  }
  const hasVersionSuffix = /\/v\d[\w-]*$/i.test(base);
  const version = hasVersionSuffix ? '' : defaultVersionSegment;
  return `${base}${version}/chat/completions`;
}

function resolveEndpoint(meta: ProviderMeta, baseUrl?: string): string {
  const defaultBase = normalizeBase(meta.base) ?? meta.base;
  const defaultEndpoint = `${defaultBase}/v1/chat/completions`;
  if (meta.id === 'ai:qwen') {
    return defaultEndpoint;
  }
  if (meta.allowBaseOverride) {
    const override = buildOverrideEndpoint(baseUrl, '/v1');
    if (override) {
      return override;
    }
  }
  return defaultEndpoint;
}

async function postChatCompletion(
  endpoint: string,
  key: string,
  body: Record<string, any>,
  label: string
): Promise<string> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    const error: any = new Error(`${label} 调用失败：HTTP ${response.status} ${text.slice(0, 160)}`);
    error.status = response.status;
    error.body = text;
    throw error;
  }

  const payload: any = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  return typeof content === 'string' ? content : JSON.stringify(payload?.choices?.[0] ?? {});
}

export async function requestChatCompletion({
  provider,
  apiKey,
  model,
  baseUrl,
  system,
  user,
  temperature = 0.2,
}: ChatCompletionRequest): Promise<string> {
  const meta = PROVIDERS[provider];
  if (!meta) {
    throw new Error('暂不支持的外置 AI 提供方');
  }
  const key = (apiKey || '').trim();
  if (!key) {
    throw new Error(`未提供 ${meta.label} API Key`);
  }

  const trimmedModel = (model || '').trim();
  if (!trimmedModel) {
    throw new Error(`${meta.label} 需要模型名称，请在设置中填写。`);
  }

  const endpoint = resolveEndpoint(meta, baseUrl);
  const body = {
    model: trimmedModel,
    temperature,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  };

  const fallbacks: string[] = [endpoint];
  if (meta.id === 'ai:deepseek' && !baseUrl) {
    const betaEndpoint = 'https://api.deepseek.com/v1beta/chat/completions';
    if (!fallbacks.includes(betaEndpoint)) {
      fallbacks.push(betaEndpoint);
    }
  }

  let lastError: any;
  for (const target of fallbacks) {
    try {
      return await postChatCompletion(target, key, body, meta.label);
    } catch (err: any) {
      lastError = err;
      if (!(meta.id === 'ai:deepseek' && !baseUrl && err?.status === 404)) {
        throw err;
      }
    }
  }

  throw lastError ?? new Error(`${meta.label} 调用失败`);
}

export function extractJsonFromCompletion(text: string): any | null {
  return extractFirstJsonObject(text);
}
