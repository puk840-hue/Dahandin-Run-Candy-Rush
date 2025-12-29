
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PlayerState, GameConfig, GameObject, Particle, Cloud } from '../types';
import { BG_COLORS, ACHIEVEMENTS } from '../constants';
import { drawCharacter, drawCandySimple, audioManager, darkenColor } from '../utils';

interface GameCanvasProps {
  playerState: PlayerState;
  config: GameConfig;
  onGameOver: (score: number, candies: number, timeSec: number, fell: boolean) => void;
  onAddScore: (amount: number) => void;
  isPaused: boolean;
  isHardMode: boolean; 
}

const GameCanvas: React.FC<GameCanvasProps> = ({ playerState, config, onGameOver, onAddScore, isPaused, isHardMode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hudTime, setHudTime] = useState("00:00");
  const [hudCandyCount, setHudCandyCount] = useState(0); 
  const [hudTotalScore, setHudTotalScore] = useState(0); 
  const [hudStage, setHudStage] = useState(1);
  const [hudHearts, setHudHearts] = useState(playerState.maxHearts);
  const [isSpeedAlert, setIsSpeedAlert] = useState(false);

  const playerStateRef = useRef(playerState);
  const isPausedRef = useRef(isPaused);
  const isHardModeRef = useRef(isHardMode);

  useEffect(() => { playerStateRef.current = playerState; }, [playerState]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { isHardModeRef.current = isHardMode; }, [isHardMode]);

  const gameState = useRef({
    playing: true,
    lastFrameTime: 0,
    playTimeMs: 0,
    candyRunCount: 0,
    jumpRunCount: 0,
    totalDistance: 0,
    nextObstacleDist: 500,
    nextCandyDist: 300,
    speedMultiplier: 1.0,
    difficultyMultiplier: 1.0,
    currentStage: 0,
    isSlidingHeld: false, 
    currentHearts: playerState.maxHearts,
    invincibleTimer: 0,
    shakeTimer: 0
  });

  const ginger = useRef({ x: 150, y: 0, dy: 0, grounded: false, jumpCount: 0 });
  const objects = useRef<GameObject[]>([]);
  const clouds = useRef<Cloud[]>([]);
  const hills = useRef<{x: number, h: number, c: string, layer: number}[]>([]); 

  const getFullPlayerName = () => {
    if (!playerState.activeTitle) return playerState.name;
    const ach = ACHIEVEMENTS.find(a => a.id === playerState.activeTitle);
    return `[${ach?.icon || ''} ${ach?.name || ''}] ${playerState.name}`;
  };

  const calculateScore = useCallback(() => {
    return (gameState.current.candyRunCount * playerStateRef.current.level) + 
           (gameState.current.jumpRunCount * playerStateRef.current.jumpBonus);
  }, []);

  const jumpAction = useCallback(() => {
    audioManager.resume();
    if(!gameState.current.playing || isPausedRef.current) return;

    if(ginger.current.grounded || gameState.current.isSlidingHeld) {
        ginger.current.dy = -20; 
        ginger.current.grounded = false;
        ginger.current.jumpCount = 1;
        gameState.current.jumpRunCount++;
    } else if(ginger.current.jumpCount < 2) {
        ginger.current.dy = -18; 
        ginger.current.jumpCount++;
        gameState.current.jumpRunCount++;
    }
    setHudTotalScore(calculateScore());
  }, [calculateScore]);

  const slideAction = useCallback((isHeld: boolean) => {
    if(!gameState.current.playing || isPausedRef.current) return;
    gameState.current.isSlidingHeld = isHeld;
  }, []);

  // 글래스모피즘 기반 3D 스타일 장애물 드로잉
  const drawObstacle = (ctx: CanvasRenderingContext2D, o: GameObject) => {
    ctx.save();
    ctx.translate(o.x, o.y);
    const w = o.w || 40;
    const h = o.h || 40;

    // 기본 유리 효과 설정
    ctx.shadowBlur = 15;
    ctx.shadowColor = "rgba(0,0,0,0.15)";
    
    const applyGlassEffect = (baseColor: string) => {
        ctx.fillStyle = baseColor;
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.lineWidth = 2;
    };

    const drawShine = (sx: number, sy: number, sw: number, sh: number) => {
        const grad = ctx.createLinearGradient(sx, sy, sx + sw, sy + sh);
        grad.addColorStop(0, "rgba(255,255,255,0.5)");
        grad.addColorStop(0.5, "rgba(255,255,255,0)");
        grad.addColorStop(1, "rgba(255,255,255,0.1)");
        ctx.fillStyle = grad;
        ctx.fillRect(sx, sy, sw, sh);
    };

    switch(o.type) {
      case 'bird': { // 글래시 핑크 도넛
        ctx.beginPath();
        ctx.ellipse(w/2, h/2, w/2, h/2.5, 0, 0, Math.PI*2);
        const grad = ctx.createRadialGradient(w/2, h/2, 5, w/2, h/2, w/2);
        grad.addColorStop(0, "rgba(255, 182, 193, 0.6)");
        grad.addColorStop(1, "rgba(255, 105, 180, 0.8)");
        ctx.fillStyle = grad; ctx.fill(); ctx.stroke();
        // 광택
        ctx.beginPath(); ctx.ellipse(w/3, h/3, w/6, h/10, Math.PI/4, 0, Math.PI*2);
        ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.fill();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath(); ctx.arc(w/2, h/2, w/6, 0, Math.PI*2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'bee': { // 크리스탈 마카롱
        const macColor = "rgba(255, 235, 59, 0.7)";
        ctx.fillStyle = macColor;
        ctx.beginPath(); ctx.roundRect(0, h/2 - 15, w, 14, 10); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.roundRect(0, h/2 + 2, w, 14, 10); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.fillRect(4, h/2 - 2, w-8, 5);
        // 날개 (더 반투명하게)
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.beginPath(); ctx.ellipse(5, h/2-12, 18, 8, -Math.PI/4, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(w-5, h/2-12, 18, 8, Math.PI/4, 0, Math.PI*2); ctx.fill();
        break;
      }
      case 'ghost': { // 프로스트 마시멜로
        const mashColor = "rgba(255, 255, 255, 0.4)";
        ctx.fillStyle = mashColor;
        ctx.beginPath(); ctx.roundRect(w/4, h/4, w/2, h/2, 12); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.stroke();
        ctx.fillStyle = "#333";
        ctx.beginPath(); ctx.arc(w/2 - 8, h/2, 2.5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(w/2 + 8, h/2, 2.5, 0, Math.PI*2); ctx.fill();
        break;
      }
      case 'cactus': { // 네온 캔디 케인
        ctx.lineWidth = 12; ctx.lineCap = "round";
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.beginPath(); ctx.moveTo(w/2, h); ctx.lineTo(w/2, 30); ctx.quadraticCurveTo(w/2, 0, w, 10); ctx.stroke();
        ctx.strokeStyle = "rgba(244, 67, 54, 0.8)"; ctx.setLineDash([12, 15]);
        ctx.stroke();
        ctx.setLineDash([]);
        break;
      }
      case 'rock': { // 글로시 초코 쿠키
        const cookieGrad = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w/2);
        cookieGrad.addColorStop(0, "rgba(210, 180, 140, 0.6)");
        cookieGrad.addColorStop(1, "rgba(139, 69, 19, 0.8)");
        ctx.fillStyle = cookieGrad;
        ctx.beginPath(); ctx.arc(w/2, h/2, w/2, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        // 초코칩 (3D 느낌)
        ctx.fillStyle = "rgba(62, 39, 35, 0.9)";
        for(let i=0; i<8; i++) {
            const cx = 15 + Math.random()*(w-30);
            const cy = 15 + Math.random()*(h-30);
            ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,0.2)";
            ctx.beginPath(); ctx.arc(cx-1, cy-1, 2, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "rgba(62, 39, 35, 0.9)";
        }
        break;
      }
      case 'barrier': { // 골드 와플 블록
        const waffleColor = "rgba(255, 193, 7, 0.5)";
        ctx.fillStyle = waffleColor;
        ctx.beginPath(); ctx.roundRect(0, 0, w, h, 10); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 2;
        for(let x=15; x<w; x+=25) ctx.strokeRect(x, 10, 8, h-20);
        for(let y=15; y<h; y+=25) ctx.strokeRect(10, y, w-20, 8);
        break;
      }
      case 'mushroom': { // 주얼 컵케이크
        ctx.fillStyle = "rgba(121, 85, 72, 0.7)";
        ctx.beginPath(); ctx.moveTo(w/5, h); ctx.lineTo(4*w/5, h); ctx.lineTo(w, h/2.5); ctx.lineTo(0, h/2.5); ctx.fill();
        ctx.fillStyle = "rgba(244, 143, 177, 0.6)";
        ctx.beginPath(); ctx.arc(w/2, h/2.5, w/2.2, Math.PI, 0); ctx.fill();
        ctx.beginPath(); ctx.arc(w/2, h/4.5, w/3, Math.PI, 0); ctx.fill();
        ctx.fillStyle = "rgba(211, 47, 47, 0.9)";
        ctx.beginPath(); ctx.arc(w/2, h/7, 10, 0, Math.PI*2); ctx.fill();
        // 하이라이트
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.beginPath(); ctx.arc(w/2 - 3, h/7 - 3, 3, 0, Math.PI*2); ctx.fill();
        break;
      }
    }
    ctx.restore();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    if(!ctx) return;
    
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    
    if (clouds.current.length === 0) {
        for(let i=0; i<8; i++) clouds.current.push({ x: Math.random()*canvas.width, y: Math.random()*(canvas.height/2), speed: 0.1 + Math.random()*0.3, size: 0.8 + Math.random()*1.2 });
    }
    if (hills.current.length === 0) {
        const hillColors = ['#A5D6A7', '#81C784', '#66BB6A', '#4CAF50'];
        for(let layer=0; layer<3; layer++) {
            for(let i=0; i<canvas.width + 400; i+= 250) {
                hills.current.push({ 
                    x: i, 
                    h: 40 + (layer * 40) + Math.random()*60, 
                    c: hillColors[layer % hillColors.length],
                    layer: layer
                });
            }
        }
    }

    gameState.current.lastFrameTime = performance.now();
    let animationId: number;

    const loop = (timestamp: number) => {
        if (isPausedRef.current) { 
            gameState.current.lastFrameTime = timestamp; 
            animationId = requestAnimationFrame(loop); 
            return; 
        }
        if (!gameState.current.playing) return;

        const deltaTime = timestamp - gameState.current.lastFrameTime;
        gameState.current.lastFrameTime = timestamp;
        const dt = Math.min(deltaTime, 50); 
        gameState.current.playTimeMs += dt;
        
        if (gameState.current.invincibleTimer > 0) gameState.current.invincibleTimer -= dt;
        if (gameState.current.shakeTimer > 0) gameState.current.shakeTimer -= dt;

        const totalSeconds = Math.floor(gameState.current.playTimeMs / 1000);
        setHudTime(`${Math.floor(totalSeconds / 60).toString().padStart(2, '0')}:${(totalSeconds % 60).toString().padStart(2, '0')}`);

        const newStage = Math.floor(gameState.current.playTimeMs / 12000); 
        if (newStage > gameState.current.currentStage) {
            gameState.current.currentStage = newStage;
            gameState.current.speedMultiplier += 0.12;
            setHudStage(newStage + 1);
            setIsSpeedAlert(true);
            setTimeout(() => setIsSpeedAlert(false), 2000);
            audioManager.playUpgradeSfx();
        }

        const hardModeMultiplier = isHardModeRef.current ? 1.5 : 1.0;
        const currentSpeed = (0.4 * dt + (playerStateRef.current.level * 0.01)) * gameState.current.speedMultiplier * hardModeMultiplier;
        gameState.current.totalDistance += currentSpeed;

        const bgIdx = Math.min(gameState.current.currentStage, BG_COLORS.length - 1);
        canvas.style.background = BG_COLORS[bgIdx];
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 화면 흔들림 효과 적용
        ctx.save();
        if (gameState.current.shakeTimer > 0) {
            const shakeAmount = 8;
            ctx.translate(Math.random() * shakeAmount - shakeAmount/2, Math.random() * shakeAmount - shakeAmount/2);
        }

        const groundY = canvas.height - 160;

        // 배경 렌더링
        ctx.save();
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        clouds.current.forEach(c => {
            c.x -= c.speed * (dt / 16);
            if(c.x < -150) { c.x = canvas.width + 100; c.y = Math.random() * (canvas.height/2); }
            ctx.beginPath(); ctx.arc(c.x, c.y, 30 * c.size, 0, Math.PI * 2); ctx.fill();
        });
        ctx.restore();

        hills.current.forEach(hill => {
            const layerSpeed = (hill.layer + 1) * 0.15;
            hill.x -= currentSpeed * layerSpeed;
            if(hill.x < -400) hill.x = canvas.width;
            ctx.fillStyle = hill.c; ctx.beginPath(); ctx.moveTo(hill.x, groundY); ctx.quadraticCurveTo(hill.x + 150, groundY - hill.h, hill.x + 400, groundY); ctx.fill();
        });

        // 물리 연산
        ginger.current.dy += 0.08 * dt;
        ginger.current.y += ginger.current.dy * (dt / 16);

        let inHole = false;
        objects.current.forEach(o => {
            if (o.type === 'hole') {
                if (ginger.current.x > o.x && ginger.current.x < o.x + (o.w || 100)) inHole = true;
            }
        });

        if (ginger.current.y > groundY - 25) {
            if (inHole) {
                if (ginger.current.y > canvas.height) {
                    gameState.current.playing = false;
                    onGameOver(calculateScore(), gameState.current.candyRunCount, Math.floor(gameState.current.playTimeMs/1000), true);
                    return;
                }
            } else {
                ginger.current.y = groundY - 25; 
                ginger.current.dy = 0; 
                ginger.current.grounded = true; 
                ginger.current.jumpCount = 0;
            }
        } else {
            ginger.current.grounded = false;
        }

        const isSlidingNow = ginger.current.grounded && gameState.current.isSlidingHeld;

        // 지면 렌더링
        ctx.fillStyle = "#5d4037"; ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);
        ctx.fillStyle = "#4caf50"; ctx.fillRect(0, groundY, canvas.width, 20);
        objects.current.forEach(o => { if (o.type === 'hole') ctx.clearRect(o.x, groundY, o.w || 100, canvas.height - groundY); });

        // 오브젝트 스폰
        if(gameState.current.totalDistance >= gameState.current.nextObstacleDist) {
            const rand = Math.random();
            if (rand < 0.15) { 
                objects.current.push({ type: 'hole', x: canvas.width, y: groundY, w: 100 + Math.random() * 80 });
            } else if (rand < 0.45) { 
                const types: GameObject['type'][] = ['bird', 'bee', 'ghost'];
                const type = types[Math.floor(Math.random()*types.length)];
                const airY = groundY - (60 + Math.random() * 140);
                objects.current.push({ type, x: canvas.width, y: airY, w: 75, h: 75 });
            } else { 
                const types: GameObject['type'][] = ['cactus', 'rock', 'barrier', 'mushroom'];
                const type = types[Math.floor(Math.random()*types.length)];
                objects.current.push({ type, x: canvas.width, y: groundY - 95, w: 95, h: 95 });
            }
            gameState.current.nextObstacleDist = gameState.current.totalDistance + (500 + Math.random()*600);
        }

        if(gameState.current.totalDistance >= gameState.current.nextCandyDist) {
            objects.current.push({ type: 'candy', x: canvas.width, y: groundY - (60 + Math.random()*160), r: 25, candyIdx: playerStateRef.current.currentCandySkin });
            gameState.current.nextCandyDist = gameState.current.totalDistance + (250 + Math.random()*300);
        }

        // 충돌 및 오브젝트 렌더링
        let hitSomething = false;
        for(let i=0; i<objects.current.length; i++) {
            const o = objects.current[i];
            o.x -= currentSpeed;

            if (o.type === 'candy') {
                drawCandySimple(ctx, o.x, o.y, o.r || 20, o.candyIdx || 0);
                if (Math.hypot(ginger.current.x - o.x, (ginger.current.y - 20) - o.y) < 50) {
                    gameState.current.candyRunCount++;
                    setHudCandyCount(gameState.current.candyRunCount);
                    setHudTotalScore(calculateScore());
                    onAddScore(1); audioManager.playCandySfx();
                    objects.current.splice(i, 1); i--; continue;
                }
            } else if (o.type !== 'hole') {
                drawObstacle(ctx, o);
                
                const pW = 30; 
                const pH = isSlidingNow ? 25 : 60;
                const pY = isSlidingNow ? ginger.current.y + 15 : ginger.current.y - 20;
                
                const objCenterX = o.x + (o.w || 40) / 2;
                const objCenterY = o.y + (o.h || 40) / 2;
                
                if (gameState.current.invincibleTimer <= 0 && 
                    Math.abs(ginger.current.x - objCenterX) < (pW + (o.w || 40) / 2 - 20) && 
                    Math.abs(pY - objCenterY) < (pH / 2 + (o.h || 40) / 2 - 20)) {
                    hitSomething = true;
                }
            }
            if(o.x < -300) { objects.current.splice(i, 1); i--; }
        }

        if (hitSomething) {
            gameState.current.currentHearts--;
            setHudHearts(gameState.current.currentHearts);
            gameState.current.shakeTimer = 500; // 충돌 시 화면 흔들림
            if(gameState.current.currentHearts > 0) {
                gameState.current.invincibleTimer = 1500;
                audioManager.playGameOverSfx(); 
            } else {
                gameState.current.playing = false;
                audioManager.stopBgm();
                audioManager.playGameOverSfx();
                onGameOver(calculateScore(), gameState.current.candyRunCount, Math.floor(gameState.current.playTimeMs/1000), false);
                return;
            }
        }

        drawCharacter(ctx, ginger.current.x, ginger.current.y, playerStateRef.current.currentSkin, playerStateRef.current.equipped, gameState.current.playTimeMs, isSlidingNow, (gameState.current.invincibleTimer > 0 ? 'cry' : 'normal'), ginger.current.dy, ginger.current.grounded, gameState.current.invincibleTimer > 0);

        ctx.restore(); // 흔들림 효과 restore
        animationId = requestAnimationFrame(loop);
    };

    animationId = requestAnimationFrame(loop);

    const handleKeyDown = (e: KeyboardEvent) => {
        if(e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); jumpAction(); }
        if(e.code === 'ArrowDown') { e.preventDefault(); slideAction(true); }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
        if(e.code === 'ArrowDown') { e.preventDefault(); slideAction(false); }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
        window.removeEventListener('resize', resize);
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        cancelAnimationFrame(animationId);
    };
  }, [jumpAction, slideAction, onGameOver, onAddScore, calculateScore]); 

  return (
    <div className="relative w-full h-full overflow-hidden">
        <canvas ref={canvasRef} className="block w-full h-full transition-colors duration-2000" />
        
        {/* HUD */}
        <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start pointer-events-none z-10">
            <div className="flex gap-4">
                <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-2xl flex items-center gap-3 border-2 border-white/20 text-white font-bold shadow-lg">
                    <i className="fa-solid fa-user text-yellow-300"></i> 
                    <span className="truncate max-w-[150px]">{getFullPlayerName()}</span>
                </div>
            </div>

            <div className="bg-black/40 backdrop-blur-md px-5 py-2 rounded-2xl flex items-center gap-6 border-2 border-white/20 text-white font-bold shadow-lg">
                <div className="flex gap-1.5 items-center">
                    {Array.from({length: playerState.maxHearts}).map((_,i) => (
                        <i key={i} className={`fa-solid fa-heart transition-colors duration-300 ${i < hudHearts ? 'text-red-500 drop-shadow-sm' : 'text-gray-600 opacity-40'}`}></i>
                    ))}
                </div>
                <div className="h-4 w-px bg-white/20"></div>
                <div className="flex items-center gap-2">
                    <span className="text-xl">🍬</span> 
                    <span className="text-purple-300 font-black">{hudCandyCount}</span>
                </div>
            </div>

            <div className="flex items-center gap-3 pointer-events-none">
                <div className="bg-black/40 backdrop-blur-md px-3 py-2 rounded-xl border-2 border-white/20 text-white font-bold text-sm shadow-md">
                    <i className="fa-solid fa-flag mr-1.5 text-blue-400"></i> {hudStage}
                </div>
                <div className="bg-black/40 backdrop-blur-md px-3 py-2 rounded-xl border-2 border-white/20 text-white font-bold text-sm shadow-md">
                    <i className="fa-solid fa-clock mr-1.5 text-slate-400"></i> {hudTime}
                </div>
                <div className="bg-black/60 backdrop-blur-md px-5 py-2 rounded-2xl border-2 border-yellow-400/30 text-yellow-400 font-black text-2xl shadow-xl flex items-center gap-3">
                    <i className="fa-solid fa-trophy text-yellow-400"></i> 
                    <span className="tabular-nums">{hudTotalScore}</span>
                </div>
            </div>
        </div>

        {isSpeedAlert && (
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl md:text-7xl font-black text-yellow-300 italic animate-bounce pointer-events-none z-50 transition-all duration-300" style={{textShadow: '0 0 20px rgba(255,111,0,0.6), 4px 4px 0 rgba(191,54,12,1)'}}>
                <i className="fa-solid fa-bolt mr-4"></i>SPEED UP!!
            </div>
        )}

        {/* 조작 버튼 */}
        <div className="absolute bottom-10 left-10 pointer-events-auto">
            <button 
                onTouchStart={() => slideAction(true)} 
                onMouseDown={() => slideAction(true)}
                onTouchEnd={() => slideAction(false)}
                onMouseUp={() => slideAction(false)}
                onMouseLeave={() => slideAction(false)}
                className={`w-28 h-28 border-4 rounded-full text-white text-4xl backdrop-blur-md active:scale-90 transition-all shadow-2xl flex items-center justify-center ${gameState.current.isSlidingHeld ? 'bg-orange-500 border-orange-200 shadow-[0_0_20px_rgba(255,165,0,0.4)]' : 'bg-orange-500/40 border-orange-400'}`}
            >
                <i className="fa-solid fa-arrow-down"></i>
            </button>
        </div>

        <div className="absolute bottom-10 right-10 pointer-events-auto">
            <button 
                onTouchStart={jumpAction} 
                onMouseDown={jumpAction} 
                className="w-28 h-28 bg-blue-500/40 border-4 border-blue-400 rounded-full text-white text-4xl backdrop-blur-md active:scale-90 transition-transform shadow-2xl flex items-center justify-center"
            >
                <i className="fa-solid fa-arrow-up"></i>
            </button>
        </div>
    </div>
  );
};

export default GameCanvas;
