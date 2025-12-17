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
  
  // Normal Melody: 20s Variation in C Major (Upbeat)
  private melodyNormal = [
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

  // Hard Mode Melody: Extended 20s Loop (Fast, A Minor, Tense)
  // Approx 150BPM feel (0.1s - 0.2s notes)
  private melodyHard = [
    // --- SECTION A: The Chase (A Minor Arpeggios) ---
    { freq: 440.00, len: 0.1 }, { freq: 0, len: 0.05 }, { freq: 440.00, len: 0.1 }, { freq: 523.25, len: 0.1 }, // A-A-C
    { freq: 659.25, len: 0.1 }, { freq: 523.25, len: 0.1 }, { freq: 440.00, len: 0.1 }, { freq: 349.23, len: 0.1 }, // E-C-A-F
    { freq: 329.63, len: 0.1 }, { freq: 440.00, len: 0.1 }, { freq: 523.25, len: 0.1 }, { freq: 659.25, len: 0.1 }, // E-A-C-E
    { freq: 880.00, len: 0.2 }, { freq: 659.25, len: 0.2 }, // High A - E

    { freq: 440.00, len: 0.1 }, { freq: 0, len: 0.05 }, { freq: 440.00, len: 0.1 }, { freq: 523.25, len: 0.1 }, // A-A-C
    { freq: 659.25, len: 0.1 }, { freq: 523.25, len: 0.1 }, { freq: 440.00, len: 0.1 }, { freq: 349.23, len: 0.1 }, // E-C-A-F
    { freq: 493.88, len: 0.1 }, { freq: 587.33, len: 0.1 }, { freq: 698.46, len: 0.1 }, { freq: 830.61, len: 0.1 }, // B-D-F-Ab (Diminished climb)
    { freq: 880.00, len: 0.2 }, { freq: 0, len: 0.1 },

    // --- SECTION B: Rising Tension (Chromatic / Fast) ---
    { freq: 523.25, len: 0.1 }, { freq: 554.37, len: 0.1 }, { freq: 587.33, len: 0.1 }, { freq: 622.25, len: 0.1 }, // Chromatic C -> Eb
    { freq: 659.25, len: 0.1 }, { freq: 698.46, len: 0.1 }, { freq: 739.99, len: 0.1 }, { freq: 783.99, len: 0.1 }, // Chromatic E -> G
    { freq: 880.00, len: 0.1 }, { freq: 0, len: 0.05 }, { freq: 880.00, len: 0.1 }, { freq: 0, len: 0.05 }, // A Stabs
    { freq: 830.61, len: 0.1 }, { freq: 783.99, len: 0.1 }, { freq: 739.99, len: 0.1 }, { freq: 698.46, len: 0.1 }, // Descent

    // --- SECTION C: The Danger Zone (Low rumble + High trills) ---
    { freq: 220.00, len: 0.1 }, { freq: 220.00, len: 0.1 }, { freq: 329.63, len: 0.1 }, { freq: 220.00, len: 0.1 }, // Low A Riff
    { freq: 1046.50, len: 0.05 }, { freq: 987.77, len: 0.05 }, { freq: 1046.50, len: 0.1 }, // High Trill
    { freq: 220.00, len: 0.1 }, { freq: 220.00, len: 0.1 }, { freq: 349.23, len: 0.1 }, { freq: 220.00, len: 0.1 }, // Low A Riff
    { freq: 1174.66, len: 0.05 }, { freq: 1108.73, len: 0.05 }, { freq: 1174.66, len: 0.1 }, // High Trill

    // --- SECTION D: Loop Turnaround (Dm -> E7 -> Am) ---
    { freq: 587.33, len: 0.15 }, { freq: 698.46, len: 0.15 }, { freq: 880.00, len: 0.15 }, { freq: 1046.50, len: 0.15 }, // Dm Arp
    { freq: 659.25, len: 0.15 }, { freq: 830.61, len: 0.15 }, { freq: 987.77, len: 0.15 }, { freq: 1318.51, len: 0.15 }, // E7 Arp
    { freq: 880.00, len: 0.3 }, { freq: 440.00, len: 0.2 }, { freq: 220.00, len: 0.2 }, { freq: 0, len: 0.1 } // Hit A
  ];

  private currentNoteIndex = 0;
  private currentMelody: {freq: number, len: number}[] = [];

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

  playBgm(mode: 'normal' | 'hard' = 'normal') {
    this.init();
    // Stop if already playing to allow restart or mode switch
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
    
    // Schedule notes ahead (lookahead 0.1s)
    while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
        this.scheduleNote(this.currentMelody[this.currentNoteIndex], this.nextNoteTime);
        this.nextNoteTime += this.currentMelody[this.currentNoteIndex].len;
        this.currentNoteIndex = (this.currentNoteIndex + 1) % this.currentMelody.length;
    }
    this.timerID = window.setTimeout(() => this.scheduler(), 25);
  }

  private scheduleNote(note: {freq: number, len: number}, time: number) {
      if (!this.ctx) return;
      if (note.freq === 0) return; // Rest

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = this.currentMelody === this.melodyHard ? 'sawtooth' : 'triangle'; // Sawtooth for harsher/tense sound in Hard mode
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
    logs: state.logs, // Save logs
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
        if (isSliding) { 
            // Sliding legs
            drawLeg(10); 
        }
        else { drawLeg(runAnim * 3); drawLeg(-runAnim * 3); }
    }

    // Body
    ctx.fillStyle = grad; 
    ctx.strokeStyle = "#5d4037"; ctx.lineWidth = 2.5;
    
    // Draw body skin first
    ctx.beginPath(); ctx.roundRect(-8, -15, 16, 30, 8); ctx.fill(); ctx.stroke();

    // Clothes Logic - Side View & Body Fit
    if (equipped.clothes) {
        // TIGHT CLOTHES (Clip to Body)
        if (['overalls', 'suit', 'hoodie', 'tuxedo', 'armor', 'jersey', 'hanbok', 'dress', 'raincoat'].includes(equipped.clothes)) {
             ctx.save();
             // Clip to the round body shape for tight fitting items
             
             if (['overalls', 'suit', 'hoodie', 'armor', 'jersey'].includes(equipped.clothes)) {
                 ctx.beginPath(); ctx.roundRect(-8, -15, 16, 30, 8); ctx.clip();
             }

             if (equipped.clothes === 'overalls') {
                 // Pants
                 ctx.fillStyle = "#1976d2"; ctx.fillRect(-8, 0, 16, 15);
                 // Bib (Side view - Strap + Front)
                 ctx.fillRect(-8, -5, 16, 20); 
                 ctx.fillStyle = "#1565c0"; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI*2); ctx.fill(); // Button
             } 
             else if (equipped.clothes === 'suit') {
                 ctx.fillStyle = "#212121"; ctx.fillRect(-8, -15, 16, 30);
                 // White shirt showing at neck/front
                 ctx.fillStyle = "white"; ctx.beginPath(); ctx.moveTo(8, -15); ctx.lineTo(8, -5); ctx.lineTo(0, -15); ctx.fill();
                 ctx.fillStyle = "red"; ctx.fillRect(6, -10, 2, 5); // Tie hint
             }
             else if (equipped.clothes === 'hoodie') {
                ctx.fillStyle = "#757575"; ctx.fillRect(-8, -15, 16, 30);
                // Hood bump on back (Left side)
                ctx.beginPath(); ctx.moveTo(-8, -15); ctx.quadraticCurveTo(-12, -10, -8, -5); ctx.fill();
                // Pocket line
                ctx.fillStyle = "#616161"; ctx.fillRect(0, 5, 8, 8);
             }
             else if (equipped.clothes === 'armor') {
                ctx.fillStyle = "#b0bec5"; ctx.fillRect(-8, -15, 16, 30);
                ctx.fillStyle = "#78909c"; ctx.fillRect(-4, -5, 8, 10); // Plate detail
             }
             else if (equipped.clothes === 'jersey') {
                ctx.fillStyle = "#0d47a1"; ctx.fillRect(-8, -15, 16, 30);
                ctx.fillStyle = "white"; ctx.font="bold 10px Arial"; ctx.fillText("7", -2, 5);
             }
             ctx.restore();

             // LOOSE CLOTHES (Draw Over Body)
             if (equipped.clothes === 'tuxedo') {
                 // Body part (clipped manually by drawing inside)
                 ctx.save();
                 ctx.beginPath(); ctx.roundRect(-8, -15, 16, 30, 8); ctx.clip();
                 ctx.fillStyle = "black"; ctx.fillRect(-8, -15, 16, 30);
                 ctx.fillStyle = "white"; ctx.fillRect(0, -15, 8, 20); // Front shirt
                 ctx.restore();
                 // Tailcoat (extends back/left)
                 ctx.fillStyle = "black"; ctx.beginPath(); ctx.moveTo(-5, 5); ctx.lineTo(-12, 15); ctx.lineTo(-5, 15); ctx.fill();
             }
             else if (equipped.clothes === 'dress') {
                 // Top part (tight)
                 ctx.save(); ctx.beginPath(); ctx.roundRect(-8, -15, 16, 15, 8); ctx.clip();
                 ctx.fillStyle = "#e91e63"; ctx.fillRect(-8, -15, 16, 30);
                 ctx.restore();
                 // Skirt part (flares out)
                 ctx.fillStyle = "#e91e63"; 
                 ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.lineTo(10, 15); ctx.quadraticCurveTo(0, 18, -10, 15); ctx.fill();
             }
             else if (equipped.clothes === 'raincoat') {
                 // Round Poncho shape (covering body)
                 ctx.fillStyle = "#ffeb3b";
                 // Draw a circle/oval shape that covers the body rect
                 ctx.beginPath(); 
                 ctx.ellipse(0, -5, 12, 20, 0, 0, Math.PI*2); 
                 ctx.fill();
                 // Hood detail (small line)
                 ctx.strokeStyle = "#fbc02d"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-5, -20); ctx.lineTo(0, -23); ctx.stroke();
             }
             else if (equipped.clothes === 'hanbok') {
                 // Jeogori (Top) - Short jacket
                 ctx.fillStyle = "#ce93d8"; 
                 ctx.save(); ctx.beginPath(); ctx.roundRect(-8, -15, 16, 12, 8); ctx.clip(); ctx.fillRect(-8, -15, 16, 30); ctx.restore();
                 // Chima/Baji (Bottom) - Flared
                 ctx.fillStyle = "#f48fb1"; 
                 ctx.beginPath(); ctx.moveTo(-7, -3); ctx.lineTo(7, -3); ctx.lineTo(11, 15); ctx.quadraticCurveTo(0, 18, -11, 15); ctx.fill();
                 // Tie detail
                 ctx.fillStyle = "#ef5350"; ctx.fillRect(2, -5, 4, 8);
             }
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

        // Sleeve (If clothes equipped)
        if (equipped.clothes) {
             ctx.save(); ctx.clip(); // Clip to arm shape
             if (['overalls', 'suit', 'hoodie', 'tuxedo', 'armor', 'jersey', 'raincoat', 'hanbok'].includes(equipped.clothes)) {
                 if(equipped.clothes === 'overalls') ctx.fillStyle = "#1565c0"; // Blue shirt under?
                 else if(equipped.clothes === 'suit' || equipped.clothes === 'tuxedo') ctx.fillStyle = "black";
                 else if(equipped.clothes === 'hoodie') ctx.fillStyle = "#757575";
                 else if(equipped.clothes === 'armor') ctx.fillStyle = "#b0bec5";
                 else if(equipped.clothes === 'jersey') ctx.fillStyle = "#0d47a1";
                 else if(equipped.clothes === 'raincoat') ctx.fillStyle = "#ffeb3b";
                 else if(equipped.clothes === 'hanbok') ctx.fillStyle = "#ce93d8";
                 
                 // Sleeve usually covers top half of arm
                 if (equipped.clothes !== 'overalls') ctx.fillRect(-5, 0, 10, 12); 
                 else ctx.fillRect(-5, 0, 10, 4); // Short sleeve for overalls
             }
             ctx.restore();
        }

        // Weapon Handling
        if (equipped.weapon) {
            ctx.save();
            ctx.translate(0, 15); // Move to hand
            
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
             // Moved up: y-45 instead of y-35 base, adjust ellipse
             ctx.fillStyle = "#d32f2f"; ctx.beginPath(); ctx.ellipse(2, -40, 16, 10, 0.2, 0, Math.PI*2); ctx.fill(); ctx.fillRect(0,-50, 2, 6);
        } else if (equipped.hat === 'partyhat') {
             ctx.fillStyle = "#ab47bc"; ctx.beginPath(); ctx.moveTo(-8, -32); ctx.lineTo(12, -32); ctx.lineTo(2, -55); ctx.fill();
        } else if (equipped.hat === 'headphone') {
            // Side view: Band over head, one cup visible
            ctx.strokeStyle = "#333"; ctx.lineWidth = 4; 
            ctx.beginPath(); ctx.arc(2, -26, 17, Math.PI, 0); ctx.stroke(); // Band
            ctx.fillStyle = "#ef5350"; 
            ctx.beginPath(); ctx.arc(2, -26, 8, 0, Math.PI*2); ctx.fill(); // Cup
            ctx.fillStyle = "#333"; 
            ctx.beginPath(); ctx.arc(2, -26, 4, 0, Math.PI*2); ctx.fill(); // Detail
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