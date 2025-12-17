import React, { useState, useEffect, useRef } from 'react';
import GameCanvas from './components/GameCanvas';
import { AppView, PlayerState, GameConfig, GameRecord, TransactionLog, PlayerStats } from './types';
import { INITIAL_PLAYER_STATE, INITIAL_CONFIG, GAME_ITEMS, ITEM_NAMES, ACHIEVEMENTS } from './constants';
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
const CharacterPreview: React.FC<{ player: PlayerState, scale?: number }> = ({ player, scale = 2 }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx || !canvasRef.current) return;
        let frame = 0;
        let animationId: number;
        const render = () => {
            // Updated Canvas Resolution for cleaner look
            const W = 500;
            const H = 600;
            ctx.clearRect(0, 0, W, H);
            frame++;
            const animTick = frame * 16; 
            
            // Transform for BIGGER character
            ctx.save();
            ctx.scale(scale, scale); 
            
            // Calculate center in scaled coordinates
            // If canvas width is 500, and scale is 3.5, visible width in scaled units is 500/3.5
            // Center X is (500/2)/3.5
            const cx = (W / 2) / scale;
            const cy = (H / 2) / scale;

            // Draw character centered (slightly adjusted Y for balance)
            drawCharacter(ctx, cx, cy + 20, player.currentSkin, player.equipped, animTick, false, 'happy', 0, true);
            
            const candyY = (cy - 10) + Math.sin(frame * 0.05) * 5;
            // Draw candy relative to the center calculated above
            drawCandySimple(ctx, cx + 45, candyY, 15, player.currentCandySkin);
            ctx.restore();
            
            animationId = requestAnimationFrame(render);
        };
        render();
        return () => cancelAnimationFrame(animationId);
    }, [player.currentSkin, player.equipped, player.currentCandySkin, scale]);

    return (
        <div className="w-full h-full flex items-center justify-center">
             <canvas ref={canvasRef} width={500} height={600} className="w-full h-full object-contain drop-shadow-2xl" />
        </div>
    );
};

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'accent' | 'danger' }> = ({ children, variant = 'primary', className = "", onClick, ...props }) => {
    const base = "w-full py-3 px-6 rounded-xl font-bold text-lg shadow-md transform transition active:scale-95 hover:-translate-y-0.5 flex items-center justify-center gap-2 mb-3 disabled:opacity-50 disabled:cursor-not-allowed";
    const variants = {
        primary: "bg-gradient-to-br from-amber-700 to-amber-900 text-white",
        secondary: "bg-gradient-to-br from-gray-400 to-gray-600 text-white",
        accent: "bg-gradient-to-br from-orange-400 to-orange-600 text-white",
        danger: "bg-gradient-to-br from-red-500 to-red-700 text-white"
    };
    
    // Wrapper for click sound
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (props.disabled) return;
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
    
    // New state to track if entered via Magic Link
    const [isMagicLink, setIsMagicLink] = useState(false);
    
    // 1-second delay for Intro buttons to prevent magic link flickering misclicks
    const [isIntroReady, setIsIntroReady] = useState(false);

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
    const [showWalletLog, setShowWalletLog] = useState(false);
    
    // New States for Features
    const [showTutorial, setShowTutorial] = useState(false);
    const [showExchange, setShowExchange] = useState(false);
    const [exchangeAmount, setExchangeAmount] = useState(1);
    const [showShopInfo, setShowShopInfo] = useState(false);
    const [showGameModeSelect, setShowGameModeSelect] = useState(false);
    const [showTitleSelect, setShowTitleSelect] = useState(false);

    // Teacher Reset State
    const [isResetChecked, setIsResetChecked] = useState(false);

    // Initialization
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const data = params.get('data');
        if (data) {
            const loadedConfig = decryptConfig(data);
            if (loadedConfig) {
                setConfig(prev => ({ ...prev, ...loadedConfig }));
                setTempApiKey(loadedConfig.api || "");
                setIsMagicLink(true); // Mark as magic link user
                setView(AppView.INTRO); // Go to Intro first, not Login
            } else {
                alert("잘못된 링크입니다.");
                window.location.search = "";
            }
        }
        
        // Enable buttons after 1 second
        const timer = setTimeout(() => setIsIntroReady(true), 1000);
        return () => clearTimeout(timer);
    }, []);

    // Shop Intro Modal Trigger
    useEffect(() => {
        if (view === AppView.SHOP) {
            setShowShopInfo(true);
        }
    }, [view]);

    // Achievement Checker Logic
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
            // Auto-equip if it's the first title
            const activeTitle = currentPlayer.activeTitle ? currentPlayer.activeTitle : newUnlocked[0];
            
            const updatedPlayer = {
                ...currentPlayer,
                unlockedTitles: updatedUnlocked,
                activeTitle: activeTitle
            };
            setPlayer(updatedPlayer);
            savePlayerData(updatedPlayer);
            
            const earnedTitles = newUnlocked.map(id => ACHIEVEMENTS.find(a => a.id === id)?.name).join(', ');
            setPurchaseFeedback({ 
                message: "🎉 칭호 획득!", 
                subMessage: `${earnedTitles} 칭호를 획득했습니다!`, 
                icon: "fa-crown" 
            });
            audioManager.playUpgradeSfx();
        }
    };

    // --- Actions ---

    const handleTeacherLogin = () => {
        setView(AppView.TEACHER);
    };

    const handleStudentStart = () => {
        setView(AppView.LOGIN);
    };

    const handleGenerateLink = () => {
        if (!tempApiKey.trim()) {
            return alert("⚠️ API 키를 입력해주세요!\n(설정이 저장되지 않았습니다)");
        }

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

    const handleHardReset = () => {
        if (!isResetChecked) return alert("데이터 초기화에 동의해주세요.");

        if (window.confirm("❗ 경고: 모든 학생의 데이터가 초기화됩니다.\n\n[초기화 항목]\n- 레벨, 캔디, 칭호\n- 보유 아이템, 착용 장비\n- 게임 기록, 통계\n\n[유지 항목]\n- 보유 쿠키(지갑)\n\n계속하시겠습니까?")) {
            const newConfig = { ...config, hardResetTimestamp: Date.now() };
            setConfig(newConfig);
            alert("초기화 설정이 완료되었습니다. '설정 저장 및 매직 링크 복사'를 눌러 학생들에게 공유해주세요.");
        }
    }

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
                
                // --- Reset Logic Handling ---
                const serverHardResetTime = config.hardResetTimestamp || 0;
                const playerLastResetTime = loaded?.lastGlobalReset || 0;

                let playerStateToUse: Partial<PlayerState> = loaded || {};

                // 1. HARD RESET Check (Teacher forced full wipe except wallet)
                // Fix: Ensure we compare timestamps correctly so we don't reset repeatedly
                if (serverHardResetTime > 0 && serverHardResetTime > playerLastResetTime) {
                    alert("📢 선생님 요청으로 데이터가 초기화되었습니다. (쿠키 제외)");
                    // Wipe everything except wallet-related info
                    playerStateToUse = {
                        ...INITIAL_PLAYER_STATE,
                        wallet: loaded?.wallet ?? 0, // Keep loaded wallet if exists
                        logs: loaded?.logs ?? [], // Keep logs
                        lastGlobalReset: serverHardResetTime // Update timestamp locally
                    };
                } 
                
                // 2. DAILY RESET Check (Local logic or Server Daily Reset)
                if (playerStateToUse.lastGamingDate !== today) {
                    playerStateToUse.dailyPlayCount = 0;
                    playerStateToUse.dailyShopCount = 0;
                    playerStateToUse.lastGamingDate = today;
                }

                // Construct new player state
                const initialWallet = config.api ? fetchedWallet : (playerStateToUse.wallet ?? 100);

                const newPlayerState: PlayerState = {
                    ...INITIAL_PLAYER_STATE,
                    ...playerStateToUse, // Apply loaded/reset state
                    mode: 'student',
                    code: codeInput,
                    name: fetchedName,
                    wallet: initialWallet, // API wallet priority
                    // Ensure stats structure matches
                    stats: { ...INITIAL_PLAYER_STATE.stats, ...(playerStateToUse.stats || {}) },
                    unlockedTitles: playerStateToUse.unlockedTitles || [],
                    activeTitle: playerStateToUse.activeTitle || null,
                    lastGlobalReset: playerStateToUse.lastGlobalReset || 0 // Persist logic
                };

                setPlayer(newPlayerState);
                
                // CRITICAL: Save immediately
                savePlayerData(newPlayerState);
                
                // Instead of going directly to Lobby, show Tutorial
                setShowTutorial(true);
            }
        } catch (e) { alert("로그인 중 오류가 발생했습니다."); }
    };

    const handleTestMode = () => {
        // Set level to 1 for test mode as requested
        setPlayer({ ...INITIAL_PLAYER_STATE, mode: 'test', wallet: 9999, totalCandies: 9999, name: "테스트 유저", level: 1 });
        setConfig(prev => ({...prev, dailyLimit: 999, shopLimit: 999}));
        setView(AppView.LOBBY);
    };

    const handleTutorialComplete = () => {
        setShowTutorial(false);
        setView(AppView.LOBBY);
    }

    const handleEnterShop = () => {
        // Shop Limit Logic: Check counts on ENTRY
        if (player.mode === 'student' && player.dailyShopCount >= config.shopLimit) {
            return alert("오늘의 상점 이용 횟수를 모두 사용했어요!");
        }
        
        // Increment count on ENTRY
        const updatedStats = { 
            ...player.stats, 
            totalShopVisits: (player.stats.totalShopVisits || 0) + 1 
        };
        const updated = { 
            ...player, 
            dailyShopCount: player.mode === 'student' ? player.dailyShopCount + 1 : player.dailyShopCount,
            stats: updatedStats
        };
        setPlayer(updated);
        savePlayerData(updated);
        checkAchievements(updated); // Check 'Shopper' achievement
        
        setView(AppView.SHOP);
    };

    const openGameModeSelect = () => {
        setShowGameModeSelect(true);
    };

    const startNormalGame = () => {
        if (player.mode === 'student') {
            if (player.dailyPlayCount >= config.dailyLimit) {
                return alert("오늘의 게임 횟수를 모두 사용했어요! 내일 다시 만나요.");
            }
            const updated = { ...player, dailyPlayCount: player.dailyPlayCount + 1 };
            setPlayer(updated);
            savePlayerData(updated);
        }
        setIsHardMode(false);
        launchGame();
    };

    const startHardGame = () => {
        if (player.totalCandies < config.hardModeEntryCost) {
            return alert(`캔디가 부족해요! (입장료: ${config.hardModeEntryCost}개)`);
        }
        // Deduct Candies & track hard mode count
        const updatedStats = { ...player.stats, totalHardModeCount: (player.stats.totalHardModeCount || 0) + 1 };
        const updated = { 
            ...player, 
            totalCandies: player.totalCandies - config.hardModeEntryCost,
            stats: updatedStats
        };
        setPlayer(updated);
        savePlayerData(updated);
        checkAchievements(updated); // Check 'Moth' achievement
        
        setIsHardMode(true);
        launchGame();
    };

    const launchGame = () => {
        setGameOverModalOpen(false);
        setRestartConfirmOpen(false);
        setShowGameModeSelect(false);
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
        
        // Update Cumulative Stats
        const newStats: PlayerStats = {
            ...player.stats,
            totalPlayCount: player.stats.totalPlayCount + 1,
            totalPlayTimeSec: player.stats.totalPlayTimeSec + timeSec,
            totalFalls: player.stats.totalFalls + (fell ? 1 : 0),
            maxTimeSec: Math.max(player.stats.maxTimeSec, timeSec)
        };

        const updatedRecords = [newRecord, ...player.records];
        const updatedPlayer = { 
            ...player, 
            records: updatedRecords,
            stats: newStats
        };
        setPlayer(updatedPlayer);
        savePlayerData(updatedPlayer);
        
        checkAchievements(updatedPlayer); // Check All Stats-based Achievements (ONLY PLACE for gameplay stats)

        setGameOverModalOpen(true);
    };

    const handleAddScore = (amount: number) => {
        setPlayer(prev => {
            const newStats = { 
                ...prev.stats, 
                totalCandiesCollected: prev.stats.totalCandiesCollected + amount 
            };
            const next = { 
                ...prev, 
                totalCandies: prev.totalCandies + amount,
                stats: newStats
            };
            savePlayerData(next); 
            return next;
        });
    };

    const handleExchange = () => {
        const cost = exchangeAmount * config.exchangeRate;
        if (player.totalCandies >= cost) {
            const newLog: TransactionLog = {
                id: Date.now().toString(),
                date: new Date().toLocaleString(),
                desc: `환전 (쿠키 ${exchangeAmount}개 구매)`,
                amount: exchangeAmount
            };
            
            const updated = {
                ...player,
                totalCandies: player.totalCandies - cost,
                wallet: player.wallet + exchangeAmount,
                logs: [newLog, ...(player.logs || [])]
            };
            setPlayer(updated);
            savePlayerData(updated);
            audioManager.playClickSfx();
            checkAchievements(updated); // Check 'Rich' achievement
            alert("환전이 완료되었습니다!");
            setShowExchange(false);
            setExchangeAmount(1);
        } else {
            alert("보유한 캔디가 부족합니다.");
        }
    };

    const buyUpgrade = () => {
        // Removed Daily Shop Count Check (Now checked on Entry)

        const cost = player.level * config.priceUpgrade;
        if (player.wallet >= cost && player.level < 20) {
            // Log Transaction
            const newLog: TransactionLog = {
                id: Date.now().toString(),
                date: new Date().toLocaleString(),
                desc: `레벨 업 (Lv.${player.level} -> Lv.${player.level + 1})`,
                amount: -cost
            };

            const updated = { 
                ...player, 
                wallet: player.wallet - cost, 
                level: player.level + 1,
                logs: [newLog, ...(player.logs || [])]
            };
            setPlayer(updated);
            savePlayerData(updated);
            // SFX
            audioManager.playUpgradeSfx();
            checkAchievements(updated); // Check 'Expert'
            setPurchaseFeedback({ message: "레벨업 성공!", subMessage: `점수 획득량이 Lv.${updated.level}로 증가했어요!`, icon: "fa-arrow-up" });
        } else if (player.wallet < cost) { alert("쿠키가 부족해요!"); }
    };

    const buyGacha = () => {
        // Removed Daily Shop Count Check (Now checked on Entry)

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

             // Log Transaction
             const newLog: TransactionLog = {
                id: Date.now().toString(),
                date: new Date().toLocaleString(),
                desc: `아이템 뽑기 (${ITEM_NAMES[picked.item]})`,
                amount: -config.priceGacha
            };

            const updated = { 
                ...player, 
                wallet: player.wallet - config.priceGacha, 
                inventory: updatedInventory,
                logs: [newLog, ...(player.logs || [])]
            };
            setPlayer(updated);
            savePlayerData(updated);
            // SFX
            audioManager.playGachaSfx();
            checkAchievements(updated); // Check 'Fashionista'
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

    const handleExitGame = () => {
        setGameOverModalOpen(false);
        setRestartConfirmOpen(false);
        setView(AppView.LOBBY);
    };

    const requestRestart = () => {
        setRestartConfirmOpen(true);
    };

    const startGame = () => {
        if (isHardMode) {
            startHardGame();
        } else {
            startNormalGame();
        }
    };

    const getActiveTitleName = () => {
        if (!player.activeTitle) return "";
        const t = ACHIEVEMENTS.find(a => a.id === player.activeTitle);
        return t ? `[${t.name}] ` : "";
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
            
            {/* Intro View - REDESIGNED 7:3 Split */}
            {view === AppView.INTRO && (
                <div className="w-full h-full flex flex-col md:flex-row relative overflow-hidden bg-[#1a1a2e]">
                    {/* Dynamic Background Elements (Shared) */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-600/30 rounded-full blur-[100px] animate-pulse"></div>
                        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-amber-600/30 rounded-full blur-[100px] animate-pulse" style={{animationDelay: '1s'}}></div>
                         {/* Floating Icons */}
                        <div className="absolute top-[20%] left-[10%] text-4xl opacity-20 animate-bounce" style={{animationDuration: '3s'}}>🍪</div>
                        <div className="absolute top-[15%] right-[20%] text-5xl opacity-20 animate-bounce" style={{animationDuration: '4s'}}>🍬</div>
                        <div className="absolute bottom-[30%] left-[20%] text-3xl opacity-20 animate-bounce" style={{animationDuration: '5s'}}>🏃</div>
                    </div>

                    {/* Left: 70% Character Showcase */}
                    <div className="w-full md:w-[70%] h-[50%] md:h-full flex items-center justify-center relative z-10 p-4">
                         {/* Big Halo */}
                        <div className="absolute w-[80%] h-[80%] bg-gradient-to-t from-amber-500/10 to-transparent rounded-full blur-3xl animate-pulse"></div>
                        <div className="w-full h-full flex items-center justify-center relative animate-fade-in-up">
                            <CharacterPreview 
                                player={{...INITIAL_PLAYER_STATE, currentSkin: "#8d6e63", equipped: { ...INITIAL_PLAYER_STATE.equipped, hat: 'crown', weapon: 'wand', clothes: 'tuxedo', shoes: 'boots' } }} 
                                scale={3.5}
                            />
                        </div>
                    </div>

                    {/* Right: 30% Menu Actions */}
                    <div className="w-full md:w-[30%] h-[50%] md:h-full bg-black/30 backdrop-blur-xl border-l border-white/10 flex flex-col items-center justify-center p-8 z-20 shadow-2xl relative">
                        {/* Title Group */}
                        <div className="mb-12 text-center group">
                            <h1 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-amber-300 via-orange-400 to-red-500 drop-shadow-2xl tracking-tighter mb-2" style={{ textShadow: '0 4px 20px rgba(255, 160, 0, 0.5)' }}>
                                다했니 런
                            </h1>
                            <div className="inline-block px-4 py-1 rounded-full bg-white/10 border border-white/20 mt-2 backdrop-blur-sm">
                                <span className="text-sm md:text-base font-bold text-white tracking-[0.3em] drop-shadow-md">REMASTERED</span>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className={`flex flex-col gap-4 w-full max-w-xs transition-opacity duration-500 ${isIntroReady ? 'opacity-100' : 'opacity-50'}`}>
                             <button disabled={!isIntroReady} onClick={handleStudentStart} className="group relative w-full py-5 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold text-xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all overflow-hidden disabled:cursor-not-allowed">
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                                <div className="relative flex items-center justify-center gap-3">
                                    <span className="bg-white/20 p-2 rounded-lg"><i className="fa-solid fa-user-graduate"></i></span>
                                    <span>학생 시작하기</span>
                                </div>
                            </button>
                            
                            {!isMagicLink && (
                                <>
                                    <button disabled={!isIntroReady} onClick={handleTeacherLogin} className="group relative w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold text-lg hover:shadow-xl hover:-translate-y-0.5 transition-all border border-white/10 disabled:cursor-not-allowed">
                                        <div className="relative flex items-center justify-center gap-2">
                                            <i className="fa-solid fa-chalkboard-user"></i>
                                            <span>선생님 시작하기</span>
                                        </div>
                                    </button>
                                    
                                    <button disabled={!isIntroReady} onClick={handleTestMode} className="w-full py-4 rounded-2xl bg-white/5 border-2 border-white/10 text-gray-400 font-bold text-lg hover:bg-white/10 hover:text-white hover:border-white/30 transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed">
                                        <i className="fa-solid fa-gamepad"></i> 테스트 모드로 체험하기
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Footer Info */}
                        <div className="mt-auto pt-8 text-center w-full">
                            <button onClick={() => { audioManager.playClickSfx(); setHelpOpen(true); }} className="text-white/40 hover:text-white/80 text-sm font-medium transition-colors border-b border-transparent hover:border-white/40 pb-0.5">
                                도움이 필요하신가요?
                            </button>
                            
                            <a href="https://blog.naver.com/ppang_sem" target="_blank" rel="noopener noreferrer" className="block mt-2 text-white/20 hover:text-white/50 text-xs transition-colors" onClick={() => audioManager.playClickSfx()}>
                                made by ppangsem
                            </a>

                            <div className="mt-4 flex justify-center gap-4 text-white/20 text-xl">
                                <i className="fa-brands fa-react"></i>
                                <i className="fa-brands fa-js"></i>
                                <i className="fa-solid fa-gamepad"></i>
                            </div>
                            <p className="text-white/10 text-[10px] mt-2 font-mono">v2.5.0 • COOKIE RUSH</p>
                        </div>
                    </div>
                    
                    {/* Help Modal */}
                    {helpOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in" onClick={() => setHelpOpen(false)}>
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

             {/* Tutorial Modal (Shown after Login) */}
             {showTutorial && (
                 <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in" onClick={() => {}}>
                     <div className="bg-white text-gray-800 p-8 rounded-3xl max-w-2xl w-full relative max-h-[90vh] overflow-y-auto">
                         <div className="text-center mb-6">
                             <h2 className="text-3xl font-black mb-2 text-amber-600">🎉 환영합니다!</h2>
                             <p className="text-gray-500 font-bold">대기실(로비) 사용 설명서</p>
                         </div>
                         <div className="space-y-6 text-left">
                             <div className="flex gap-4 items-start bg-orange-50 p-4 rounded-xl">
                                 <div className="bg-orange-100 p-3 rounded-full text-2xl text-orange-600"><i className="fa-solid fa-wallet"></i></div>
                                 <div>
                                     <h3 className="font-bold text-lg">내 지갑 (쿠키)</h3>
                                     <p className="text-gray-600 text-sm">현재 보유한 쿠키 개수입니다. 클릭하면 쿠키 사용 내역을 볼 수 있습니다. 쿠키로 상점에서 아이템을 사거나 레벨업을 할 수 있습니다.</p>
                                 </div>
                             </div>
                             <div className="flex gap-4 items-start bg-purple-50 p-4 rounded-xl">
                                 <div className="bg-purple-100 p-3 rounded-full text-2xl text-purple-600"><i className="fa-solid fa-candy-cane"></i></div>
                                 <div>
                                     <h3 className="font-bold text-lg">보유 캔디 (환전소)</h3>
                                     <p className="text-gray-600 text-sm">게임 플레이로 모은 캔디입니다. <strong>클릭하면 쿠키로 환전</strong>할 수 있습니다. 캔디를 모으면 하드모드가 해금됩니다.</p>
                                 </div>
                             </div>
                             <div className="flex gap-4 items-start bg-blue-50 p-4 rounded-xl">
                                 <div className="bg-blue-100 p-3 rounded-full text-2xl text-blue-600"><i className="fa-solid fa-shop"></i></div>
                                 <div>
                                     <h3 className="font-bold text-lg">상점과 옷장</h3>
                                     <p className="text-gray-600 text-sm">상점에서 뽑기를 통해 캐릭터를 꾸밀 아이템을 획득하고, 옷장에서 착용할 수 있습니다.</p>
                                 </div>
                             </div>
                         </div>
                         <div className="mt-8 text-center">
                             <Button onClick={handleTutorialComplete} variant="primary" className="text-xl py-4 w-full">확인했습니다! (입장하기)</Button>
                         </div>
                     </div>
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
                            <div><label className="block text-xl font-bold text-white mb-3"><i className="fa-solid fa-fire mr-2 text-red-500"></i>하드모드 입장료 (캔디)</label><input type="number" className="w-full h-14 px-4 text-xl border-2 border-slate-600 bg-slate-800 text-white rounded-2xl" value={config.hardModeEntryCost} onChange={(e) => setConfig({...config, hardModeEntryCost: parseInt(e.target.value)})} /></div>
                            <div><label className="block text-xl font-bold text-white mb-3"><i className="fa-solid fa-right-left mr-2 text-yellow-500"></i>캔디 환율 (캔디 N개 = 쿠키 1개)</label><input type="number" className="w-full h-14 px-4 text-xl border-2 border-slate-600 bg-slate-800 text-white rounded-2xl" value={config.exchangeRate} onChange={(e) => setConfig({...config, exchangeRate: parseInt(e.target.value)})} /></div>
                        </div>
                        <div className="pt-6 border-t border-slate-700 flex flex-col gap-3">
                            <div className="bg-red-900/30 border border-red-500/30 p-6 rounded-2xl mb-4">
                                <h3 className="text-red-400 font-bold text-xl mb-3"><i className="fa-solid fa-triangle-exclamation mr-2"></i>데이터 초기화</h3>
                                <div className="flex items-center gap-3 mb-4">
                                    <input type="checkbox" id="resetCheck" checked={isResetChecked} onChange={(e) => setIsResetChecked(e.target.checked)} className="w-6 h-6 rounded border-red-500 bg-slate-800 text-red-600 focus:ring-red-500" />
                                    <label htmlFor="resetCheck" className="text-white text-lg">모든 학생 데이터 초기화에 동의합니다 (쿠키 제외)</label>
                                </div>
                                <p className="text-gray-400 text-sm mb-4 bg-black/20 p-3 rounded-lg"><i className="fa-solid fa-circle-info mr-2"></i>초기화 시 <strong>새로운 API 키 발급</strong>을 권장합니다. 기존 키 유지 시 일부 학생의 캐시된 데이터가 남을 수 있습니다.</p>
                                <Button onClick={handleHardReset} variant="danger" disabled={!isResetChecked} className={`text-xl py-4 !bg-red-900/50 hover:!bg-red-800 border border-red-500/50 text-red-100 ${!isResetChecked ? 'opacity-50 cursor-not-allowed' : ''}`}>🔥 전체 초기화 실행 (복구 불가)</Button>
                            </div>
                            
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
                    <Button onClick={() => setView(AppView.INTRO)} variant="secondary">뒤로가기</Button>
                </Panel>
            )}

            {view === AppView.LOBBY && (
                <Panel>
                    {showGameModeSelect && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowGameModeSelect(false)}>
                            <div className="bg-white p-8 rounded-3xl w-[90%] max-w-2xl shadow-2xl relative" onClick={e => e.stopPropagation()}>
                                <h3 className="text-3xl font-black text-gray-800 mb-8">모드를 선택하세요!</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div onClick={startNormalGame} className="cursor-pointer bg-blue-50 border-4 border-blue-200 hover:border-blue-400 p-6 rounded-3xl transition-all hover:-translate-y-1 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">일반 모드</div>
                                        <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">🏃</div>
                                        <h4 className="text-2xl font-bold text-blue-800 mb-2">기본 달리기</h4>
                                        <p className="text-gray-500 text-sm font-bold">오늘의 도전 횟수 차감</p>
                                        <p className="text-blue-600 font-bold mt-2">남은 횟수: {Math.max(0, config.dailyLimit - player.dailyPlayCount)}회</p>
                                    </div>
                                    <div onClick={startHardGame} className="cursor-pointer bg-red-50 border-4 border-red-200 hover:border-red-400 p-6 rounded-3xl transition-all hover:-translate-y-1 relative overflow-hidden group">
                                         <div className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">하드 모드</div>
                                        <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">🔥</div>
                                        <h4 className="text-2xl font-bold text-red-800 mb-2">무한 챌린지</h4>
                                        <p className="text-gray-500 text-sm font-bold">도전 횟수 차감 없음</p>
                                        <p className="text-red-600 font-bold mt-2">입장료: 캔디 {config.hardModeEntryCost}개</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowGameModeSelect(false)} className="mt-8 text-gray-400 hover:text-gray-600 font-bold border-b border-gray-300 pb-1">취소</button>
                            </div>
                        </div>
                    )}

                    {showTitleSelect && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowTitleSelect(false)}>
                            <div className="bg-white p-6 rounded-3xl w-[90%] max-w-2xl shadow-2xl relative max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-2xl font-black text-gray-800"><i className="fa-solid fa-crown text-yellow-500 mr-2"></i>칭호 설정</h3>
                                    <button onClick={() => setShowTitleSelect(false)} className="text-gray-400 hover:text-gray-600"><i className="fa-solid fa-xmark text-2xl"></i></button>
                                </div>
                                <div className="overflow-y-auto flex-1 no-scrollbar grid grid-cols-1 md:grid-cols-2 gap-3 pr-2">
                                    <div onClick={() => { setPlayer({...player, activeTitle: null}); savePlayerData({...player, activeTitle: null}); }} 
                                         className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-3 ${player.activeTitle === null ? 'border-amber-500 bg-amber-50 shadow-md' : 'border-gray-200 hover:bg-gray-50'}`}>
                                        <div className="text-2xl">😶</div>
                                        <div>
                                            <div className="font-bold text-gray-800">칭호 없음</div>
                                            <div className="text-xs text-gray-500">칭호를 사용하지 않습니다.</div>
                                        </div>
                                    </div>
                                    {ACHIEVEMENTS.map(ach => {
                                        const isUnlocked = player.unlockedTitles.includes(ach.id);
                                        return (
                                            <div key={ach.id} 
                                                 onClick={() => { if(isUnlocked) { setPlayer({...player, activeTitle: ach.id}); savePlayerData({...player, activeTitle: ach.id}); } }} 
                                                 className={`p-4 rounded-xl border-2 transition-all flex items-center gap-3 relative overflow-hidden ${player.activeTitle === ach.id ? 'border-amber-500 bg-amber-50 shadow-md' : (isUnlocked ? 'border-gray-200 cursor-pointer hover:bg-gray-50' : 'border-gray-100 bg-gray-100 opacity-70 cursor-not-allowed')}`}>
                                                <div className={`text-2xl ${!isUnlocked ? 'grayscale' : ''}`}>{ach.icon}</div>
                                                <div>
                                                    <div className={`font-bold ${isUnlocked ? 'text-gray-800' : 'text-gray-400'}`}>{ach.name}</div>
                                                    <div className="text-xs text-gray-500">{ach.desc}</div>
                                                </div>
                                                {!isUnlocked && <div className="absolute inset-0 bg-gray-200/50 flex items-center justify-center"><i className="fa-solid fa-lock text-gray-400"></i></div>}
                                            </div>
                                        )
                                    })}
                                </div>
                                <div className="mt-4 text-center">
                                    <p className="text-sm text-gray-500 font-bold">
                                        현재 이름: <span className="text-amber-600 text-lg">{getActiveTitleName()}{player.name}</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <h2 className="text-3xl font-bold text-gray-800 mb-6 flex items-center justify-center gap-2">
                        {player.activeTitle && (
                            <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-lg text-lg border border-amber-200">
                                {ACHIEVEMENTS.find(a => a.id === player.activeTitle)?.icon} {ACHIEVEMENTS.find(a => a.id === player.activeTitle)?.name}
                            </span>
                        )}
                        <span>{player.name}</span>
                        <button onClick={() => setShowTitleSelect(true)} className="w-8 h-8 rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600 text-sm ml-2"><i className="fa-solid fa-pen"></i></button>
                    </h2>
                    
                    <div className="flex gap-4 mb-6">
                        <div className="flex-1 bg-orange-100 p-6 rounded-3xl shadow-inner cursor-pointer hover:bg-orange-200 transition-colors relative group" onClick={() => setShowWalletLog(true)}>
                            <div className="text-orange-800 font-bold flex items-center justify-center gap-3 text-xl mb-2"><i className="fa-solid fa-wallet"></i> 내 지갑</div>
                            <div className="text-4xl font-black text-orange-600">{player.wallet} <span className="text-lg">쿠키</span></div>
                            <div className="absolute top-2 right-2 text-orange-400 opacity-50 group-hover:opacity-100"><i className="fa-solid fa-list-ul"></i></div>
                        </div>
                        <div className="flex-1 bg-purple-100 p-6 rounded-3xl shadow-inner cursor-pointer hover:bg-purple-200 transition-colors relative group" onClick={() => setShowExchange(true)}>
                             <div className="text-purple-800 font-bold flex items-center justify-center gap-3 text-xl mb-2"><i className="fa-solid fa-candy-cane"></i> 보유 캔디</div>
                            <div className="text-4xl font-black text-purple-600">{player.totalCandies} <span className="text-lg">개</span></div>
                            <div className="absolute top-2 right-2 text-purple-400 opacity-50 group-hover:opacity-100"><i className="fa-solid fa-right-left"></i></div>
                        </div>
                    </div>
                    
                    <div className="flex gap-4 mb-8">
                         <div className="flex-1 bg-blue-100 p-4 rounded-3xl shadow-inner text-center">
                            <div className="text-blue-800 font-bold text-lg mb-1"><i className="fa-solid fa-gamepad mr-2"></i>오늘의 도전</div>
                             <div className="text-3xl font-black text-blue-600">{Math.max(0, config.dailyLimit - player.dailyPlayCount)} <span className="text-base text-blue-400">/ {config.dailyLimit}</span></div>
                        </div>
                        <div className="flex-1 bg-pink-100 p-4 rounded-3xl shadow-inner text-center">
                            <div className="text-pink-800 font-bold text-lg mb-1"><i className="fa-solid fa-cart-shopping mr-2"></i>상점 입장</div>
                             <div className="text-3xl font-black text-pink-600">{Math.max(0, config.shopLimit - player.dailyShopCount)} <span className="text-base text-pink-400">/ {config.shopLimit}</span></div>
                        </div>
                    </div>
                    
                    {showWalletLog && (
                         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowWalletLog(false)}>
                            <div className="bg-white p-6 rounded-3xl w-[90%] max-w-lg shadow-2xl overflow-hidden max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-2xl font-bold text-gray-800">📜 쿠키 사용 내역</h3>
                                    <button onClick={() => setShowWalletLog(false)} className="text-gray-400 hover:text-gray-600"><i className="fa-solid fa-xmark text-2xl"></i></button>
                                </div>
                                <div className="overflow-y-auto flex-1 no-scrollbar pr-2">
                                    {(player.logs && player.logs.length > 0) ? (
                                        <div className="space-y-3">
                                            {player.logs.map((log) => (
                                                <div key={log.id} className="bg-gray-50 p-3 rounded-xl flex justify-between items-center border border-gray-100">
                                                    <div className="text-left">
                                                        <div className="font-bold text-gray-800">{log.desc}</div>
                                                        <div className="text-xs text-gray-400">{log.date}</div>
                                                    </div>
                                                    <div className={`font-bold text-lg ${log.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                        {log.amount > 0 ? '+' : ''}{log.amount}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="py-10 text-gray-400 text-center">아직 사용 내역이 없습니다.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {showExchange && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowExchange(false)}>
                            <div className="bg-white p-8 rounded-3xl w-[90%] max-w-md shadow-2xl text-center relative" onClick={e => e.stopPropagation()}>
                                <h3 className="text-2xl font-black text-purple-800 mb-6">🍬 캔디 환전소</h3>
                                <div className="bg-gray-100 p-4 rounded-xl mb-6">
                                    <p className="text-gray-500 font-bold mb-1">현재 환율</p>
                                    <p className="text-lg font-bold">캔디 <span className="text-purple-600">{config.exchangeRate}개</span> = 쿠키 <span className="text-orange-600">1개</span></p>
                                </div>
                                <div className="mb-6">
                                    <label className="block text-gray-600 font-bold mb-2">구매할 쿠키 개수</label>
                                    <div className="flex items-center justify-center gap-4">
                                        <button onClick={() => setExchangeAmount(Math.max(1, exchangeAmount - 1))} className="w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 font-bold text-xl">-</button>
                                        <span className="text-3xl font-black w-16">{exchangeAmount}</span>
                                        <button onClick={() => setExchangeAmount(exchangeAmount + 1)} className="w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 font-bold text-xl">+</button>
                                    </div>
                                    <p className="mt-4 text-gray-500">
                                        필요한 캔디: <span className="font-bold text-purple-600">{exchangeAmount * config.exchangeRate}</span>개
                                    </p>
                                </div>
                                <Button onClick={handleExchange} variant="primary" disabled={player.totalCandies < exchangeAmount * config.exchangeRate} className={player.totalCandies < exchangeAmount * config.exchangeRate ? 'opacity-50 cursor-not-allowed' : ''}>환전하기</Button>
                                <button onClick={() => setShowExchange(false)} className="mt-4 text-gray-400 hover:text-gray-600 font-bold">취소</button>
                            </div>
                        </div>
                    )}

                    <Button onClick={openGameModeSelect} variant="accent" className="py-8 text-3xl mb-6">▶ 게임 시작</Button>
                    <div className="grid grid-cols-2 gap-4">
                        <Button onClick={handleEnterShop} variant="secondary" className="text-xl"><i className="fa-solid fa-shop"></i> 상점</Button>
                        <Button onClick={() => setView(AppView.WARDROBE)} variant="secondary" className="text-xl bg-purple-500 text-white"><i className="fa-solid fa-shirt"></i> 옷장</Button>
                    </div>
                    <Button onClick={() => setView(AppView.RECORDS)} variant="secondary" className="mt-4 text-xl"><i className="fa-solid fa-trophy"></i> 명예의 전당</Button>
                    {!isMagicLink && <Button onClick={() => setView(AppView.INTRO)} variant="danger" className="mt-6 text-lg">나가기</Button>}
                </Panel>
            )}

            {/* Shop View */}
            {view === AppView.SHOP && (
                <Panel title="🛒 아이템 상점" className="max-w-4xl">
                     {/* Shop Intro Modal */}
                     {showShopInfo && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowShopInfo(false)}>
                            <div className="bg-white p-8 rounded-3xl w-[95%] max-w-2xl shadow-2xl relative max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                                <h3 className="text-2xl font-black text-gray-800 mb-4 text-center">🎁 오늘의 뽑기 라인업</h3>
                                <div className="grid grid-cols-2 gap-4 text-left">
                                    <div className="bg-blue-50 p-4 rounded-xl">
                                        <div className="font-bold text-blue-600 mb-2">🧢 모자</div>
                                        <div className="text-sm text-gray-600 leading-relaxed">{GAME_ITEMS.hats.map(i => ITEM_NAMES[i]).join(', ')}</div>
                                    </div>
                                    <div className="bg-red-50 p-4 rounded-xl">
                                        <div className="font-bold text-red-600 mb-2">⚔️ 무기</div>
                                        <div className="text-sm text-gray-600 leading-relaxed">{GAME_ITEMS.weapons.map(i => ITEM_NAMES[i]).join(', ')}</div>
                                    </div>
                                    <div className="bg-green-50 p-4 rounded-xl">
                                        <div className="font-bold text-green-600 mb-2">👗 옷</div>
                                        <div className="text-sm text-gray-600 leading-relaxed">{GAME_ITEMS.clothes.map(i => ITEM_NAMES[i]).join(', ')}</div>
                                    </div>
                                    <div className="bg-yellow-50 p-4 rounded-xl">
                                        <div className="font-bold text-yellow-600 mb-2">👟 신발</div>
                                        <div className="text-sm text-gray-600 leading-relaxed">{GAME_ITEMS.shoes.map(i => ITEM_NAMES[i]).join(', ')}</div>
                                    </div>
                                </div>
                                <div className="mt-6 text-center">
                                    <Button onClick={() => setShowShopInfo(false)} variant="primary" className="py-3">확인</Button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="text-gray-500 font-bold mb-4 text-center bg-gray-100 py-2 rounded-xl">
                        오늘 상점 이용 횟수: <span className="text-pink-600">{player.dailyShopCount}</span> / {config.shopLimit} (입장 시 차감)
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div className="bg-white p-6 rounded-3xl shadow-lg border-2 border-gray-100 flex flex-col items-center hover:-translate-y-1 transition-transform">
                            <div className="w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center mb-4 text-5xl">⚡</div>
                            <h3 className="text-2xl font-black text-gray-800 mb-1">캔디 업그레이드</h3>
                            <p className="text-gray-500 font-bold mb-4">현재 Lv.{player.level} (+{player.level}점)</p>
                            <div className="mt-auto w-full">
                                <Button onClick={buyUpgrade} variant="primary" className="mb-0">
                                    강화 {player.level * config.priceUpgrade}🍪
                                </Button>
                            </div>
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in pointer-events-auto">
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