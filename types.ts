

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

export interface PlayerState {
  mode: 'student' | 'test' | 'guest';
  name: string;
  code: string;
  wallet: number;
  totalCandies: number; 
  level: number;
  
  unlockedSkins: string[];
  currentSkin: string; 
  currentCandySkin: number; // Changed to Index (0-19)
  
  inventory: PlayerInventory;
  equipped: PlayerEquipped;

  records: GameRecord[];
  logs: TransactionLog[]; // New: Transaction History
  dailyPlayCount: number;
  dailyShopCount: number;
  lastGamingDate: string;
}

export interface GameConfig {
  api: string;
  skinColors: string[];
  candyColors: string[];
  priceUpgrade: number;
  priceGacha: number;
  dailyLimit: number;
  shopLimit: number;
  hardModeCost: number; // New: threshold to unlock hard mode
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