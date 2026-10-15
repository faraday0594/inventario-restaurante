/**
 * Utilidad de audio usando Web Audio API estándar del navegador y Web Speech API.
 * No requiere archivos MP3 externos ni dependencias.
 */

let audioCtx: AudioContext | null = null;
let unlockedAudioEl: HTMLAudioElement | null = null;

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!audioCtx && AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state !== 'running') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Desbloquea permisos de sonido reproduciendo un micro-tono imperceptible
 * para que el navegador permita reproducir audio cuando la pantalla se minimice
 */
export function unlockAudioEngine() {
  if (typeof window === 'undefined') return;
  const ctx = getAudioContext();
  if (ctx && ctx.state !== 'running') {
    ctx.resume().catch(() => {});
  }
}

/**
 * Genera un sonido tipo BEEP/SIRENA WAV sintetizado en formato data URI
 * para poder reproducirlo con un <audio> estándar que los navegadores móviles
 * SI permiten reproducir con la pantalla apagada o pestaña minimizada.
 */
function createBeepDataUri(frequency: number, durationSec: number, repeats = 2): string {
  if (typeof window === 'undefined') return '';
  const sampleRate = 22050;
  const numChannels = 1;
  const totalSamples = Math.floor(sampleRate * durationSec * repeats);
  const blockAlign = numChannels * 2;
  const byteRate = sampleRate * blockAlign;
  const dataSize = totalSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // Escribir cabecera WAV RIFF
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // 16 bits
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Llenar muestras de audio con pulsos
  let offset = 44;
  const samplesPerBeep = Math.floor(sampleRate * (durationSec / repeats));
  for (let r = 0; r < repeats; r++) {
    for (let i = 0; i < samplesPerBeep; i++) {
      const t = i / sampleRate;
      // Onda cuadrada / senoidal con decaimiento
      const envelope = Math.max(0, 1 - (i / samplesPerBeep));
      const sample = Math.sin(2 * Math.PI * frequency * t) * envelope * 0.8;
      const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return 'data:audio/wav;base64,' + window.btoa(binary);
}

const KITCHEN_ALARM_URI = typeof window !== 'undefined' ? createBeepDataUri(950, 0.7, 3) : '';
const READY_ALARM_URI = typeof window !== 'undefined' ? createBeepDataUri(1250, 0.8, 3) : '';

function playAudioUri(uri: string) {
  if (!uri || typeof window === 'undefined') return;
  try {
    const audio = new Audio(uri);
    audio.volume = 1.0;
    const playPromise = audio.play();
    if (playPromise) {
      playPromise.catch(() => {});
    }
  } catch {}
}

/**
 * Activa la vibración física si el dispositivo (celular Android / tablet) lo soporta.
 */
export function triggerVibration(pattern: number[] = [300, 150, 300, 150, 500]) {
  try {
    if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  } catch {}
}

/**
 * Síntesis de voz hablada en español ("¡Atención: Nuevo pedido de mesa 3!")
 */
export function speakAlert(text: string) {
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      // Cancelar frases previas en cola para evitar retrasos
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-CO';
      utterance.rate = 1.05;
      utterance.pitch = 1.1;
      utterance.volume = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  } catch {}
}

/**
 * Alarma potente y penetrante ("SIRENA / TIMBRE FUERTE") para COCINA
 * cuando una mesera toma un pedido nuevo.
 */
export function playKitchenChime() {
  triggerVibration([250, 100, 250, 100, 400]);
  // Reproducir sonido con reproductor HTML5 (funciona con app minimizada en celular)
  playAudioUri(KITCHEN_ALARM_URI);

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const startTime = ctx.currentTime;

    // Ráfaga de 3 timbrazos rápidos y resonantes estilo comanda de restaurante
    for (let i = 0; i < 3; i++) {
      const burstStart = startTime + (i * 0.28);

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth'; // Tono más penetrante y notorio que sine
      osc.frequency.setValueAtTime(880, burstStart); // La5
      osc.frequency.exponentialRampToValueAtTime(1320, burstStart + 0.12); // Mi6

      gain.gain.setValueAtTime(0.65, burstStart);
      gain.gain.exponentialRampToValueAtTime(0.001, burstStart + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(burstStart);
      osc.stop(burstStart + 0.25);
    }
  } catch (err) {
    console.warn('Audio no permitido o silenciado por el navegador:', err);
  }
}

/**
 * Alarma potente para MESERAS ("¡PEDIDO LISTO EN COCINA!")
 * Sonido llamativo repetitivo y vibración fuerte para que no se pase por alto.
 */
export function playReadyOrderChime() {
  triggerVibration([300, 150, 300, 150, 600]);
  // Reproducir sonido con reproductor HTML5 (funciona con app minimizada en celular)
  playAudioUri(READY_ALARM_URI);

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const startTime = ctx.currentTime;

    // Doble acorde campana estridente (aviso urgente de despacho)
    const notes = [784, 988, 1175, 1568]; // Acorde mayor brillante (G5, B5, D6, G6)
    
    // Pulso 1
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime + (idx * 0.05));
      gain.gain.setValueAtTime(0.5, startTime + (idx * 0.05));
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.7);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime + (idx * 0.05));
      osc.stop(startTime + 0.7);
    });

    // Pulso 2 repetido a los 0.6s para que suene insistente
    notes.forEach((freq, idx) => {
      const t = startTime + 0.55 + (idx * 0.05);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.6, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.9);
    });
  } catch (err) {
    console.warn('Audio de servicio silenciado por navegador:', err);
  }
}

/**
 * Sonido rápido al agregar un producto o confirmar (click suave)
 */
export function playTapSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  } catch {}
}
