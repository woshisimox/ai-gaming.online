import Head from 'next/head';
import { useEffect, useMemo, useState } from 'react';
import type { GameDefinition, GameId } from '../games';
import { GAME_REGISTRY, listGames } from '../games';
import HomeDashboard from '../components/home/HomeDashboard';
import { readSiteLanguage, subscribeSiteLanguage, type SiteLanguage } from '../lib/siteLanguage';

type RendererComponent = () => JSX.Element;

function useGameList(): GameDefinition<any, any>[] {
  return useMemo(() => listGames(), []);
}

type TabId = 'home' | GameId;

export default function HomePage() {
  const games = useGameList();
  const defaultId = (games[0]?.id ?? 'ddz') as GameId;
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [lang, setLang] = useState<SiteLanguage>(() => readSiteLanguage() ?? 'zh');

  const selectedGameId: GameId = (activeTab === 'home' ? defaultId : activeTab) as GameId;
  const current = GAME_REGISTRY[selectedGameId] ?? GAME_REGISTRY[defaultId];
  const Renderer = current?.renderer as RendererComponent | undefined;

  useEffect(() => {
    const initial = readSiteLanguage();
    if (initial) {
      setLang(initial);
    }
    const unsubscribe = subscribeSiteLanguage((next) => {
      setLang(next);
    });
    return unsubscribe;
  }, []);

  const homeLabel = lang === 'zh' ? '首页' : 'Home';
  const tabs: Array<{ id: TabId; label: string; subtitle?: string }> = [
    { id: 'home', label: homeLabel },
    ...games.map((game) => ({
      id: game.id as GameId,
      label: lang === 'zh' ? game.displayName : game.name || game.displayName,
    })),
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <Head>
        <title>ai-gaming.online</title>
        <meta name="description" content="AI gaming arena with modular game plugins." />
      </Head>

      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto w-full max-w-6xl px-4 py-6">
          <nav className="flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                      : 'border-slate-200 bg-white/70 text-slate-600 hover:border-slate-300 hover:text-slate-900'
                  }`}
                >
                  <div className="flex flex-col items-start">
                    <span>{tab.label}</span>
                    {tab.subtitle ? <span className="text-[11px] font-normal text-slate-400">{tab.subtitle}</span> : null}
                  </div>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        {activeTab === 'home' ? (
          <HomeDashboard games={games} onSelectGame={(id) => setActiveTab(id)} />
        ) : Renderer ? (
          <Renderer />
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-8 text-center text-sm text-slate-500">
            暂未找到渲染器。
          </div>
        )}
      </main>
    </div>
  );
}
