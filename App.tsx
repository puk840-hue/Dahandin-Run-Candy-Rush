import React, { useState, useEffect, useRef } from 'react';
import GameCanvas from './components/GameCanvas';
import { AppView, PlayerState, GameConfig, GameRecord } from './types';
import { INITIAL_PLAYER_STATE, INITIAL_CONFIG, GAME_ITEMS, ITEM_NAMES } from './constants';
import { loadPlayerData, savePlayerData, decryptConfig, encryptConfig, getGamingDate, drawCharacter, drawCandySimple, audioManager } from './utils';

// Helper UI Component for panels
const Panel: React.FC<{ children: React.ReactNode, title?: string, className?: string, onClose?: () => void }> = ({ children, title, className = "", onClose }) => (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
        <div className={`bg-white/95 backdrop-blur-xl p-6 md:p-8 rounded-3xl shadow-2xl border border-white/40 w-[95%] max-w-2xl text-center pointer-events-auto overflow-y-auto max-h-[95vh] transition-all duration-300 no-scrollbar relative ${className}`}>
            {onClose && <button onClick={onClose} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 text-2xl"><i className="fa-solid fa-xmark"></i></button>}
            {title && <h2 className={`text-3xl md:text-4xl font-black mb-8 ${className.includes('bg-slate-900') ? 'text-white' : 'text-gray-800'}`}>{title}</h2>}
            {children}
        </div>
    </div>
);

// Character Preview Component (Optimized scale & transparency)
const CharacterPreview: React.FC<{ player: PlayerState }> = ({ player }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx || !canvasRef.current) return;
        let frame = 0;
        let animationId: number;
        const render = () => {
            // Updated Canvas Resolution for cleaner look
            ctx.clearRect(0, 0, 300, 400);
            frame++;
            const animTick = frame * 16; 
            
            // Transform for BIGGER character
            ctx.save();
            ctx.scale(2, 2); // Double scale
            // Adjusted coordinates for scaled drawing
            // Original center ~150, now ~75. Y adjusted.
            drawCharacter(ctx, 75, 140, player.currentSkin, player.equipped, animTick, false, 'happy', 0, true);
            const candyY = 100 + Math.sin(frame * 0.05) * 5;
            drawCandySimple(ctx, 120, candyY, 12, player.currentCandySkin);
            ctx.restore();
            
            animationId = requestAnimationFrame(render);
        };
        render();
        return () => cancelAnimationFrame(animationId);
    }, [player.currentSkin, player.equipped, player.currentCandySkin]);

    return (
        <div className="w-full h-full flex items-center justify-center">
             <canvas ref={canvasRef} width={300} height={400} className="w-full h-full object-contain drop-shadow-xl" />
        </div>
    );
};

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'accent' | 'danger' }> = ({ children, variant = 'primary', className = "", onClick, ...props }) => {
    const base = "w-full py-3 px-6 rounded-xl font-bold text-lg shadow-md transform transition active:scale-95 hover:-translate-y-0.5 flex items-center justify-center gap-2 mb-3";
    const variants = {
        primary: "bg-gradient-to-br from-amber-700 to-amber-900 text-white",
        secondary: "bg-gradient-to-br from-gray-400 to-gray-600 text-white",
        accent: "bg-gradient-to-br from-orange-400 to-orange-600 text-white",
        danger: "bg-gradient-to-br from-red-500 to-red-700 text-white"
    };
    
    // Wrapper for click sound
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        audioManager.playClickSfx();
        if (onClick) onClick(e);
    };

    return <button className={`${base} ${variants[variant]} ${className}`} onClick={handleClick} {...props}>{children}</button>;
};

const App: React.FC = () => {
    const [view, setView] = useState<AppView>(AppView.INTRO);
    const [player, setPlayer] = useState<PlayerState>(INITIAL_PLAYER_STATE);
    const [config, setConfig] = useState<GameConfig>(INITIAL_CONFIG);
    const [tempApiKey, setTempApiKey] = useState("");
    
    const [isHardMode, setIsHardMode] = useState(false);
    const [purchaseFeedback, setPurchaseFeedback] = useState<{ message: string, subMessage?: string, color?: string, icon?: string } | null>(null);
    const [gameId, setGameId] = useState(0); 
    const [isGameOverModalOpen, setGameOverModalOpen] = useState(false);
    const [isRestartConfirmOpen, setRestartConfirmOpen] = useState(false);
    const [lastGameResult, setLastGameResult] = useState<{score: number, time: number, fell: boolean} | null>(null);
    const [recordTab, setRecordTab] = useState<'score' | 'time'>('score');
    const [recordDifficultyTab, setRecordDifficultyTab] = useState<'normal' | 'hard'>('normal');
    const [wardrobeTab, setWardrobeTab] = useState<'hat' | 'weapon' | 'clothes' | 'shoes'>('hat');
    const [helpOpen, setHelpOpen] = useState(false);

    // Initialization
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const data = params.get('data');
        if (data) {
            const loadedConfig = decryptConfig(data);
            if (loadedConfig) {
                setConfig(prev => ({ ...prev, ...loadedConfig }));
                setTempApiKey(loadedConfig.api || "");
                setView(AppView.LOGIN);
            } else {
                alert("잘못된 링크입니다.");
                window.location.search = "";
            }
        }
    }, []);

    // --- Actions ---

    const handleTeacherLogin = () => {
        setView(AppView.TEACHER);
    };

    const handleGenerateLink = () => {
        const newConfig = { ...config, api: tempApiKey };
        setConfig(newConfig);

        const payload = { 
            ...newConfig,
            k: tempApiKey, 
        };
        const encrypted = encryptConfig(payload);
        const link = `${window.location.href.split('?')[0]}?data=${encodeURIComponent(encrypted)}`;
        navigator.clipboard.writeText(link).then(() => alert("✨ 학생용 매직 링크가 복사되었습니다!"));
    };

    const handleStudentLogin = async () => {
        const codeInput = (document.getElementById('studentCode') as HTMLInputElement).value;
        if (!codeInput) return alert("학생 코드를 입력해주세요.");
        
        try {
            // API Login Logic
            let fetchedName = `학생 ${codeInput.slice(-3)}`;
            let fetchedWallet = 0;
            let success = false;

            if (config.api) {
                try {
                    const response = await fetch(`https://api.dahandin.com/openapi/v1/get/student/total?code=${codeInput}`, {
                        headers: { "X-API-Key": config.api }
                    });
                    const json = await response.json();
                    if (json.result) {
                        fetchedName = json.data.name;
                        fetchedWallet = json.data.totalCookie;
                        success = true;
                    } else {
                        alert("학생 정보를 찾을 수 없습니다.");
                        return;
                    }
                } catch (apiError) {
                    console.error(apiError);
                    alert("통신 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
                    return;
                }
            } else {
                 // Fallback for demo/no-api mode
                 fetchedWallet = 100;
                 success = true;
            }

            if (success) {
                const loaded = loadPlayerData(codeInput);
                const today = getGamingDate();
                let dailyPlay = loaded?.dailyPlayCount || 0;
                let dailyShop = loaded?.dailyShopCount || 0;
                if (loaded?.lastGamingDate !== today) { dailyPlay = 0; dailyShop = 0; }

                const currentCandySkin = (typeof loaded?.currentCandySkin === 'number') ? loaded.currentCandySkin : 0;
                const inventory = loaded?.inventory || INITIAL_PLAYER_STATE.inventory;
                const equipped = loaded?.equipped || INITIAL_PLAYER_STATE.equipped;
                const totalCandies = loaded?.totalCandies || 0; 

                setPlayer({
                    ...INITIAL_PLAYER_STATE,
                    mode: 'student',
                    code: codeInput,
                    name: fetchedName,
                    wallet: fetchedWallet, // Set wallet from API
                    totalCandies,
                    ...loaded,
                    currentCandySkin,
                    inventory,
                    equipped,
                    dailyPlayCount: dailyPlay,
                    dailyShopCount: dailyShop,
                    lastGamingDate: today
                });
                setView(AppView.LOBBY);
            }
        } catch (e) { alert("로그인 중 오류가 발생했습니다."); }
    };

    const handleTestMode = () => {
        setPlayer({ ...INITIAL_PLAYER_STATE, mode: 'test', wallet: 9999, totalCandies: 9999, name: "테스트 유저", level: 20 });
        setConfig(prev => ({...prev, dailyLimit: 999, shopLimit: 999}));
        setView(AppView.LOBBY);
    };

    const startGame = () => {
        if (player.mode === 'student') {
            if (player.dailyPlayCount >= config.dailyLimit) {
                return alert("오늘의 게임 횟수를 모두 사용했어요! 내일 다시 만나요.");
            }
            const updated = { ...player, dailyPlayCount: player.dailyPlayCount + 1 };
            setPlayer(updated);
            savePlayerData(updated);
        }
        setGameOverModalOpen(false);
        setRestartConfirmOpen(false);
        setGameId(prev => prev + 1); 
        setView(AppView.GAME);
    };

    const handleGameOver = (score: number, timeSec: number, fell: boolean) => {
        setLastGameResult({ score, time: timeSec, fell });
        const newRecord: GameRecord = {
            date: new Date().toLocaleDateString(),
            score,
            timeSec,
            timeStr: `${Math.floor(timeSec/60).toString().padStart(2,'0')}:${(timeSec%60).toString().padStart(2,'0')}`,
            difficulty: isHardMode ? 'hard' : 'normal'
        };
        const updatedRecords = [newRecord, ...player.records];
        const updatedPlayer = { ...player, records: updatedRecords };
        setPlayer(updatedPlayer);
        savePlayerData(updatedPlayer);
        setGameOverModalOpen(true);
    };

    const handleAddScore = (amount: number) => {
        // Only updates total candies record, NOT wallet (cookies)
        setPlayer(prev => {
            const next = { 
                ...prev, 
                totalCandies: prev.totalCandies + amount
            };
            savePlayerData(next);
            return next;
        });
    };

    const buyUpgrade = () => {
        const cost = player.level * config.priceUpgrade;
        if (player.wallet >= cost && player.level < 20) {
            const updated = { ...player, wallet: player.wallet - cost, level: player.level + 1 };
            setPlayer(updated);
            savePlayerData(updated);
            // SFX
            audioManager.playUpgradeSfx();
            setPurchaseFeedback({ message: "레벨업 성공!", subMessage: `점수 획득량이 Lv.${updated.level}로 증가했어요!`, icon: "fa-arrow-up" });
        } else if (player.wallet < cost) { alert("쿠키가 부족해요!"); }
    };

    const buyGacha = () => {
        if (player.wallet >= config.priceGacha) {
            const missing: {cat: string, item: string}[] = [];
            GAME_ITEMS.hats.forEach(i => { if(!player.inventory.hats.includes(i)) missing.push({cat:'hats', item:i}) });
            GAME_ITEMS.weapons.forEach(i => { if(!player.inventory.weapons.includes(i)) missing.push({cat:'weapons', item:i}) });
            GAME_ITEMS.clothes.forEach(i => { if(!player.inventory.clothes.includes(i)) missing.push({cat:'clothes', item:i}) });
            GAME_ITEMS.shoes.forEach(i => { if(!player.inventory.shoes.includes(i)) missing.push({cat:'shoes', item:i}) });

            if (missing.length === 0) return alert("모든 아이템을 획득했어요!");
            const picked = missing[Math.floor(Math.random() * missing.length)];
            const updatedInventory = { ...player.inventory };
            // @ts-ignore
            updatedInventory[picked.cat] = [...updatedInventory[picked.cat], picked.item];

            const updated = { ...player, wallet: player.wallet - config.priceGacha, inventory: updatedInventory };
            setPlayer(updated);
            savePlayerData(updated);
            // SFX
            audioManager.playGachaSfx();
            setPurchaseFeedback({ message: "아이템 획득!", subMessage: ITEM_NAMES[picked.item], icon: "fa-gift" });
        } else { alert("쿠키가 부족해요!"); }
    };

    const toggleEquip = (category: 'hat' | 'weapon' | 'clothes' | 'shoes', item: string) => {
        audioManager.playClickSfx();
        const current = player.equipped[category];
        const next = current === item ? "" : item;
        const updated = { ...player, equipped: { ...player.equipped, [category]: next } };
        setPlayer(updated);
        savePlayerData(updated);
    };

    const hardModeUnlocked = player.totalCandies >= 1000 || player.mode === 'test';

    const handleExitGame = () => {
        setGameOverModalOpen(false);
        setRestartConfirmOpen(false);
        setView(AppView.LOBBY);
    };

    const requestRestart = () => {
        setRestartConfirmOpen(true);
    };

    return (
        <div className="w-full h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 overflow-hidden relative">
            
            {/* Purchase Feedback */}
            {purchaseFeedback && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setPurchaseFeedback(null)}>
                    <div className="bg-white p-8 rounded-3xl shadow-2xl text-center max-w-sm w-full transform scale-110 transition-transform relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-yellow-400 to-red-500"></div>
                        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-blue-100 flex items-center justify-center animate-bounce"><i className={`fa-solid ${purchaseFeedback.icon} text-5xl text-blue-600`}></i></div>
                        <h2 className="text-3xl font-black text-gray-800 mb-2">{purchaseFeedback.message}</h2>
                        {purchaseFeedback.subMessage && <p className="text-gray-500 font-bold text-lg mb-6">{purchaseFeedback.subMessage}</p>}
                        <Button onClick={(e) => { e.stopPropagation(); setPurchaseFeedback(null); }} variant="primary">확인</Button>
                    </div>
                </div>
            )}
            
            {/* Intro View */}
            {view === AppView.INTRO && (
                <div className="w-full h-full flex flex-col items-center justify-center text-white relative">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                    <div className="z-10 text-center">
                        <h1 className="text-7xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-500 mb-4 drop-shadow-2xl" style={{filter: 'drop-shadow(0 0 20px rgba(255, 193, 7, 0.5))'}}>다했니 런</h1>
                        <p className="text-2xl md:text-3xl font-bold text-white/80 mb-16 tracking-widest">COOKIE RUSH REMASTERED</p>
                        <div className="flex flex-col gap-4 w-80 mx-auto">
                            <Button onClick={handleTeacherLogin} variant="accent" className="text-xl py-4 shadow-orange-500/50">
                                <i className="fa-solid fa-chalkboard-user"></i> 선생님 모드
                            </Button>
                            <Button onClick={handleTestMode} variant="secondary" className="bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/20 text-xl py-4">
                                <i className="fa-solid fa-gamepad"></i> 테스트 모드
                            </Button>
                        </div>
                        <button onClick={() => { audioManager.playClickSfx(); setHelpOpen(true); }} className="mt-8 text-white/60 hover:text-white underline text-sm">선생님을 위한 도움말</button>
                    </div>
                    {/* Help Modal */}
                    {helpOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={() => setHelpOpen(false)}>
                            <div className="bg-white text-gray-800 p-8 rounded-2xl max-w-lg w-full relative" onClick={e => e.stopPropagation()}>
                                <h3 className="text-2xl font-bold mb-4">📢 선생님 도움말</h3>
                                <ul className="list-disc pl-5 space-y-2 text-left text-gray-600">
                                    <li><strong>선생님 모드:</strong> 학생들의 게임 기록을 관리하고 설정을 변경합니다.</li>
                                    <li><strong>매직 링크:</strong> 학생들에게 이 링크를 공유하면 설정된 값으로 바로 접속할 수 있습니다.</li>
                                </ul>
                                <button onClick={() => setHelpOpen(false)} className="mt-6 bg-gray-800 text-white px-6 py-2 rounded-lg font-bold">닫기</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Teacher Config View (Optimized with Dark Theme) */}
            {view === AppView.TEACHER && (
                <Panel title="⚙️ 선생님 설정" className="max-w-4xl h-auto !bg-slate-900/95 !border-slate-700">
                    <div className="text-left space-y-8">
                        <div>
                            <label className="block text-white font-bold mb-3 text-2xl"><i className="fa-solid fa-key mr-2 text-amber-500"></i>다했니 API</label>
                            <input type="text" className="w-full h-14 px-6 text-xl border-2 border-slate-600 bg-slate-800 text-white rounded-2xl focus:border-amber-500 outline-none transition-colors placeholder-slate-400" value={tempApiKey} onChange={(e) => setTempApiKey(e.target.value)} placeholder="다했니 API 센터에서 복사(필수)" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div><label className="block text-xl font-bold text-white mb-3"><i className="fa-solid fa-gamepad mr-2 text-blue-500"></i>일일 게임 횟수</label><input type="number" className="w-full h-14 px-4 text-xl border-2 border-slate-600 bg-slate-800 text-white rounded-2xl" value={config.dailyLimit} onChange={(e) => setConfig({...config, dailyLimit: parseInt(e.target.value)})} /></div>
                            <div><label className="block text-xl font-bold text-white mb-3"><i className="fa-solid fa-cart-shopping mr-2 text-pink-500"></i>일일 상점 이용</label><input type="number" className="w-full h-14 px-4 text-xl border-2 border-slate-600 bg-slate-800 text-white rounded-2xl" value={config.shopLimit} onChange={(e) => setConfig({...config, shopLimit: parseInt(e.target.value)})} /></div>
                            <div><label className="block text-xl font-bold text-white mb-3"><i className="fa-solid fa-arrow-up-right-dots mr-2 text-green-500"></i>업그레이드 비용</label><input type="number" className="w-full h-14 px-4 text-xl border-2 border-slate-600 bg-slate-800 text-white rounded-2xl" value={config.priceUpgrade} onChange={(e) => setConfig({...config, priceUpgrade: parseInt(e.target.value)})} /></div>
                            <div><label className="block text-xl font-bold text-white mb-3"><i className="fa-solid fa-dice mr-2 text-purple-500"></i>뽑기 비용</label><input type="number" className="w-full h-14 px-4 text-xl border-2 border-slate-600 bg-slate-800 text-white rounded-2xl" value={config.priceGacha} onChange={(e) => setConfig({...config, priceGacha: parseInt(e.target.value)})} /></div>
                        </div>
                        <div className="pt-6 border-t border-slate-700 flex flex-col gap-3">
                            <Button onClick={handleGenerateLink} variant="accent" className="text-xl py-4">✨ 설정 저장 및 매직 링크 복사</Button>
                            <Button onClick={() => setView(AppView.INTRO)} variant="secondary" className="text-xl py-4 !bg-slate-700 !text-gray-300 hover:!bg-slate-600">뒤로가기</Button>
                        </div>
                    </div>
                </Panel>
            )}

            {/* Login, Lobby, Game View placeholders remain same logic but wrapped in Panel/Canvas */}
            {view === AppView.LOGIN && (
                <Panel title="🚀 학생 로그인">
                    <input id="studentCode" type="text" placeholder="학생 코드를 입력하세요" className="w-full p-6 border-2 border-gray-200 rounded-2xl text-2xl mb-8 text-center font-bold" />
                    <Button onClick={handleStudentLogin} variant="primary" className="text-2xl py-5">로그인</Button>
                    <Button onClick={() => window.location.search = ""} variant="secondary">뒤로가기</Button>
                </Panel>
            )}

            {view === AppView.LOBBY && (
                <Panel>
                    <h2 className="text-3xl font-bold text-gray-800 mb-6">안녕, {player.name}!</h2>
                    <div className="flex gap-4 mb-8">
                        <div className="flex-1 bg-orange-100 p-6 rounded-3xl shadow-inner">
                            <div className="text-orange-800 font-bold flex items-center justify-center gap-3 text-xl mb-2"><i className="fa-solid fa-wallet"></i> 내 지갑</div>
                            <div className="text-4xl font-black text-orange-600">{player.wallet} <span className="text-lg">쿠키</span></div>
                        </div>
                        <div className="flex-1 bg-purple-100 p-6 rounded-3xl shadow-inner">
                             <div className="text-purple-800 font-bold flex items-center justify-center gap-3 text-xl mb-2"><i className="fa-solid fa-candy-cane"></i> 누적 획득</div>
                            <div className="text-4xl font-black text-purple-600">{player.totalCandies} <span className="text-lg">개</span></div>
                        </div>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-2xl mb-6 text-blue-800 text-lg">오늘의 도전: <strong>{Math.max(0, config.dailyLimit - player.dailyPlayCount)}</strong> 회 남음</div>
                    <div className="mb-6 flex justify-center">
                        <button onClick={() => { audioManager.playClickSfx(); if(hardModeUnlocked) setIsHardMode(!isHardMode); }} className={`px-8 py-3 rounded-2xl font-black text-xl flex items-center gap-3 transition-all ${!hardModeUnlocked ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : isHardMode ? 'bg-red-500 text-white shadow-red-300 shadow-lg scale-105' : 'bg-white border-2 border-red-500 text-red-500 hover:bg-red-50'}`}>
                            {isHardMode ? <i className="fa-solid fa-fire animate-pulse"></i> : <i className="fa-solid fa-lock-open"></i>}
                            {isHardMode ? "하드 모드 ON" : "하드 모드 OFF"}
                            {!hardModeUnlocked && <span className="text-xs font-normal ml-2">(누적 1000개 필요)</span>}
                        </button>
                    </div>
                    <Button onClick={startGame} variant="accent" className={`py-8 text-3xl mb-6 ${isHardMode ? 'bg-gradient-to-br from-red-600 to-red-800 ring-4 ring-red-300' : ''}`}>{isHardMode ? "🔥 하드모드 시작" : "▶ 게임 시작"}</Button>
                    <div className="grid grid-cols-2 gap-4">
                        <Button onClick={() => setView(AppView.SHOP)} variant="secondary" className="text-xl"><i className="fa-solid fa-shop"></i> 상점</Button>
                        <Button onClick={() => setView(AppView.WARDROBE)} variant="secondary" className="text-xl bg-purple-500 text-white"><i className="fa-solid fa-shirt"></i> 옷장</Button>
                    </div>
                    <Button onClick={() => setView(AppView.RECORDS)} variant="secondary" className="mt-4 text-xl"><i className="fa-solid fa-trophy"></i> 명예의 전당</Button>
                    <Button onClick={() => setView(AppView.INTRO)} variant="danger" className="mt-6 text-lg">나가기</Button>
                </Panel>
            )}

            {/* Shop View */}
            {view === AppView.SHOP && (
                <Panel title="🛒 아이템 상점" className="max-w-4xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div className="bg-white p-6 rounded-3xl shadow-lg border-2 border-gray-100 flex flex-col items-center hover:-translate-y-1 transition-transform">
                            <div className="w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center mb-4 text-5xl">⚡</div>
                            <h3 className="text-2xl font-black text-gray-800 mb-1">점수 부스터</h3>
                            <p className="text-gray-500 font-bold mb-4">현재 Lv.{player.level} (+{player.level}점)</p>
                            <div className="mt-auto w-full">
                                <Button onClick={buyUpgrade} variant="primary" className="mb-0">
                                    강화 {player.level * config.priceUpgrade}🍪
                                </Button>
                            </div>
                            <div className="mt-4 opacity-50"><CandyIcon idx={0} size={25} /></div>
                        </div>
                        <div className="bg-white p-6 rounded-3xl shadow-lg border-2 border-gray-100 flex flex-col items-center hover:-translate-y-1 transition-transform">
                             <div className="w-24 h-24 bg-purple-100 rounded-full flex items-center justify-center mb-4 text-5xl">🎁</div>
                            <h3 className="text-2xl font-black text-gray-800 mb-1">랜덤 뽑기</h3>
                            <p className="text-gray-500 font-bold mb-4">모자, 무기, 옷, 신발 중 1종</p>
                            <div className="mt-auto w-full">
                                <Button onClick={buyGacha} variant="accent" className="mb-0">
                                    뽑기 {config.priceGacha}🍪
                                </Button>
                            </div>
                            <div className="mt-4 text-4xl">⚔️🧢👗👟</div>
                        </div>
                    </div>
                    <Button onClick={() => setView(AppView.LOBBY)} variant="secondary">로비로 돌아가기</Button>
                </Panel>
            )}

            {/* Wardrobe View - Optimized Layout */}
            {view === AppView.WARDROBE && (
                <Panel title="👔 내 옷장" className="max-w-6xl w-full h-[85vh] flex flex-col">
                    <div className="flex flex-col md:flex-row gap-6 h-full overflow-hidden">
                        {/* Left: Preview (30%) - Adjusted height and cleaner look */}
                        <div className="w-full md:w-[30%] shrink-0 flex flex-col items-center justify-center h-[30vh] md:h-auto">
                            <div className="w-full h-full flex items-center justify-center">
                                <CharacterPreview player={player} />
                            </div>
                            <div className="text-gray-400 text-xs mt-2 font-bold">* 미리보기 화면입니다</div>
                        </div>

                        {/* Right: Controls (70%) - Scrollable Content + Fixed Button */}
                        <div className="w-full md:w-[70%] flex flex-col h-full overflow-hidden relative">
                            {/* Scrollable Area */}
                            <div className="flex-1 overflow-y-auto pr-2 space-y-4 pb-20 no-scrollbar">
                                {/* Top Row: Skin Picker + Tabs */}
                                <div className="flex gap-4 h-20 shrink-0">
                                    <div className="w-[20%] bg-gray-50 rounded-2xl flex flex-col items-center justify-center border-2 border-gray-100 p-1 gap-1">
                                        <span className="text-xs font-bold text-gray-500">피부색</span>
                                        <label className="w-8 h-8 md:w-10 md:h-10 rounded-full cursor-pointer border-4 border-white shadow-md overflow-hidden relative group">
                                            <input type="color" value={player.currentSkin} onChange={(e) => { const updated = { ...player, currentSkin: e.target.value }; setPlayer(updated); savePlayerData(updated); }} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                                            <div className="w-full h-full absolute top-0 left-0 pointer-events-none flex items-center justify-center" style={{backgroundColor: player.currentSkin}}>
                                                <i className={`fa-solid fa-eye-dropper text-xs ${parseInt(player.currentSkin.slice(1), 16) > 0xffffff/2 ? 'text-black' : 'text-white'}`}></i>
                                            </div>
                                        </label>
                                    </div>
                                    <div className="w-[80%] flex gap-2">
                                        {['hat','weapon','clothes','shoes'].map(t => (
                                            <button key={t} onClick={() => { audioManager.playClickSfx(); setWardrobeTab(t as any); }} className={`flex-1 rounded-2xl font-bold transition-all text-sm ${wardrobeTab === t ? 'bg-amber-100 text-amber-800 border-2 border-amber-200' : 'bg-gray-50 text-gray-400 border-2 border-transparent'}`}>
                                                {{hat:'모자',weapon:'무기',clothes:'옷',shoes:'신발'}[t]}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Item Grid */}
                                <div className="bg-gray-50 p-4 rounded-2xl min-h-[150px] flex flex-wrap content-start gap-2 border-2 border-gray-100">
                                    {/* @ts-ignore */}
                                    {player.inventory[wardrobeTab + (wardrobeTab === 'hat' || wardrobeTab === 'weapon' ? 's' : (wardrobeTab === 'clothes' ? '' : ''))].length === 0 && (
                                        <div className="w-full text-center text-gray-400 py-10">아이템이 없어요 😢<br/>상점에서 뽑아보세요!</div>
                                    )}
                                    {/* @ts-ignore */}
                                    {player.inventory[wardrobeTab === 'clothes' ? 'clothes' : (wardrobeTab === 'shoes' ? 'shoes' : wardrobeTab + 's')].map((item: string) => (
                                        <div key={item} onClick={() => toggleEquip(wardrobeTab, item)} className={`px-3 py-2 rounded-lg cursor-pointer border font-bold text-sm flex items-center gap-2 transition-all ${player.equipped[wardrobeTab] === item ? 'bg-amber-500 text-white border-amber-600 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'}`}>
                                            {player.equipped[wardrobeTab] === item && <i className="fa-solid fa-check"></i>}
                                            {ITEM_NAMES[item] || item}
                                        </div>
                                    ))}
                                </div>

                                {/* Candy Skins */}
                                <div className="bg-pink-50 p-4 rounded-2xl border-2 border-pink-100">
                                    <h3 className="text-left font-bold text-pink-800 mb-2 text-sm"><i className="fa-solid fa-candy-cane mr-2"></i>캔디 스킨 (Lv.{player.level})</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {Array.from({length: 20}).map((_, idx) => {
                                            const isUnlocked = idx <= player.level;
                                            return (
                                                <div key={idx} onClick={() => { if(isUnlocked) { audioManager.playClickSfx(); const updated = { ...player, currentCandySkin: idx }; setPlayer(updated); savePlayerData(updated); } }} className={`w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center relative cursor-pointer transition-all ${player.currentCandySkin === idx ? 'ring-2 ring-pink-500 bg-white shadow-md z-10 scale-110' : (isUnlocked ? 'bg-white/60 hover:bg-white' : 'bg-gray-200 opacity-50 cursor-not-allowed')}`}>
                                                    {!isUnlocked && <i className="fa-solid fa-lock text-[10px] text-gray-400 absolute z-20"></i>}
                                                    <div className={!isUnlocked ? 'blur-[1px] opacity-40' : ''}>
                                                       <CandyIcon idx={idx} size={16} />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                            
                            {/* Fixed Bottom Button */}
                            <div className="absolute bottom-0 w-full bg-white/80 backdrop-blur-sm pt-2">
                                <Button onClick={() => setView(AppView.LOBBY)} variant="primary" className="mb-0">✨ 옷 갈아입기 완료</Button>
                            </div>
                        </div>
                    </div>
                </Panel>
            )}
            
            {/* Game Canvas, Game Over, Records View ... */}
            {view === AppView.GAME && <GameCanvas key={gameId} playerState={player} config={config} onGameOver={handleGameOver} onAddScore={handleAddScore} isPaused={isGameOverModalOpen || isRestartConfirmOpen} isHardMode={isHardMode} />}
            {isGameOverModalOpen && lastGameResult && !isRestartConfirmOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-transparent backdrop-blur-none animate-fade-in pointer-events-auto">
                     <div className="bg-white/95 backdrop-blur-xl p-8 rounded-3xl shadow-2xl text-center max-w-sm w-full border-4 border-white transform scale-100 transition-transform mt-20">
                        <div className="text-4xl mb-2">{lastGameResult.fell ? "😵" : "💥"}</div>
                        <h1 className="text-4xl font-black text-gray-800 mb-2 drop-shadow-sm">{lastGameResult.fell ? "떨어졌어요!" : "부딪혔어요!"}</h1>
                        <div className="bg-amber-50 border-2 border-amber-100 rounded-2xl p-6 mb-6 mt-4">
                            <div className="text-lg text-gray-600 font-bold">이번 판 점수</div>
                            <div className="text-5xl font-black text-amber-600 mb-2 tracking-tighter">{lastGameResult.score}</div>
                            <div className="text-sm text-blue-500 font-bold bg-blue-100 inline-block px-3 py-1 rounded-full"><i className="fa-regular fa-clock mr-1"></i>{Math.floor(lastGameResult.time / 60).toString().padStart(2,'0')}:{(lastGameResult.time % 60).toString().padStart(2,'0')}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-3"><Button onClick={handleExitGame} variant="secondary">로비</Button><Button onClick={requestRestart} variant="accent">다시하기</Button></div>
                     </div>
                </div>
            )}
             {isRestartConfirmOpen && (
                 <div className="fixed inset-0 z-[60] flex items-center justify-center bg-transparent backdrop-blur-none animate-fade-in pointer-events-auto">
                     <div className="bg-white p-6 rounded-2xl shadow-2xl text-center max-w-xs w-full border-4 border-gray-300">
                         <div className="text-4xl mb-4">🤔</div><h2 className="text-xl font-bold mb-2">다시 도전하시겠어요?</h2>
                         <div className="flex gap-2"><Button onClick={() => setRestartConfirmOpen(false)} variant="secondary" className="py-2 text-base">취소</Button><Button onClick={startGame} variant="primary" className="py-2 text-base">도전!</Button></div>
                     </div>
                 </div>
            )}
             {view === AppView.RECORDS && (
                <Panel title="🏆 명예의 전당">
                    <div className="flex gap-2 mb-4 bg-gray-200 p-2 rounded-xl">
                        <button onClick={() => { audioManager.playClickSfx(); setRecordTab('score'); }} className={`flex-1 py-3 rounded-lg font-bold text-lg transition-all ${recordTab === 'score' ? 'bg-white shadow text-amber-600' : 'text-gray-500'}`}>점수순</button>
                        <button onClick={() => { audioManager.playClickSfx(); setRecordTab('time'); }} className={`flex-1 py-3 rounded-lg font-bold text-lg transition-all ${recordTab === 'time' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>생존시간순</button>
                    </div>
                     <div className="flex gap-2 mb-6">
                        <button onClick={() => { audioManager.playClickSfx(); setRecordDifficultyTab('normal'); }} className={`flex-1 py-2 rounded-lg font-bold transition-all border-2 ${recordDifficultyTab === 'normal' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-transparent text-gray-400 border-transparent'}`}>기본 모드</button>
                        <button onClick={() => { audioManager.playClickSfx(); setRecordDifficultyTab('hard'); }} className={`flex-1 py-2 rounded-lg font-bold transition-all border-2 ${recordDifficultyTab === 'hard' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-transparent text-gray-400 border-transparent'}`}>하드 모드</button>
                    </div>
                     <div className="bg-gray-50 rounded-2xl p-6 min-h-[350px] mb-8 overflow-y-auto max-h-[45vh]">
                        {player.records.filter(r => (r.difficulty || 'normal') === recordDifficultyTab).length === 0 ? 
                            <div className="text-gray-400 py-10 text-xl">아직 기록이 없습니다.</div> : 
                            player.records
                                .filter(r => (r.difficulty || 'normal') === recordDifficultyTab)
                                .sort((a,b) => recordTab === 'score' ? b.score - a.score : b.timeSec - a.timeSec)
                                .slice(0, 20).map((rec, idx) => (
                                <div key={idx} className="flex justify-between items-center py-4 border-b last:border-0 border-dashed border-gray-300">
                                    <div className="flex items-center gap-4"><div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${idx < 3 ? 'bg-amber-400' : 'bg-gray-300'}`}>{idx+1}</div><div className="text-gray-600">{rec.date}</div></div>
                                    <div className="text-right">{recordTab === 'score' ? <><div className="font-bold text-gray-800 text-xl">{rec.score}점</div><div className="text-sm text-blue-500">{rec.timeStr}</div></> : <><div className="font-bold text-gray-800 text-xl">{rec.timeStr}</div><div className="text-sm text-blue-500">{rec.score}점</div></>}</div>
                                </div>
                            ))
                        }
                    </div>
                    <Button onClick={() => setView(AppView.LOBBY)} variant="secondary">로비로 돌아가기</Button>
                </Panel>
            )}
        </div>
    );
};

// Helper for UI Candy Icons
const CandyIcon: React.FC<{idx: number, size: number}> = ({idx, size}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const ctx = canvasRef.current?.getContext('2d');
        if(ctx) {
            ctx.clearRect(0,0,size*2, size*2); 
            drawCandySimple(ctx, size, size, size/2, idx);
        }
    }, [idx, size]);
    return <canvas ref={canvasRef} width={size*2} height={size*2} style={{width: size*2, height: size*2}} />;
}

export default App;