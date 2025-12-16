import CryptoJS from 'crypto-js';
import { GameConfig, PlayerState } from './types';
import { SECRET_PASSPHRASE, STORAGE_KEY, CANDY_TYPES, CANDY_COLORS } from './constants';

// --- Audio Manager ---
class AudioManager {
  private ctx: AudioContext | null = null;
  private bgmOscillators: AudioScheduledSourceNode[] = [];
  private isBgmPlaying: boolean = false;
  private nextNoteTime: number = 0;
  private timerID: number | undefined;
  
  // Extended Melody: 20s Variation in C Major
  private melody = [
    // Part A: Intro Arpeggios (C Major)
    { freq: 261.63, len: 0.2 }, { freq: 329.63, len: 0.2 }, { freq: 392.00, len: 0.2 }, { freq: 523.25, len: 0.2 }, // C-E-G-C
    { freq: 392.00, len: 0.2 }, { freq: 523.25, len: 0.2 }, { freq: 659.25, len: 0.4 }, // G-C-E (hold)
    { freq: 261.63, len: 0.2 }, { freq: 329.63, len: 0.2 }, { freq: 392.00, len: 0.2 }, { freq: 261.63, len: 0.2 }, // C-E-G-C
    { freq: 293.66, len: 0.2 }, { freq: 349.23, len: 0.2 }, { freq: 392.00, len: 0.4 }, // D-F-G (hold)

    // Part B: Running Theme (A Minor / F Major feel)
    { freq: 440.00, len: 0.2 }, { freq: 523.25, len: 0.2 }, { freq: 440.00, len: 0.2 }, { freq: 349.23, len: 0.2 }, // A-C-A-F
    { freq: 329.63, len: 0.2 }, { freq: 261.63, len: 0.2 }, { freq: 196.00, len: 0.4 }, // E-C-G3 (hold)
    { freq: 349.23, len: 0.2 }, { freq: 440.00, len: 0.2 }, { freq: 523.25, len: 0.2 }, { freq: 587.33, len: 0.2 }, // F-A-C-D
    { freq: 659.25, len: 0.2 }, { freq: 523.25, len: 0.2 }, { freq: 392.00, len: 0.4 }, // E-C-G (hold)

    // Part C: High Energy Scales
    { freq: 523.25, len: 0.15 }, { freq: 587.33, len: 0.15 }, { freq: 659.25, len: 0.15 }, { freq: 698.46, len: 0.15 }, // C-D-E-F (fast)
    { freq: 783.99, len: 0.15 }, { freq: 698.46, len: 0.15 }, { freq: 659.25, len: 0.15 }, { freq: 587.33, len: 0.15 }, // G-F-E-D (fast)
    { freq: 523.25, len: 0.2 }, { freq: 392.00, len: 0.2 }, { freq: 329.63, len: 0.2 }, { freq: 261.63, len: 0.2 }, // C-G-E-C
    
    // Turnaround
    { freq: 293.66, len: 0.2 }, { freq: 392.00, len: 0.2 }, { freq: 493.88, len: 0.2 }, { freq: 587.33, len: 0.2 }, // D-G-B-D
    { freq: 523.25, len: 0.4 }, { freq: 0, len: 0.2 } // C (End)
  ];
  private currentNoteIndex = 0;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    // Attempt to resume if suspended (browser autoplay policy)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  // Public method to force resume (bind to user interaction)
  resume() {
    this.init();
  }

  playBgm() {
    this.init();
    if (this.isBgmPlaying || !this.ctx) return;
    
    this.isBgmPlaying = true;
    this.currentNoteIndex = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.scheduler();
  }

  stopBgm() {
    this.isBgmPlaying = false;
    if (this.timerID) window.clearTimeout(this.timerID);
    this.bgmOscillators.forEach(osc => {
        try { osc.stop(); osc.disconnect(); } catch(e) {}
    });
    this.bgmOscillators = [];
  }

  private scheduler() {
    if (!this.isBgmPlaying || !this.ctx) return;
    
    // Schedule notes ahead (lookahead 0.1s)
    while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
        this.scheduleNote(this.melody[this.currentNoteIndex], this.nextNoteTime);
        this.nextNoteTime += this.melody[this.currentNoteIndex].len;
        this.currentNoteIndex = (this.currentNoteIndex + 1) % this.melody.length;
    }
    this.timerID = window.setTimeout(() => this.scheduler(), 25);
  }

  private scheduleNote(note: {freq: number, len: number}, time: number) {
      if (!this.ctx) return;
      if (note.freq === 0) return; // Rest

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle'; // Smooth upbeat sound
      osc.frequency.value = note.freq;
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      // Envelope to make it sound plucky yet continuous
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.08, time + 0.02); // Attack
      gain.gain.exponentialRampToValueAtTime(0.01, time + note.len - 0.02); // Decay

      osc.start(time);
      osc.stop(time + note.len);
      
      this.bgmOscillators.push(osc);
      if (this.bgmOscillators.length > 50) this.bgmOscillators.shift();
  }

  playClickSfx() {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.05);
      
      gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
  }

  playCandySfx() {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, this.ctx.currentTime); 
      osc.frequency.exponentialRampToValueAtTime(1760, this.ctx.currentTime + 0.1); 
      
      gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
  }

  playUpgradeSfx() {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
          const osc = this.ctx!.createOscillator();
          const gain = this.ctx!.createGain();
          osc.type = 'triangle';
          osc.frequency.value = freq;
          
          gain.gain.setValueAtTime(0.1, now + i*0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i*0.08 + 0.2);
          
          osc.connect(gain);
          gain.connect(this.ctx!.destination);
          osc.start(now + i*0.08);
          osc.stop(now + i*0.08 + 0.2);
      });
  }

  playGachaSfx() {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const notes = [
          {f: 523.25, t: 0, d: 0.1}, {f: 523.25, t: 0.1, d: 0.1}, {f: 523.25, t: 0.2, d: 0.1}, // Triplet C
          {f: 783.99, t: 0.3, d: 0.3}, // Long G
          {f: 1046.50, t: 0.6, d: 0.6} // Long High C
      ];

      notes.forEach(n => {
          const osc = this.ctx!.createOscillator();
          const gain = this.ctx!.createGain();
          osc.type = 'square'; 
          osc.frequency.value = n.f;
          
          gain.gain.setValueAtTime(0.1, now + n.t);
          gain.gain.linearRampToValueAtTime(0.08, now + n.t + 0.05); 
          gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.d); 
          
          osc.connect(gain);
          gain.connect(this.ctx!.destination);
          osc.start(now + n.t);
          osc.stop(now + n.t + n.d);
      });
  }

  playGameOverSfx() {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'square'; 
      osc.frequency.setValueAtTime(300, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.15);
      
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.15);
  }
}

export const audioManager = new AudioManager();

export const encryptConfig = (config: any): string => {
  return CryptoJS.AES.encrypt(JSON.stringify(config), SECRET_PASSPHRASE).toString();
};

export const decryptConfig = (cipherText: string): any => {
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, SECRET_PASSPHRASE);
    const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(decryptedStr);
  } catch (e) {
    console.error("Decryption failed", e);
    return null;
  }
};

export const savePlayerData = (state: PlayerState) => {
  if (state.mode === 'test') return;
  const dataToSave = {
    level: state.level,
    unlockedSkins: state.unlockedSkins,
    currentSkin: state.currentSkin,
    currentCandySkin: state.currentCandySkin,
    wallet: state.wallet,
    totalCandies: state.totalCandies,
    inventory: state.inventory,
    equipped: state.equipped,
    records: state.records,
    dailyPlayCount: state.dailyPlayCount,
    dailyShopCount: state.dailyShopCount,
    lastGamingDate: state.lastGamingDate
  };
  localStorage.setItem(`${STORAGE_KEY}_${state.code}`, JSON.stringify(dataToSave));
};

export const loadPlayerData = (code: string): Partial<PlayerState> | null => {
  const saved = localStorage.getItem(`${STORAGE_KEY}_${code}`);
  if (saved) {
    return JSON.parse(saved);
  }
  return null;
};

export const getGamingDate = (): string => {
  const now = new Date();
  if (now.getHours() < 8) {
      now.setDate(now.getDate() - 1);
  }
  return now.toLocaleDateString();
};

export const getRandomColor = () => {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) color += letters[Math.floor(Math.random() * 16)];
    return color;
};

// --- Character Drawing Logic (Reuse) ---
export const drawCharacter = (
    ctx: CanvasRenderingContext2D, 
    x: number, 
    y: number, 
    skinColor: string, 
    equipped: PlayerState['equipped'], 
    animTick: number, 
    isSliding: boolean, 
    expression: string, 
    dy: number, 
    grounded: boolean
) => {
    ctx.save(); 
    ctx.translate(x, y);
    ctx.scale(1.4, 1.4); // 1.4x scale

    if (isSliding) {
        ctx.rotate(-Math.PI / 2); 
        ctx.translate(-20, 10); 
    } else {
        let rotation = 0;
        if (!grounded) {
            rotation = Math.min(0.2, dy * 0.02);
        }
        ctx.rotate(rotation);
    }

    const grad = ctx.createLinearGradient(-10, -20, 10, 20);
    grad.addColorStop(0, skinColor);
    grad.addColorStop(1, '#8d6e63'); 

    ctx.fillStyle = grad; 
    ctx.strokeStyle = "#5d4037"; 
    ctx.lineWidth = 2.5;
    
    const runAnim = Math.sin(animTick / 60) * 12; 
    const isJumping = !grounded && !isSliding;

    // Legs
    const drawLeg = (angle: number) => {
        ctx.save();
        ctx.translate(0, 12); 
        ctx.rotate(angle * (Math.PI / 180));
        ctx.beginPath();
        ctx.roundRect(-4, 0, 8, 18, 4);
        ctx.fill(); ctx.stroke();

        if (equipped.shoes) {
            if (equipped.shoes === 'boots') {
                ctx.fillStyle = "#3e2723"; ctx.fillRect(-5, 8, 10, 10);
            } else if (equipped.shoes === 'sneakers') {
                ctx.fillStyle = "#fff"; ctx.fillRect(-4, 10, 8, 8);
                ctx.fillStyle = "#f44336"; ctx.fillRect(-4, 12, 8, 2);
            } else if (equipped.shoes === 'slippers') {
                ctx.fillStyle = "#ec407a"; ctx.fillRect(-4, 14, 8, 4);
            } else if (equipped.shoes === 'heels') {
                ctx.fillStyle = "#e91e63"; ctx.fillRect(-4, 12, 8, 6); ctx.fillRect(0, 18, 2, 4);
            } else if (equipped.shoes === 'sandals') {
                ctx.fillStyle = "#8d6e63"; ctx.fillRect(-4, 16, 8, 2); ctx.fillRect(-2, 10, 4, 6);
            } else if (equipped.shoes === 'skates') {
                ctx.fillStyle = "white"; ctx.fillRect(-5, 10, 10, 8); ctx.fillStyle="gray"; ctx.fillRect(-5, 18, 10, 2);
            }
        } else {
            ctx.strokeStyle = "white"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(-3, 14); ctx.lineTo(3, 14); ctx.stroke();
        }
        ctx.restore();
    };

    if (isJumping) {
        drawLeg(30); drawLeg(-20); 
    } else {
        if (isSliding) { 
            // Sliding legs
            drawLeg(10); 
        }
        else { drawLeg(runAnim * 3); drawLeg(-runAnim * 3); }
    }

    // Body
    ctx.fillStyle = grad; 
    ctx.strokeStyle = "#5d4037"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(-8, -15, 16, 30, 8); ctx.fill(); ctx.stroke();

    // Clothes
    if (equipped.clothes) {
        if (equipped.clothes === 'overalls') {
            ctx.fillStyle = "#1976d2";
            ctx.fillRect(-8, -5, 16, 20);
            ctx.fillStyle = "#1565c0"; ctx.fillRect(-6, -10, 4, 10); ctx.fillRect(2, -10, 4, 10);
        } else if (equipped.clothes === 'suit') {
            ctx.fillStyle = "#212121"; ctx.fillRect(-8, -15, 16, 30);
            ctx.fillStyle = "white"; ctx.beginPath(); ctx.moveTo(-2, -15); ctx.lineTo(0, -5); ctx.lineTo(2, -15); ctx.fill();
            ctx.fillStyle = "red"; ctx.fillRect(-1, -10, 2, 5);
        } else if (equipped.clothes === 'dress') {
            ctx.fillStyle = "#e91e63"; ctx.beginPath(); ctx.moveTo(-8, -15); ctx.lineTo(8, -15); ctx.lineTo(12, 15); ctx.lineTo(-12, 15); ctx.fill();
        } else if (equipped.clothes === 'hoodie') {
            ctx.fillStyle = "#757575"; ctx.fillRect(-9, -15, 18, 25); ctx.fillStyle="#bdbdbd"; ctx.fillRect(-6, -5, 12, 10);
        } else if (equipped.clothes === 'tuxedo') {
            ctx.fillStyle = "black"; ctx.fillRect(-8, -15, 16, 30); ctx.fillStyle="white"; ctx.fillRect(-3, -15, 6, 20); ctx.fillStyle="black"; ctx.fillRect(-2, -12, 4, 2);
        } else if (equipped.clothes === 'raincoat') {
            ctx.fillStyle = "#ffeb3b"; ctx.beginPath(); ctx.moveTo(-8, -15); ctx.lineTo(8, -15); ctx.lineTo(10, 15); ctx.lineTo(-10, 15); ctx.fill();
        }
    }

    // Arm (One arm only for side view)
    function drawArm(angle: number) {
        ctx.save();
        ctx.translate(0, -8); 
        ctx.rotate(angle * (Math.PI / 180));
        ctx.fillStyle = grad; 
        
        ctx.beginPath();
        ctx.roundRect(-3.5, 0, 7, 18, 3.5);
        ctx.fill(); ctx.stroke();

        // Weapon Handling
        if (equipped.weapon) {
            ctx.save();
            ctx.translate(0, 15); // Move to hand
            
            // Fix: Rotate weapon again (user requested 90 degrees turn from previous -90)
            // Setting to 0 aligns with arm (baton style). 
            // Setting to Math.PI/2 would point backwards.
            // Removing the rotation makes it parallel to arm which is often more natural for 'running' animations 
            // unless it's a gun. Since it's sword/wand, holding it parallel (0 deg) or slightly up is standard.
            // I will remove the previous rotation to make it align with the arm.
            
            if (equipped.weapon === 'sword') {
                 ctx.fillStyle = "#cfd8dc"; ctx.fillRect(0, -2, 35, 4); 
                 ctx.fillStyle = "#5d4037"; ctx.fillRect(-5, -2, 5, 4); 
                 ctx.fillStyle = "#ffeb3b"; ctx.fillRect(0, -6, 4, 12); 
            } else if (equipped.weapon === 'wand') {
                ctx.strokeStyle = "#8d6e63"; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(30,0); ctx.stroke();
                ctx.fillStyle = "#4fc3f7"; ctx.beginPath(); ctx.arc(30, 0, 6, 0, Math.PI*2); ctx.fill();
            } else if (equipped.weapon === 'lollipop') {
                ctx.strokeStyle = "white"; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(25,0); ctx.stroke();
                ctx.fillStyle = "#f44336"; ctx.beginPath(); ctx.arc(28, 0, 8, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = "white"; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(28, 0, 5, 0, Math.PI*2); ctx.stroke();
            } else if (equipped.weapon === 'hammer') {
                ctx.fillStyle = "#5d4037"; ctx.fillRect(0, -2, 20, 4); 
                ctx.fillStyle = "red"; ctx.fillRect(20, -10, 12, 20); 
            } else if (equipped.weapon === 'bow') {
                ctx.strokeStyle = "#8d6e63"; ctx.lineWidth=2; 
                ctx.beginPath(); ctx.arc(10, 0, 15, -Math.PI/2, Math.PI/2); ctx.stroke(); 
                ctx.beginPath(); ctx.moveTo(10, -15); ctx.lineTo(10, 15); ctx.stroke();
            } else if (equipped.weapon === 'shield') {
                ctx.rotate(Math.PI/2); 
                ctx.fillStyle = "#8d6e63"; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI*2); ctx.fill(); 
                ctx.fillStyle = "silver"; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.fill();
            }
            ctx.restore();
        }
        
        // Sleeve edge if no clothes
        if (!equipped.clothes) { ctx.strokeStyle = "white"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-2, 14); ctx.lineTo(2, 14); ctx.stroke(); }
        ctx.restore();
    }

    if (isJumping) {
        drawArm(-130); 
    } else {
        if (isSliding) { drawArm(160); }
        else { drawArm(runAnim * 3); }
    }

    // Head
    ctx.fillStyle = grad; 
    ctx.strokeStyle = "#5d4037"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(2, -26, 14, 0, Math.PI*2); ctx.fill(); ctx.stroke();

    // Face
    ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(2, -26, 11, Math.PI, 1.5 * Math.PI); ctx.stroke();

    if (expression === 'cry') {
        ctx.fillStyle = "#3e2723"; ctx.font = "10px Arial"; ctx.fillText("T_T", 4, -24);
    } else {
        ctx.fillStyle = "#3e2723";
        ctx.beginPath(); ctx.arc(8, -28, 2, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = "#3e2723"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(8, -23, 3, 0.2, Math.PI/2); ctx.stroke();
        if(expression === 'happy') {
             ctx.fillStyle = "#e91e63"; ctx.globalAlpha = 0.5;
             ctx.beginPath(); ctx.arc(6, -23, 3, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1.0;
        }
    }

    // Hat
    if (equipped.hat) {
        if (equipped.hat === 'cap') {
            ctx.fillStyle = "#1e88e5"; ctx.beginPath(); ctx.arc(2, -30, 14, Math.PI, 0); ctx.fill(); ctx.fillRect(2, -30, 16, 4);
        } else if (equipped.hat === 'crown') {
            ctx.fillStyle = "#ffca28"; ctx.beginPath(); ctx.moveTo(-10, -35); ctx.lineTo(-10, -45); ctx.lineTo(-5, -40); ctx.lineTo(2, -48); ctx.lineTo(9, -40); ctx.lineTo(14, -45); ctx.lineTo(14, -35); ctx.fill();
        } else if (equipped.hat === 'tophat') {
            ctx.fillStyle = "#212121"; ctx.fillRect(-10, -38, 24, 4); ctx.fillRect(-6, -55, 16, 17);
        } else if (equipped.hat === 'helmet') {
             ctx.fillStyle = "#ffeb3b"; ctx.beginPath(); ctx.arc(2, -32, 15, Math.PI, 0); ctx.fill(); ctx.fillRect(-13, -32, 26, 4);
        } else if (equipped.hat === 'beret') {
             ctx.fillStyle = "#d32f2f"; ctx.beginPath(); ctx.ellipse(2, -35, 16, 10, 0.2, 0, Math.PI*2); ctx.fill(); ctx.fillRect(0,-45, 2, 6);
        } else if (equipped.hat === 'partyhat') {
             ctx.fillStyle = "#ab47bc"; ctx.beginPath(); ctx.moveTo(-8, -32); ctx.lineTo(12, -32); ctx.lineTo(2, -55); ctx.fill();
        }
    }
    ctx.restore();
};

// 3D Candy Drawer
export const drawCandySimple = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, candyIdx: number) => {
    ctx.save(); ctx.translate(x, y);

    const typeIdx = Math.floor(candyIdx / 5);
    const colorIdx = candyIdx % 5;
    const color = CANDY_COLORS[colorIdx] || CANDY_COLORS[0];
    const type = CANDY_TYPES[typeIdx] || 'basic';

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath(); ctx.ellipse(2, 2, r, r*0.8, 0, 0, Math.PI*2); ctx.fill();

    // Base Gradient
    const grad = ctx.createRadialGradient(-r/3, -r/3, r/4, 0, 0, r);
    grad.addColorStop(0, "white");
    grad.addColorStop(0.3, color);
    grad.addColorStop(1, adjustColor(color, -40));

    if (type === 'basic') {
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
        // Highlight
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.beginPath(); ctx.ellipse(-r/3, -r/3, r/3, r/5, -Math.PI/4, 0, Math.PI*2); ctx.fill();
    } 
    else if (type === 'striped') {
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
        ctx.clip();
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        for(let i=-r; i<r; i+=8) {
            ctx.fillRect(i, -r, 4, r*2);
        }
    }
    else if (type === 'lollipop') {
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
        // Swirl
        ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 3;
        ctx.beginPath();
        for(let i=0; i<10; i++) {
            ctx.arc(0, 0, i*2, 0 + i*0.5, Math.PI + i*0.5);
        }
        ctx.stroke();
    }
    else if (type === 'wrapped') {
        // Wrapper Wings
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(-r-8, -8); ctx.lineTo(-r-8, 8); ctx.fill();
        ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(r+8, -8); ctx.lineTo(r+8, 8); ctx.fill();
        
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.roundRect(-r, -r*0.7, r*2, r*1.4, 5); ctx.fill();
        // Stripes on wrapper
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.fillRect(-5, -r*0.7, 10, r*1.4);
    }

    ctx.restore();
};

const adjustColor = (color: string, amount: number) => {
    return color; 
}