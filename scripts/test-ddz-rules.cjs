const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

const originalTsLoader = Module._extensions['.ts'];
Module._extensions['.ts'] = function loadTypeScript(module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      resolveJsonModule: true,
    },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};

const root = path.resolve(__dirname, '..');
const engine = require(path.join(root, 'lib/doudizhu/engine.ts'));
const { buildDouPrompts } = require(path.join(root, 'lib/bots/util.ts'));
const { ddzEngine } = require(path.join(root, 'games/ddz/game.ts'));

function hasMove(moves, wanted) {
  const key = wanted.slice().sort().join('|');
  return moves.some((move) => move.slice().sort().join('|') === key);
}

function testCompleteAttachmentEnumeration() {
  const tripleHand = ['♠7', '♥7', '♦7', '♠3', '♠4'];
  const tripleMoves = engine.generateMoves(tripleHand, null, 'both');
  assert(hasMove(tripleMoves, ['♠7', '♥7', '♦7', '♠3']));
  assert(hasMove(tripleMoves, ['♠7', '♥7', '♦7', '♠4']));

  const fourHand = ['♠9', '♥9', '♦9', '♣9', '♠3', '♠4', '♠5'];
  const fourMoves = engine.generateMoves(fourHand, null, 'both');
  assert(hasMove(fourMoves, ['♠9', '♥9', '♦9', '♣9', '♠3', '♠4']));
  assert(hasMove(fourMoves, ['♠9', '♥9', '♦9', '♣9', '♠3', '♠5']));
  assert(hasMove(fourMoves, ['♠9', '♥9', '♦9', '♣9', '♠4', '♠5']));

  const planeHand = ['♠3', '♥3', '♦3', '♠4', '♥4', '♦4', '♠5', '♠6', '♠7'];
  const planeMoves = engine.generateMoves(planeHand, null, 'both');
  assert(hasMove(planeMoves, ['♠3', '♥3', '♦3', '♠4', '♥4', '♦4', '♠5', '♠6']));
  assert(hasMove(planeMoves, ['♠3', '♥3', '♦3', '♠4', '♥4', '♦4', '♠5', '♠7']));
  assert(hasMove(planeMoves, ['♠3', '♥3', '♦3', '♠4', '♥4', '♦4', '♠6', '♠7']));
}

function testCompleteLlmContext() {
  const history = Array.from({ length: 10 }, (_, idx) => ({
    seat: idx % 3,
    move: idx % 4 === 3 ? 'pass' : 'play',
    cards: idx % 4 === 3 ? undefined : [`♠${idx + 3}`],
    trick: Math.floor(idx / 3),
  }));
  const ctx = {
    hands: ['♠A', '♥A'],
    require: { type: 'single', rank: 8 },
    canPass: true,
    policy: { four2: 'both' },
    seat: 1,
    landlord: 0,
    leader: 0,
    trick: 3,
    history,
    currentTrick: history.slice(-1),
    seen: history.flatMap((entry) => entry.cards || []),
    seenBySeat: [[], [], []],
    bottom: ['♣2', 'x', 'X'],
    handsCount: [5, 2, 7],
  };
  for (const mode of ['normal', 'safe', 'minimal']) {
    const prompt = buildDouPrompts(ctx, 'play', mode).user;
    assert.match(prompt, /#0:/, `${mode} prompt must contain the first trick`);
    assert.match(prompt, /#3:/, `${mode} prompt must contain the latest trick`);
    assert.match(prompt, /♣2/);
    assert.match(prompt, /x/);
    assert.match(prompt, /X/);
  }
}

function testStreamUsesRequestLocalContext() {
  const streamSource = fs.readFileSync(path.join(root, 'pages/api/stream_ndjson.ts'), 'utf8');
  const engineSource = fs.readFileSync(path.join(root, 'lib/doudizhu/engine.ts'), 'utf8');
  assert.doesNotMatch(streamSource, /__DDZ_SEEN/);
  assert.doesNotMatch(engineSource, /__DDZ_SEEN/);
  assert.match(streamSource, /const ctxWithSeen = sanitizeCtx\(ctx\)/);
}

function testGenericEngineValidation() {
  const base = ddzEngine.initialState(42);
  const leading = {
    ...base,
    currentPlayer: 0,
    data: {
      ...base.data,
      require: null,
      lastPlay: null,
      hands: [['♠3'], ['♠4'], ['♠5']],
    },
  };
  assert.throws(() => ddzEngine.nextState(leading, { type: 'pass' }), /Cannot pass/);

  const following = {
    ...base,
    currentPlayer: 1,
    data: {
      ...base.data,
      require: engine.classify(['♠T']),
      lastPlay: { seat: 0, cards: ['♠T'], combo: engine.classify(['♠T']) },
      hands: [['♠3'], ['♠9'], ['♠5']],
    },
  };
  assert.throws(
    () => ddzEngine.nextState(following, { type: 'play', cards: ['♠9'] }),
    /does not beat/
  );

  const finished = ddzEngine.nextState(leading, { type: 'play', cards: ['♠3'] });
  assert.equal(finished.status, 'finished');
  assert.equal(finished.data.winner, 0);
}

async function testImmediateProductionTermination() {
  let botCalls = 0;
  let callsAtTerminal = null;
  let terminalSeat = null;
  let initialLandlordContext = null;
  const landlordBot = (ctx) => {
    botCalls += 1;
    if (!initialLandlordContext) initialLandlordContext = ctx;
    const moves = engine.generateMoves(ctx.hands, ctx.require, ctx.policy.four2);
    if (!moves.length) return { move: 'pass' };
    const chosen = moves.slice().sort((a, b) => b.length - a.length)[0];
    return { move: 'play', cards: chosen };
  };
  landlordBot.choice = 'built-in:test-landlord';
  const farmerBot = (ctx) => {
    botCalls += 1;
    if (ctx.canPass) return { move: 'pass' };
    const moves = engine.generateMoves(ctx.hands, ctx.require, ctx.policy.four2);
    const chosen = moves.slice().sort((a, b) => a.length - b.length)[0];
    return { move: 'play', cards: chosen };
  };
  farmerBot.choice = 'built-in:test-farmer';

  const events = [];
  for await (const event of engine.runOneGame({
    seats: [landlordBot, farmerBot, farmerBot],
    bid: false,
    four2: 'both',
    rule: {},
  })) {
    events.push(event);
    if (event?.type === 'event' && event?.kind === 'play' && event?.terminal) {
      callsAtTerminal = botCalls;
      terminalSeat = event.seat;
      assert.deepEqual(event.hand, []);
    }
  }

  assert.notEqual(callsAtTerminal, null, 'a terminal play event must be emitted');
  assert.equal(initialLandlordContext.bottom.length, 3);
  assert.equal(initialLandlordContext.seen.length, 3);
  assert.deepEqual(initialLandlordContext.seenBySeat, [[], [], []]);
  assert.equal(terminalSeat, 0, 'the landlord must be the player that empties their hand');
  assert.equal(botCalls, callsAtTerminal, 'no bot may be called after a hand reaches zero');
  const terminalIndex = events.findIndex((event) => event?.kind === 'play' && event?.terminal);
  const laterPlays = events.slice(terminalIndex + 1).filter((event) => event?.kind === 'play');
  assert.equal(laterPlays.length, 0, 'no play event may follow the terminal play');
  const win = events.slice(terminalIndex + 1).find((event) => event?.kind === 'win');
  assert.equal(win?.winner, 0);
}

(async () => {
  try {
    testCompleteAttachmentEnumeration();
    testCompleteLlmContext();
    testStreamUsesRequestLocalContext();
    testGenericEngineValidation();
    await testImmediateProductionTermination();
    console.log('Dou Dizhu rule/context regressions passed.');
  } finally {
    if (originalTsLoader) Module._extensions['.ts'] = originalTsLoader;
    else delete Module._extensions['.ts'];
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
