
import CryptoJS from 'crypto-js';
import { GameConfig, PlayerState } from './types';
import { SECRET_PASSPHRASE, STORAGE_KEY, CANDY_TYPES, CANDY_COLORS } from './constants';

// --- Utility Functions ---
export const darkenColor = (hex: string, percent: number): string => {
    // Basic hex darkening
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);

    r = Math.floor(r * (1 - percent / 100));
    g = Math.floor(g * (1 - percent / 100));
    b = Math.floor(b * (1 - percent / 100));

    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

// --- Audio Manager ---
class AudioManager {
  private ctx: AudioContext | null = null;
  private bgmOscillators: AudioScheduledSourceNode[] = [];
  private isBgmPlaying: boolean = false;
  private nextNoteTime: number = 0;
  private timerID: number | undefined;
  
  private melodyNormal = [
    { freq: 261.63, len: 0.2 }, { freq: 329.63, len: 0.2 }, { freq: 392.00, len: 0.2 }, { freq: 523.25, len: 0.2 },
    { freq: 392.00, len: 0.2 }, { freq: 523.25, len: 0.2 }, { freq: 659.25, len: 0.4 },
    { freq: 261.63, len: 0.2 }, { freq: 329.63, len: 0.2 }, { freq: 392.00, len: 0.2 }, { freq: 261.63, len: 0.2 },
    { freq: 293.66, len: 0.2 }, { freq: 349.23, len: 0.2 }, { freq: 392.00, len: 0.4 },
    { freq: 440.00, len: 0.2 }, { freq: 523.25, len: 0.2 }, { freq: 440.00, len: 0.2 }, { freq: 349.23, len: 0.2 },
    { freq: 329.63, len: 0.2 }, { freq: 261.63, len: 0.2 }, { freq: 196.00, len: 0.4 },
    { freq: 349.23, len: 0.2 }, { freq: 440.00, len: 0.2 }, { freq: 523.25, len: 0.2 }, { freq: 587.33, len: 0.2 },
    { freq: 659.25, len: 0.2 }, { freq: 523.25, len: 0.2 }, { freq: 392.00, len: 0.4 },
    { freq: 523.25, len: 0.15 }, { freq: 587.33, len: 0.15 }, { freq: 659.25, len: 0.15 }, { freq: 698.46, len: 0.15 },
    { freq: 783.99, len: 0.15 }, { freq: 698.46, len: 0.15 }, { freq: 659.25, len: 0.15 }, { freq: 587.33, len: 0.15 },
    { freq: 523.25, len: 0.2 }, { freq: 392.00, len: 0.2 }, { freq: 329.63, len: 0.2 }, { freq: 261.63, len: 0.2 },
    { freq: 293.66, len: 0.2 }, { freq: 392.00, len: 0.2 }, { freq: 493.88, len: 0.2 }, { freq: 587.33, len: 0.2 },
    { freq: 523.25, len: 0.4 }, { freq: 0, len: 0.2 }
  ];

  private melodyHard = [
    { freq: 440.00, len: 0.1 }, { freq: 0, len: 0.05 }, { freq: 440.00, len: 0.1 }, { freq: 523.25, len: 0.1 },
    { freq: 659.25, len: 0.1 }, { freq: 523.25, len: 0.1 }, { freq: 440.00, len: 0.1 }, { freq: 349.23, len: 0.1 },
    { freq: 329.63, len: 0.1 }, { freq: 440.00, len: 0.1 }, { freq: 523.25, len: 0.1 }, { freq: 659.25, len: 0.1 },
    { freq: 880.00, len: 0.2 }, { freq: 659.25, len: 0.2 },
    { freq: 440.00, len: 0.1 }, { freq: 0, len: 0.05 }, { freq: 440.00, len: 0.1 }, { freq: 523.25, len: 0.1 },
    { freq: 659.25, len: 0.1 }, { freq: 523.25, len: 0.1 }, { freq: 440.00, len: 0.1 }, { freq: 349.23, len: 0.1 },
    { freq: 493.88, len: 0.1 }, { freq: 587.33, len: 0.1 }, { freq: 698.46, len: 0.1 }, { freq: 830.61, len: 0.1 },
    { freq: 880.00, len: 0.2 }, { freq: 0, len: 0.1 },
    { freq: 523.25, len: 0.1 }, { freq: 554.37, len: 0.1 }, { freq: 587.33, len: 0.1 }, { freq: 622.25, len: 0.1 },
    { freq: 659.25, len: 0.1 }, { freq: 698.46, len: 0.1 }, { freq: 739.99, len: 0.1 }, { freq: 783.99, len: 0.1 },
    { freq: 880.00, len: 0.1 }, { freq: 0, len: 0.05 }, { freq: 880.00, len: 0.1 }, { freq: 0, len: 0.05 },
    { freq: 830.61, len: 0.1 }, { freq: 783.99, len: 0.1 }, { freq: 739.99, len: 0.1 }, { freq: 698.46, len: 0.1 },
    { freq: 220.00, len: 0.1 }, { freq: 220.00, len: 0.1 }, { freq: 329.63, len: 0.1 }, { freq: 220.00, len: 0.1 },
    { freq: 1046.50, len: 0.05 }, { freq: 987.77, len: 0.05 }, { freq: 1046.50, len: 0.1 },
    { freq: 220.00, len: 0.1 }, { freq: 220.00, len: 0.1 }, { freq: 349.23, len: 0.1 }, { freq: 220.00, len: 0.1 },
    { freq: 1174.66, len: 0.05 }, { freq: 1108.73, len: 0.05 }, { freq: 1174.66, len: 0.1 },
    { freq: 587.33, len: 0.15 }, { freq: 698.46, len: 0.15 }, { freq: 880.00, len: 0.15 }, { freq: 1046.50, len: 0.15 },
    { freq: 659.25, len: 0.15 }, { freq: 830.61, len: 0.15 }, { freq: 987.77, len: 0.15 }, { freq: 1318.51, len: 0.15 },
    { freq: 880.00, len: 0.3 }, { freq: 440.00, len: 0.2 }, { freq: 220.00, len: 0.2 }, { freq: 0, len: 0.1 }
  ];

  private currentNoteIndex = 0;
  private currentMelody: {freq: number, len: number}[] = [];

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  resume() {
    this.init();
  }

  playBgm(mode: 'normal' | 'hard' = 'normal') {
    this.init();
    this.stopBgm();
    if (!this.ctx) return;
    this.isBgmPlaying = true;
    this.currentNoteIndex = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.currentMelody = mode === 'hard' ? this.melodyHard : this.melodyNormal;
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
    while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
        this.scheduleNote(this.currentMelody[this.currentNoteIndex], this.nextNoteTime);
        this.nextNoteTime += this.currentMelody[this.currentNoteIndex].len;
        this.currentNoteIndex = (this.currentNoteIndex + 1) % this.currentMelody.length;
    }
    this.timerID = window.setTimeout(() => this.scheduler(), 25);
  }

  private scheduleNote(note: {freq: number, len: number}, time: number) {
      if (!this.ctx) return;
      if (note.freq === 0) return; 
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = this.currentMelody === this.melodyHard ? 'sawtooth' : 'triangle'; 
      osc.frequency.value = note.freq;
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.08, time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, time + note.len - 0.02);
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
          {f: 523.25, t: 0, d: 0.1}, {f: 523.25, t: 0.1, d: 0.1}, {f: 523.25, t: 0.2, d: 0.1}, 
          {f: 783.99, t: 0.3, d: 0.3}, 
          {f: 1046.50, t: 0.6, d: 0.6} 
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
    maxHearts: state.maxHearts,
    jumpBonus: state.jumpBonus, // Persist jump bonus
    unlockedSkins: state.unlockedSkins,
    currentSkin: state.currentSkin,
    currentCandySkin: state.currentCandySkin,
    wallet: state.wallet,
    totalCandies: state.totalCandies,
    inventory: state.inventory,
    equipped: state.equipped,
    records: state.records,
    logs: state.logs,
    dailyPlayCount: state.dailyPlayCount,
    dailyShopCount: state.dailyShopCount,
    lastGamingDate: state.lastGamingDate,
    activeTitle: state.activeTitle,
    unlockedTitles: state.unlockedTitles,
    stats: state.stats,
    lastGlobalReset: state.lastGlobalReset
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
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const getRandomColor = () => {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) color += letters[Math.floor(Math.random() * 16)];
    return color;
};

// --- Character Drawing Logic ---
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
    grounded: boolean,
    isInvincible?: boolean
) => {
    ctx.save(); 
    
    if (isInvincible) {
        ctx.globalAlpha = (Math.floor(animTick / 100) % 2 === 0) ? 0.3 : 0.8;
    }

    ctx.translate(x, y);
    ctx.scale(1.4, 1.4); 

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
    grad.addColorStop(1, darkenColor(skinColor, 20)); 

    ctx.fillStyle = grad; 
    ctx.strokeStyle = darkenColor(skinColor, 40); // Natural outline based on skin
    ctx.lineWidth = 2.5;
    
    const runAnim = Math.sin(animTick / 60) * 12; 
    const isJumping = !grounded && !isSliding;

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
            } else if (equipped.shoes === 'flippers') {
                ctx.fillStyle = "#43a047"; ctx.beginPath(); ctx.moveTo(-6, 12); ctx.lineTo(6, 12); ctx.lineTo(10, 22); ctx.lineTo(-10, 22); ctx.fill();
            } else if (equipped.shoes === 'socks') {
                ctx.fillStyle = "white"; ctx.fillRect(-4, 8, 8, 10); ctx.fillStyle="#ef5350"; ctx.fillRect(-4, 8, 8, 2);
            } else if (equipped.shoes === 'rocket') {
                ctx.fillStyle = "#9e9e9e"; ctx.fillRect(-5, 8, 10, 10); 
                ctx.fillStyle = "orange"; ctx.beginPath(); ctx.moveTo(-3, 18); ctx.lineTo(0, 24); ctx.lineTo(3, 18); ctx.fill();
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
        if (isSliding) drawLeg(10); 
        else { drawLeg(runAnim * 3); drawLeg(-runAnim * 3); }
    }

    ctx.fillStyle = grad; 
    ctx.strokeStyle = darkenColor(skinColor, 40); 
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(-8, -15, 16, 30, 8); ctx.fill(); ctx.stroke();

    if (equipped.clothes) {
        if (['overalls', 'suit', 'hoodie', 'tuxedo', 'armor', 'jersey', 'hanbok', 'dress', 'raincoat'].includes(equipped.clothes)) {
             ctx.save();
             if (['overalls', 'suit', 'hoodie', 'armor', 'jersey'].includes(equipped.clothes)) {
                 ctx.beginPath(); ctx.roundRect(-8, -15, 16, 30, 8); ctx.clip();
             }
             if (equipped.clothes === 'overalls') {
                 ctx.fillStyle = "#1976d2"; ctx.fillRect(-8, 0, 16, 15);
                 ctx.fillRect(-8, -5, 16, 20); 
                 ctx.fillStyle = "#1565c0"; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI*2); ctx.fill();
             } 
             else if (equipped.clothes === 'suit') {
                 ctx.fillStyle = "#212121"; ctx.fillRect(-8, -15, 16, 30);
                 ctx.fillStyle = "white"; ctx.beginPath(); ctx.moveTo(8, -15); ctx.lineTo(8, -5); ctx.lineTo(0, -15); ctx.fill();
                 ctx.fillStyle = "red"; ctx.fillRect(6, -10, 2, 5);
             }
             else if (equipped.clothes === 'hoodie') {
                ctx.fillStyle = "#757575"; ctx.fillRect(-8, -15, 16, 30);
                ctx.beginPath(); ctx.moveTo(-8, -15); ctx.quadraticCurveTo(-12, -10, -8, -5); ctx.fill();
                ctx.fillStyle = "#616161"; ctx.fillRect(0, 5, 8, 8);
             }
             else if (equipped.clothes === 'armor') {
                ctx.fillStyle = "#b0bec5"; ctx.fillRect(-8, -15, 16, 30);
                ctx.fillStyle = "#78909c"; ctx.fillRect(-4, -5, 8, 10);
             }
             else if (equipped.clothes === 'jersey') {
                ctx.fillStyle = "#0d47a1"; ctx.fillRect(-8, -15, 16, 30);
                ctx.fillStyle = "white"; ctx.font="bold 10px Arial"; ctx.fillText("7", -2, 5);
             }
             ctx.restore();

             if (equipped.clothes === 'tuxedo') {
                 ctx.save();
                 ctx.beginPath(); ctx.roundRect(-8, -15, 16, 30, 8); ctx.clip();
                 ctx.fillStyle = "black"; ctx.fillRect(-8, -15, 16, 30);
                 ctx.fillStyle = "white"; ctx.fillRect(0, -15, 8, 20);
                 ctx.restore();
                 ctx.fillStyle = "black"; ctx.beginPath(); ctx.moveTo(-5, 5); ctx.lineTo(-12, 15); ctx.lineTo(-5, 15); ctx.fill();
             }
             else if (equipped.clothes === 'dress') {
                 ctx.save(); ctx.beginPath(); ctx.roundRect(-8, -15, 16, 15, 8); ctx.clip();
                 ctx.fillStyle = "#e91e63"; ctx.fillRect(-8, -15, 16, 30);
                 ctx.restore();
                 ctx.fillStyle = "#e91e63"; 
                 ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.lineTo(10, 15); ctx.quadraticCurveTo(0, 18, -10, 15); ctx.fill();
             }
             else if (equipped.clothes === 'raincoat') {
                 ctx.fillStyle = "#ffeb3b";
                 ctx.beginPath(); 
                 ctx.ellipse(0, -5, 12, 20, 0, 0, Math.PI*2); 
                 ctx.fill();
                 ctx.strokeStyle = "#fbc02d"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-5, -20); ctx.lineTo(0, -23); ctx.stroke();
             }
             else if (equipped.clothes === 'hanbok') {
                 ctx.fillStyle = "#ce93d8"; 
                 ctx.save(); ctx.beginPath(); ctx.roundRect(-8, -15, 16, 12, 8); ctx.clip(); ctx.fillRect(-8, -15, 16, 30); ctx.restore();
                 ctx.fillStyle = "#f48fb1"; 
                 ctx.beginPath(); ctx.moveTo(-7, -3); ctx.lineTo(7, -3); ctx.lineTo(11, 15); ctx.quadraticCurveTo(0, 18, -11, 15); ctx.fill();
                 ctx.fillStyle = "#ef5350"; ctx.fillRect(2, -5, 4, 8);
             }
        }
    }

    function drawArm(angle: number) {
        ctx.save();
        ctx.translate(0, -8); 
        ctx.rotate(angle * (Math.PI / 180));
        ctx.fillStyle = grad; 
        ctx.strokeStyle = darkenColor(skinColor, 40);
        ctx.beginPath();
        ctx.roundRect(-3.5, 0, 7, 18, 3.5);
        ctx.fill(); ctx.stroke();

        if (equipped.clothes) {
             ctx.save(); ctx.clip(); 
             if (['overalls', 'suit', 'hoodie', 'tuxedo', 'armor', 'jersey', 'raincoat', 'hanbok'].includes(equipped.clothes)) {
                 if(equipped.clothes === 'overalls') ctx.fillStyle = "#1565c0"; 
                 else if(equipped.clothes === 'suit' || equipped.clothes === 'tuxedo') ctx.fillStyle = "black";
                 else if(equipped.clothes === 'hoodie') ctx.fillStyle = "#757575";
                 else if(equipped.clothes === 'armor') ctx.fillStyle = "#b0bec5";
                 else if(equipped.clothes === 'jersey') ctx.fillStyle = "#0d47a1";
                 else if(equipped.clothes === 'raincoat') ctx.fillStyle = "#ffeb3b";
                 else if(equipped.clothes === 'hanbok') ctx.fillStyle = "#ce93d8";
                 
                 if (equipped.clothes !== 'overalls') ctx.fillRect(-5, 0, 10, 12); 
                 else ctx.fillRect(-5, 0, 10, 4); 
             }
             ctx.restore();
        }

        if (equipped.weapon) {
            ctx.save();
            ctx.translate(0, 15); 
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
            } else if (equipped.weapon === 'mic') {
                ctx.fillStyle = "black"; ctx.fillRect(0, -2, 15, 4);
                ctx.fillStyle = "#bdbdbd"; ctx.beginPath(); ctx.arc(18, 0, 6, 0, Math.PI*2); ctx.fill();
            } else if (equipped.weapon === 'carrot') {
                ctx.fillStyle = "#ff9800"; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(25, -5); ctx.lineTo(25, 5); ctx.fill();
                ctx.fillStyle = "#4caf50"; ctx.fillRect(25, -2, 5, 4);
            } else if (equipped.weapon === 'laser') {
                ctx.fillStyle = "#bdbdbd"; ctx.fillRect(0, -2, 8, 4);
                ctx.fillStyle = "#00e676"; ctx.shadowColor = "#00e676"; ctx.shadowBlur = 10; ctx.fillRect(8, -2, 30, 4); ctx.shadowBlur = 0;
            }
            ctx.restore();
        }
        
        if (!equipped.clothes) { ctx.strokeStyle = "white"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-2, 14); ctx.lineTo(2, 14); ctx.stroke(); }
        ctx.restore();
    }

    if (isJumping) drawArm(-130); 
    else {
        if (isSliding) drawArm(160); 
        else drawArm(runAnim * 3); 
    }

    ctx.fillStyle = grad; 
    ctx.strokeStyle = darkenColor(skinColor, 40);
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(2, -26, 14, 0, Math.PI*2); ctx.fill(); ctx.stroke();

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
             ctx.fillStyle = "#d32f2f"; ctx.beginPath(); ctx.ellipse(2, -40, 16, 10, 0.2, 0, Math.PI*2); ctx.fill(); ctx.fillRect(0,-50, 2, 6);
        } else if (equipped.hat === 'partyhat') {
             ctx.fillStyle = "#ab47bc"; ctx.beginPath(); ctx.moveTo(-8, -32); ctx.lineTo(12, -32); ctx.lineTo(2, -55); ctx.fill();
        } else if (equipped.hat === 'headphone') {
            ctx.strokeStyle = "#333"; ctx.lineWidth = 4; 
            ctx.beginPath(); ctx.arc(2, -26, 17, Math.PI, 0); ctx.stroke(); 
            ctx.fillStyle = "#ef5350"; 
            ctx.beginPath(); ctx.arc(2, -26, 8, 0, Math.PI*2); ctx.fill(); 
            ctx.fillStyle = "#333"; 
            ctx.beginPath(); ctx.arc(2, -26, 4, 0, Math.PI*2); ctx.fill(); 
        } else if (equipped.hat === 'flower') {
            ctx.fillStyle = "#ff4081"; ctx.beginPath(); ctx.arc(10, -35, 5, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "white"; ctx.beginPath(); ctx.arc(10, -35, 2, 0, Math.PI*2); ctx.fill();
        } else if (equipped.hat === 'viking') {
            ctx.fillStyle = "#9e9e9e"; ctx.beginPath(); ctx.arc(2, -30, 14, Math.PI, 0); ctx.fill();
            ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(-12, -30); ctx.lineTo(-18, -45); ctx.lineTo(-8, -35); ctx.fill();
            ctx.beginPath(); ctx.moveTo(16, -30); ctx.lineTo(22, -45); ctx.lineTo(12, -35); ctx.fill();
        }
    }
    ctx.restore();
};

export const drawCandySimple = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, candyIdx: number) => {
    ctx.save(); ctx.translate(x, y);
    const typeIdx = Math.floor(candyIdx / 5);
    const colorIdx = candyIdx % 5;
    const color = CANDY_COLORS[colorIdx] || CANDY_COLORS[0];
    const type = CANDY_TYPES[typeIdx] || 'basic';
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath(); ctx.ellipse(2, 2, r, r*0.8, 0, 0, Math.PI*2); ctx.fill();
    const grad = ctx.createRadialGradient(-r/3, -r/3, r/4, 0, 0, r);
    grad.addColorStop(0, "white");
    grad.addColorStop(0.3, color);
    grad.addColorStop(1, darkenColor(color, 30));
    if (type === 'basic') {
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.beginPath(); ctx.ellipse(-r/3, -r/3, r/3, r/5, -Math.PI/4, 0, Math.PI*2); ctx.fill();
    } 
    else if (type === 'striped') {
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
        ctx.clip();
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        for(let i=-r; i<r; i+=8) ctx.fillRect(i, -r, 4, r*2);
    }
    else if (type === 'lollipop') {
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 3;
        ctx.beginPath();
        for(let i=0; i<10; i++) ctx.arc(0, 0, i*2, 0 + i*0.5, Math.PI + i*0.5);
        ctx.stroke();
    }
    else if (type === 'wrapped') {
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(-r-8, -8); ctx.lineTo(-r-8, 8); ctx.fill();
        ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(r+8, -8); ctx.lineTo(r+8, 8); ctx.fill();
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.roundRect(-r, -r*0.7, r*2, r*1.4, 5); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.fillRect(-5, -r*0.7, 10, r*1.4);
    }
    ctx.restore();
};

const adjustColor = (color: string, amount: number) => {
    return color; 
}
