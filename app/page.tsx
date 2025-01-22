'use client';

import { useState, useCallback, useRef } from 'react';
import { LanguageSelector } from '@/components/language-selector';
import { MessageDisplay } from '@/components/message-display';
import { useAudioRecorder } from '@/hooks/use-audio';
import { Language } from '@/lib/types';
import { VoiceSettings, VoiceSettings as VoiceSettingsType, defaultVoiceSettings, environmentPresets } from '@/components/voice-settings';
import { Button } from '@/components/ui/button';
import { translateText } from '@/lib/translate';
import '@/styles/animations.css';

interface Message {
  id: string;
  originalText: string;
  translatedText: string;
  timestamp: number;
  sourceLang: string;
  targetLang: string;
}

export default function Home() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [supportedLanguages, setSupportedLanguages] = useState<Language[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [transcribedText, setTranscribedText] = useState<string>('');
  const [translatedText, setTranslatedText] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const processingRef = useRef(false);
  const [isInitialSetup, setIsInitialSetup] = useState(true);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettingsType>(defaultVoiceSettings);
  const [currentMode, setCurrentMode] = useState("Quiet Room");
  const [isTTSEnabled, setIsTTSEnabled] = useState(true);
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);

  const processAudio = async (audioBlob: Blob) => {
    if (processingRef.current) {
      return;
    }

    // Check if the audio is too short (less than 0.5 seconds)
    if (audioBlob.size < 15000) {  // Roughly 0.5s of audio at 128kbps
      console.log('Audio too short, ignoring');
      return;
    }

    try {
      processingRef.current = true;
      setIsProcessing(true);
      setError(null);

      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');

      if (isInitialSetup) {
        // Initial language detection phase
        const transcriptionResponse = await fetch('/api/speech', {
          method: 'POST',
          body: formData,
        });

        const transcriptionData = await transcriptionResponse.json();

        if (!transcriptionResponse.ok) {
          if (transcriptionData.error === 'Low quality speech detected' || 
              transcriptionData.error === 'No speech detected' ||
              transcriptionData.error === 'Speech too short') {
            console.log('Ignoring low quality audio:', transcriptionData.error);
            return;
          }
          
          // Enhanced error messages
          let userFriendlyError = transcriptionData.details || transcriptionData.error;
          
          if (transcriptionData.error === 'Network connection failed') {
            userFriendlyError = "네트워크 연결이 불안정합니다. 모바일 데이터 연결을 확인하고 다시 시도해주세요.";
          } else if (transcriptionData.error === 'API access blocked') {
            userFriendlyError = "서버 접속이 일시적으로 제한되었습니다. 잠시 후 다시 시도해주세요.";
          } else if (transcriptionData.error === 'Request timeout') {
            userFriendlyError = "네트워크 속도가 너무 느립니다. 더 안정적인 네트워크 환경에서 시도해주세요.";
          } else if (transcriptionData.error === 'Invalid audio file') {
            userFriendlyError = "오디오 파일이 올바르지 않습니다. 마이크 권한을 확인하고 다시 시도해주세요.";
          }
          
          throw new Error(userFriendlyError);
        }

        setTranscribedText(transcriptionData.text);

        // detect two languages
        const languageResponse = await fetch('/api/language', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: transcriptionData.text }),
        });

        const languageData = await languageResponse.json();

        if (!languageResponse.ok) {
          throw new Error(languageData.error || 'Failed to detect languages');
        }
        
        setSupportedLanguages([
          languageData.sourceLanguage,
          languageData.targetLanguage
        ]);
        setIsInitialSetup(false);
      } else {
        // Translation phase
        formData.append('languages', JSON.stringify(supportedLanguages));
        const transcriptionResponse = await fetch('/api/speech', {
          method: 'POST',
          body: formData,
        });

        const transcriptionData = await transcriptionResponse.json();

        if (!transcriptionResponse.ok) {
          if (transcriptionData.error === 'Low quality speech detected' || 
              transcriptionData.error === 'No speech detected' ||
              transcriptionData.error === 'Transcription too short') {
            console.log('Ignoring low quality audio:', transcriptionData.error);
            return;
          }
          throw new Error(transcriptionData.details || transcriptionData.error || 'Failed to transcribe audio');
        }

        setTranscribedText(transcriptionData.text);

        // Use streaming translation
        const translation = await translateText(
          transcriptionData.text, 
          supportedLanguages,
          {
            onPartial: (partialTranslation) => {
              setTranslatedText(partialTranslation);
            }
          }
        );

        const newMessage: Message = {
          id: Date.now().toString(),
          originalText: transcriptionData.text,
          translatedText: translation,
          timestamp: Date.now(),
          sourceLang: transcriptionData.language,
          targetLang: supportedLanguages[1].code
        };

        setMessages(prev => [...prev, newMessage]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred';
      setError(message);
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  };

  const { isRecording, startListening, stopListening, isListening } = useAudioRecorder({
    onRecordingComplete: processAudio,
    silenceThreshold: voiceSettings.silenceThreshold,
    silenceTimeout: voiceSettings.silenceTimeout,
    smoothingTimeConstant: voiceSettings.smoothingTimeConstant,
  });

  const handleVoiceSettingsChange = (newSettings: VoiceSettingsType) => {
    setVoiceSettings(newSettings);
    
    // Use the same preset values as voice-settings.tsx
    if (JSON.stringify(newSettings) === JSON.stringify(environmentPresets.quiet.settings)) {
      setCurrentMode(environmentPresets.quiet.name);
    } else if (JSON.stringify(newSettings) === JSON.stringify(environmentPresets.moderate.settings)) {
      setCurrentMode(environmentPresets.moderate.name);
    } else if (JSON.stringify(newSettings) === JSON.stringify(environmentPresets.noisy.settings)) {
      setCurrentMode(environmentPresets.noisy.name);
    }
  };

  return (
    <main className={`flex min-h-screen flex-col items-center ${isInitialSetup ? 'py-0' : 'pb-20 pt-12'}`}>
      <div className="fixed md:absolute top-0 md:top-[35px] left-0 right-0 h-16 flex items-center justify-between px-6 bg-white z-[60] transition-none">
        <VoiceSettings
          currentSettings={voiceSettings}
          onSettingsChange={handleVoiceSettingsChange}
          onOpenChange={setIsModeMenuOpen}
        />
        {!isModeMenuOpen && (
          <Button
            variant="ghost"
            className={`
              h-auto py-2 px-4 hover:bg-transparent relative
              after:content-[''] after:absolute after:top-1/2 after:left-1/2
              after:bg-neutral-900 after:transition-all after:-translate-y-1/2
              ${isTTSEnabled 
                ? 'after:w-full after:h-[1px] after:left-0 after:scale-x-100' 
                : 'after:w-[3px] after:h-[3px] after:-translate-x-1/2 after:rounded-full'
              }
            `}
            onClick={() => setIsTTSEnabled(!isTTSEnabled)}
            title={isTTSEnabled ? "Voice enabled" : "Voice muted"}
          >
            <span className="sr-only">{isTTSEnabled ? "Voice enabled" : "Voice muted"}</span>
          </Button>
        )}
      </div>
      <div className="w-full md:max-w-none max-w-md space-y-8 mt-12">
        {isInitialSetup ? (
          <LanguageSelector
            isRecording={isRecording}
            isListening={isListening}
            isProcessing={isProcessing}
            onListeningStart={startListening}
            onListeningStop={stopListening}
            transcribedText={transcribedText}
            showWelcomeMessage={true}
            isTTSEnabled={isTTSEnabled}
          />
        ) : (
          <>
            <div className="flex justify-center mb-14">
              <div className="inline-flex items-center gap-4 py-1">
                <span className="text-[10px] tracking-[0.25em] uppercase text-neutral-900 font-light">
                  {supportedLanguages[0].name}
                </span>
                <span className="text-[8px] tracking-[0.2em] text-neutral-400 font-light">⟷</span>
                <span className="text-[10px] tracking-[0.25em] uppercase text-neutral-900 font-light">
                  {supportedLanguages[1].name}
                </span>
              </div>
            </div>
            
            <LanguageSelector
              isRecording={isRecording}
              isListening={isListening}
              isProcessing={isProcessing}
              onListeningStart={startListening}
              onListeningStop={stopListening}
              transcribedText={transcribedText}
              translatedText={translatedText}
              isTTSEnabled={isTTSEnabled}
            />

            <MessageDisplay 
              messages={messages} 
              currentLanguage={supportedLanguages[0].name}
            />
          </>
        )}

        {error && (
          <div className="fixed top-20 inset-x-0 z-[70] flex justify-center">
            <div className="w-[calc(100%-2rem)] max-w-md">
              <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 shadow-lg animate-slideDown">
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm leading-5">{error}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}