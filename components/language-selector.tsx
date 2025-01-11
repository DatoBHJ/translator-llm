import { Button } from './ui/button';
import { Mic, Loader2, Volume2 } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';

interface LanguageSelectorProps {
  onRecordingStart: () => void;
  onRecordingStop: () => void;
  onListeningStart: () => void;
  onListeningStop: () => void;
  isRecording: boolean;
  isListening: boolean;
  isProcessing?: boolean;
  transcribedText?: string;
  translatedText?: string;
  showWelcomeMessage?: boolean;
  currentMode?: string;
  isTTSEnabled: boolean;
}

export function LanguageSelector({
  onRecordingStart,
  onRecordingStop,
  onListeningStart,
  onListeningStop,
  isRecording,
  isListening,
  isProcessing = false,
  transcribedText,
  translatedText,
  showWelcomeMessage = false,
  currentMode = "Quiet Room",
  isTTSEnabled
}: LanguageSelectorProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const previousTranscribedTextRef = useRef<string | undefined>(transcribedText);
  const previousTranslatedTextRef = useRef<string | undefined>(translatedText);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const ttsEnableTimeRef = useRef<number>(0);
  const lastTranslationTimeRef = useRef<number>(0);
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio context and silent audio
  useEffect(() => {
    // Create a silent audio element
    const silentAudio = new Audio("data:audio/mp3;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBQbHVzIMKpIE5DSCBTb2Z0d2FyZQBUSVQyAAAABgAAAzIyMzUAVFNTRQAAAA8AAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV");
    silentAudio.setAttribute('playsinline', 'true');
    silentAudio.setAttribute('webkit-playsinline', 'true');
    silentAudioRef.current = silentAudio;

    // Create audio context
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    setAudioContext(ctx);

    // Resume audio context on user interaction
    const resumeAudioContext = () => {
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      silentAudio.play().catch(() => {});
      document.removeEventListener('touchstart', resumeAudioContext);
      document.removeEventListener('click', resumeAudioContext);
    };

    document.addEventListener('touchstart', resumeAudioContext);
    document.addEventListener('click', resumeAudioContext);

    return () => {
      document.removeEventListener('touchstart', resumeAudioContext);
      document.removeEventListener('click', resumeAudioContext);
      if (silentAudioRef.current) {
        silentAudioRef.current.pause();
        silentAudioRef.current = null;
      }
    };
  }, []);

  // Update previous text refs when new text arrives
  useEffect(() => {
    if (transcribedText) {
      previousTranscribedTextRef.current = transcribedText;
    }
  }, [transcribedText]);

  // Track when TTS is enabled
  useEffect(() => {
    if (isTTSEnabled) {
      ttsEnableTimeRef.current = Date.now();
    }
  }, [isTTSEnabled]);

  // Track when new translations arrive
  useEffect(() => {
    if (translatedText !== previousTranslatedTextRef.current) {
      lastTranslationTimeRef.current = Date.now();
      previousTranslatedTextRef.current = translatedText;
    }
  }, [translatedText]);

  // Handle TTS playback
  useEffect(() => {
    if (!translatedText || !isTTSEnabled) return;

    // Only play TTS if the translation came after TTS was enabled
    const shouldPlayTTS = lastTranslationTimeRef.current >= ttsEnableTimeRef.current;
    
    if (shouldPlayTTS) {
      // Try to resume audio context and play silent audio first
      if (audioContext?.state === 'suspended') {
        audioContext.resume();
      }
      silentAudioRef.current?.play().catch(() => {});

      // Wait longer to ensure we have the complete translation
      const timeoutId = setTimeout(() => {
        // Double check if we have a complete sentence
        if (
          translatedText.endsWith('.') || 
          translatedText.endsWith('!') || 
          translatedText.endsWith('?') ||
          translatedText === previousTranslatedTextRef.current
        ) {
          playTranslatedText();
        }
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [translatedText, isTTSEnabled, audioContext]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setIsScrolled(scrollPosition > 100);
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      cleanupAudio();
    };
  }, []);

  const cleanupAudio = () => {
    // Abort any ongoing fetch request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Cleanup audio element
    if (audioRef.current) {
      const audio = audioRef.current;
      
      // Remove all event listeners
      audio.oncanplaythrough = null;
      audio.onended = null;
      audio.onerror = null;
      audio.onloadstart = null;
      audio.onloadeddata = null;
      
      // Stop and cleanup
      audio.pause();
      audio.currentTime = 0;
      audio.src = ''; // Clear source
      audio.load(); // Reset audio element
      audioRef.current = null;
    }

    // Cleanup URL
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }

    setIsPlaying(false);
    setIsLoadingAudio(false);
  };

  const playTranslatedText = async () => {
    if (!translatedText || isPlaying || isLoadingAudio) return;
    
    try {
      // Try to resume audio context and play silent audio first
      if (audioContext?.state === 'suspended') {
        await audioContext.resume();
      }
      await silentAudioRef.current?.play().catch(() => {});

      cleanupAudio(); // Cleanup any existing audio first
      setIsLoadingAudio(true);
      
      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();
      
      const response = await fetch('/api/speech/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: translatedText,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to generate speech');
      }

      const audioBlob = await response.blob();
      
      // Verify blob is audio
      if (!audioBlob.type.startsWith('audio/')) {
        throw new Error(`Invalid audio format: ${audioBlob.type}`);
      }
      
      const audioUrl = URL.createObjectURL(audioBlob);
      audioUrlRef.current = audioUrl;
      
      const audio = new Audio();
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('webkit-playsinline', 'true');
      
      // Set up audio event handlers before setting source
      audio.oncanplaythrough = () => {
        setIsLoadingAudio(false);
        setIsPlaying(true);
      };
      
      audio.onended = () => {
        cleanupAudio();
      };
      
      audio.onerror = () => {
        console.error('Audio playback error:', {
          error: audio.error,
          networkState: audio.networkState,
          readyState: audio.readyState,
          currentSrc: audio.currentSrc,
        });
        cleanupAudio();
      };

      // Only store the audio reference after all event handlers are set
      audioRef.current = audio;
      
      // Set source and load
      audio.src = audioUrl;
      
      try {
        // Try multiple times with increasing delays
        for (let i = 0; i < 3; i++) {
          try {
            await audio.play();
            break;
          } catch (error) {
            if (i === 2) throw error;
            await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, i)));
            // Try to resume audio context and play silent audio before retrying
            if (audioContext?.state === 'suspended') {
              await audioContext.resume();
            }
            await silentAudioRef.current?.play().catch(() => {});
          }
        }
      } catch (error) {
        const playError = error as Error & { code?: number };
        console.error('Audio play failed:', {
          error: playError,
          name: playError.name,
          message: playError.message,
          code: playError.code,
          userAgent: navigator.userAgent
        });
        cleanupAudio();
        throw playError;
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Audio fetch aborted');
      } else {
        console.error('Failed to play audio:', error);
      }
      cleanupAudio();
    }
  };

  const handleButtonClick = () => {
    if (isListening) {
      onListeningStop();
    } else {
      onListeningStart();
    }
  };

  return (
    <div className="relative min-h-[60vh] bg-white">
      {showWelcomeMessage && (
        <div className="text-center space-y-8 pt-24">
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="text-neutral-600 text-sm tracking-wide">
                "English Spanish"
              </p>
              <p className="text-neutral-600 text-sm tracking-wide">
                "한국어 中文"
              </p>
              <p className="text-neutral-600 text-sm tracking-wide">
                "Русский алрбية"
              </p>
              <p className="text-neutral-600 text-sm tracking-wide">
                "Español Português"
              </p>
              <p className="text-neutral-600 text-sm tracking-wide">
                "日本語 Deutsch"
              </p>
            </div>
          </div>
        </div>
      )}

      {(previousTranscribedTextRef.current || transcribedText) && (
        <div className="text-center mt-10 space-y-4">
          <p className="text-sm text-gray-500">
            "{previousTranscribedTextRef.current || transcribedText}"
          </p>
          {(translatedText) && (
            <div className="flex flex-col items-center">
              <div className="space-y-2">
                <p className="text-xl font-medium text-gray-900">
                  {translatedText}
                </p>
                {isTTSEnabled && (
                  <button
                    onClick={playTranslatedText}
                    disabled={isPlaying || isLoadingAudio || isRecording || isProcessing}
                    className={`
                      w-10 h-10 rounded-full mx-auto
                      flex items-center justify-center
                      transition-all duration-200 bg-gray-50
                      ${(isPlaying || isLoadingAudio || isRecording || isProcessing) 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:bg-gray-100 cursor-pointer'}
                    `}
                    aria-label="Play translation"
                  >
                    <Volume2 className="w-5 h-5 text-gray-600" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className={`
        fixed bottom-28 left-0 right-0 h-32 bg-transparent 
        flex flex-col items-center justify-center
        transition-opacity duration-300 ease-in-out
        ${isScrolled ? 'opacity-0' : 'opacity-100'}
      `}>
        <Button
          variant="outline"
          size="lg"
          className={`
            w-24 h-24 min-w-[96px] min-h-[96px] max-w-[96px] max-h-[96px] rounded-full border 
            ${isRecording ? 'border-red-500' : isListening ? 'border-green-500' : 'border-neutral-200'} 
            bg-white hover:bg-white
            transition-all duration-500 ease-in-out
            ${(isProcessing) ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          onClick={handleButtonClick}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <Loader2 className="w-8 h-8 text-neutral-400 animate-spin" />
          ) : (
            <Mic className={`w-8 h-8 ${isRecording ? 'text-red-500' : isListening ? 'text-green-500' : 'text-neutral-400'}`} />
          )}
        </Button>

        <div className="flex flex-col items-center mt-6">
          <div className="text-[10px] tracking-[0.25em] uppercase text-neutral-400 font-light">
            {isProcessing 
              ? "Processing"
              : isRecording 
                ? "Recording"
                : isListening && showWelcomeMessage
                  ? "Speak Two"
                  : isListening
                    ? "Speaking"
                    : "Tap"}
          </div>
        </div>
      </div>
    </div>
  );
} 