
import { Achievement, PlayerState } from './types';

export const SECRET_PASSPHRASE = "DAHANDIN_SECRET_2024"; 
export const STORAGE_KEY = "dahandin_run_save_v4_react";

export const DEFAULT_SKINS = ["#ffffff", "#8d6e63", "#ffcc80", "#ef9a9a", "#ce93d8", "#9fa8da", "#80deea", "#a5d6a7", "#e6ee9c", "#ffab91"];
// 4 Types * 5 Colors = 20 Variations
export const CANDY_TYPES = ['basic', 'striped', 'lollipop', 'wrapped'];
export const CANDY_COLORS = ['#ef5350', '#ffca28', '#66bb6a', '#42a5f5', '#ab47bc']; // Red, Yellow, Green, Blue, Purple

export const GAME_ITEMS = {
    hats: ["cap", "crown", "tophat", "helmet", "beret", "partyhat", "headphone", "flower", "viking"],
    weapons: ["sword", "wand", "lollipop", "hammer", "bow", "shield", "mic", "carrot", "laser"],
    clothes: ["overalls", "suit", "dress", "hoodie", "tuxedo", "raincoat", "armor", "jersey", "hanbok"],
    shoes: ["boots", "sneakers", "slippers", "heels", "sandals", "skates", "flippers", "socks", "rocket"]
};

export const ITEM_NAMES: Record<string, string> = {
    cap: "야구 모자", crown: "황금 왕관", tophat: "마술사 모자", helmet: "안전모", beret: "베레모", partyhat: "파티 모자",
    headphone: "헤드셋", flower: "꽃 핀", viking: "바이킹 투구",
    sword: "용사 칼", wand: "요정 지팡이", lollipop: "왕사탕", hammer: "뿅망치", bow: "장난감 활", shield: "나무 방패",
    mic: "황금 마이크", carrot: "신선한 당근", laser: "광선검",
    overalls: "멜빵 바지", suit: "정장", dress: "드레스", hoodie: "후드티", tuxedo: "턱시도", raincoat: "우비",
    armor: "기사 갑옷", jersey: "축구 유니폼", hanbok: "색동 한복",
    boots: "장화", sneakers: "운동화", slippers: "슬리퍼", heels: "구두", sandals: "샌들", skates: "스케이트",
    flippers: "오리발", socks: "줄무늬 양말", rocket: "로켓 부츠"
};

export const BG_COLORS = [
    "linear-gradient(to bottom, #E3F2FD 0%, #BBDEFB 100%)", 
    "linear-gradient(to bottom, #BBDEFB 0%, #90CAF9 100%)", 
    "linear-gradient(to bottom, #90CAF9 0%, #64B5F6 100%)", 
    "linear-gradient(to bottom, #64B5F6 0%, #F8BBD0 100%)", 
    "linear-gradient(to bottom, #F8BBD0 0%, #F48FB1 100%)", 
    "linear-gradient(to bottom, #F48FB1 0%, #FFCC80 100%)", 
    "linear-gradient(to bottom, #FFCC80 0%, #FFB74D 100%)", 
    "linear-gradient(to bottom, #FFB74D 0%, #E1BEE7 100%)", 
    "linear-gradient(to bottom, #E1BEE7 0%, #CE93D8 100%)", 
    "linear-gradient(to bottom, #CE93D8 0%, #BA68C8 100%)" 
];

export const INITIAL_PLAYER_STATE: PlayerState = {
    mode: "guest" as const, 
    name: "게스트", 
    code: "", 
    wallet: 0, 
    totalCandies: 0, 
    level: 1,
    unlockedSkins: ["#ffffff", "#8d6e63"], 
    currentSkin: "#8d6e63", 
    currentCandySkin: 0, // Index 0-19
    
    inventory: {
        hats: [],
        weapons: [],
        clothes: [],
        shoes: []
    },
    equipped: {
        hat: "",
        weapon: "",
        clothes: "",
        shoes: ""
    },

    // Title System
    activeTitle: null,
    unlockedTitles: [],
    stats: {
        totalPlayCount: 0,
        totalHardModeCount: 0,
        totalCandiesCollected: 0,
        totalFalls: 0,
        totalShopVisits: 0,
        totalPlayTimeSec: 0,
        maxTimeSec: 0
    },

    records: [],
    logs: [], // Transaction History
    dailyPlayCount: 0, 
    dailyShopCount: 0, 
    lastGamingDate: "",
    lastGlobalReset: 0
};

export const INITIAL_CONFIG = {
    api: "",
    skinColors: [...DEFAULT_SKINS],
    candyColors: [...CANDY_COLORS],
    priceUpgrade: 5,  
    priceGacha: 10,   
    dailyLimit: 5,    
    shopLimit: 1,
    hardModeEntryCost: 100, // Cost per play
    exchangeRate: 10,   // 10 Candies = 1 Cookie
    globalResetTimestamp: 0
};

export const ACHIEVEMENTS: Achievement[] = [
    {
        id: 'newbie', name: '걸음마 단계', icon: '👶', desc: '게임을 1번이라도 플레이하세요.',
        condition: (s) => s.totalPlayCount >= 1
    },
    {
        id: 'gravity_tester', name: '중력 실험가', icon: '🤕', desc: '구멍에 총 10번 빠지세요.',
        condition: (s) => s.totalFalls >= 10
    },
    {
        id: 'candy_lover', name: '캔디 중독자', icon: '🍬', desc: '누적 캔디 300개를 모으세요.',
        condition: (s) => s.totalCandiesCollected >= 300
    },
    {
        id: 'survivor', name: '생존 전문가', icon: '⏱️', desc: '한 게임에서 60초 이상 버티세요.',
        condition: (s) => s.maxTimeSec >= 60
    },
    {
        id: 'rich', name: '부자', icon: '💎', desc: '지갑에 쿠키를 100개 이상 보유하세요.',
        condition: (_, __, wallet) => wallet >= 100
    },
    {
        id: 'fashionista', name: '패션 피플', icon: '🕶️', desc: '아이템을 총 5개 이상 수집하세요.',
        condition: (_, __, ___, invCount) => invCount >= 5
    },
    {
        id: 'moth', name: '불나방', icon: '🔥', desc: '하드모드를 1회 플레이하세요.',
        condition: (s) => s.totalHardModeCount >= 1
    },
    {
        id: 'shopper', name: '단골 손님', icon: '🛍️', desc: '상점을 누적 10회 방문하세요.',
        condition: (s) => s.totalShopVisits >= 10
    },
    {
        id: 'expert', name: '고인물', icon: '🎓', desc: '레벨 10을 달성하세요.',
        condition: (_, level) => level >= 10
    },
    {
        id: 'marathon', name: '마라토너', icon: '🏃', desc: '총 달린 시간이 10분(600초)을 넘기세요.',
        condition: (s) => s.totalPlayTimeSec >= 600
    }
];