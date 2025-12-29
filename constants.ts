
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
    overalls: "멜빵 바지", suit: "정장", dress: "드레스", hoodie: "hoodie", tuxedo: "턱시도", raincoat: "우비",
    armor: "기사 갑옷", jersey: "축구 유니폼", hanbok: "색동 한복",
    boots: "장화", sneakers: "운동화", slippers: "슬리퍼", heels: "구두", sandals: "샌들", skates: "스케이트",
    flippers: "오리발", socks: "줄무늬 양말", rocket: "로켓 부츠"
};

export const BG_COLORS = [
    "linear-gradient(to bottom, #87CEEB 0%, #E0F7FA 100%)", // 1: 맑은 낮
    "linear-gradient(to bottom, #74ebd5 0%, #ACB6E5 100%)", // 2: 에메랄드 낮
    "linear-gradient(to bottom, #89f7fe 0%, #66a6ff 100%)", // 3: 시원한 하늘
    "linear-gradient(to bottom, #fbc2eb 0%, #a6c1ee 100%)", // 4: 몽환적인 핑크
    "linear-gradient(to bottom, #fdcbf1 0%, #fdcbf1 1%, #e6dee9 100%)", // 5: 밝은 노을 기미
    "linear-gradient(to bottom, #f6d365 0%, #fda085 100%)", // 6: 따뜻한 주황 노을
    "linear-gradient(to bottom, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)", // 7: 붉은 노을
    "linear-gradient(to bottom, #a18cd1 0%, #fbc2eb 100%)", // 8: 보랏빛 황혼
    "linear-gradient(to bottom, #30cfd0 0%, #330867 100%)", // 9: 깊은 밤의 시작
    "linear-gradient(to bottom, #09203f 0%, #537895 100%)"  // 10: 심야
];

export const INITIAL_PLAYER_STATE: PlayerState = {
    mode: "guest" as const, 
    name: "게스트", 
    code: "", 
    wallet: 0, 
    totalCandies: 0, 
    level: 1,
    maxHearts: 1,
    jumpBonus: 1, 
    unlockedSkins: ["#ffffff", "#8d6e63"], 
    currentSkin: "#8d6e63", 
    currentCandySkin: 0, 
    
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
    logs: [], 
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
    priceHeartUpgrade: 50,
    priceJumpUpgrade: 10,
    dailyLimit: 5,    
    shopLimit: 1,
    hardModeEntryCost: 30, 
    exchangeRate: 10,   
    globalResetTimestamp: 0,
    hardResetTimestamp: 0
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
