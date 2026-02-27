// lib/bots/douzero_bot.ts
// DouZero 适配器：通过 HTTP 调用外部 DouZero 服务。
// 说明：平台不直接内置 DouZero Python 推理运行时，需提供一个可访问的 HTTP bridge。

type BotMove =
  | { phase?: 'play'; move: 'pass'; reason?: string }
  | { phase?: 'play'; move: 'play'; cards: string[]; reason?: string }
  | { phase: 'bid'; bid: boolean; reason?: string }
  | { phase: 'double'; double: boolean; reason?: string };

type BotFunc = (ctx: any) => Promise<BotMove>;

const toCards = (v: any): string[] => Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];

export const DouZeroBot = (o: {
  baseUrl?: string;
  token?: string;
  apiKey?: string;
  model?: string;
}): BotFunc =>
  async (ctx: any) => {
    const endpoint = (o.baseUrl || '').trim().replace(/\/$/, '');
    if (!endpoint) throw new Error('DouZero endpoint 未配置（baseUrl 为空）');

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(o.token ? { authorization: `Bearer ${o.token}` } : {}),
        ...(o.apiKey ? { 'x-api-key': o.apiKey } : {}),
        'x-bot-provider': 'douzero',
      },
      body: JSON.stringify({
        provider: 'douzero',
        model: (o.model || '').trim() || 'douzero',
        ctx,
        seen: Array.isArray(ctx?.seen) ? ctx.seen : [],
        seenBySeat: Array.isArray(ctx?.seenBySeat) ? ctx.seenBySeat : [[], [], []],
        seatInfo: {
          seat: ctx?.seat,
          landlord: ctx?.landlord,
          leader: ctx?.leader,
          trick: ctx?.trick,
        },
      }),
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`DouZero HTTP ${response.status}: ${text.slice(0, 220)}`);
    }

    let payload: any = {};
    try { payload = JSON.parse(text); } catch {}

    if (payload?.phase === 'bid' || typeof payload?.bid === 'boolean') {
      const bid = typeof payload?.bid === 'boolean'
        ? payload.bid
        : payload?.move === 'pass'
          ? false
          : true;
      return { phase: 'bid', bid: !!bid, reason: typeof payload?.reason === 'string' ? payload.reason : undefined };
    }

    if (payload?.phase === 'double' || typeof payload?.double === 'boolean') {
      const decision = typeof payload?.double === 'boolean'
        ? payload.double
        : typeof payload?.bid === 'boolean'
          ? payload.bid
          : payload?.move === 'pass'
            ? false
            : true;
      return { phase: 'double', double: !!decision, reason: typeof payload?.reason === 'string' ? payload.reason : undefined };
    }

    const explicitMove = payload?.move === 'pass' ? 'pass' : (payload?.move === 'play' ? 'play' : undefined);
    const cards = toCards(payload?.cards?.length ? payload.cards : payload?.action?.cards);

    // 兼容部分 DouZero bridge 返回：{ action: { type:'pass'|'play', cards:[...] } }
    const actionType = typeof payload?.action?.type === 'string' ? payload.action.type.toLowerCase() : '';
    const inferredMove: 'pass' | 'play' = actionType === 'pass'
      ? 'pass'
      : actionType === 'play'
        ? 'play'
        : (cards.length ? 'play' : 'pass');

    const move = explicitMove ?? inferredMove;
    const reason = typeof payload?.reason === 'string' ? payload.reason : undefined;

    return move === 'pass'
      ? { phase: 'play', move: 'pass', reason }
      : { phase: 'play', move: 'play', cards, reason };
  };
