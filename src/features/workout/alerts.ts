const BEEP_HZ = 880;
const BEEP_SECONDS = 0.18;
const BEEP_VOLUME = 0.2;
const VIBRATION_MS = [120, 80, 120];

let audioContext: AudioContext | null = null;

/** Los navegadores exigen crear o reanudar el audio dentro de una pulsación del usuario. */
export const unlockAudio = () => {
  if (!('AudioContext' in globalThis)) return;
  audioContext ??= new AudioContext();
  void audioContext.resume();
};

const beep = () => {
  if (!audioContext) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  gain.gain.value = BEEP_VOLUME;
  oscillator.frequency.value = BEEP_HZ;
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + BEEP_SECONDS);
};

export interface AlertPreferences {
  sound: boolean;
  vibration: boolean;
}

export const playAlert = ({ sound, vibration }: AlertPreferences) => {
  if (sound) beep();
  if (vibration && 'vibrate' in navigator) navigator.vibrate(VIBRATION_MS);
};
