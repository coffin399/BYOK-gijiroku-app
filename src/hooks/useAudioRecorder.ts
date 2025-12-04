import { useState, useRef, useCallback, useEffect } from 'react';
import { RecordingSource } from '@/types';

interface UseAudioRecorderReturn {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioLevel: number;
  audioBlob: Blob | null;
  error: string | null;
  browserSupport: BrowserSupport;
  startRecording: (source: RecordingSource) => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
}

interface BrowserSupport {
  microphone: boolean;
  systemAudio: boolean;
  mediaRecorder: boolean;
  browserName: string;
}

// Detect browser and capabilities
function detectBrowserSupport(): BrowserSupport {
  const ua = navigator.userAgent;
  let browserName = 'Unknown';
  
  if (ua.includes('Firefox')) {
    browserName = 'Firefox';
  } else if (ua.includes('Chrome')) {
    browserName = 'Chrome';
  } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
    browserName = 'Safari';
  } else if (ua.includes('Edge')) {
    browserName = 'Edge';
  }

  const hasGetUserMedia = !!(navigator.mediaDevices?.getUserMedia);
  const hasGetDisplayMedia = !!(navigator.mediaDevices?.getDisplayMedia);
  const hasMediaRecorder = typeof MediaRecorder !== 'undefined';

  // Firefox supports getDisplayMedia but system audio capture is limited
  // Chrome/Edge have full support
  // Safari has limited support
  const systemAudioSupport = hasGetDisplayMedia && (browserName === 'Chrome' || browserName === 'Edge');

  return {
    microphone: hasGetUserMedia,
    systemAudio: systemAudioSupport,
    mediaRecorder: hasMediaRecorder,
    browserName,
  };
}

// Get supported MIME types
function getSupportedMimeType(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
    'audio/mpeg',
  ];

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  return 'audio/webm'; // Fallback
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [browserSupport] = useState<BrowserSupport>(() => detectBrowserSupport());

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, []);

  // Audio level monitoring
  const monitorAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    
    const updateLevel = () => {
      if (!analyserRef.current || !isRecording) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      setAudioLevel(average / 255);
      
      animationFrameRef.current = requestAnimationFrame(updateLevel);
    };
    
    updateLevel();
  }, [isRecording]);

  // Start recording
  const startRecording = useCallback(async (source: RecordingSource) => {
    try {
      setError(null);
      chunksRef.current = [];
      setAudioBlob(null);
      setDuration(0);

      let stream: MediaStream;

      if (source === 'system' || source === 'both') {
        // System audio capture
        if (!browserSupport.systemAudio) {
          // Firefox fallback: use microphone only with warning
          if (browserSupport.browserName === 'Firefox') {
            setError('Firefox does not support system audio capture. Using microphone only.');
            source = 'microphone';
          } else {
            throw new Error('Your browser does not support system audio capture. Please use Chrome or Edge.');
          }
        }

        if (source !== 'microphone') {
          try {
            // Request display media for system audio
            const displayStream = await navigator.mediaDevices.getDisplayMedia({
              video: true, // Required but we'll ignore it
              audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
              } as MediaTrackConstraints,
            });

            // Get audio tracks only
            const audioTracks = displayStream.getAudioTracks();
            
            if (audioTracks.length === 0) {
              // Stop video tracks
              displayStream.getVideoTracks().forEach((track) => track.stop());
              throw new Error('System audio not selected. Please enable "Share system audio" option.');
            }

            // Stop video tracks as we don't need them
            displayStream.getVideoTracks().forEach((track) => track.stop());

            if (source === 'both') {
              // Combine with microphone
              const micStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                  echoCancellation: true,
                  noiseSuppression: true,
                  autoGainControl: true,
                },
              });

              // Create audio context to mix streams
              const audioContext = new AudioContext();
              const destination = audioContext.createMediaStreamDestination();
              
              const systemSource = audioContext.createMediaStreamSource(new MediaStream(audioTracks));
              const micSource = audioContext.createMediaStreamSource(micStream);
              
              // Adjust gains
              const systemGain = audioContext.createGain();
              const micGain = audioContext.createGain();
              systemGain.gain.value = 1.0;
              micGain.gain.value = 0.8;
              
              systemSource.connect(systemGain);
              micSource.connect(micGain);
              systemGain.connect(destination);
              micGain.connect(destination);
              
              stream = destination.stream;
              audioContextRef.current = audioContext;
            } else {
              stream = new MediaStream(audioTracks);
            }
          } catch (err) {
            if (err instanceof Error && err.name === 'NotAllowedError') {
              throw new Error('Screen sharing was cancelled.');
            }
            throw new Error('Failed to capture system audio. Please try again.');
          }
        }
      }
      
      if (source === 'microphone') {
        // Microphone only
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      }

      streamRef.current = stream!;

      // Setup audio analysis
      const audioContext = audioContextRef.current || new AudioContext();
      audioContextRef.current = audioContext;
      
      // Resume audio context if suspended (Firefox requirement)
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      const sourceNode = audioContext.createMediaStreamSource(stream!);
      sourceNode.connect(analyser);
      analyserRef.current = analyser;

      // Get supported MIME type
      const mimeType = getSupportedMimeType();

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream!, {
        mimeType,
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setError('Recording error occurred.');
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setIsPaused(false);

      // Start duration timer
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);

      // Start audio level monitoring
      monitorAudioLevel();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start recording';
      setError(message);
      cleanup();
    }
  }, [cleanup, monitorAudioLevel, browserSupport]);

  // Stop recording
  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.onstop = () => {
          const mimeType = getSupportedMimeType();
          const blob = new Blob(chunksRef.current, { type: mimeType });
          setAudioBlob(blob);
          setIsRecording(false);
          setIsPaused(false);
          cleanup();
          resolve(blob);
        };
        mediaRecorderRef.current.stop();
      } else {
        setIsRecording(false);
        setIsPaused(false);
        cleanup();
        resolve(null);
      }
    });
  }, [cleanup]);

  // Pause recording
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, []);

  // Resume recording
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    isRecording,
    isPaused,
    duration,
    audioLevel,
    audioBlob,
    error,
    browserSupport,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  };
}
