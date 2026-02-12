import type { NextApiRequest, NextApiResponse } from 'next';
import { extractFirstJsonObject } from '../../../lib/bots/util';
import {
  chatProviderLabel,
  isChatProvider,
  requestChatCompletion,
  type ChatProviderId,
} from '../../../lib/external-ai/chatProviders';
import type { MahjongAction, Tile } from '../../../games/mahjong/game';

interface RequestBody {
  provider?: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  observation?: string;
  legalActions?: MahjongAction[];
  player?: number;
}

interface MoveResponse {
  action: MahjongAction;
  reason?: string;
  provider?: string;
}

const RULES = [
  '规则简介：',
  '1. 四人麻将简化回合：当前玩家出1张牌，下家摸1张；',
  '2. 若当前手牌满足胡牌条件可选择 win；',
  '3. 只能从 legalActions 里选择；',
  '4. 优先保证输出合法 JSON。',
].join('\n');

function sanitizeLegalActions(raw: any): MahjongAction[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const type = String(item?.type || '');
      if (type === 'win') return { type: 'win' } as MahjongAction;
      if (type === 'discard' && typeof item?.tile === 'string') {
        return { type: 'discard', tile: item.tile as Tile } as MahjongAction;
      }
      return null;
    })
    .filter(Boolean) as MahjongAction[];
}

function actionKey(action: MahjongAction): string {
  return action.type === 'win' ? 'win' : `discard:${action.tile}`;
}

function ensureLegalAction(candidate: any, legalActions: MahjongAction[]): MahjongAction {
  const fallback = legalActions[0];
  if (!fallback) {
    throw new Error('No legal actions available');
  }
  if (!candidate || typeof candidate !== 'object') return fallback;
  const type = String(candidate.type || '');
  if (type === 'win') {
    const action: MahjongAction = { type: 'win' };
    return legalActions.find((x) => actionKey(x) === actionKey(action)) ?? fallback;
  }
  if (type === 'discard' && typeof candidate.tile === 'string') {
    const action: MahjongAction = { type: 'discard', tile: candidate.tile as Tile };
    return legalActions.find((x) => actionKey(x) === actionKey(action)) ?? fallback;
  }
  return fallback;
}

function buildPrompt(body: RequestBody, legalActions: MahjongAction[]) {
  const legalText = legalActions
    .map((action) => (action.type === 'win' ? 'win' : `discard:${action.tile}`))
    .join(', ');
  const playerInfo = Number.isInteger(body.player) ? `当前座位：${body.player}` : '当前座位：未知';
  const observation = typeof body.observation === 'string' ? body.observation : '';

  const system = [
    'You are a Mahjong decision assistant.',
    'Return strict JSON only: {"type":"discard","tile":"1m","reason":"..."} or {"type":"win","reason":"..."}.',
    'Never output actions outside legalActions.',
    RULES,
  ].join(' ');

  const user = [
    playerInfo,
    observation,
    `legalActions: ${legalText}`,
    '请只输出 JSON，不要额外解释。',
  ].join('\n\n');

  return { system, user };
}

async function resolveAction(body: RequestBody, legalActions: MahjongAction[]): Promise<MoveResponse> {
  const provider = (body.provider || '').toLowerCase() as ChatProviderId;
  if (!isChatProvider(provider)) {
    throw new Error('暂不支持的外置 AI 提供方');
  }
  const model = typeof body.model === 'string' ? body.model.trim() : '';
  if (!model) {
    throw new Error(`${chatProviderLabel(provider)} 需要模型名称`);
  }
  const { system, user } = buildPrompt(body, legalActions);

  const rawText = await requestChatCompletion({
    provider,
    apiKey: body.apiKey,
    model,
    baseUrl: body.baseUrl,
    system,
    user,
    temperature: 0.2,
  });

  const parsed = extractFirstJsonObject(String(rawText));
  const action = ensureLegalAction(parsed, legalActions);
  const reason = typeof parsed?.reason === 'string' ? parsed.reason.trim().slice(0, 200) : undefined;
  return { action, reason, provider: chatProviderLabel(provider) };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const body = (req.body ?? {}) as RequestBody;
    const legalActions = sanitizeLegalActions(body.legalActions);
    if (!legalActions.length) {
      res.status(400).json({ error: '缺少合法动作列表' });
      return;
    }
    const result = await resolveAction(body, legalActions);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).send(error?.message || '外置 AI 调用失败');
  }
}
