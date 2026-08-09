import type { ComponentType } from 'react';
import type { GameEngine, GameState } from '../core/types';
import { ddzEngine } from './ddz/game';
import type { DdzAction, DdzState } from './ddz/game';
import ddzConfig from './ddz/config.json';
import DdzRenderer from './ddz/renderer';
import { debateEngine } from './debate/game';
import type { DebateState } from './debate/game';
import debateConfig from './debate/config.json';
import DebateRenderer from './debate/renderer';
import { gobangEngine } from './gobang/game';
import type { GobangAction, GobangState } from './gobang/game';
import gobangConfig from './gobang/config.json';
import GobangRenderer from './gobang/renderer';
import { mahjongEngine } from './mahjong/game';
import type { MahjongAction, MahjongState } from './mahjong/game';
import mahjongConfig from './mahjong/config.json';
import MahjongRenderer from './mahjong/renderer';

export interface GameDefinition<State extends GameState = GameState, Action = unknown> {
  id: string;
  name: string;
  displayName: string;
  maxPlayers: number;
  description?: string;
  engine: GameEngine<State, Action>;
  renderer: ComponentType;
}

const ddzDefinition: GameDefinition<DdzState, DdzAction> = {
  id: ddzConfig.id,
  name: ddzConfig.name,
  displayName: ddzConfig.displayName,
  maxPlayers: ddzConfig.maxPlayers,
  description: ddzConfig.description,
  engine: ddzEngine,
  renderer: DdzRenderer,
};

const gobangDefinition: GameDefinition<GobangState, GobangAction> = {
  id: gobangConfig.id,
  name: gobangConfig.name,
  displayName: gobangConfig.displayName,
  maxPlayers: gobangConfig.maxPlayers,
  description: gobangConfig.description,
  engine: gobangEngine,
  renderer: GobangRenderer,
};

const debateDefinition: GameDefinition<DebateState, any> = {
  id: debateConfig.id,
  name: debateConfig.name,
  displayName: debateConfig.displayName,
  maxPlayers: debateConfig.maxPlayers,
  description: debateConfig.description,
  engine: debateEngine,
  renderer: DebateRenderer,
};

const mahjongDefinition: GameDefinition<MahjongState, MahjongAction> = {
  id: mahjongConfig.id,
  name: mahjongConfig.name,
  displayName: mahjongConfig.displayName,
  maxPlayers: mahjongConfig.maxPlayers,
  description: mahjongConfig.description,
  engine: mahjongEngine,
  renderer: MahjongRenderer,
};

export const GAME_REGISTRY = {
  [ddzConfig.id]: ddzDefinition,
  [gobangConfig.id]: gobangDefinition,
  [debateConfig.id]: debateDefinition,
  [mahjongConfig.id]: mahjongDefinition,
} as const;

export type GameId = keyof typeof GAME_REGISTRY;

export function listGames(): GameDefinition<any, any>[] {
  return Object.values(GAME_REGISTRY) as GameDefinition<any, any>[];
}

export function getGameDefinition(id: GameId): GameDefinition<any, any> | undefined {
  return GAME_REGISTRY[id] as GameDefinition<any, any> | undefined;
}
