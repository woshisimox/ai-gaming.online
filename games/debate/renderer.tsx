'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PlayerConfigPanel, {
  type PlayerCardInfo,
  type PlayerModeOptionGroup,
} from '../../components/game-modules/PlayerConfigPanel';
import { readPlayerConfigs, writePlayerConfigs } from '../../lib/game-modules/playerConfigStore';
import { chatProviderLabel, isChatProvider, type ChatProviderId } from '../../lib/external-ai/chatProviders';
import { readSiteLanguage, subscribeSiteLanguage, type SiteLanguage } from '../../lib/siteLanguage';
import styles from './renderer.module.css';

type DebateRole = 'pro' | 'con' | 'judge';
type DebateMode = 'human' | 'builtin' | ChatProviderId;

type DebatePlayerConfig = {
  mode: DebateMode;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
};

type DebateLogEntry = {
  id: string;
  role: DebateRole;
  stage: 'topic' | 'argument' | 'verdict';
  round?: number;
  content: string;
  provider?: string;
  meta?: string;
  durationMs?: number;
};

type DebateVerdict = {
  winner: 'pro' | 'con' | 'draw';
  summary: string;
  highlights: string[];
  provider?: string;
};

const ROLE_ORDER: DebateRole[] = ['pro', 'con', 'judge'];
const STORAGE_KEY = 'debate_player_configs_v1';

const ROLE_TEXT: Record<DebateRole, { zh: { title: string; subtitle: string }; en: { title: string; subtitle: string } }> = {
  pro: {
    zh: { title: '甲方（正方）', subtitle: '主张成立 / 支持命题' },
    en: { title: 'Affirmative', subtitle: 'Supports the motion' },
  },
  con: {
    zh: { title: '乙方（反方）', subtitle: '提出质疑 / 反对命题' },
    en: { title: 'Negative', subtitle: 'Challenges the motion' },
  },
  judge: {
    zh: { title: '评委', subtitle: '命题 + 仲裁 + 裁决' },
    en: { title: 'Judge', subtitle: 'Sets topics & delivers verdicts' },
  },
};

const ROLE_LABELS: Record<SiteLanguage, Record<DebateRole, string>> = {
  zh: { pro: '甲方', con: '乙方', judge: '评委' },
  en: { pro: 'Affirmative', con: 'Negative', judge: 'Judge' },
};

const MODE_GROUPS: Record<SiteLanguage, PlayerModeOptionGroup[]> = {
  zh: [
    { label: '人类选手', options: [{ value: 'human', label: '人类输入' }] },
    { label: '内置 AI', options: [{ value: 'builtin', label: '内置辩手脚本' }] },
    {
      label: '外置 AI',
      options: [
        { value: 'ai:openai', label: 'OpenAI' },
        { value: 'ai:deepseek', label: 'DeepSeek' },
        { value: 'ai:kimi', label: 'Kimi' },
        { value: 'ai:qwen', label: 'Qwen' },
      ],
    },
  ],
  en: [
    { label: 'Human', options: [{ value: 'human', label: 'Manual input' }] },
    { label: 'Built-in', options: [{ value: 'builtin', label: 'Built-in agent' }] },
    {
      label: 'External AI',
      options: [
        { value: 'ai:openai', label: 'OpenAI' },
        { value: 'ai:deepseek', label: 'DeepSeek' },
        { value: 'ai:kimi', label: 'Kimi' },
        { value: 'ai:qwen', label: 'Qwen' },
      ],
    },
  ],
};

const COPY = {
  zh: {
    title: 'AI 辩论赛',
    subtitle: '甲乙双方与评委协同构成的 AI 辩论平台。',
    playersTitle: '参赛角色配置',
    playersDescription: '为甲方、乙方与评委配置人类、内置脚本或外置大模型模式。',
    topicTitle: '辩题 & 回合设置',
    topicPlaceholder: '请输入辩题，或点击下方按钮由评委自动命题…',
    topicButton: '让评委命题',
    topicManualPrompt: '请输入评委给出的辩题：',
    topicRequired: '请先设置辩题，再开始自动辩论。',
    topicSourceManual: '题目来源：人工输入',
    topicSourceAi: (provider: string) => `题目来源：${provider}`,
    roundsLabel: '回合数',
    roundsHint: '建议 2-4 轮，默认 3 轮。',
    start: '开始自动辩论',
    stop: '停止自动流程',
    reset: '重置记录',
    statusLabel: '当前状态',
    statusIdle: '待命',
    statusRunning: '对局进行中…',
    statusStopped: '已停止',
    statusErrorPrefix: '错误：',
    logTitle: '实时辩论记录',
    logEmpty: '尚无发言，可点击“开始自动辩论”或使用人类输入。',
    verdictTitle: '评委裁决',
    verdictPending: '等待评委给出最终判词…',
    highlightsLabel: '亮点',
    winnerLabel: { pro: '甲方胜', con: '乙方胜', draw: '平局' },
    manualMeta: '人类输入',
    builtinMeta: '内置脚本',
    externalHint: '需填写 API Key 与模型名称方可调用对应模型。',
    builtinHint: '使用平台内置脚本自动生成观点。',
    manualArgumentPrompt: (role: string) => `请以 ${role} 身份输入本轮发言：`,
    manualVerdictPrompt: '请输入评委的判词（包含理由）：',
    manualWinnerPrompt: '请输入胜者（甲方/乙方/平局）：',
    manualTopicInfo: '评委需手动输入辩题。',
    baseUrlHint: '可选，默认为官方接口地址。',
    topicGeneratedLog: '评委命题',
    stageLabels: { topic: '命题', argument: '发言', verdict: '裁决' },
    latencyLabel: (ms: number) => `耗时 ${ms.toFixed(0)}ms`,
  },
  en: {
    title: 'AI Debate Arena',
    subtitle: 'Affirmative vs. negative with an optional AI/human judge.',
    playersTitle: 'Participants',
    playersDescription: 'Choose whether each seat is human, built-in, or an external model.',
    topicTitle: 'Topic & Rounds',
    topicPlaceholder: 'Type a motion or ask the judge to generate one…',
    topicButton: 'Ask judge for a topic',
    topicManualPrompt: 'Enter the judge’s topic:',
    topicRequired: 'Please provide a topic before starting the debate.',
    topicSourceManual: 'Topic: manual input',
    topicSourceAi: (provider: string) => `Topic by ${provider}`,
    roundsLabel: 'Rounds',
    roundsHint: 'Recommended 2-4 rounds. Default: 3.',
    start: 'Start debate',
    stop: 'Stop automation',
    reset: 'Reset log',
    statusLabel: 'Status',
    statusIdle: 'Idle',
    statusRunning: 'Running…',
    statusStopped: 'Stopped',
    statusErrorPrefix: 'Error: ',
    logTitle: 'Live transcript',
    logEmpty: 'No messages yet. Start the debate or enter content manually.',
    verdictTitle: 'Judge verdict',
    verdictPending: 'Waiting for the judge to decide…',
    highlightsLabel: 'Highlights',
    winnerLabel: { pro: 'Affirmative wins', con: 'Negative wins', draw: 'Draw' },
    manualMeta: 'Manual input',
    builtinMeta: 'Built-in script',
    externalHint: 'API Key and a model name are required for external providers.',
    builtinHint: 'Use the built-in heuristic debater.',
    manualArgumentPrompt: (role: string) => `Enter ${role}'s statement for this round:`,
    manualVerdictPrompt: 'Enter the judge’s verdict summary:',
    manualWinnerPrompt: 'Winner? (Affirmative/Negative/Draw):',
    manualTopicInfo: 'Provide the motion manually.',
    baseUrlHint: 'Optional override for the provider base URL.',
    topicGeneratedLog: 'Judge topic',
    stageLabels: { topic: 'Topic', argument: 'Argument', verdict: 'Verdict' },
    latencyLabel: (ms: number) => `took ${ms.toFixed(0)}ms`,
  },
} as const;

const BUILTIN_TOPICS: Record<SiteLanguage, string[]> = {
  zh: [
    'AI 是否应该成为课堂助教？',
    '大模型生成内容需不需要强制水印？',
    '机器人能否担任养老陪护主力？',
    '城市是否应该限制无人车高峰上路？',
    '公司应否允许员工使用自带 AI 工具？',
  ],
  en: [
    'Should AI assistants be mandatory in classrooms?',
    'Must AI-generated media always carry watermarks?',
    'Can service robots become the primary eldercare workforce?',
    'Should cities limit autonomous cars during rush hours?',
    'Should companies allow employees to bring their own AI tools?',
  ],
};

const BUILTIN_ANGLES: Record<SiteLanguage, string[]> = {
  zh: ['强调社会价值', '引用真实案例', '强调风险与底线', '提出折中方案', '追问对手逻辑'],
  en: ['highlight social value', 'cite real-world cases', 'stress risks and guardrails', 'offer pragmatic trade-offs', 'question logical gaps'],
};

function isDebateMode(value: any): value is DebateMode {
  return value === 'human' || value === 'builtin' || isChatProvider(value);
}

function sanitizeConfig(raw: any): DebatePlayerConfig {
  const mode = isDebateMode(raw?.mode) ? raw.mode : 'human';
  return {
    mode,
    apiKey: typeof raw?.apiKey === 'string' ? raw.apiKey : '',
    model: typeof raw?.model === 'string' ? raw.model : '',
    baseUrl: typeof raw?.baseUrl === 'string' ? raw.baseUrl : '',
  };
}

function pickTopic(lang: SiteLanguage): string {
  const pool = BUILTIN_TOPICS[lang];
  if (!pool.length) return lang === 'zh' ? 'AI 议题' : 'AI topic';
  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}

function scoreEntry(text: string): number {
  if (!text) return 0;
  let score = Math.min(text.length / 60, 3);
  if (/[0-9％%]/.test(text)) score += 0.4;
  if (/[？?]/.test(text)) score += 0.2;
  if (/(因此|所以|because)/i.test(text)) score += 0.2;
  return score;
}

function builtinArgument(
  lang: SiteLanguage,
  role: DebateRole,
  topic: string,
  round: number,
  transcript: DebateLogEntry[]
): string {
  const angles = BUILTIN_ANGLES[lang];
  const angle = angles[(round + (role === 'pro' ? 1 : 3)) % angles.length];
  const roleLabel = ROLE_LABELS[lang][role];
  const opponent = [...transcript]
    .reverse()
    .find((entry) => entry.role !== role && entry.role !== 'judge');
  const opponentCue = opponent
    ? lang === 'zh'
      ? `回应 ${ROLE_LABELS[lang][opponent.role]} 提到的“${opponent.content.slice(0, 24)}”…`
      : `Responding to ${ROLE_LABELS[lang][opponent.role]}’s point "${opponent.content.slice(0, 60)}"…`
    : '';
  if (lang === 'zh') {
    return `${roleLabel}认为，“${topic || '该议题'}”的关键在于${angle}。${opponentCue}我们需要提出${
      role === 'pro' ? '积极方案以释放价值' : '必要的防线来控制风险'
    }，并明确可执行的落地路径。`;
  }
  return `${roleLabel} argues that ${topic || 'this motion'} hinges on the need to ${angle}. ${opponentCue}We must ${
    role === 'pro' ? 'unlock the upside through action' : 'install guardrails before scaling'
  } with a concrete plan.`;
}

function builtinVerdict(lang: SiteLanguage, topic: string, transcript: DebateLogEntry[]): DebateVerdict {
  const proEntries = transcript.filter((entry) => entry.role === 'pro');
  const conEntries = transcript.filter((entry) => entry.role === 'con');
  const proScore = proEntries.reduce((sum, entry) => sum + scoreEntry(entry.content), 0);
  const conScore = conEntries.reduce((sum, entry) => sum + scoreEntry(entry.content), 0);
  const diff = proScore - conScore;
  let winner: 'pro' | 'con' | 'draw' = 'draw';
  if (Math.abs(diff) > 0.35) {
    winner = diff > 0 ? 'pro' : 'con';
  }
  const label =
    winner === 'draw'
      ? lang === 'zh'
        ? '双方'
        : 'Both sides'
      : ROLE_LABELS[lang][winner];
  const summary =
    lang === 'zh'
      ? `${label}${winner === 'draw' ? '在证据与逻辑上难分伯仲' : '在证据与逻辑上更充分'}，综合得分 ${proScore.toFixed(1)} : ${conScore.toFixed(1)}，因此${
          winner === 'draw' ? '判为平局' : '获得胜出'
        }。`
      : `${label} ${winner === 'draw' ? 'matched the opponent' : 'presented clearer evidence'} (${proScore.toFixed(1)} vs ${
          conScore.toFixed(1)
        }). Verdict: ${winner === 'draw' ? 'draw' : 'win'}.`;
  const highlights = [...transcript]
    .filter((entry) => entry.role !== 'judge')
    .sort((a, b) => scoreEntry(b.content) - scoreEntry(a.content))
    .slice(0, 2)
    .map((entry) => {
      const prefix = ROLE_LABELS[lang][entry.role];
      const maxLen = lang === 'zh' ? 42 : 80;
      const snippet = entry.content.length > maxLen ? `${entry.content.slice(0, maxLen)}…` : entry.content;
      return `${prefix}: ${snippet}`;
    });
  return {
    winner,
    summary,
    highlights,
    provider: lang === 'zh' ? '内置评委' : 'Built-in judge',
  };
}

function createEntryId() {
  return `${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
}
export default function DebateRenderer() {
  const [lang, setLang] = useState<SiteLanguage>(() => readSiteLanguage() ?? 'zh');
  useEffect(() => {
    const initial = readSiteLanguage();
    if (initial) setLang(initial);
    const unsubscribe = subscribeSiteLanguage((next) => setLang(next));
    return unsubscribe;
  }, []);

  const copy = COPY[lang];
  const [playerConfigs, setPlayerConfigs] = useState<DebatePlayerConfig[]>(() => {
    const stored = readPlayerConfigs(STORAGE_KEY, () => ROLE_ORDER.map(() => ({ mode: 'human' })), sanitizeConfig);
    return ROLE_ORDER.map((_, index) => sanitizeConfig(stored[index] ?? { mode: 'human' }));
  });
  useEffect(() => {
    writePlayerConfigs(STORAGE_KEY, playerConfigs);
  }, [playerConfigs]);

  const [topic, setTopic] = useState('');
  const [topicSource, setTopicSource] = useState<string | null>(null);
  const [rounds, setRounds] = useState(3);
  const [log, setLog] = useState<DebateLogEntry[]>([]);
  const logRef = useRef<DebateLogEntry[]>([]);
  useEffect(() => {
    logRef.current = log;
  }, [log]);
  const [verdict, setVerdict] = useState<DebateVerdict | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeRole, setActiveRole] = useState<DebateRole | null>(null);
  const [isTopicLoading, setTopicLoading] = useState(false);
  const abortRef = useRef({ cancelled: false });

  const playerCards: PlayerCardInfo[] = useMemo(
    () =>
      ROLE_ORDER.map((role) => ({
        title: ROLE_TEXT[role][lang].title,
        subtitle: ROLE_TEXT[role][lang].subtitle,
      })),
    [lang]
  );

  const modeGroups = MODE_GROUPS[lang];

  const configForRole = useCallback(
    (role: DebateRole): DebatePlayerConfig => {
      const index = ROLE_ORDER.indexOf(role);
      return playerConfigs[index] ?? { mode: 'human' };
    },
    [playerConfigs]
  );

  const transcriptSnapshot = useCallback(() => {
    return logRef.current.map((entry) => ({ role: entry.role, content: entry.content, round: entry.round }));
  }, []);

  const appendLog = useCallback((entry: DebateLogEntry) => {
    setLog((prev) => {
      const next = [...prev, entry];
      logRef.current = next;
      return next;
    });
  }, []);

  const updateConfig = useCallback((index: number, patch: Partial<DebatePlayerConfig>) => {
    setPlayerConfigs((prev) => {
      const next = [...prev];
      const current = sanitizeConfig(next[index] ?? { mode: 'human' });
      next[index] = { ...current, ...patch };
      return next;
    });
  }, []);

  const handleModeChange = useCallback(
    (index: number, mode: string) => {
      if (!isDebateMode(mode)) {
        updateConfig(index, { mode: 'human' });
        return;
      }
      const resetFields = mode === 'human' || mode === 'builtin';
      updateConfig(index, {
        mode,
        apiKey: resetFields ? '' : undefined,
        model: resetFields ? '' : undefined,
        baseUrl: resetFields ? '' : undefined,
      });
    },
    [updateConfig]
  );
  const renderMeta = useCallback(
    (_index: number, config?: DebatePlayerConfig) => {
      if (!config) return null;
      if (config.mode === 'human') return <span>{copy.manualMeta}</span>;
      if (config.mode === 'builtin') return <span>{copy.builtinMeta}</span>;
      if (isChatProvider(config.mode)) {
        const provider = chatProviderLabel(config.mode);
        const model = (config.model || '').trim();
        return <span>{model ? `${provider} · ${model}` : provider}</span>;
      }
      return null;
    },
    [copy]
  );

  const renderFields = useCallback(
    (index: number, config?: DebatePlayerConfig) => {
      if (!config) return null;
      const mode = config.mode;
      if (mode === 'human') {
        return <p className={styles.fieldHint}>{copy.manualTopicInfo}</p>;
      }
      if (mode === 'builtin') {
        return <p className={styles.fieldHint}>{copy.builtinHint}</p>;
      }
      if (isChatProvider(mode)) {
        const showBase = mode !== 'ai:qwen';
        return (
          <div className={styles.fieldGrid}>
            <label>
              <span>API Key</span>
              <input
                type="password"
                value={config.apiKey || ''}
                onChange={(event) => updateConfig(index, { apiKey: event.target.value })}
                placeholder="sk-..."
              />
            </label>
            <label>
              <span>Model *</span>
              <input
                type="text"
                value={config.model || ''}
                onChange={(event) => updateConfig(index, { model: event.target.value })}
                placeholder={lang === 'zh' ? '请输入模型名称' : 'Model name'}
              />
            </label>
            {showBase ? (
              <label>
                <span>Base URL</span>
                <input
                  type="text"
                  value={config.baseUrl || ''}
                  onChange={(event) => updateConfig(index, { baseUrl: event.target.value })}
                  placeholder="https://api.example.com"
                />
                <small className={styles.fieldHint}>{copy.baseUrlHint}</small>
              </label>
            ) : null}
            <p className={styles.fieldHint}>{copy.externalHint}</p>
          </div>
        );
      }
      return null;
    },
    [copy, lang, updateConfig]
  );
  const runExternalTurn = useCallback(
    async (role: DebateRole, task: 'argument' | 'topic' | 'verdict', config: DebatePlayerConfig, round?: number) => {
      if (!isChatProvider(config.mode)) {
        throw new Error('Unsupported provider');
      }
      const trimmedModel = (config.model || '').trim();
      if (!trimmedModel) {
        const message = lang === 'zh' ? '请先填写模型名称' : 'Model name is required';
        throw new Error(message);
      }
      const response = await fetch('/api/debate/turn', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          provider: config.mode,
          apiKey: config.apiKey,
          model: trimmedModel,
          baseUrl: config.baseUrl,
          role,
          task,
          topic,
          transcript: transcriptSnapshot(),
          round,
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        const fallback = lang === 'zh' ? '调用外置 AI 失败' : 'External AI call failed';
        throw new Error(text || fallback);
      }
      return response.json();
    },
    [lang, topic, transcriptSnapshot]
  );

  const runHumanArgument = useCallback(
    (role: DebateRole) => {
      const prompt = copy.manualArgumentPrompt(ROLE_LABELS[lang][role]);
      const input = window.prompt(prompt, '') || '';
      if (!input.trim()) {
        const message = lang === 'zh' ? '输入已取消' : 'Input cancelled';
        throw new Error(message);
      }
      return input.trim();
    },
    [copy, lang]
  );

  const runHumanVerdict = useCallback((): DebateVerdict => {
    const summary = window.prompt(copy.manualVerdictPrompt, '') || '';
    if (!summary.trim()) {
      throw new Error(lang === 'zh' ? '评委未给出裁决' : 'Judge did not respond');
    }
    const winnerRaw = (window.prompt(copy.manualWinnerPrompt, '') || '').trim().toLowerCase();
    let winner: 'pro' | 'con' | 'draw' = 'draw';
    if (winnerRaw.includes('甲') || winnerRaw.includes('aff')) winner = 'pro';
    else if (winnerRaw.includes('乙') || winnerRaw.includes('neg')) winner = 'con';
    else if (winnerRaw.includes('平') || winnerRaw.includes('draw')) winner = 'draw';
    return { winner, summary: summary.trim(), highlights: [], provider: ROLE_LABELS[lang].judge };
  }, [copy, lang]);

  const runArgumentTurn = useCallback(
    async (role: DebateRole, round: number): Promise<DebateLogEntry> => {
      const config = configForRole(role);
      const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
      let content = '';
      let providerLabel: string | undefined;
      if (config.mode === 'human') {
        content = runHumanArgument(role);
        providerLabel = copy.manualMeta;
      } else if (config.mode === 'builtin') {
        content = builtinArgument(lang, role, topic, round, logRef.current);
        providerLabel = copy.builtinMeta;
      } else if (isChatProvider(config.mode)) {
        const payload = await runExternalTurn(role, 'argument', config, round);
        content = (payload?.content || '').trim();
        providerLabel = payload?.provider || chatProviderLabel(config.mode);
        if (!content) {
          throw new Error(lang === 'zh' ? '外置 AI 未返回内容' : 'External AI returned empty text');
        }
      } else {
        throw new Error(lang === 'zh' ? '未知模式' : 'Unknown mode');
      }
      const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const durationMs = end - start;
      return {
        id: createEntryId(),
        role,
        stage: 'argument',
        round,
        content,
        provider: providerLabel,
        durationMs,
      };
    },
    [configForRole, copy.builtinMeta, copy.manualMeta, lang, runExternalTurn, runHumanArgument, topic]
  );

  const runVerdictTurn = useCallback(async (): Promise<DebateVerdict> => {
    const config = configForRole('judge');
    if (config.mode === 'human') {
      return runHumanVerdict();
    }
    if (config.mode === 'builtin') {
      return builtinVerdict(lang, topic, logRef.current);
    }
    if (isChatProvider(config.mode)) {
      const payload = await runExternalTurn('judge', 'verdict', config);
      const summary = (payload?.summary || '').trim();
      if (!summary) {
        throw new Error('评委 AI 未返回判词');
      }
      return {
        winner: payload?.winner === 'pro' || payload?.winner === 'con' || payload?.winner === 'draw' ? payload.winner : 'draw',
        summary,
        highlights: Array.isArray(payload?.highlights)
          ? payload.highlights.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
          : [],
        provider: payload?.provider || chatProviderLabel(config.mode),
      };
    }
    throw new Error(lang === 'zh' ? '未知评委模式' : 'Unknown judge mode');
  }, [configForRole, lang, runExternalTurn, runHumanVerdict, topic]);
  const handleGenerateTopic = useCallback(async () => {
    const config = configForRole('judge');
    setTopicLoading(true);
    try {
      let generated = '';
      let providerLabel = ROLE_LABELS[lang].judge;
      if (config.mode === 'human') {
        const manual = window.prompt(copy.topicManualPrompt, topic) || '';
        generated = manual.trim();
        providerLabel = copy.manualMeta;
      } else if (config.mode === 'builtin') {
        generated = pickTopic(lang);
        providerLabel = copy.builtinMeta;
      } else if (isChatProvider(config.mode)) {
        const payload = await runExternalTurn('judge', 'topic', config);
        generated = (payload?.topic || '').trim();
        providerLabel = payload?.provider || chatProviderLabel(config.mode);
      } else {
        throw new Error('评委模式不支持命题');
      }
      if (!generated) {
        throw new Error('未获得有效辩题');
      }
      setTopic(generated);
      setTopicSource(copy.topicSourceAi(providerLabel));
      appendLog({
        id: createEntryId(),
        role: 'judge',
        stage: 'topic',
        content: `${copy.topicGeneratedLog}：${generated}`,
        provider: providerLabel,
      });
    } catch (error: any) {
      setStatusMessage(copy.statusErrorPrefix + (error?.message || '命题失败'));
    } finally {
      setTopicLoading(false);
    }
  }, [appendLog, configForRole, copy, lang, runExternalTurn, topic]);

  const handleReset = useCallback(() => {
    abortRef.current.cancelled = false;
    setIsRunning(false);
    setStatusMessage(null);
    setActiveRole(null);
    setLog([]);
    logRef.current = [];
    setVerdict(null);
  }, []);
  const handleStart = useCallback(async () => {
    if (isRunning) {
      abortRef.current.cancelled = true;
      setIsRunning(false);
      setActiveRole(null);
      setStatusMessage(copy.statusStopped);
      return;
    }
    if (!topic.trim()) {
      setStatusMessage(copy.topicRequired);
      return;
    }
    abortRef.current.cancelled = false;
    setIsRunning(true);
    setStatusMessage(copy.statusRunning);
    setActiveRole(null);
    setVerdict(null);
    setLog([]);
    logRef.current = [];
    try {
      for (let round = 1; round <= Math.max(1, rounds); round += 1) {
        for (const role of ['pro', 'con'] as DebateRole[]) {
          if (abortRef.current.cancelled) break;
          setActiveRole(role);
          const entry = await runArgumentTurn(role, round);
          appendLog(entry);
        }
        if (abortRef.current.cancelled) break;
      }
      setActiveRole(null);
      if (!abortRef.current.cancelled) {
        const verdictEntry = await runVerdictTurn();
        setVerdict(verdictEntry);
        appendLog({
          id: createEntryId(),
          role: 'judge',
          stage: 'verdict',
          content: verdictEntry.summary,
          provider: verdictEntry.provider,
        });
        setStatusMessage(copy.statusIdle);
      } else {
        setStatusMessage(copy.statusStopped);
      }
    } catch (error: any) {
      const fallback = lang === 'zh' ? '对局失败' : 'Debate failed';
      setStatusMessage(copy.statusErrorPrefix + (error?.message || fallback));
    } finally {
      setIsRunning(false);
      setActiveRole(null);
      abortRef.current.cancelled = false;
    }
  }, [appendLog, copy.statusErrorPrefix, copy.statusIdle, copy.statusRunning, copy.statusStopped, copy.topicRequired, isRunning, rounds, runArgumentTurn, runVerdictTurn, topic]);
  const statusLabel = isRunning ? copy.statusRunning : copy.statusIdle;
  const topicSourceLabel = topicSource || (topic.trim() ? copy.topicSourceManual : null);
  const startLabel = isRunning ? copy.stop : copy.start;

  return (
    <div className={styles.root}>
      <section className={styles.hero}>
        <div>
          <h1>{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </div>
        <div className={styles.statusBadge}>
          <span>{copy.statusLabel}</span>
          <strong>{statusLabel}</strong>
        </div>
      </section>

      <div className={styles.layout}>
        <div className={styles.sidebar}>
          <PlayerConfigPanel
            title={copy.playersTitle}
            description={copy.playersDescription}
            players={playerCards}
            configs={playerConfigs}
            optionGroups={modeGroups}
            getMode={(config) => config?.mode || 'human'}
            onModeChange={handleModeChange}
            renderFields={renderFields}
            renderMeta={renderMeta}
            className={styles.playerPanel}
            selectAriaLabel={(index) => `Player ${index + 1} mode`}
          />

          <section className={styles.topicCard}>
            <header>
              <div>
                <h2>{copy.topicTitle}</h2>
                {topicSourceLabel ? <p className={styles.topicSource}>{topicSourceLabel}</p> : null}
              </div>
              <button type="button" onClick={handleGenerateTopic} disabled={isTopicLoading || isRunning}>
                {isTopicLoading ? '…' : copy.topicButton}
              </button>
            </header>
            <textarea
              value={topic}
              onChange={(event) => {
                setTopic(event.target.value);
                setTopicSource(copy.topicSourceManual);
              }}
              placeholder={copy.topicPlaceholder}
            />
            <label className={styles.roundField}>
              <span>{copy.roundsLabel}</span>
              <input
                type="number"
                min={1}
                max={8}
                value={rounds}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setRounds(Number.isFinite(next) ? Math.max(1, next) : 1);
                }}
              />
              <small>{copy.roundsHint}</small>
            </label>
          </section>

          <div className={styles.controlRow}>
            <button type="button" className={styles.primary} onClick={handleStart}>
              {startLabel}
            </button>
            <button type="button" onClick={handleReset} disabled={isRunning}>
              {copy.reset}
            </button>
          </div>
          {statusMessage ? <div className={styles.statusMessage}>{statusMessage}</div> : null}

          <section className={styles.verdictCard}>
            <header>
              <h3>{copy.verdictTitle}</h3>
            </header>
            {verdict ? (
              <div>
                <div className={styles.winnerLine}>
                  <strong>{copy.winnerLabel[verdict.winner]}</strong>
                  {verdict.provider ? <span className={styles.providerTag}>{verdict.provider}</span> : null}
                </div>
                <p className={styles.verdictSummary}>{verdict.summary}</p>
                {verdict.highlights.length ? (
                  <ul>
                    {verdict.highlights.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <p className={styles.verdictPlaceholder}>{copy.verdictPending}</p>
            )}
          </section>
        </div>

        <section className={styles.logCard}>
          <header>
            <h2>{copy.logTitle}</h2>
          </header>
          <div className={styles.logList}>
            {log.length === 0 ? (
              <p className={styles.emptyState}>{copy.logEmpty}</p>
            ) : (
              log.map((entry) => {
                const metaParts: string[] = [copy.stageLabels[entry.stage]];
                if (entry.round) {
                  metaParts.push(lang === 'zh' ? `第${entry.round}轮` : `R${entry.round}`);
                }
                if (entry.provider) {
                  metaParts.push(entry.provider);
                }
                if (entry.meta) {
                  metaParts.push(entry.meta);
                }
                if (typeof entry.durationMs === 'number') {
                  metaParts.push(copy.latencyLabel(entry.durationMs));
                }
                return (
                  <article
                    key={entry.id}
                    className={`${styles.logEntry} ${entry.role === 'judge' ? styles.judgeEntry : ''}`}
                  >
                    <div className={styles.logHeader}>
                      <span className={styles.speaker}>{ROLE_LABELS[lang][entry.role]}</span>
                      <div className={styles.logMeta}>{metaParts.join(' · ')}</div>
                    </div>
                    <p className={styles.logContent}>{entry.content}</p>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
