import { spawn } from 'child_process';

type BotMove =
  | { phase?: 'play'; move: 'pass'; reason?: string }
  | { phase?: 'play'; move: 'play'; cards: string[]; reason?: string }
  | { phase: 'bid'; bid: boolean; reason?: string }
  | { phase: 'double'; double: boolean; reason?: string };

type BotFunc = (ctx: any) => Promise<BotMove>;

const toCards = (v: any): string[] => Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];

const parseMove = (payload: any): BotMove => {
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

export const DouZeroLocalBot = (o: {
  cmd: string;
  model?: string;
  timeoutMs?: number;
}): BotFunc =>
  async (ctx: any) => {
    const cmd = (o.cmd || '').trim();
    if (!cmd) {
      throw new Error('DouZero local command 未配置：请设置 DOUZERO_LOCAL_CMD');
    }
    const timeoutMs = Number.isFinite(o.timeoutMs) ? Math.max(500, Math.floor(o.timeoutMs || 0)) : 15000;
    const shell = process.env.SHELL || '/bin/bash';

    const payload = JSON.stringify({
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
    });

    const child = spawn(shell, ['-lc', cmd], {
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false,
    });

    let stdout = '';
    let stderr = '';

    const outP = new Promise<void>((resolve) => {
      child.stdout?.on('data', (buf) => { stdout += String(buf); });
      child.stderr?.on('data', (buf) => { stderr += String(buf); });
      child.on('close', () => resolve());
    });

    child.stdin?.write(payload);
    child.stdin?.end();

    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch {}
    }, timeoutMs);

    await outP;
    clearTimeout(timer);

    if ((child.exitCode ?? 1) !== 0) {
      throw new Error(`DouZero local command failed(exit=${child.exitCode ?? -1}): ${(stderr || '').trim().slice(-300)}`);
    }

    const output = (stdout || '').trim();
    if (!output) {
      throw new Error('DouZero local command 输出为空');
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(output);
    } catch {
      const lines = output.split('\n').map((x) => x.trim()).filter(Boolean);
      const last = lines[lines.length - 1] || '';
      parsed = JSON.parse(last);
    }

    return parseMove(parsed);
  };
