
import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { TextAreaInput } from './components/TextAreaInput';
import { VoiceSelector } from './components/VoiceSelector';
import { ActionButton } from './components/ActionButton';
import { PlayIcon, StopIcon, VolumeUpIcon, EraserIcon, DownloadIcon } from './components/icons';

const App: React.FC = () => {
  const [text, setText] = useState<string>('');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pitch, setPitch] = useState<number>(1);
  const [rate, setRate] = useState<number>(1);

  const getSpeechSynthesisErrorCodeText = (errorCode: SpeechSynthesisErrorCode | string | undefined): string => {
    if (!errorCode) return "알 수 없는 오류";
    switch (errorCode) {
      case 'canceled':
        return "음성 변환이 취소되었습니다.";
      case 'interrupted':
        return "음성 변환이 중단되었습니다.";
      case 'audio-busy':
        return "오디오 장치가 사용 중입니다. 잠시 후 다시 시도해주세요.";
      case 'audio-hardware':
        return "오디오 하드웨어 오류가 발생했습니다. 출력 장치를 확인해주세요.";
      case 'network':
        return "네트워크 문제로 음성 변환에 실패했습니다. (일부 목소리는 인터넷 연결 필요)";
      case 'synthesis-unavailable':
        return "음성 합성 엔진을 사용할 수 없습니다.";
      case 'synthesis-failed':
        return "음성 합성에 실패했습니다. 다른 목소리나 텍스트로 시도해보세요.";
      case 'language-unavailable':
        return "선택한 언어를 지원하는 음성 엔진이 없습니다.";
      case 'voice-unavailable':
        return "선택한 목소리를 사용할 수 없습니다. 다른 목소리를 선택해주세요.";
      case 'text-too-long':
        return "입력된 텍스트가 너무 깁니다. 짧게 줄여주세요.";
      case 'invalid-argument':
        return "음성 변환 설정(텍스트, 속도, 높낮이 등)에 잘못된 값이 있습니다.";
      case 'not-allowed':
        return "음성 변환 권한이 없습니다. 브라우저 설정을 확인해주세요.";
      case 'not-supported':
         return "이 기능이 현재 브라우저에서 지원되지 않습니다.";
      default:
        return `알 수 없는 오류 (${errorCode}). 다른 목소리를 시도해보세요.`;
    }
  };


  useEffect(() => {
    const loadVoices = () => {
      setIsLoading(true);
      try {
        const availableVoices = window.speechSynthesis.getVoices();
        if (availableVoices.length > 0) {
          setVoices(availableVoices);
          const koreanVoice = availableVoices.find(voice => voice.lang.startsWith('ko-KR'));
          if (koreanVoice) {
            setSelectedVoiceURI(koreanVoice.voiceURI);
          } else {
            const defaultEngVoice = availableVoices.find(voice => voice.lang.startsWith('en-US'));
            setSelectedVoiceURI(defaultEngVoice ? defaultEngVoice.voiceURI : availableVoices[0]?.voiceURI);
          }
          setError(null);
        } else if (voices.length === 0) {
           // Keep retrying or inform user after a timeout if still no voices.
        }
      } catch (e) {
        console.error("Error loading voices:", e);
        setError("음성 목록을 불러오는 데 실패했습니다. 브라우저가 Web Speech API를 지원하는지 확인해주세요.");
      } finally {
        setIsLoading(false);
      }
    };
    
    if (typeof window.speechSynthesis === 'undefined') {
         setError("Web Speech API가 이 브라우저에서 지원되지 않습니다.");
         setIsLoading(false);
         return;
    }
    
    // Attempt to load voices immediately
    loadVoices();

    // speechSynthesis.onvoiceschanged event is crucial for asynchronously loaded voices
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
    };
  }, []); 

  const handleSpeak = useCallback(() => {
    if (!text.trim()) {
      setError("읽을 텍스트를 입력해주세요.");
      return;
    }
    if (voices.length === 0) {
      setError("사용 가능한 음성이 없습니다. 잠시 후 다시 시도하거나 브라우저 설정을 확인해주세요.");
      return;
    }
    
    let voiceToUseURI = selectedVoiceURI;
    if (!voiceToUseURI && voices.length > 0) {
        voiceToUseURI = voices[0].voiceURI;
        setSelectedVoiceURI(voiceToUseURI); 
    }
    
    if (!voiceToUseURI) {
      setError("목소리를 선택해주세요 또는 사용 가능한 목소리가 없습니다.");
      return;
    }

    setError(null);
    const utterance = new SpeechSynthesisUtterance(text);
    const selectedVoiceObject = voices.find(voice => voice.voiceURI === voiceToUseURI);
    
    utterance.voice = selectedVoiceObject || (voices.length > 0 ? voices[0] : null);
    if (!utterance.voice && voices.length > 0) { // Fallback if selected voice somehow becomes invalid
        utterance.voice = voices[0];
        setSelectedVoiceURI(voices[0].voiceURI); // Update state to reflect fallback
        console.warn("Selected voice not found, falling back to the first available voice.");
    } else if (!utterance.voice) {
        setError("선택된 목소리를 찾을 수 없거나 사용 가능한 목소리가 없습니다.");
        setIsSpeaking(false);
        return;
    }

    utterance.pitch = pitch;
    utterance.rate = rate;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
      console.error("SpeechSynthesisUtterance.onerror event:", event);
      console.error("Error code:", event.error);
      const errorMessage = getSpeechSynthesisErrorCodeText(event.error);
      setError(`음성 변환 중 오류: ${errorMessage}`);
      setIsSpeaking(false);
    };

    window.speechSynthesis.cancel(); // Cancel any ongoing speech
    window.speechSynthesis.speak(utterance);
  }, [text, selectedVoiceURI, voices, pitch, rate]);

  const handleStop = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const handleClearText = useCallback(() => {
    setText('');
    setError(null); // Clear error when text is cleared
    if (isSpeaking) {
      handleStop();
    }
  }, [isSpeaking, handleStop]);

  const handleDownloadSpeech = useCallback(() => {
    if (!text.trim()) {
      setError("다운로드할 텍스트를 입력해주세요.");
      return;
    }
    setError("음성 파일 다운로드 기능은 브라우저 TTS와 직접 연동이 어려워 현재 지원되지 않습니다. 이 기능은 향후 개선될 예정입니다.");
    setTimeout(() => {
        // Clear only this specific message
        if (error === "음성 파일 다운로드 기능은 브라우저 TTS와 직접 연동이 어려워 현재 지원되지 않습니다. 이 기능은 향후 개선될 예정입니다.") {
            setError(null);
        }
    }, 5000);
  }, [text, error]);


  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900 text-slate-100 selection:bg-sky-500 selection:text-white">
      <div className="w-full max-w-2xl bg-slate-800 shadow-2xl rounded-xl p-6 md:p-8 space-y-6 transform transition-all duration-500 hover:scale-[1.01]">
        <Header title="AI 텍스트 음성 변환기" icon={<VolumeUpIcon className="w-8 h-8 text-sky-400" />} />

        {isLoading && voices.length === 0 && <p className="text-center text-sky-400 animate-pulse">목소리 목록을 불러오는 중입니다...</p>}
        {error && <p className="text-center text-red-400 bg-red-900/30 p-3 rounded-md" role="alert">{error}</p>}

        <TextAreaInput
          value={text}
          onChange={(e) => {setText(e.target.value); if(error && error !== "음성 파일 다운로드 기능은 브라우저 TTS와 직접 연동이 어려워 현재 지원되지 않습니다. 이 기능은 향후 개선될 예정입니다.") setError(null);}}
          placeholder="여기에 변환할 텍스트를 입력하세요..."
          disabled={isSpeaking}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <VoiceSelector
            voices={voices}
            selectedVoiceURI={selectedVoiceURI}
            onChange={(e) => setSelectedVoiceURI(e.target.value)}
            disabled={isSpeaking || voices.length === 0}
            isLoading={isLoading && voices.length === 0}
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="pitch" className="block text-sm font-medium text-slate-300 mb-1">음높이 ({pitch.toFixed(1)})</label>
              <input
                type="range"
                id="pitch"
                min="0.5"
                max="2"
                step="0.1"
                value={pitch}
                onChange={(e) => setPitch(parseFloat(e.target.value))}
                disabled={isSpeaking}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500 disabled:opacity-50"
                aria-label="음높이 조절"
              />
            </div>
            <div>
              <label htmlFor="rate" className="block text-sm font-medium text-slate-300 mb-1">속도 ({rate.toFixed(1)})</label>
              <input
                type="range"
                id="rate"
                min="0.5"
                max="2"
                step="0.1"
                value={rate}
                onChange={(e) => setRate(parseFloat(e.target.value))}
                disabled={isSpeaking}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500 disabled:opacity-50"
                aria-label="재생 속도 조절"
              />
            </div>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
          {!isSpeaking ? (
            <ActionButton
              onClick={handleSpeak}
              disabled={!text.trim() || voices.length === 0 || (isLoading && voices.length === 0)}
              className="bg-sky-600 hover:bg-sky-500 w-full"
              aria-label="음성 변환 시작"
            >
              <PlayIcon className="w-5 h-5 mr-2" />
              음성 변환
            </ActionButton>
          ) : (
            <ActionButton
              onClick={handleStop}
              className="bg-amber-600 hover:bg-amber-500 w-full"
              aria-label="재생 정지"
            >
              <StopIcon className="w-5 h-5 mr-2" />
              정지
            </ActionButton>
          )}
          <ActionButton
            onClick={handleDownloadSpeech}
            disabled={!text.trim() || isSpeaking}
            className="bg-green-600 hover:bg-green-500 w-full sm:w-auto"
            title="음성 다운로드 (현재 미지원)"
            aria-label="음성 파일 다운로드"
          >
            <DownloadIcon className="w-5 h-5" />
            <span className="sm:hidden ml-2">다운로드</span>
          </ActionButton>
          <ActionButton
            onClick={handleClearText}
            disabled={!text.trim() && !error} 
            className="bg-slate-600 hover:bg-slate-500 w-full sm:w-auto"
            title="텍스트 지우기"
            aria-label="입력된 텍스트 지우기"
          >
            <EraserIcon className="w-5 h-5" />
             <span className="sm:hidden ml-2">텍스트 지우기</span>
          </ActionButton>
        </div>
      </div>
      <footer className="mt-8 text-center text-slate-400 text-sm">
        <p>&copy; {new Date().getFullYear()} AI Voice. Web Speech API 기반.</p>
        <p className="text-xs mt-1">참고: 목소리 목록은 사용자의 브라우저 및 운영체제에 따라 다를 수 있습니다.</p>
      </footer>
    </div>
  );
};

export default App;
