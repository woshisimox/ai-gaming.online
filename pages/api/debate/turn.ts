import type { NextApiRequest, NextApiResponse } from 'next';
import { extractFirstJsonObject } from '../../../lib/bots/util';
import {
  chatProviderLabel,
  isChatProvider,
  requestChatCompletion,
  type ChatProviderId,
} from '../../../lib/external-ai/chatProviders';

type DebateRole = 'pro' | 'con' | 'judge';
type DebateTask = 'argument' | 'topic' | 'verdict';

const ROLE_LABEL: Record<DebateRole, string> = {
  pro: '甲方',
  con: '乙方',
  judge: '评委',
};

const ROLE_STANCE: Record<DebateRole, string> = {
  pro: '支持立场',
  con: '反对立场',
  judge: '命题与裁决',
};

type TranscriptEntry = {
  role: DebateRole;
  content: string;
  round?: number;
};

interface RequestBody {
  provider?: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  task?: DebateTask;
  role?: DebateRole;
  topic?: string;
  transcript?: TranscriptEntry[];
  round?: number;
}

function sanitizeTranscript(raw: any): TranscriptEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      const role: DebateRole = entry?.role === 'con' ? 'con' : entry?.role === 'judge' ? 'judge' : 'pro';
      const content = typeof entry?.content === 'string' ? entry.content : '';
      const round = Number.isFinite(entry?.round) ? Number(entry.round) : undefined;
      return { role, content, round };
    })
    .filter((entry) => entry.content.trim().length > 0);
}

function ensureTask(value: any): DebateTask {
  if (value === 'topic' || value === 'verdict' || value === 'argument') {
    return value;
  }
  return 'argument';
}

function formatTranscript(entries: TranscriptEntry[]): string {
  if (!entries.length) return '暂无历史发言。';
  return entries
    .map((entry) => {
      const roundTag = Number.isFinite(entry.round) ? `第${entry.round}轮` : '不分轮次';
      return `${roundTag} ${ROLE_LABEL[entry.role]}：${entry.content}`;
    })
    .join('\n');
}

function buildArgumentPrompt(topic: string, role: DebateRole, round: number, transcript: TranscriptEntry[]) {
  const stance = ROLE_STANCE[role];
  const system = [
    'You are a bilingual debate assistant who writes concise Chinese paragraphs.',
    'Respond as the assigned debater, cite evidence or questions, and keep it under 3 sentences.',
    'Avoid markdown or JSON; output natural language only.',
  ].join(' ');
  const user = [
    `辩题：${topic || '待定辩题'}`,
    `身份：${ROLE_LABEL[role]}（${stance}）`,
    `轮次：第 ${round} 轮`,
    transcript.length ? `已有发言：\n${formatTranscript(transcript)}` : '已有发言：暂无',
    '请用 2-3 句话陈述观点，适当引用事实、数据或提问，保持尊重与专业。',
  ].join('\n\n');
  return { system, user };
}

function buildTopicPrompt(transcript: TranscriptEntry[]) {
  const system = [
    'You are the judge of an AI debate league.',
    'Return strictly formatted JSON: {"topic":"简短辩题","angle":"补充说明"}.',
    'The topic must be in Chinese and under 26 characters.',
  ].join(' ');
  const history = transcript.length ? `已生成的讨论：\n${formatTranscript(transcript)}` : '暂无历史讨论，可自由命题。';
  const user = [
    '请生成一个新辩题，聚焦社会、科技或商业视角。',
    history,
    '务必输出严格 JSON。',
  ].join('\n\n');
  return { system, user };
}

function buildVerdictPrompt(topic: string, transcript: TranscriptEntry[]) {
  const system = [
    'You are the final judge of the debate.',
    'Return strict JSON: {"winner":"pro|con|draw","reason":"简要判词","highlights":["亮点1","亮点2"]}.',
    'Be neutral, reference concrete arguments, and keep the reason within 80 Chinese characters.',
  ].join(' ');
  const user = [
    `辩题：${topic || '待定辩题'}`,
    '发言记录：',
    formatTranscript(transcript),
    '请综合双方表现给出胜者或平局，并列出 1-2 条亮点。',
  ].join('\n');
  return { system, user };
}

function buildPrompt(body: RequestBody, transcript: TranscriptEntry[]): { system: string; user: string } {
  const task = ensureTask(body.task);
  const topic = typeof body.topic === 'string' ? body.topic : '';
  const role: DebateRole = body.role === 'con' ? 'con' : body.role === 'judge' ? 'judge' : 'pro';
  const round = Number.isFinite(body.round) ? Number(body.round) : 1;
  switch (task) {
    case 'topic':
      return buildTopicPrompt(transcript);
    case 'verdict':
      return buildVerdictPrompt(topic, transcript);
    default:
      return buildArgumentPrompt(topic, role, round, transcript);
  }
}

function parseTopicResponse(text: string) {
  const parsed = extractFirstJsonObject(text);
  const topic = typeof parsed?.topic === 'string' && parsed.topic.trim().length > 0 ? parsed.topic.trim() : text.trim();
  const angle = typeof parsed?.angle === 'string' && parsed.angle.trim().length > 0 ? parsed.angle.trim() : undefined;
  return { topic, angle };
}

function parseVerdictResponse(text: string) {
  const parsed = extractFirstJsonObject(text) ?? {};
  const winnerRaw = typeof parsed.winner === 'string' ? parsed.winner : '';
  const winner: 'pro' | 'con' | 'draw' = winnerRaw === 'pro' || winnerRaw === 'con' || winnerRaw === 'draw' ? winnerRaw : 'draw';
  const reason = typeof parsed.reason === 'string' && parsed.reason.trim().length > 0 ? parsed.reason.trim() : text.trim();
  const highlights = Array.isArray(parsed.highlights)
    ? parsed.highlights
        .map((item: any) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item: string) => item.length > 0)
    : [];
  return { winner, reason, highlights };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const body = (req.body ?? {}) as RequestBody;
    const provider = (body.provider || '').toLowerCase() as ChatProviderId;
    if (!isChatProvider(provider)) {
      res.status(400).json({ error: '暂不支持的外置 AI 提供方' });
      return;
    }

    const transcript = sanitizeTranscript(body.transcript);
    const { system, user } = buildPrompt(body, transcript);
    const task = ensureTask(body.task);

    const text = await requestChatCompletion({
      provider,
      apiKey: body.apiKey,
      model: body.model,
      baseUrl: body.baseUrl,
      system,
      user,
      temperature: task === 'argument' ? 0.35 : 0.2,
    });

    const providerLabel = chatProviderLabel(provider);
    if (task === 'topic') {
      const { topic, angle } = parseTopicResponse(text);
      res.status(200).json({ topic, angle, provider: providerLabel });
      return;
    }

    if (task === 'verdict') {
      const { winner, reason, highlights } = parseVerdictResponse(text);
      res.status(200).json({ winner, summary: reason, highlights, provider: providerLabel });
      return;
    }

    res.status(200).json({ content: text.trim(), provider: providerLabel });
  } catch (error: any) {
    const message = error?.message || '外置 AI 调用失败';
    res.status(500).send(message);
  }
}
