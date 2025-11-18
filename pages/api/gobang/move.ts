import type { NextApiRequest, NextApiResponse } from 'next';
import { extractFirstJsonObject } from '../../../lib/bots/util';
import {
  chatProviderLabel,
  isChatProvider,
  requestChatCompletion,
  type ChatProviderId,
} from '../../../lib/external-ai/chatProviders';

interface GobangAction {
  row: number;
  col: number;
}

interface MoveResponse {
  move: GobangAction;
  reason?: string;
  provider?: string;
}

interface RequestBody {
  provider?: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  token?: string;
  observation?: string;
  legalMoves?: GobangAction[];
  player?: number;
}

const RULES_DESCRIPTION = [
  '规则简介：',
  '1. 棋盘为 15×15 的交叉点；',
  '2. 黑方（玩家 0）先手，双方轮流在空交叉点落子；',
  '3. 任意方向（横、竖、斜）连成五子立即获胜；',
  '4. 禁止在已被占据的位置落子；',
  '5. 合法落点列表已经根据规则过滤，请勿选择列表之外的坐标。',
].join('\n');

function sanitizeLegalMoves(raw: any): GobangAction[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => ({
      row: Number((item ?? {}).row),
      col: Number((item ?? {}).col),
    }))
    .filter((item) => Number.isInteger(item.row) && Number.isInteger(item.col));
}

function ensureLegalMove(
  candidate: { row?: number; col?: number; reason?: string } | null | undefined,
  legalMoves: GobangAction[],
  fallbackReason: string
): { move: GobangAction; reason?: string } {
  const fallback = legalMoves[0];
  if (!fallback) {
    throw new Error('No legal moves available');
  }

  if (!candidate) {
    return { move: fallback, reason: fallbackReason };
  }

  const row = Number(candidate.row);
  const col = Number(candidate.col);
  if (!Number.isInteger(row) || !Number.isInteger(col)) {
    return { move: fallback, reason: fallbackReason };
  }

  const match = legalMoves.find((move) => move.row === row && move.col === col);
  if (!match) {
    return { move: fallback, reason: `${fallbackReason}（AI 提供了非法落点，已改用 ${fallback.row},${fallback.col}）` };
  }

  const reason = typeof candidate.reason === 'string' ? candidate.reason.trim() : undefined;
  return { move: match, reason };
}

function extractBoard(observation: string | undefined): { board: string[]; metadata: string } {
  if (!observation || typeof observation !== 'string') {
    return { board: [], metadata: '' };
  }

  const lines = observation.split(/\r?\n/);
  const boardIndex = lines.findIndex((line) => line.trim().toLowerCase() === 'board:');
  const board = boardIndex >= 0 ? lines.slice(boardIndex + 1).filter((line) => line.trim().length > 0) : [];
  const metadata = boardIndex >= 0 ? lines.slice(0, boardIndex).join('\n') : observation;
  return { board, metadata };
}

function buildPrompt(body: RequestBody, legalMoves: GobangAction[]): { system: string; user: string } {
  const observation = typeof body.observation === 'string' ? body.observation : '';
  const { board, metadata } = extractBoard(observation);
  const legalList = legalMoves.map((move) => `(${move.row},${move.col})`).join(', ');
  const playerInfo = Number.isInteger(body.player) ? `当前代理编号：${body.player}` : '当前代理编号：未知';

  const system = [
    'You are a Gomoku (Gobang) AI assistant.',
    'Only respond with a strict JSON object: {"row":number,"col":number,"reason":"brief explanation"}.',
    'Rows and columns are 0-indexed from the top-left intersection.',
    'Choose only from the provided legal moves and favour winning/blocking critical threats.',
    RULES_DESCRIPTION,
  ].join(' ');

  const boardSection = board.length
    ? `棋盘（行号从上到下）：\n${board.join('\n')}`
    : '棋盘数据：暂无（请依赖 observation 文本）';

  const user = [
    playerInfo,
    metadata,
    boardSection,
    `合法落点列表：${legalList}`,
    '请遵循上述五子棋规则进行推理。',
    '请输出严格的 JSON，不要包含额外文字。',
  ]
    .filter(Boolean)
    .join('\n\n');

  return { system, user };
}

async function resolveMove(body: RequestBody, legalMoves: GobangAction[]): Promise<MoveResponse> {
  const provider = (body.provider || '').toLowerCase() as ChatProviderId;
  if (!isChatProvider(provider)) {
    throw new Error('暂不支持的外置 AI 提供方');
  }
  const model = typeof body.model === 'string' ? body.model.trim() : '';
  if (!model) {
    throw new Error(`${chatProviderLabel(provider)} 需要模型名称`);
  }
  const { system, user } = buildPrompt(body, legalMoves);

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
  const fallbackLabel = `${chatProviderLabel(provider)} 响应无效，已使用默认落点`;
  const { move, reason } = ensureLegalMove(parsed, legalMoves, fallbackLabel);
  const trimmedReason = typeof reason === 'string' && reason.trim().length > 0 ? reason.trim().slice(0, 200) : undefined;
  return { move, reason: trimmedReason, provider: chatProviderLabel(provider) };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const body = (req.body ?? {}) as RequestBody;
    const legalMoves = sanitizeLegalMoves(body.legalMoves);
    if (legalMoves.length === 0) {
      res.status(400).json({ error: '缺少合法落点列表' });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');

    const result = await resolveMove(body, legalMoves);
    res.status(200).json(result);
  } catch (error: any) {
    const message = error?.message || '外置 AI 调用失败';
    res.status(500).send(message);
  }
}
