
export enum AppView {
  INTRO = 'INTRO',
  TEACHER = 'TEACHER',
  LOGIN = 'LOGIN',
  LOBBY = 'LOBBY',
  GAME = 'GAME',
  SHOP = 'SHOP',
  WARDROBE = 'WARDROBE',
  RECORDS = 'RECORDS',
  GAME_OVER = 'GAME_OVER'
}

export interface GameRecord {
  date: string;
  score: number;
  timeStr: string;
  timeSec: number;
  difficulty?: 'normal' | 'hard';
}

export interface TransactionLog {
  id: string;
  date: string;
  desc: string;
  amount: number; // negative for spend, positive for gain
}

export interface PlayerInventory {
  hats: string[];
  weapons: string[];
  clothes: string[];
  shoes: string[];
}

export interface PlayerEquipped {
  hat: string;
  weapon: string;
  clothes: string;
  shoes: string;
}

export interface PlayerStats {
    totalPlayCount: number;
    totalHardModeCount: number;
    totalCandiesCollected: number;
    totalFalls: number;
    totalShopVisits: number;
    totalPlayTimeSec: number;
    maxTimeSec: number;
}

export interface Achievement {
    id: string;
    name: string;
    icon: string;
    desc: string;
    condition: (stats: PlayerStats, level: number, wallet: number, inventoryCount: number) => boolean;
}

export interface PlayerState {
  mode: 'student' | 'test' | 'guest';
  name: string;
  code: string;
  wallet: number;
  totalCandies: number; 
  level: number;
  maxHearts: number;
  jumpBonus: number; 
  
  unlockedSkins: string[];
  currentSkin: string; 
  currentCandySkin: number; 
  
  inventory: PlayerInventory;
  equipped: PlayerEquipped;

  activeTitle: string | null;
  unlockedTitles: string[];
  stats: PlayerStats; 

  records: GameRecord[];
  logs: TransactionLog[]; 
  dailyPlayCount: number;
  dailyShopCount: number;
  lastGamingDate: string;
  lastGlobalReset?: number; 
}

export interface GameConfig {
  api: string;
  skinColors: string[];
  candyColors: string[];
  priceUpgrade: number;
  priceGacha: number;
  priceHeartUpgrade: number;
  priceJumpUpgrade: number;
  dailyLimit: number;
  shopLimit: number;
  hardModeEntryCost: number; 
  exchangeRate: number; 
  globalResetTimestamp: number;
  hardResetTimestamp?: number;
}

export interface GameObject {
  type: 'bird' | 'ghost' | 'bee' | 'hole' | 'cactus' | 'rock' | 'barrier' | 'mushroom' | 'fire' | 'candy';
  x: number;
  y: number;
  w?: number;
  h?: number;
  r?: number; 
  color?: string; 
  candyIdx?: number; 
  variation?: number; 
  initialY?: number; 
  initialX?: number; 
  moveType?: 'static' | 'sin_y' | 'sin_x'; 
}

export interface Particle {
  x: number;
  y: number;
  type: 'score' | 'impact';
  text?: string;
  life: number;
  dy?: number;
  size?: number;
}

export interface Cloud {
  x: number;
  y: number;
  speed: number;
  size: number;
}
