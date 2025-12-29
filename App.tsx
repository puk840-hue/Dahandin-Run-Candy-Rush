
import React, { useState, useEffect, useRef } from 'react';
import GameCanvas from './components/GameCanvas';
import { AppView, PlayerState, GameConfig, GameRecord, TransactionLog, PlayerStats } from './types';
import { INITIAL_PLAYER_STATE, INITIAL_CONFIG, GAME_ITEMS, ITEM_NAMES, ACHIEVEMENTS } from './constants';
import { loadPlayerData, savePlayerData, decryptConfig, encryptConfig, getGamingDate, drawCharacter, drawCandySimple, audioManager } from './utils';

// Shared UI Components
const Modal: React.FC<{ children: React.ReactNode, title?: string, onClose?: () => void, className?: string }> = ({ children, title, onClose, className = "" }) => (
    <div className="fixed inset-0 flex items-center justify-center z-[110] p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
        <div className={`bg-white rounded-[32px] p-8 shadow-2xl max-w-md w-full relative ${className}`}>
            {onClose && <button onClick={onClose} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 text-xl"><i className="fa-solid fa-xmark"></i></button>}
            {title && <h3 className="text-2xl font-black mb-6 text-gray-800 text-center">{title}</h3>}
            {children}
        </div>
    </div>
);

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost' | 'dark' }> = ({ children, variant = 'primary', className = "", onClick, ...props }) => {
    const base = "w-full py-4 px-6 rounded-2xl font-bold text-lg shadow-md transform transition active:scale-95 flex items-center justify-center gap-3 mb-3 disabled:opacity-50";
    const variants = {
        primary: "bg-gradient-to-r from-blue-500 to-blue-600 text-white",
        secondary: "bg-slate-500 text-white",
        accent: "bg-gradient-to-r from-orange-400 to-orange-600 text-white",
        danger: "bg-red-500 text-white",
        ghost: "bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white",
        dark: "bg-slate-800 text-white border border-slate-700 hover:bg-slate-700"
    };
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (props.disabled) return;
        audioManager.resume();
        audioManager.playClickSfx();
        if (onClick) onClick(e);
    };
    return <button className={`${base} ${variants[variant]} ${className}`} onClick={handleClick} {...props}>{children}</button>;
};

const CharacterPreview: React.FC<{ player: PlayerState, scale?: number }> = ({ player, scale = 2 }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx || !canvasRef.current) return;
        let frame = 0;
        let animationId: number;
        const render = () => {
            ctx.clearRect(0, 0, 500, 600);
            frame++;
            ctx.save();
            ctx.scale(scale, scale);
            const cx = (500/2)/scale; const cy = (600/2)/scale;
            drawCharacter(ctx, cx, cy + 20, player.currentSkin, player.equipped, frame * 16, false, 'happy', 0, true);
            drawCandySimple(ctx, cx + 45, cy - 10 + Math.sin(frame * 0.05) * 5, 15, player.currentCandySkin);
            ctx.restore();
            animationId = requestAnimationFrame(render);
        };
        render();
        return () => cancelAnimationFrame(animationId);
    }, [player.currentSkin, player.equipped, player.currentCandySkin, scale]);
    return <canvas ref={canvasRef} width={500} height={600} className="w-full h-full object-contain" />;
};

const App: React.FC = () => {
    const [view, setView] = useState<AppView>(AppView.INTRO);
    const [player, setPlayer] = useState<PlayerState>(INITIAL_PLAYER_STATE);
    const [config, setConfig] = useState<GameConfig>(INITIAL_CONFIG);
    const [tempApiKey, setTempApiKey] = useState("");
    const [isMagicLink, setIsMagicLink] = useState(false);
    const [isHardMode, setIsHardMode] = useState(false);
    const [gameId, setGameId] = useState(0);
    const [lastGameResult, setLastGameResult] = useState<{score: number, candies: number, timeSec: number, timeStr: string, fell: boolean} | null>(null);

    const [showWalletLogs, setShowWalletLogs] = useState(false);
    const [showExchange, setShowExchange] = useState(false);
    const [exchangeAmount, setExchangeAmount] = useState(1);
    const [showTitleSelect, setShowTitleSelect] = useState(false);
    const [showGameModeSelect, setShowGameModeSelect] = useState(false);
    const [purchaseFeedback, setPurchaseFeedback] = useState<{ message: string, subMessage?: string, icon: string } | null>(null);
    const [showTutorial, setShowTutorial] = useState(false);
    const [isGameOverOpen, setGameOverOpen] = useState(false);
    const [showGameIntro, setShowGameIntro] = useState(false);

    const [recordsDiffTab, setRecordsDiffTab] = useState<'normal' | 'hard'>('normal');
    const [recordsMetricTab, setRecordsMetricTab] = useState<'score' | 'time'>('score');
    const [wardrobeTab, setWardrobeTab] = useState<'hat' | 'weapon' | 'clothes' | 'shoes' | 'candy'>('hat');

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const data = params.get('data');
        if (data) {
            const loadedConfig = decryptConfig(data);
            if (loadedConfig) {
                setConfig(prev => ({ ...prev, ...loadedConfig }));
                setTempApiKey(loadedConfig.api || "");
                setIsMagicLink(true);
            }
        }
    }, []);

    useEffect(() => {
        if (view === AppView.LOBBY) {
            checkAchievements(player);
            // Show intro once per session entry
            if (!sessionStorage.getItem('intro_shown')) {
                setShowGameIntro(true);
                sessionStorage.setItem('intro_shown', 'true');
            }
        }
    }, [view]);

    const checkAchievements = (currentPlayer: PlayerState) => {
        const newUnlocked: string[] = [];
        const invCount = currentPlayer.inventory.hats.length + currentPlayer.inventory.weapons.length + currentPlayer.inventory.clothes.length + currentPlayer.inventory.shoes.length;
        
        ACHIEVEMENTS.forEach(ach => {
            if (!currentPlayer.unlockedTitles.includes(ach.id)) {
                if (ach.condition(currentPlayer.stats, currentPlayer.level, currentPlayer.wallet, invCount)) {
                    newUnlocked.push(ach.id);
                }
            }
        });

        if (newUnlocked.length > 0) {
            const updatedUnlocked = [...currentPlayer.unlockedTitles, ...newUnlocked];
            const updatedPlayer = { ...currentPlayer, unlockedTitles: updatedUnlocked };
            setPlayer(updatedPlayer);
            savePlayerData(updatedPlayer);
            
            const firstAch = ACHIEVEMENTS.find(a => a.id === newUnlocked[0]);
            setPurchaseFeedback({ 
                message: "🎉 칭호 획득!", 
                subMessage: `칭호 [${firstAch?.name}]를 획득했습니다! 프로필에서 변경할 수 있어요.`, 
                icon: "fa-crown" 
            });
            audioManager.playUpgradeSfx();
        }
    };

    const toggleTitle = (id: string) => {
        setPlayer(prev => {
            const nextTitle = prev.activeTitle === id ? null : id;
            const updated = { ...prev, activeTitle: nextTitle };
            savePlayerData(updated);
            return updated;
        });
    };

    const handleAddScore = (amount: number) => {
        setPlayer(prev => {
            const updated = {
                ...prev,
                totalCandies: prev.totalCandies + amount,
                stats: {
                    ...prev.stats,
                    totalCandiesCollected: (prev.stats.totalCandiesCollected || 0) + amount
                }
            };
            savePlayerData(updated);
            return updated;
        });
    };

    const handleStudentLogin = async () => {
        const code = (document.getElementById('studentCode') as HTMLInputElement).value;
        if (!code) return alert("학생 코드를 입력하세요.");
        let fetchedName = `학생 ${code.slice(-3)}`;
        let fetchedWallet = 100;
        if (config.api) {
            try {
                const res = await fetch(`https://api.dahandin.com/openapi/v1/get/student/total?code=${code}`, { headers: { "X-API-Key": config.api } });
                const json = await res.json();
                if (json.result) { fetchedName = json.data.name; fetchedWallet = json.data.totalCookie; }
                else return alert("정보를 찾을 수 없습니다.");
            } catch { return alert("네트워크 오류"); }
        }
        const loaded = loadPlayerData(code);
        const serverReset = config.hardResetTimestamp || 0;
        const playerReset = loaded?.lastGlobalReset || 0;
        let pToUse: Partial<PlayerState> = loaded || {};
        if (serverReset > playerReset) {
            pToUse = { ...INITIAL_PLAYER_STATE, wallet: loaded?.wallet ?? 0, logs: loaded?.logs ?? [], lastGlobalReset: serverReset };
        }
        const today = getGamingDate();
        if (pToUse.lastGamingDate !== today) { pToUse.dailyPlayCount = 0; pToUse.dailyShopCount = 0; pToUse.lastGamingDate = today; }
        const final: PlayerState = { ...INITIAL_PLAYER_STATE, ...pToUse, mode: 'student', code, name: fetchedName, wallet: config.api ? fetchedWallet : (pToUse.wallet ?? 100) };
        setPlayer(final); savePlayerData(final); setView(AppView.LOBBY);
    };

    const startNormalGame = () => {
        if (player.mode === 'student' && player.dailyPlayCount >= config.dailyLimit) return alert("오늘의 도전 횟수를 모두 사용했어요!");
        setIsHardMode(false);
        const updated = { ...player, dailyPlayCount: player.dailyPlayCount + 1 };
        setPlayer(updated); savePlayerData(updated);
        setGameId(prev => prev + 1);
        setShowGameModeSelect(false);
        setGameOverOpen(false);
        setView(AppView.GAME);
    };

    const startHardGame = () => {
        if (player.mode === 'student' && player.dailyPlayCount >= config.dailyLimit) return alert("오늘의 도전 횟수를 모두 사용했어요!");
        if (player.totalCandies < config.hardModeEntryCost) return alert(`하드모드 입장을 위해 캔디 ${config.hardModeEntryCost}개가 필요합니다.`);
        setIsHardMode(true);
        const updated = { 
            ...player, 
            dailyPlayCount: player.dailyPlayCount + 1,
            totalCandies: player.totalCandies - config.hardModeEntryCost,
            stats: { ...player.stats, totalHardModeCount: player.stats.totalHardModeCount + 1 }
        };
        setPlayer(updated); savePlayerData(updated);
        setGameId(prev => prev + 1);
        setShowGameModeSelect(false);
        setGameOverOpen(false);
        setView(AppView.GAME);
    };

    const handleGameOver = (score: number, candies: number, timeSec: number, fell: boolean) => {
        const timeStr = `${Math.floor(timeSec/60).toString().padStart(2,'0')}:${(timeSec%60).toString().padStart(2,'0')}`;
        setLastGameResult({ score, candies, timeSec, timeStr, fell }); 
        const nRecord: GameRecord = { date: new Date().toLocaleDateString(), score, timeSec, timeStr, difficulty: isHardMode ? 'hard' : 'normal' };
        const nStats: PlayerStats = { 
            ...player.stats, 
            totalPlayCount: player.stats.totalPlayCount + 1, 
            totalPlayTimeSec: player.stats.totalPlayTimeSec + timeSec, 
            totalFalls: player.stats.totalFalls + (fell ? 1 : 0), 
            maxTimeSec: Math.max(player.stats.maxTimeSec, timeSec) 
        };
        const updated = { ...player, records: [nRecord, ...player.records], stats: nStats };
        setPlayer(updated); savePlayerData(updated); 
        setGameOverOpen(true);
    };

    const buyGacha = () => {
        if (player.wallet < config.priceGacha) return alert("쿠키가 부족합니다.");
        const missing: {cat: 'hats' | 'weapons' | 'clothes' | 'shoes', item: string}[] = [];
        (['hats', 'weapons', 'clothes', 'shoes'] as const).forEach(cat => {
            GAME_ITEMS[cat].forEach(item => {
                if (!player.inventory[cat].includes(item)) missing.push({ cat, item });
            });
        });

        if (missing.length === 0) return alert("모든 아이템을 수집했습니다!");
        const picked = missing[Math.floor(Math.random() * missing.length)];
        const inv = { ...player.inventory }; 
        inv[picked.cat] = [...inv[picked.cat], picked.item];
        
        const n = { 
            ...player, 
            wallet: player.wallet - config.priceGacha, 
            inventory: inv, 
            logs: [{ id: Date.now().toString(), date: new Date().toLocaleString(), desc: `뽑기: ${ITEM_NAMES[picked.item]}`, amount: -config.priceGacha }, ...player.logs] 
        };
        setPlayer(n); savePlayerData(n); 
        audioManager.playGachaSfx(); 
        setPurchaseFeedback({ message: "선물 상자 도착!", subMessage: `${ITEM_NAMES[picked.item]}을(를) 획득했습니다!`, icon: "fa-gift" });
    };

    const getFullPlayerName = () => {
        if (!player.activeTitle) return player.name;
        const ach = ACHIEVEMENTS.find(a => a.id === player.activeTitle);
        return `[${ach?.icon || ''} ${ach?.name || ''}] ${player.name}`;
    };

    return (
        <div className="w-screen h-screen bg-[#1a1a2e] text-slate-800 relative overflow-hidden font-pretendard">
            {showGameIntro && (
                <Modal title="🍭 다했니 런에 오신 것을 환영합니다!" onClose={() => setShowGameIntro(false)}>
                    <div className="text-center space-y-4">
                        <p className="text-slate-600 font-medium">다양한 아이템을 수집하고 장애물을 피해 멀리 달려보세요!</p>
                        <div className="bg-slate-50 p-4 rounded-2xl text-left text-sm space-y-2">
                            <div className="flex items-center gap-2"><span className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">⬆️</span> <span><b>점프/2단 점프:</b> 장애물을 뛰어넘습니다.</span></div>
                            <div className="flex items-center gap-2"><span className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">⬇️</span> <span><b>슬라이드:</b> 낮은 장애물을 피합니다.</span></div>
                            <div className="flex items-center gap-2"><span className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">🍬</span> <span><b>점수:</b> 캔디 x 강화 레벨 + 점프 횟수 x 보너스</span></div>
                        </div>
                        <Button onClick={() => setShowGameIntro(false)} variant="primary">시작하기</Button>
                    </div>
                </Modal>
            )}

            {purchaseFeedback && (
                <Modal onClose={() => setPurchaseFeedback(null)}>
                    <div className="text-center">
                        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce"><i className={`fa-solid ${purchaseFeedback.icon} text-3xl text-blue-600`}></i></div>
                        <h3 className="text-2xl font-black mb-2">{purchaseFeedback.message}</h3>
                        <p className="text-gray-500 mb-6">{purchaseFeedback.subMessage}</p>
                        <Button onClick={() => setPurchaseFeedback(null)} variant="primary">확인</Button>
                    </div>
                </Modal>
            )}

            {showTitleSelect && (
                <Modal title="🏆 칭호 선택" onClose={() => setShowTitleSelect(false)}>
                    <div className="max-h-[350px] overflow-y-auto pr-2 no-scrollbar space-y-3">
                        {ACHIEVEMENTS.map(ach => {
                            const isUnlocked = player.unlockedTitles.includes(ach.id);
                            const isActive = player.activeTitle === ach.id;
                            return (
                                <div key={ach.id} onClick={() => isUnlocked && toggleTitle(ach.id)} className={`p-4 rounded-2xl border-2 flex items-center gap-4 transition-all ${isUnlocked ? (isActive ? 'border-blue-500 bg-blue-50 cursor-pointer' : 'border-slate-100 bg-white hover:border-slate-200 cursor-pointer') : 'border-slate-50 bg-slate-50 opacity-50 grayscale cursor-not-allowed'}`}>
                                    <div className="text-3xl">{ach.icon}</div>
                                    <div className="text-left flex-1">
                                        <div className="font-black text-slate-800">{ach.name}</div>
                                        <div className="text-xs text-slate-400 font-medium">{ach.desc}</div>
                                    </div>
                                    {isActive && <i className="fa-solid fa-check text-blue-500"></i>}
                                </div>
                            );
                        })}
                    </div>
                </Modal>
            )}

            {showWalletLogs && (
                <Modal title="💰 쿠키 내역" onClose={() => setShowWalletLogs(false)}>
                    <div className="max-h-[350px] overflow-y-auto pr-2 no-scrollbar space-y-2">
                        {player.logs.length === 0 ? (
                            <div className="text-center py-10 text-slate-400 font-bold italic">내역이 없습니다.</div>
                        ) : (
                            player.logs.map(log => (
                                <div key={log.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                                    <div className="text-left">
                                        <div className="text-xs text-slate-400">{log.date}</div>
                                        <div className="font-bold text-slate-700">{log.desc}</div>
                                    </div>
                                    <div className={`font-black ${log.amount > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                        {log.amount > 0 ? `+${log.amount}` : log.amount}🍪
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </Modal>
            )}

            {view === AppView.INTRO && (
                <div className="w-full h-full flex flex-col md:flex-row animate-fade-in">
                    <div className="flex-1 flex items-center justify-center relative bg-gradient-to-br from-[#1a1a2e] to-[#2a2a4e]">
                        <div className="w-full h-full max-w-2xl"><CharacterPreview player={player} scale={3} /></div>
                        <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a2e] via-transparent to-transparent pointer-events-none" />
                    </div>
                    <div className="w-full md:w-[400px] bg-black/40 backdrop-blur-2xl border-l border-white/10 flex flex-col p-8 md:p-12 items-center justify-center shadow-2xl relative z-10">
                        <div className="mb-12 text-center">
                            <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-amber-300 to-orange-500 mb-2 drop-shadow-xl">다했니 런</h1>
                            <div className="inline-block px-4 py-1 rounded-full bg-black/40 border border-white/20"><span className="text-xs font-bold text-white tracking-[0.2em]">REMASTERED</span></div>
                        </div>
                        <div className="w-full flex flex-col gap-4">
                            <Button onClick={() => setView(AppView.LOGIN)} variant="primary" className="py-5"><i className="fa-solid fa-user-graduate"></i> 학생 시작하기</Button>
                            {!isMagicLink && <Button onClick={() => setView(AppView.TEACHER)} variant="dark" className="py-4 bg-purple-600/80 hover:bg-purple-600 border-none"><i className="fa-solid fa-chalkboard-user"></i> 선생님 시작하기</Button>}
                            <Button onClick={() => { setPlayer(p => ({...p, mode:'test', wallet:9999, totalCandies:9999, name:'테스트 유저'})); setView(AppView.LOBBY); }} variant="ghost" className="py-4"><i className="fa-solid fa-gamepad"></i> 테스트 모드로 체험하기</Button>
                        </div>
                    </div>
                </div>
            )}

            {view === AppView.LOGIN && (
                <Modal title="🚀 학생 로그인">
                    <input id="studentCode" type="text" placeholder="학생 코드를 입력하세요" className="w-full p-6 border-2 border-slate-100 rounded-3xl text-2xl mb-8 text-center font-bold outline-none focus:border-blue-400 shadow-inner" />
                    <Button onClick={handleStudentLogin} variant="primary" className="py-5 text-xl">로그인</Button>
                    <Button onClick={() => setView(AppView.INTRO)} variant="secondary">뒤로가기</Button>
                </Modal>
            )}

            {view === AppView.LOBBY && (
                <div className="w-full h-full flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-[24px] p-8 w-full max-w-md shadow-2xl relative border-t-8 border-blue-500">
                        <div className="flex flex-col items-center justify-center gap-2 mb-10 group">
                            <span className="text-2xl font-black text-slate-800 break-all text-center">{getFullPlayerName()}</span>
                            <button onClick={() => setShowTitleSelect(true)} className="flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors text-xs font-bold"><i className="fa-solid fa-pencil"></i> 칭호 변경</button>
                        </div>
                        <div className="grid grid-cols-2 gap-5 mb-8">
                            <div onClick={() => setShowWalletLogs(true)} className="bg-orange-50 p-5 rounded-[24px] cursor-pointer hover:bg-orange-100 transition-colors border border-orange-200/50 shadow-sm relative text-center">
                                <div className="text-orange-800 font-bold mb-1 flex justify-between items-center"><span className="text-xs uppercase tracking-wider">내 지갑</span><i className="fa-solid fa-list-ul text-[10px]"></i></div>
                                <div className="text-2xl font-black text-orange-600">{player.wallet} <span className="text-sm">쿠키</span></div>
                            </div>
                            <div onClick={() => { setExchangeAmount(1); setShowExchange(true); }} className="bg-purple-50 p-5 rounded-[24px] cursor-pointer hover:bg-purple-100 transition-colors border border-purple-200/50 shadow-sm relative text-center">
                                <div className="text-purple-800 font-bold mb-1 flex justify-between items-center"><span className="text-xs uppercase tracking-wider">보유 캔디</span><i className="fa-solid fa-repeat text-[10px]"></i></div>
                                <div className="text-2xl font-black text-purple-600">{player.totalCandies} <span className="text-sm">개</span></div>
                            </div>
                        </div>

                        <div className="flex justify-between gap-4 mb-8">
                            <div className="flex-1 bg-blue-50/50 p-3 rounded-2xl text-center border border-blue-100">
                                <div className="text-[10px] text-blue-400 font-bold uppercase tracking-tighter">오늘 게임</div>
                                <div className="font-black text-blue-600">{player.dailyPlayCount} / {config.dailyLimit}</div>
                            </div>
                            <div className="flex-1 bg-rose-50/50 p-3 rounded-2xl text-center border border-rose-100">
                                <div className="text-[10px] text-rose-400 font-bold uppercase tracking-tighter">상점 입장</div>
                                <div className="font-black text-rose-600">{player.dailyShopCount} / {config.shopLimit}</div>
                            </div>
                        </div>

                        <Button onClick={() => setShowGameModeSelect(true)} variant="accent" className="py-8 text-2xl rounded-[28px] mb-6 shadow-orange-500/20">▶ 게임 시작</Button>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <Button onClick={() => {
                                if (player.mode === 'student' && player.dailyShopCount >= config.shopLimit) return alert("오늘의 상점 이용 횟수를 모두 사용했어요!");
                                setView(AppView.SHOP);
                            }} variant="secondary" className="py-4 rounded-[20px] bg-slate-400"><i className="fa-solid fa-store"></i> 상점</Button>
                            <Button onClick={() => setView(AppView.WARDROBE)} variant="secondary" className="py-4 rounded-[20px] bg-slate-400"><i className="fa-solid fa-shirt"></i> 옷장</Button>
                        </div>
                        <Button onClick={() => setView(AppView.RECORDS)} variant="secondary" className="py-4 rounded-[20px] bg-slate-400"><i className="fa-solid fa-trophy"></i> 명예의 전당</Button>
                        <Button onClick={() => setView(AppView.INTRO)} variant="danger" className="mt-4 py-4 rounded-[20px] bg-red-500 shadow-red-500/20">나가기</Button>
                    </div>
                </div>
            )}

            {showExchange && (
                <Modal onClose={() => setShowExchange(false)}>
                    <div className="text-center mb-6"><h3 className="text-2xl font-black text-purple-700 flex items-center justify-center gap-2">🍬 캔디 환전소</h3></div>
                    <div className="bg-slate-50 p-6 rounded-[24px] mb-8 border border-slate-100 text-center">
                        <p className="text-sm text-slate-400 font-bold mb-2">현재 환율</p>
                        <p className="text-xl font-black text-slate-800">캔디 <span className="text-purple-600">{config.exchangeRate}개</span> = 쿠키 <span className="text-orange-500">1개</span></p>
                    </div>
                    <div className="text-center mb-8">
                        <p className="text-sm text-slate-500 font-bold mb-4">구매할 쿠키 개수</p>
                        <div className="flex items-center justify-center gap-6 mb-4">
                            <button onClick={() => setExchangeAmount(Math.max(1, exchangeAmount - 1))} className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-2xl font-bold hover:bg-slate-200">-</button>
                            <span className="text-4xl font-black text-slate-800 min-w-[60px]">{exchangeAmount}</span>
                            <button onClick={() => setExchangeAmount(Math.min(100, exchangeAmount + 1))} className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-2xl font-bold hover:bg-slate-200">+</button>
                        </div>
                        <p className="text-slate-500 font-bold">필요한 캔디: <span className="text-purple-600 font-black">{exchangeAmount * config.exchangeRate}</span>개</p>
                    </div>
                    <Button onClick={() => {
                        const cost = exchangeAmount * config.exchangeRate;
                        if(player.totalCandies < cost) return alert("캔디가 부족해요!");
                        const n = { ...player, totalCandies: player.totalCandies - cost, wallet: player.wallet + exchangeAmount, logs: [{ id: Date.now().toString(), date: new Date().toLocaleString(), desc: `캔디 환전 (${exchangeAmount}개)`, amount: exchangeAmount }, ...player.logs] };
                        setPlayer(n); savePlayerData(n); setShowExchange(false); setPurchaseFeedback({ message: "환전 완료!", subMessage: `쿠키 ${exchangeAmount}개를 얻었습니다.`, icon: "fa-exchange" });
                    }} variant="accent" className="py-5 bg-amber-800 border-none rounded-2xl">환전하기</Button>
                </Modal>
            )}

            {showGameModeSelect && (
                <Modal onClose={() => setShowGameModeSelect(false)}>
                    <h3 className="text-3xl font-black text-center mb-10 text-slate-800">모드 선택</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div onClick={startNormalGame} className="bg-blue-50 p-8 rounded-[32px] border-4 border-blue-200 cursor-pointer hover:scale-105 transition-all text-center group">
                            <div className="text-6xl mb-4 group-hover:animate-bounce">🏃</div>
                            <h4 className="text-xl font-bold text-blue-800">일반 모드</h4>
                        </div>
                        <div onClick={startHardGame} className="bg-red-50 p-8 rounded-[32px] border-4 border-red-200 cursor-pointer hover:scale-105 transition-all text-center group">
                            <div className="text-6xl mb-4 group-hover:animate-bounce">🔥</div>
                            <h4 className="text-xl font-bold text-red-800">하드 모드</h4>
                        </div>
                    </div>
                </Modal>
            )}

            {view === AppView.SHOP && (
                <div className="w-full h-full flex items-center justify-center p-4 animate-fade-in overflow-x-auto">
                    <div className="bg-white rounded-[40px] p-10 w-full max-w-5xl shadow-2xl relative flex flex-col gap-8 max-h-[90vh] overflow-y-auto no-scrollbar">
                        <div className="text-center shrink-0">
                            <h2 className="text-3xl font-black text-slate-800 mb-2 flex items-center justify-center gap-3"><i className="fa-solid fa-shopping-cart text-slate-300"></i>아이템 상점</h2>
                            <p className="text-slate-400 font-bold">쿠키를 사용하여 능력을 강화하세요!</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 text-center flex flex-col items-center group hover:bg-white hover:shadow-xl transition-all">
                                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4 text-3xl group-hover:scale-110 transition-transform">⚡</div>
                                <h3 className="font-black text-lg mb-1">캔디 강화</h3>
                                <p className="text-xs text-slate-400 font-bold mb-2">현재 Lv.{player.level}</p>
                                <p className="text-[10px] text-slate-500 leading-tight mb-6">캔디 하나당 획득하는 점수 배율이 증가합니다.</p>
                                <Button onClick={() => {
                                    const cost = player.level * config.priceUpgrade;
                                    if(player.wallet < cost) return alert("쿠키가 부족해요!");
                                    const n = { ...player, level: player.level + 1, wallet: player.wallet - cost, logs: [{ id: Date.now().toString(), date: new Date().toLocaleString(), desc: "캔디 강화", amount: -cost }, ...player.logs] };
                                    setPlayer(n); savePlayerData(n); setPurchaseFeedback({ message: "강화 성공!", subMessage: `Lv.${n.level}로 강화되었습니다.`, icon: "fa-bolt" });
                                }} variant="accent" className="mt-auto mb-0 py-3 text-sm bg-amber-800 border-none">강화 {player.level * config.priceUpgrade}🍪</Button>
                            </div>
                            <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 text-center flex flex-col items-center group hover:bg-white hover:shadow-xl transition-all">
                                <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mb-4 text-3xl group-hover:scale-110 transition-transform">❤️</div>
                                <h3 className="font-black text-lg mb-1">하트 강화</h3>
                                <p className="text-xs text-slate-400 font-bold mb-2">최대 {player.maxHearts}/5</p>
                                <p className="text-[10px] text-slate-500 leading-tight mb-6">부딪혀도 버틸 수 있는 생명력이 늘어납니다.</p>
                                <Button onClick={() => {
                                    if(player.maxHearts >= 5) return alert("이미 최대치입니다.");
                                    if(player.wallet < config.priceHeartUpgrade) return alert("쿠키가 부족해요!");
                                    const n = { ...player, maxHearts: player.maxHearts + 1, wallet: player.wallet - config.priceHeartUpgrade, logs: [{ id: Date.now().toString(), date: new Date().toLocaleString(), desc: "하트 강화", amount: -config.priceHeartUpgrade }, ...player.logs] };
                                    setPlayer(n); savePlayerData(n); setPurchaseFeedback({ message: "강화 성공!", subMessage: `하트가 ${n.maxHearts}개로 늘어났습니다.`, icon: "fa-heart" });
                                }} variant="accent" className="mt-auto mb-0 py-3 text-sm bg-amber-800 border-none">강화 {config.priceHeartUpgrade}🍪</Button>
                            </div>
                            <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 text-center flex flex-col items-center group hover:bg-white hover:shadow-xl transition-all">
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 text-3xl group-hover:scale-110 transition-transform">🦘</div>
                                <h3 className="font-black text-lg mb-1">점프 강화</h3>
                                <p className="text-xs text-slate-400 font-bold mb-2">보너스 {player.jumpBonus}/10</p>
                                <p className="text-[10px] text-slate-500 leading-tight mb-6">점프할 때마다 추가로 획득하는 점수가 증가합니다.</p>
                                <Button onClick={() => {
                                    if(player.jumpBonus >= 10) return alert("이미 최대치입니다.");
                                    if(player.wallet < config.priceJumpUpgrade) return alert("쿠키가 부족해요!");
                                    const n = { ...player, jumpBonus: player.jumpBonus + 1, wallet: player.wallet - config.priceJumpUpgrade, logs: [{ id: Date.now().toString(), date: new Date().toLocaleString(), desc: "점프 강화", amount: -config.priceJumpUpgrade }, ...player.logs] };
                                    setPlayer(n); savePlayerData(n); setPurchaseFeedback({ message: "강화 성공!", subMessage: `점프 보너스가 ${n.jumpBonus}점이 되었습니다.`, icon: "fa-arrow-up" });
                                }} variant="accent" className="mt-auto mb-0 py-3 text-sm bg-amber-800 border-none">강화 {config.priceJumpUpgrade}🍪</Button>
                            </div>
                            <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 text-center flex flex-col items-center group hover:bg-white hover:shadow-xl transition-all">
                                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4 text-3xl group-hover:scale-110 transition-transform">🎁</div>
                                <h3 className="font-black text-lg mb-1">랜덤 뽑기</h3>
                                <p className="text-xs text-slate-400 font-bold mb-2">무작위 아이템</p>
                                <p className="text-[10px] text-slate-500 leading-tight mb-6">모자, 무기, 의상, 신발 중 하나를 획득합니다.</p>
                                <Button onClick={buyGacha} variant="primary" className="mt-auto mb-0 py-3 text-sm">뽑기 {config.priceGacha}🍪</Button>
                            </div>
                        </div>

                        {/* Gacha Lineup Display */}
                        <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-100 shrink-0">
                            <h4 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2"><i className="fa-solid fa-layer-group text-blue-400"></i> 전체 뽑기 라인업</h4>
                            <div className="grid grid-cols-4 gap-2">
                                {(['hats', 'weapons', 'clothes', 'shoes'] as const).map(cat => (
                                    <div key={cat} className="space-y-1">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{cat === 'hats' ? '모자' : cat === 'weapons' ? '무기' : cat === 'clothes' ? '의상' : '신발'}</div>
                                        <div className="flex flex-wrap gap-1">
                                            {GAME_ITEMS[cat].map(item => {
                                                const has = player.inventory[cat].includes(item);
                                                return <div key={item} title={ITEM_NAMES[item]} className={`w-3 h-3 rounded-sm ${has ? 'bg-blue-500' : 'bg-slate-200'}`} />;
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <Button onClick={() => setView(AppView.LOBBY)} variant="secondary" className="py-4 bg-slate-500 rounded-[20px] max-w-sm mx-auto">로비로 돌아가기</Button>
                    </div>
                </div>
            )}

            {view === AppView.WARDROBE && (
                <div className="w-full h-full flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-[40px] p-10 w-full max-w-5xl h-[75vh] shadow-2xl relative flex flex-col border-t-8 border-purple-500">
                        <h2 className="text-3xl font-black text-slate-800 mb-8 text-center">👔 내 옷장</h2>
                        <div className="flex flex-col md:flex-row gap-8 flex-1 overflow-hidden">
                            <div className="w-full md:w-[35%] shrink-0 flex items-center justify-center bg-slate-50 rounded-[32px] p-6 relative">
                                <CharacterPreview player={player} scale={2.5} />
                                <div className="absolute top-4 left-4 flex items-center gap-3">
                                    <input type="color" value={player.currentSkin} onChange={e=>setPlayer({...player, currentSkin: e.target.value})} className="w-10 h-10 rounded-xl cursor-pointer border-4 border-white shadow-md overflow-hidden p-0" />
                                    <span className="text-sm font-bold text-slate-500">피부색 변경</span>
                                </div>
                            </div>
                            <div className="w-full md:w-[65%] flex flex-col overflow-hidden">
                                <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar py-1">
                                    {['hat','weapon','clothes','shoes','candy'].map(t => (
                                        <button key={t} onClick={() => setWardrobeTab(t as any)} className={`px-6 py-2 rounded-2xl font-bold transition-all text-sm shrink-0 ${wardrobeTab === t ? 'bg-purple-500 text-white shadow-lg' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                                            {{hat:'모자',weapon:'무기',clothes:'의상',shoes:'신발',candy:'캔디'}[t as any]}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex-1 bg-slate-50 rounded-[32px] p-6 overflow-y-auto no-scrollbar border border-slate-100">
                                    {wardrobeTab === 'candy' ? (
                                        <div className="grid grid-cols-5 gap-3">
                                            {Array.from({length: 20}).map((_, i) => {
                                                const isLocked = i >= player.level;
                                                return (
                                                    <div key={i} 
                                                        onClick={() => { 
                                                            if (isLocked) return alert(`캔디 레벨 ${i+1}이 되어야 사용할 수 있습니다! (현재: ${player.level})`);
                                                            setPlayer(p => ({...p, currentCandySkin: i})); 
                                                            savePlayerData({...player, currentCandySkin: i}); 
                                                        }} 
                                                        className={`aspect-square rounded-[20px] border-4 cursor-pointer flex items-center justify-center transition-all relative ${isLocked ? 'grayscale opacity-50 bg-slate-200 cursor-not-allowed' : (player.currentCandySkin === i ? 'bg-amber-100 border-amber-500 scale-95' : 'bg-white border-transparent hover:border-slate-200')}`}>
                                                        <canvas width="40" height="40" ref={c => { if(c) drawCandySimple(c.getContext('2d')!, 20, 20, 15, i); }} />
                                                        {isLocked && <div className="absolute inset-0 flex items-center justify-center"><i className="fa-solid fa-lock text-slate-400"></i></div>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-3">
                                            {/* @ts-ignore */}
                                            {player.inventory[wardrobeTab === 'clothes' ? 'clothes' : (wardrobeTab === 'shoes' ? 'shoes' : (wardrobeTab + 's'))].length === 0 ? (
                                                <div className="w-full py-16 text-center text-slate-300 font-bold italic">아이템이 없습니다.</div>
                                            ) : (
                                                // @ts-ignore
                                                player.inventory[wardrobeTab === 'clothes' ? 'clothes' : (wardrobeTab === 'shoes' ? 'shoes' : (wardrobeTab + 's'))].map((item: string) => (
                                                    <div key={item} onClick={() => {
                                                        const nextEquip = player.equipped[wardrobeTab as keyof typeof player.equipped] === item ? "" : item;
                                                        const n = {...player, equipped: {...player.equipped, [wardrobeTab]: nextEquip}};
                                                        setPlayer(n); savePlayerData(n);
                                                    }} className={`px-5 py-4 rounded-2xl cursor-pointer border-4 font-bold text-sm transition-all ${player.equipped[wardrobeTab as keyof typeof player.equipped] === item ? 'bg-purple-500 border-purple-600 text-white scale-95 shadow-md' : 'bg-white border-slate-100 text-slate-600 hover:border-slate-300'}`}>
                                                        {ITEM_NAMES[item] || item}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <Button onClick={() => setView(AppView.LOBBY)} variant="primary" className="mt-8 rounded-[24px] max-w-sm mx-auto">저장 및 나가기</Button>
                    </div>
                </div>
            )}

            {view === AppView.RECORDS && (
                <div className="w-full h-full flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-[40px] p-10 w-full max-w-2xl h-[75vh] shadow-2xl relative flex flex-col border-t-8 border-slate-800">
                        <h2 className="text-3xl font-black text-slate-800 mb-8 text-center"><i className="fa-solid fa-trophy mr-3 text-yellow-500"></i>명예의 전당</h2>
                        <div className="flex-1 bg-slate-50 rounded-[32px] p-6 overflow-y-auto no-scrollbar">
                            {(() => {
                                const filtered = player.records.filter(r => r.difficulty === recordsDiffTab);
                                const sorted = [...filtered].sort((a, b) => recordsMetricTab === 'score' ? b.score - a.score : b.timeSec - a.timeSec);
                                if (sorted.length === 0) return <div className="py-20 text-center text-slate-300 font-bold italic">기록이 없습니다.</div>;
                                return sorted.slice(0, 10).map((r, i) => (
                                    <div key={i} className="flex items-center justify-between py-4 border-b border-slate-200/50 last:border-0">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${i===0 ? 'bg-yellow-400 text-white' : 'bg-slate-100 text-slate-400'}`}>{i+1}</div>
                                            <div className="text-left font-bold text-slate-700">{r.date}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xl font-black text-slate-800 flex items-center gap-2">
                                                <i className="fa-solid fa-trophy text-yellow-500 text-sm"></i>{r.score}
                                            </div>
                                            <div className="text-[10px] font-bold text-slate-300">{r.timeStr}</div>
                                        </div>
                                    </div>
                                ));
                            })()}
                        </div>
                        <Button onClick={() => setView(AppView.LOBBY)} variant="secondary" className="mt-8 bg-slate-500 rounded-[20px]">닫기</Button>
                    </div>
                </div>
            )}

            {view === AppView.GAME && (
                <div className="w-full h-full relative">
                    <GameCanvas 
                        key={gameId} 
                        playerState={player} 
                        config={config} 
                        onGameOver={handleGameOver} 
                        onAddScore={handleAddScore} 
                        isPaused={isGameOverOpen} 
                        isHardMode={isHardMode} 
                    />
                    
                    {isGameOverOpen && lastGameResult && (
                        <Modal title="🎮 게임 종료!" className="z-[120]">
                            <div className="bg-slate-50 rounded-3xl p-6 mb-6 space-y-4">
                                <div className="flex justify-between items-center text-lg font-bold">
                                    <span className="text-slate-400">생존 시간</span>
                                    <span className="text-slate-800">{lastGameResult.timeStr}</span>
                                </div>
                                <div className="flex justify-between items-center text-lg font-bold">
                                    <span className="text-slate-400">🍬 획득 캔디</span>
                                    <span className="text-purple-600 font-black">{lastGameResult.candies}개</span>
                                </div>
                                <div className="flex justify-between items-center text-2xl font-black pt-2 border-t border-slate-200">
                                    <span className="text-slate-800">최종 점수</span>
                                    <span className="text-amber-500 drop-shadow-sm">{lastGameResult.score}</span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <Button onClick={isHardMode ? startHardGame : startNormalGame} variant="accent" className="py-4 shadow-orange-200">다시 도전</Button>
                                <Button onClick={() => { setGameOverOpen(false); setView(AppView.LOBBY); }} variant="secondary" className="py-4">로비로 이동</Button>
                            </div>
                        </Modal>
                    )}
                </div>
            )}
        </div>
    );
};

export default App;
