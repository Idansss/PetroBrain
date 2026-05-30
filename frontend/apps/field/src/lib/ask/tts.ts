import * as Speech from 'expo-speech';

import type { Language } from '../settings/preferences.js';

const LANG_BCP47: Record<Language, string> = {
  en: 'en-US',
  pidgin: 'en-NG',                   // closest BCP-47 today
  yo: 'yo-NG',
  ha: 'ha',
};

export function speak(text: string, language: Language): void {
  // Stop any in-flight utterance first so a fresh answer doesn't queue
  // behind the previous one (which is annoying on a noisy rig).
  Speech.stop();
  Speech.speak(text, { language: LANG_BCP47[language] ?? 'en-US' });
}

export function stopSpeaking(): void {
  Speech.stop();
}
