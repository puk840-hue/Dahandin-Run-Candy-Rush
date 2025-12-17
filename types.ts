

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
  
  unlockedSkins: string[];
  currentSkin: string; 
  currentCandySkin: number; // Index (0-19)
  
  inventory: PlayerInventory;
  equipped: PlayerEquipped;

  // Title System
  activeTitle: string | null;
  unlockedTitles: string[];
  stats: PlayerStats; // Cumulative stats for achievements

  records: GameRecord[];
  logs: TransactionLog[]; // Transaction History
  dailyPlayCount: number;
  dailyShopCount: number;
  lastGamingDate: string;
  lastGlobalReset?: number; // For teacher forced reset (Daily/Hard)
}

export interface GameConfig {
  api: string;
  skinColors: string[];
  candyColors: string[];
  priceUpgrade: number;
  priceGacha: number;
  dailyLimit: number;
  shopLimit: number;
  hardModeEntryCost: number; 
  exchangeRate: number; 
  globalResetTimestamp: number; // Timestamp for Daily Count Reset
  hardResetTimestamp?: number; // New: Timestamp for Full Data Reset (except Cookie)
}

export interface GameObject {
  type: 'bird' | 'ghost' | 'bee' | 'hole' | 'cactus' | 'rock' | 'barrier' | 'mushroom' | 'fire' | 'candy';
  x: number;
  y: number;
  w?: number;
  h?: number;
  r?: number; // radius for candy
  color?: string; // kept for compatibility, usage depends on context
  candyIdx?: number; // New: for rendering specific candy type
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