import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PlayerState, GameConfig, GameObject, Particle, Cloud } from '../types';
import { BG_COLORS } from '../constants';
import { drawCharacter, drawCandySimple, audioManager } from '../utils';

interface GameCanvasProps {
  playerState: PlayerState;
  config: GameConfig;
  onGameOver: (score: number, timeSec: number, fell: boolean) => void;
  onAddScore: (amount: number) => void;
  isPaused: boolean;
  isHardMode: boolean; 
}

const GameCanvas: React.FC<GameCanvasProps> = ({ playerState, config, onGameOver, onAddScore, isPaused, isHardMode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hudTime, setHudTime] = useState("00:00");
  const [hudScore, setHudScore] = useState(0);
  const [hudStage, setHudStage] = useState(1);
  const [isSpeedAlert, setIsSpeedAlert] = useState(false);

  // Mutable game state
  const gameState = useRef({
    playing: true,
    lastFrameTime: 0,
    playTimeMs: 0,
    score: 0,
    speed: 0,
    totalDistance: 0,
    nextObstacleDist: 500,
    nextCandyDist: 300,
    speedMultiplier: 1.0,
    difficultyMultiplier: 1.0,
    currentStage: 0,
    celebrationTimer: 0,
    isSliding: false
  });

  const jumpPressed = useRef(false); // Track if jump button is physically held
  const slidePressed = useRef(false); // Track if slide button is currently held down

  const ginger = useRef({ x: 100, y: 0, dy: 0, grounded: false, jumpCount: 0, rotation: 0 });
  const objects = useRef<GameObject[]>([]);
  const particles = useRef<Particle[]>([]);
  const clouds = useRef<Cloud[]>([]);
  const hills = useRef<{x: number, h: number, c: string}[]>([]); 

  // --- DRAWING HELPERS ---
  const drawObstacle = (ctx: CanvasRenderingContext2D, o: GameObject) => {
    ctx.save();
    ctx.translate(o.x, o.y);

    const w = o.w || 40;
    const h = o.h || 40;
    const variation = o.variation || 1;

    // Helper for 3D block
    const draw3DBlock = (colorFace: string, colorSide: string, colorTop: string, bx: number, by: number, bw: number, bh: number) => {
        // Side
        ctx.fillStyle = colorSide;
        ctx.beginPath(); ctx.moveTo(bx+bw, by); ctx.lineTo(bx+bw+10, by-10); ctx.lineTo(bx+bw+10, by+bh-10); ctx.lineTo(bx+bw, by+bh); ctx.fill();
        // Top
        ctx.fillStyle = colorTop;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx+10, by-10); ctx.lineTo(bx+bw+10, by-10); ctx.lineTo(bx+bw, by); ctx.fill();
        // Front
        ctx.fillStyle = colorFace;
        ctx.fillRect(bx, by, bw, bh);
    };

    switch(o.type) {
        case 'cactus':
            // Optimization: Avoid creating gradients every frame if possible, 
            // but for simplicity we keep it. The major bottleneck was filter() in loop.
            const cactusColor = ctx.createLinearGradient(0,0,w,0);
            cactusColor.addColorStop(0, "#4caf50"); cactusColor.addColorStop(1, "#2e7d32");
            ctx.fillStyle = cactusColor;
            if (variation === 1) {
                ctx.beginPath(); ctx.roundRect(0, 0, w, h, 10); ctx.fill();
                ctx.fillStyle="rgba(0,0,0,0.2)"; ctx.beginPath(); ctx.roundRect(w-5, 0, 5, h, 0); ctx.fill();
            } else {
                ctx.beginPath(); ctx.roundRect(10, 0, w-20, h, 10); ctx.fill();
                 if (variation === 2) { ctx.beginPath(); ctx.roundRect(0, 20, 10, 20, 5); ctx.fill(); }
            }
            ctx.fillStyle = "white";
            for(let i=0; i<5; i++) ctx.fillRect(Math.random()*w, Math.random()*h, 2, 2);
            break;
        case 'rock':
            const rockGrad = ctx.createRadialGradient(w/3, h/3, 5, w/2, h/2, w);
            rockGrad.addColorStop(0, "#bdbdbd"); rockGrad.addColorStop(1, "#616161");
            ctx.fillStyle = rockGrad;
            ctx.beginPath(); ctx.moveTo(10, h); ctx.lineTo(0, h-10); ctx.lineTo(w/2, 0); ctx.lineTo(w, h-15); ctx.lineTo(w-10, h); ctx.fill();
            ctx.fillStyle = "#424242"; ctx.beginPath(); ctx.moveTo(w, h-15); ctx.lineTo(w+5, h-20); ctx.lineTo(w+5, h); ctx.lineTo(w-10, h); ctx.fill();
            break;
        case 'barrier':
            draw3DBlock("#ef5350", "#c62828", "#ffcdd2", 0, 10, w, 20); 
            ctx.fillStyle = "#5d4037"; ctx.fillRect(5, 30, 8, h-30); ctx.fillRect(w-15, 30, 8, h-30);
            ctx.fillStyle = "rgba(255,255,255,0.8)";
            for(let i=0; i<w; i+=20) { ctx.beginPath(); ctx.moveTo(i, 30); ctx.lineTo(i+10, 30); ctx.lineTo(i+20, 10); ctx.lineTo(i+10, 10); ctx.fill(); }
            break;
        case 'bird':
            ctx.scale(variation === 1 ? 1 : 1, 1); 
            const wingY = Math.sin(gameState.current.playTimeMs / 60) * 12;
            const birdGrad = ctx.createLinearGradient(0,0,0,h);
            birdGrad.addColorStop(0, "#42a5f5"); birdGrad.addColorStop(1, "#1565c0");
            ctx.fillStyle = birdGrad; ctx.beginPath(); ctx.ellipse(w/2, h/2, w/2, h/3, 0, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "#90caf9"; ctx.beginPath(); ctx.moveTo(w/3, h/2); ctx.quadraticCurveTo(w/2, h/2-wingY, w, h/2); ctx.lineTo(w/2, h/1.5); ctx.fill();
            ctx.fillStyle = "white"; ctx.beginPath(); ctx.arc(w*0.75, h*0.3, 4, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "black"; ctx.beginPath(); ctx.arc(w*0.8, h*0.3, 1.5, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "#ffeb3b"; ctx.beginPath(); ctx.moveTo(w*0.85, h*0.4); ctx.lineTo(w+5, h*0.45); ctx.lineTo(w*0.85, h*0.5); ctx.fill();
            break;
        case 'ghost':
            const ghostGrad = ctx.createLinearGradient(0,0,w,0);
            ghostGrad.addColorStop(0, "#f5f5f5"); ghostGrad.addColorStop(1, "#e0e0e0");
            ctx.fillStyle = ghostGrad;
            ctx.beginPath(); ctx.arc(w/2, w/2, w/2, Math.PI, 0); ctx.lineTo(w, h); ctx.quadraticCurveTo(w*0.8, h-10, w*0.7, h); ctx.quadraticCurveTo(w*0.5, h-10, w*0.3, h); ctx.lineTo(0, w/2); ctx.fill();
            ctx.fillStyle = "rgba(0,0,0,0.1)"; ctx.beginPath(); ctx.arc(w/2+5, w/2, w/2, Math.PI, 0); ctx.fill();
            ctx.fillStyle = "#333"; ctx.beginPath(); ctx.arc(w*0.35, h*0.4, 3, 0, Math.PI*2); ctx.arc(w*0.65, h*0.4, 3, 0, Math.PI*2); ctx.fill();
            break;
        case 'bee':
            const beeGrad = ctx.createRadialGradient(w/2, h/3, 5, w/2, h/2, w);
            beeGrad.addColorStop(0, "#ffeb3b"); beeGrad.addColorStop(1, "#fbc02d");
            ctx.fillStyle = beeGrad; ctx.beginPath(); ctx.ellipse(w/2, h/2, w/2, h/3, 0, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "#212121"; ctx.beginPath(); ctx.ellipse(w/2, h/2, w/2, h/3, 0, 0, Math.PI*2); ctx.save(); ctx.clip(); ctx.fillRect(w*0.4, 0, 8, h); ctx.fillRect(w*0.7, 0, 8, h); ctx.restore();
            ctx.fillStyle = "rgba(255,255,255,0.8)"; const beeWing = Math.sin(gameState.current.playTimeMs / 20) * 5; ctx.beginPath(); ctx.ellipse(w/2, h*0.3, w/4, h/4 + beeWing, 0, 0, Math.PI*2); ctx.fill();
            break;
        case 'mushroom':
            ctx.fillStyle = "#ffcc80"; ctx.fillRect(w/2 - 10, h/2, 20, h/2);
            const mushGrad = ctx.createRadialGradient(w/2, 0, 5, w/2, h/2, w); mushGrad.addColorStop(0, "#ef5350"); mushGrad.addColorStop(1, "#c62828");
            ctx.fillStyle = mushGrad; ctx.beginPath(); ctx.arc(w/2, h/2, w/2+5, Math.PI, 0); ctx.fill();
            ctx.fillStyle = "white"; ctx.beginPath(); ctx.arc(w/2 - 15, h/3, 5, 0, Math.PI*2); ctx.arc(w/2 + 15, h/2.5, 4, 0, Math.PI*2); ctx.fill();
            break;
        default:
             ctx.fillStyle = "#ff5722"; ctx.roundRect(0, 0, w, h, 5); ctx.fill();
             break;
    }
    ctx.restore();
  };

  const jumpAction = useCallback(() => {
    // Ensure audio context is active (mobile requirement)
    audioManager.resume();
    
    if(!gameState.current.playing || isPaused) return;
    
    // Updated Jump Logic: 80% height, 1.1x speed
    if(ginger.current.grounded) {
        if (gameState.current.isSliding) {
            gameState.current.isSliding = false;
        }
        // Lower jump force (-20) combined with higher gravity for faster, lower jump
        ginger.current.dy = -20; 
        ginger.current.grounded = false;
        ginger.current.jumpCount = 1;
    } else if(ginger.current.jumpCount < 2) {
        ginger.current.dy = -18; 
        ginger.current.jumpCount++;
        for(let i=0; i<5; i++) {
             particles.current.push({ x: ginger.current.x, y: ginger.current.y, type: 'impact', life: 20, dy: Math.random()*4 - 2, size: Math.random()*3 });
        }
    }
  }, [isPaused]);

  const slideStart = useCallback(() => {
      audioManager.resume();
      if(!gameState.current.playing || isPaused) return;
      slidePressed.current = true; // Track intent

      if (ginger.current.grounded) {
          gameState.current.isSliding = true;
      } 
  }, [isPaused]);

  const slideEnd = useCallback(() => {
      slidePressed.current = false;
      gameState.current.isSliding = false;
  }, []);

  // Use robust event handling for virtual buttons
  // "key chewing" usually happens because of zoom delay or touch conflicts.
  // We use preventDefault and stopPropagation to ensure clean execution.
  // We added a specific logic (jumpPressed ref) to enforce "Press-Release" cycle.
  const handleJumpStart = useCallback((e: React.SyntheticEvent | Event) => {
      // Prevent default browser behavior (scrolling, zooming, mouse emulation)
      if (e.cancelable && e.type !== 'keydown') e.preventDefault();
      e.stopPropagation();
      
      if (jumpPressed.current) return; // Prevent double trigger if already held
      
      jumpPressed.current = true;
      jumpAction();
  }, [jumpAction]);

  const handleJumpEnd = useCallback((e: React.SyntheticEvent | Event) => {
      if (e.cancelable && e.type !== 'keyup') e.preventDefault();
      e.stopPropagation();
      jumpPressed.current = false;
  }, []);

  const handleSlideStartInput = useCallback((e: React.SyntheticEvent) => {
      e.preventDefault();
      e.stopPropagation();
      slideStart();
  }, [slideStart]);

  const handleSlideEndInput = useCallback((e: React.SyntheticEvent) => {
      e.preventDefault();
      e.stopPropagation();
      slideEnd();
  }, [slideEnd]);


  // --- SEPARATE BGM EFFECT ---
  // This ensures BGM only starts on mount and stops on unmount,
  // preventing it from restarting when 'onAddScore' or state changes.
  useEffect(() => {
      audioManager.playBgm();
      return () => {
          audioManager.stopBgm();
      };
  }, []);

  // --- GAME LOOP EFFECT ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    if(!ctx) return;

    const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    if (clouds.current.length === 0) {
        for(let i=0; i<8; i++) {
            clouds.current.push({ x: Math.random()*canvas.width, y: Math.random()*(canvas.height/2), speed: 0.2 + Math.random()*0.5, size: 0.5 + Math.random()*0.8 });
        }
    }
    if (hills.current.length === 0) {
        for(let i=0; i<canvas.width; i+= 100) {
            hills.current.push({ x: i, h: 50 + Math.random()*100, c: Math.random() > 0.5 ? '#81c784' : '#66bb6a' });
        }
    }

    gameState.current.lastFrameTime = performance.now();

    let animationId: number;

    const loop = (timestamp: number) => {
        if (isPaused) { 
            gameState.current.lastFrameTime = timestamp; 
            animationId = requestAnimationFrame(loop); 
            return; 
        }
        if (!gameState.current.playing) return;

        const deltaTime = timestamp - gameState.current.lastFrameTime;
        gameState.current.lastFrameTime = timestamp;
        const dt = Math.min(deltaTime, 50); 
        gameState.current.playTimeMs += dt;

        const totalSeconds = Math.floor(gameState.current.playTimeMs / 1000);
        setHudTime(`${Math.floor(totalSeconds / 60).toString().padStart(2, '0')}:${(totalSeconds % 60).toString().padStart(2, '0')}`);

        const stageDuration = 20000;
        const newStage = Math.floor(gameState.current.playTimeMs / stageDuration);
        if (newStage > gameState.current.currentStage) {
            gameState.current.currentStage = newStage;
            gameState.current.speedMultiplier += 0.15;
            gameState.current.difficultyMultiplier += 0.1;
            setHudStage(newStage + 1);
            setIsSpeedAlert(true);
            setTimeout(() => setIsSpeedAlert(false), 2000);
            gameState.current.celebrationTimer = 100;
        }

        const hardModeMultiplier = isHardMode ? 1.5 : 1.0;
        const baseSpeed = 0.4 * dt; 
        const currentSpeed = (baseSpeed + (playerState.level * 0.01)) * gameState.current.speedMultiplier * hardModeMultiplier;
        gameState.current.totalDistance += currentSpeed;

        const bgIdx = Math.min(gameState.current.currentStage, BG_COLORS.length - 1);
        canvas.style.background = BG_COLORS[bgIdx];
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Clouds & Hills
        ctx.save(); ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        clouds.current.forEach(c => {
            c.x -= c.speed * (dt / 16);
            if(c.x < -100) { c.x = canvas.width + 100; c.y = Math.random() * (canvas.height/2); }
            ctx.beginPath(); ctx.arc(c.x, c.y, 30*c.size, 0, Math.PI*2); ctx.arc(c.x+25*c.size, c.y-10*c.size, 35*c.size, 0, Math.PI*2); ctx.fill();
        });
        ctx.restore();

        const groundY = canvas.height - 100;
        ctx.save(); 
        hills.current.forEach((hill, i) => {
            hill.x -= currentSpeed * 0.3;
            if(hill.x < -200) { hill.x = canvas.width; hill.h = 50 + Math.random()*100; }
            ctx.fillStyle = hill.c; ctx.beginPath(); ctx.moveTo(hill.x, groundY); ctx.quadraticCurveTo(hill.x + 100, groundY - hill.h, hill.x + 200, groundY); ctx.fill();
        });
        ctx.fillStyle = "#81c784"; ctx.fillRect(0, groundY-10, canvas.width, 10);
        ctx.restore();

        // Physics
        // Higher gravity (0.08) for snappier, faster jumps (1.1x speed feel)
        const gravity = 0.08 * dt; 
        ginger.current.dy += gravity; 
        ginger.current.y += ginger.current.dy * (dt / 16); 
        
        const charGroundY = groundY - 25;
        let onGround = false;
        
        // OPTIMIZED COLLISION LOOP: Removed filter() to prevent garbage collection
        let hole = null;
        for (let i = 0; i < objects.current.length; i++) {
            const o = objects.current[i];
            if (o.type === 'hole' && ginger.current.x > o.x && ginger.current.x < o.x + (o.w || 200)) {
                hole = o;
                break; 
            }
        }
        
        let fell = false;
        if (ginger.current.y > charGroundY) {
            if (hole) { onGround = false; } 
            else { 
                ginger.current.y = charGroundY; 
                ginger.current.dy = 0; 
                onGround = true; 
                ginger.current.jumpCount = 0; 
                
                // Buffered Slide Logic: If holding down when landing, start sliding immediately
                if (slidePressed.current) {
                    gameState.current.isSliding = true;
                }
            }
        }
        ginger.current.grounded = onGround;
        if(ginger.current.y > canvas.height + 50) fell = true;

        // Ground
        const grassPatternWidth = 40;
        const offset = -(gameState.current.totalDistance % grassPatternWidth);
        ctx.fillStyle = "#5d4037"; ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);
        ctx.fillStyle = "#4caf50"; ctx.fillRect(0, groundY, canvas.width, 20);
        ctx.fillStyle = "#388e3c";
        for(let i=offset; i<canvas.width; i+=grassPatternWidth) { ctx.beginPath(); ctx.moveTo(i, groundY); ctx.lineTo(i+20, groundY+20); ctx.lineTo(i, groundY+20); ctx.fill(); }

        // Render Holes (Optimized: No new array creation)
        for (let i = 0; i < objects.current.length; i++) {
             const o = objects.current[i];
             if (o.type === 'hole') {
                 ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = "black"; ctx.fillRect(o.x + 10, groundY, (o.w || 200) - 20, canvas.height); ctx.restore();
                 ctx.fillStyle = "#3e2723"; ctx.fillRect(o.x, groundY + 20, 10, 100); ctx.fillRect(o.x + (o.w||200) - 10, groundY + 20, 10, 100);
             }
        }

        // Spawning
        if(gameState.current.totalDistance >= gameState.current.nextObstacleDist) {
            const possibleTypes: GameObject['type'][] = ['cactus', 'rock', 'barrier', 'mushroom', 'hole', 'bird', 'ghost', 'bee'];
            const objType = possibleTypes[Math.floor(Math.random() * possibleTypes.length)];
            let yPos = groundY; let width = 50; let height = 50; let variation = 1; let initialY = 0;

            if (['bird', 'ghost', 'bee'].includes(objType)) {
                const heightTier = Math.random();
                let tierOffset = 100; if (heightTier > 0.66) tierOffset = 400; else if (heightTier > 0.33) tierOffset = 250; 
                yPos = groundY - tierOffset; height = 90; width = 90; initialY = yPos;
            } else {
                if (objType === 'hole') { variation = Math.ceil(Math.random() * 3); width = 150 + variation * 50; } 
                else {
                    if (objType === 'rock' || objType === 'barrier') { height = 68; width = 68; yPos = groundY - height + 10; } 
                    else if (objType === 'cactus' || objType === 'mushroom') { height = 120; width = 100; yPos = groundY - height + 10; }
                }
            }
            objects.current.push({ type: objType, x: canvas.width, y: yPos, w: width, h: height, variation, initialY });
            const hardModeFreq = isHardMode ? 1.5 : 1.0;
            gameState.current.nextObstacleDist = gameState.current.totalDistance + ((650 + Math.random() * 450) / gameState.current.difficultyMultiplier) / hardModeFreq;
        }

        if(gameState.current.totalDistance >= gameState.current.nextCandyDist) {
             const cy = groundY - (Math.random() * 200 + 60);
             if(!objects.current.some(o => Math.abs(o.x - canvas.width) < 150)) {
                objects.current.push({ type: 'candy', x: canvas.width, y: cy, r: 25, candyIdx: playerState.currentCandySkin });
                gameState.current.nextCandyDist = gameState.current.totalDistance + (400 + Math.random() * 200);
             } else { gameState.current.nextCandyDist = gameState.current.totalDistance + 100; }
        }

        let collision = false; if (fell) collision = true;

        for(let i = 0; i < objects.current.length; i++) {
            let o = objects.current[i];
            o.x -= currentSpeed;
            if(o.type === 'bird') o.x -= Math.sin(gameState.current.playTimeMs * 0.005) * 1.5;
            else if(o.type === 'ghost') o.y = (o.initialY || 0) + Math.sin(gameState.current.playTimeMs * 0.003) * 30;
            else if(o.type === 'bee') o.y = (o.initialY || 0) + Math.sin(gameState.current.playTimeMs * 0.01) * 5;

            if(o.type === 'candy') {
                drawCandySimple(ctx, o.x, o.y, o.r || 20, o.candyIdx || 0);
                if(Math.hypot(ginger.current.x - o.x, (ginger.current.y - 30) - o.y) < 60) {
                    const pts = 1 * playerState.level; 
                    gameState.current.score += pts;
                    setHudScore(gameState.current.score);
                    onAddScore(pts);
                    particles.current.push({ x: o.x, y: o.y, type: 'score', text: `+${pts}`, life: 50, dy: -1 });
                    
                    // SFX: Candy
                    audioManager.playCandySfx();

                    objects.current.splice(i, 1); i--; continue;
                }
            } else if (o.type !== 'hole') {
                drawObstacle(ctx, o);
                const isSliding = gameState.current.isSliding;
                const pX = ginger.current.x; const pY = ginger.current.y - (isSliding ? 15 : 25); const pW = 14; const pH = isSliding ? 20 : 35; 
                const oCenterX = o.x + (o.w||40)/2; const oCenterY = o.y + (o.h||40)/2;
                const hitX = Math.abs(pX - oCenterX) < ((o.w||40)/2 + pW - 10);
                const hitY = Math.abs(pY - oCenterY) < ((o.h||40)/2 + pH - 10);
                if(hitX && hitY) collision = true;
            }
            if(o.x < -300) { objects.current.splice(i, 1); i--; }
        }

        let expression = 'normal'; if(gameState.current.celebrationTimer > 0) { expression = 'happy'; gameState.current.celebrationTimer--; } if(collision) expression = 'cry';
        drawCharacter(ctx, ginger.current.x, ginger.current.y, playerState.currentSkin, playerState.equipped, gameState.current.playTimeMs, gameState.current.isSliding, expression, ginger.current.dy, ginger.current.grounded);

        for(let i=0; i<particles.current.length; i++) {
            let p = particles.current[i]; p.life--; p.y += (p.dy || 0);
            if(p.type === 'score' && p.text) { ctx.shadowColor = "black"; ctx.shadowBlur = 4; ctx.font = "bold 32px Pretendard"; ctx.fillStyle = `rgba(255, 215, 0, ${p.life/50})`; ctx.fillText(p.text, p.x, p.y); ctx.shadowBlur = 0; } 
            else if (p.type === 'impact') { ctx.fillStyle = `rgba(255, 255, 255, ${p.life/20})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.size || 2, 0, Math.PI*2); ctx.fill(); }
            if(p.life <= 0) { particles.current.splice(i, 1); i--; }
        }

        if (collision) { 
            gameState.current.playing = false; 
            // SFX: Stop BGM, Play Fail
            audioManager.stopBgm();
            audioManager.playGameOverSfx();
            onGameOver(gameState.current.score, Math.floor(gameState.current.playTimeMs/1000), fell); 
        } 
        else { animationId = requestAnimationFrame(loop); }
    };

    animationId = requestAnimationFrame(loop);

    const handleKeyDown = (e: KeyboardEvent) => { 
        if(e.code === 'Space' || e.code === 'ArrowUp') { 
            e.preventDefault(); 
            // Only jump if not already pressing (enforce release)
            if (!jumpPressed.current) {
                jumpPressed.current = true;
                jumpAction(); 
            }
        } 
        if(e.code === 'ArrowDown') { e.preventDefault(); slideStart(); } 
    };
    
    const handleKeyUp = (e: KeyboardEvent) => { 
        if(e.code === 'Space' || e.code === 'ArrowUp') {
            jumpPressed.current = false;
        }
        if(e.code === 'ArrowDown') { slideEnd(); } 
    }
    
    window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp);

    return () => { 
        window.removeEventListener('resize', resize); 
        window.removeEventListener('keydown', handleKeyDown); 
        window.removeEventListener('keyup', handleKeyUp); 
        cancelAnimationFrame(animationId); 
    };
  }, [jumpAction, slideStart, slideEnd, config, onGameOver, onAddScore, playerState.level, playerState.currentSkin, playerState.currentCandySkin, playerState.equipped, isPaused, isHardMode]);

  return (
    <div ref={containerRef} className="relative w-full h-full">
        <canvas ref={canvasRef} className="block w-full h-full" />
        {/* HUD Elements */}
        <div className="absolute top-0 left-0 w-full p-4 flex flex-row justify-between items-center pointer-events-none z-10 gap-2">
            <div className="flex flex-row gap-2 items-center overflow-x-auto no-scrollbar">
                <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-2xl flex items-center gap-3 border-2 border-white/20 text-white font-bold text-lg shadow-lg shrink-0">
                    <i className="fa-solid fa-user text-yellow-300"></i> <span className="max-w-[100px] truncate">{playerState.name}</span>
                </div>
                <div className="bg-black/40 backdrop-blur-md px-3 py-2 rounded-2xl flex items-center justify-center gap-2 border-2 border-white/20 text-white font-bold text-lg shadow-lg shrink-0">
                    <i className="fa-solid fa-cookie text-amber-500 text-xl"></i> <span>{playerState.wallet}</span>
                </div>
            </div>
            <div className="flex gap-2 shrink-0">
                <div className="bg-black/40 backdrop-blur-md h-12 px-3 rounded-2xl flex items-center justify-center gap-2 border-2 border-white/20 text-white font-bold text-lg shadow-lg"><i className="fa-solid fa-flag text-green-300"></i> <span>{hudStage}</span></div>
                <div className="bg-black/40 backdrop-blur-md h-12 px-3 rounded-2xl flex items-center justify-center gap-2 border-2 border-white/20 text-white font-bold text-lg shadow-lg"><i className="fa-solid fa-clock text-blue-300"></i> <span>{hudTime}</span></div>
                <div className="bg-black/40 backdrop-blur-md h-12 px-3 rounded-2xl flex items-center justify-center gap-2 border-2 border-white/20 text-white font-bold text-xl shadow-lg"><span className="text-2xl">🍬</span> <span>{hudScore}</span></div>
            </div>
        </div>
        <div className={`absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl md:text-7xl font-black text-yellow-300 italic transition-all duration-300 pointer-events-none z-50 ${isSpeedAlert ? 'opacity-100 scale-125' : 'opacity-0 scale-75'}`} style={{textShadow: '0 0 20px #ff6f00, 4px 4px 0 #bf360c'}}>⚡ 스피드 업!</div>
        {/* Controls */}
        <div className="absolute bottom-6 right-6 z-20">
            {/* Added touch-none class and simplified handlers to prevent zoom/delay/double-tap issues */}
            <button className="w-24 h-24 md:w-32 md:h-32 bg-white/20 border-4 border-white/60 rounded-full flex items-center justify-center text-white text-3xl backdrop-blur-md shadow-2xl active:scale-95 active:bg-white/40 transition-transform touch-none" 
                onTouchStart={handleJumpStart} 
                onTouchEnd={handleJumpEnd}
                onMouseDown={handleJumpStart} 
                onMouseUp={handleJumpEnd}
                onMouseLeave={handleJumpEnd}>
                <i className="fa-solid fa-arrow-up text-4xl md:text-5xl drop-shadow-md"></i>
            </button>
        </div>
        <div className="absolute bottom-6 left-6 z-20">
            <button className="w-20 h-20 md:w-24 md:h-24 bg-white/20 border-4 border-white/60 rounded-full flex items-center justify-center text-white text-2xl backdrop-blur-md shadow-2xl active:scale-95 active:bg-white/40 transition-transform touch-none" 
                onTouchStart={handleSlideStartInput} 
                onTouchEnd={handleSlideEndInput} 
                onMouseDown={handleSlideStartInput} 
                onMouseUp={handleSlideEndInput} 
                onMouseLeave={handleSlideEndInput}>
                <i className="fa-solid fa-arrow-down text-3xl md:text-4xl drop-shadow-md"></i>
            </button>
        </div>
    </div>
  );
};

export default GameCanvas;