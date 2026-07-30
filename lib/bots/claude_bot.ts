import { buildDouPrompts, extractFirstJsonObject, nonEmptyReason } from './util';

type BotMove =
  | { phase?: 'play'; move: 'pass'; reason?: string }
  | { phase?: 'play'; move: 'play'; cards: string[]; reason?: string }
  | { phase: 'bid'; bid: boolean; reason?: string }
  | { phase: 'double'; double: boolean; reason?: string };
type BotCtx = {
  hands: string[];
  require?: any;
  canPass: boolean;
  policy?: any;
  phase?: 'play' | 'bid' | 'double';
  bid?: any;
  double?: any;
};
type BotFunc = (ctx: BotCtx) => Promise<BotMove> | BotMove;

function fallbackMove(ctx: BotCtx, reason: string): BotMove {
  if (ctx?.phase === 'bid') {
    const info: any = ctx.bid || {};
    const bid = typeof info.recommended === 'boolean' ? !!info.recommended : !!info.default;
    return { phase: 'bid', bid, reason: nonEmptyReason(reason, 'Claude') };
  }
  if (ctx?.phase === 'double') {
    const info: any = ctx.double || {};
    const double = typeof info.recommended === 'boolean' ? !!info.recommended : !!info.default;
    return { phase: 'double', double, reason: nonEmptyReason(reason, 'Claude') };
  }
  if (ctx?.canPass) return { phase: 'play', move: 'pass', reason };
  const first = Array.isArray(ctx?.hands) && ctx.hands.length ? ctx.hands[0] : '3';
  return { phase: 'play', move: 'play', cards: [first], reason };
}

export const ClaudeBot = (options: { apiKey: string; model?: string }): BotFunc =>
  async (ctx: BotCtx) => {
    try {
      if (!options.apiKey) throw new Error('Missing Anthropic API Key');
      const model = (options.model || '').trim();
      if (!model) throw new Error('Missing Claude model name');
      const phase = (ctx?.phase || 'play') as 'bid' | 'double' | 'play';
      const { system, user } = buildDouPrompts(ctx, phase, 'normal');
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': options.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 500,
          temperature: 0.2,
          system,
          messages: [{ role: 'user', content: user }],
        }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${(await response.text()).slice(0, 200)}`);
      }
      const json: any = await response.json();
      const text = Array.isArray(json?.content)
        ? json.content.filter((block: any) => block?.type === 'text').map((block: any) => block.text || '').join('\n')
        : '';
      const payload: any = extractFirstJsonObject(text) || {};

      if (phase === 'bid') {
        if (typeof payload.bid === 'boolean') {
          return { phase: 'bid', bid: payload.bid, reason: nonEmptyReason(payload.reason, 'Claude') };
        }
        if (payload.move === 'pass') return { phase: 'bid', bid: false, reason: nonEmptyReason(payload.reason, 'Claude') };
        if (payload.move === 'play') return { phase: 'bid', bid: true, reason: nonEmptyReason(payload.reason, 'Claude') };
        throw new Error('invalid bid response');
      }
      if (phase === 'double') {
        const decision = typeof payload.double === 'boolean' ? payload.double : payload.bid;
        if (typeof decision === 'boolean') {
          return { phase: 'double', double: decision, reason: nonEmptyReason(payload.reason, 'Claude') };
        }
        if (payload.move === 'pass') return { phase: 'double', double: false, reason: nonEmptyReason(payload.reason, 'Claude') };
        if (payload.move === 'play') return { phase: 'double', double: true, reason: nonEmptyReason(payload.reason, 'Claude') };
        throw new Error('invalid double response');
      }

      const reason = nonEmptyReason(payload.reason, 'Claude');
      if (payload.move === 'pass') return { phase: 'play', move: 'pass', reason };
      const cards = Array.isArray(payload.cards) ? payload.cards : [];
      return { phase: 'play', move: 'play', cards, reason };
    } catch (error: any) {
      return fallbackMove(ctx, `Claude 调用失败：${error?.message || error}，已回退`);
    }
  };
