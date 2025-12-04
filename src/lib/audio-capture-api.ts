/**
 * Audio Capture API Client
 * - Direct WASAPI Loopback (no VB-Cable needed)
 * - Virtual audio devices
 * - Network audio streaming from other PCs
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export interface AudioDevice {
  index: number;
  name: string;
  channels: number;
  sample_rate: number;
  is_loopback: boolean;
  is_wasapi_loopback: boolean;
  host_api: string;
}

export interface AudioCapabilities {
  sounddevice: boolean;
  pyaudio: boolean;
  wasapi_loopback: boolean;
  network_streaming: boolean;
}

export interface AudioDevicesResponse {
  devices: AudioDevice[];
  loopback_devices: AudioDevice[];
  wasapi_loopback_devices: AudioDevice[];
}

export interface CaptureStartResponse {
  status: string;
  session_id: string;
  devices: number[];
  use_wasapi_loopback: boolean;
  network_port: number | null;
}

export interface CaptureStopResponse {
  status: string;
  session_id: string;
  audio_base64: string;
  format: string;
  size: number;
}

export interface CaptureStatusResponse {
  id: string;
  is_recording: boolean;
  devices: number[];
  sample_rate: number;
  channels: number;
  data_size: number;
  use_wasapi_loopback: boolean;
  network_port: number | null;
  network_clients: number;
}

export interface NetworkInfo {
  hostname: string;
  ip_addresses: string[];
  default_port: number;
  connection_string: string;
}

export interface SendStartResponse {
  status: string;
  session_id: string;
  target: string;
}

/**
 * Get audio capture capabilities
 */
export async function getAudioCapabilities(): Promise<AudioCapabilities> {
  const response = await fetch(`${BACKEND_URL}/api/audio/capabilities`);
  
  if (!response.ok) {
    throw new Error('Failed to get audio capabilities');
  }
  
  return response.json();
}

/**
 * Get available audio devices from backend
 */
export async function getAudioDevices(): Promise<AudioDevicesResponse> {
  const response = await fetch(`${BACKEND_URL}/api/audio/devices`);
  
  if (!response.ok) {
    throw new Error('Failed to get audio devices');
  }
  
  return response.json();
}

/**
 * Start audio capture from specified devices
 */
export async function startCapture(
  sessionId: string,
  deviceIndices: number[],
  options: {
    sampleRate?: number;
    channels?: number;
    useWasapiLoopback?: boolean;
    networkPort?: number;
  } = {}
): Promise<CaptureStartResponse> {
  const {
    sampleRate = 16000,
    channels = 1,
    useWasapiLoopback = false,
    networkPort,
  } = options;

  const params = new URLSearchParams({
    session_id: sessionId,
    device_indices: deviceIndices.join(','),
    sample_rate: sampleRate.toString(),
    channels: channels.toString(),
    use_wasapi_loopback: useWasapiLoopback.toString(),
  });

  if (networkPort) {
    params.set('network_port', networkPort.toString());
  }

  const response = await fetch(`${BACKEND_URL}/api/audio/capture/start?${params}`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to start capture');
  }

  return response.json();
}

/**
 * Stop audio capture and get WAV data
 */
export async function stopCapture(sessionId: string): Promise<Blob> {
  const params = new URLSearchParams({ session_id: sessionId });
  
  const response = await fetch(`${BACKEND_URL}/api/audio/capture/stop?${params}`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to stop capture');
  }

  const data: CaptureStopResponse = await response.json();
  
  // Convert base64 to Blob
  const binaryString = atob(data.audio_base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  return new Blob([bytes], { type: 'audio/wav' });
}

/**
 * Get capture session status
 */
export async function getCaptureStatus(sessionId: string): Promise<CaptureStatusResponse> {
  const response = await fetch(`${BACKEND_URL}/api/audio/capture/status/${sessionId}`);

  if (!response.ok) {
    throw new Error('Session not found');
  }

  return response.json();
}

/**
 * Get network info for this PC
 */
export async function getNetworkInfo(): Promise<NetworkInfo> {
  const response = await fetch(`${BACKEND_URL}/api/network/info`);

  if (!response.ok) {
    throw new Error('Failed to get network info');
  }

  return response.json();
}

/**
 * Start sending audio to another PC
 */
export async function startAudioSend(
  sessionId: string,
  deviceIndex: number,
  targetHost: string,
  targetPort: number,
  options: {
    sampleRate?: number;
    channels?: number;
    useWasapiLoopback?: boolean;
  } = {}
): Promise<SendStartResponse> {
  const {
    sampleRate = 16000,
    channels = 1,
    useWasapiLoopback = false,
  } = options;

  const params = new URLSearchParams({
    session_id: sessionId,
    device_index: deviceIndex.toString(),
    target_host: targetHost,
    target_port: targetPort.toString(),
    sample_rate: sampleRate.toString(),
    channels: channels.toString(),
    use_wasapi_loopback: useWasapiLoopback.toString(),
  });

  const response = await fetch(`${BACKEND_URL}/api/audio/send/start?${params}`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to start audio send');
  }

  return response.json();
}

/**
 * Stop sending audio
 */
export async function stopAudioSend(sessionId: string): Promise<void> {
  const params = new URLSearchParams({ session_id: sessionId });
  
  const response = await fetch(`${BACKEND_URL}/api/audio/send/stop?${params}`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to stop audio send');
  }
}

/**
 * Check if backend audio capture is available
 */
export async function isBackendCaptureAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/audio/devices`, {
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
