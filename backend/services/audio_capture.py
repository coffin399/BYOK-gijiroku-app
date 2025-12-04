"""
Audio Capture Service
- Direct system audio capture via WASAPI Loopback (Windows)
- Virtual audio devices (VB-Cable, Voicemeeter)
- Network audio streaming (receive from other PCs)
"""

import asyncio
import logging
import wave
import io
import threading
import socket
import struct
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field
from datetime import datetime
import numpy as np

logger = logging.getLogger(__name__)

# Try to import audio libraries
SOUNDDEVICE_AVAILABLE = False
PYAUDIO_AVAILABLE = False
WASAPI_AVAILABLE = False

try:
    import sounddevice as sd
    SOUNDDEVICE_AVAILABLE = True
except ImportError:
    logger.warning("sounddevice not installed. Run: pip install sounddevice")

try:
    import pyaudio
    PYAUDIO_AVAILABLE = True
    # Check for WASAPI support on Windows
    try:
        p = pyaudio.PyAudio()
        for i in range(p.get_host_api_count()):
            api = p.get_host_api_info_by_index(i)
            if 'WASAPI' in api['name']:
                WASAPI_AVAILABLE = True
                break
        p.terminate()
    except:
        pass
except ImportError:
    logger.warning("pyaudio not installed. Run: pip install pyaudio")


@dataclass
class AudioDevice:
    """Audio device information"""
    index: int
    name: str
    channels: int
    sample_rate: int
    is_input: bool
    is_loopback: bool = False
    is_wasapi_loopback: bool = False
    host_api: str = ""
    host_api_index: int = 0


@dataclass
class CaptureSession:
    """Active capture session"""
    id: str
    devices: List[int]
    sample_rate: int
    channels: int
    is_recording: bool = False
    audio_data: List[bytes] = field(default_factory=list)
    use_wasapi_loopback: bool = False
    network_port: Optional[int] = None


@dataclass
class NetworkAudioClient:
    """Connected network audio client"""
    address: str
    port: int
    connected_at: datetime
    buffer: List[bytes] = field(default_factory=list)


class AudioCaptureService:
    """
    Multi-source audio capture service
    - Direct WASAPI Loopback capture (no VB-Cable needed)
    - Virtual audio devices
    - Network audio streaming from other PCs
    """
    
    def __init__(self):
        self.sessions: Dict[str, CaptureSession] = {}
        self.network_clients: Dict[str, NetworkAudioClient] = {}
        self._lock = threading.Lock()
        self._network_server: Optional[socket.socket] = None
        self._network_thread: Optional[threading.Thread] = None
        self._network_running = False
        
    def get_available_devices(self) -> List[AudioDevice]:
        """
        Get list of available audio devices
        Including WASAPI loopback devices for direct system audio capture
        """
        devices = []
        
        if PYAUDIO_AVAILABLE:
            try:
                p = pyaudio.PyAudio()
                
                # Find WASAPI host API index
                wasapi_api_index = -1
                for i in range(p.get_host_api_count()):
                    api = p.get_host_api_info_by_index(i)
                    if 'WASAPI' in api['name']:
                        wasapi_api_index = i
                        break
                
                for i in range(p.get_device_count()):
                    try:
                        dev = p.get_device_info_by_index(i)
                        host_api = p.get_host_api_info_by_index(dev['hostApi'])
                        host_api_name = host_api['name']
                        
                        # Check if this is a WASAPI device
                        is_wasapi = 'WASAPI' in host_api_name
                        
                        # WASAPI output devices can be used for loopback capture
                        is_wasapi_loopback = is_wasapi and dev['maxOutputChannels'] > 0
                        
                        # Regular input device
                        is_input = dev['maxInputChannels'] > 0
                        
                        # Virtual audio device detection
                        is_virtual = any(keyword in dev['name'].lower() for keyword in [
                            'loopback', 'stereo mix', 'what u hear', 'wave out',
                            'vb-cable', 'voicemeeter', 'blackhole', 'virtual'
                        ])
                        
                        if is_input or is_wasapi_loopback:
                            devices.append(AudioDevice(
                                index=i,
                                name=dev['name'],
                                channels=max(dev['maxInputChannels'], dev['maxOutputChannels']),
                                sample_rate=int(dev['defaultSampleRate']),
                                is_input=is_input,
                                is_loopback=is_virtual or is_wasapi_loopback,
                                is_wasapi_loopback=is_wasapi_loopback,
                                host_api=host_api_name,
                                host_api_index=dev['hostApi']
                            ))
                    except Exception as e:
                        logger.debug(f"Error getting device {i}: {e}")
                        continue
                        
                p.terminate()
            except Exception as e:
                logger.error(f"Failed to query devices with pyaudio: {e}")
        
        elif SOUNDDEVICE_AVAILABLE:
            try:
                device_list = sd.query_devices()
                host_apis = sd.query_hostapis()
                
                for i, dev in enumerate(device_list):
                    if dev['max_input_channels'] > 0:
                        host_api_name = host_apis[dev['hostapi']]['name']
                        
                        is_loopback = any(keyword in dev['name'].lower() for keyword in [
                            'loopback', 'stereo mix', 'what u hear', 'wave out',
                            'vb-cable', 'voicemeeter', 'blackhole', 'virtual'
                        ])
                        
                        devices.append(AudioDevice(
                            index=i,
                            name=dev['name'],
                            channels=dev['max_input_channels'],
                            sample_rate=int(dev['default_samplerate']),
                            is_input=True,
                            is_loopback=is_loopback,
                            is_wasapi_loopback=False,
                            host_api=host_api_name,
                            host_api_index=dev['hostapi']
                        ))
            except Exception as e:
                logger.error(f"Failed to query devices with sounddevice: {e}")
        
        return devices
    
    def get_loopback_devices(self) -> List[AudioDevice]:
        """Get only loopback devices for system audio capture"""
        return [d for d in self.get_available_devices() if d.is_loopback]
    
    def get_wasapi_loopback_devices(self) -> List[AudioDevice]:
        """Get WASAPI loopback devices (direct system audio, no VB-Cable)"""
        return [d for d in self.get_available_devices() if d.is_wasapi_loopback]
    
    async def start_capture(
        self,
        session_id: str,
        device_indices: List[int],
        sample_rate: int = 16000,
        channels: int = 1,
        use_wasapi_loopback: bool = False,
        network_port: Optional[int] = None
    ) -> bool:
        """
        Start capturing audio from multiple sources
        
        Args:
            session_id: Unique session identifier
            device_indices: List of device indices to capture from
            sample_rate: Sample rate (default 16000 for speech recognition)
            channels: Number of channels (default 1 for mono)
            use_wasapi_loopback: Use WASAPI loopback for direct system audio
            network_port: Port to receive network audio (None to disable)
        """
        if not SOUNDDEVICE_AVAILABLE and not PYAUDIO_AVAILABLE:
            raise RuntimeError("No audio library available. Install sounddevice or pyaudio.")
        
        with self._lock:
            if session_id in self.sessions:
                raise ValueError(f"Session {session_id} already exists")
            
            session = CaptureSession(
                id=session_id,
                devices=device_indices,
                sample_rate=sample_rate,
                channels=channels,
                is_recording=True,
                use_wasapi_loopback=use_wasapi_loopback,
                network_port=network_port
            )
            self.sessions[session_id] = session
        
        # Start capture in background
        if use_wasapi_loopback and WASAPI_AVAILABLE:
            asyncio.create_task(self._capture_wasapi_loopback(session))
        else:
            asyncio.create_task(self._capture_loop(session))
        
        # Start network receiver if port specified
        if network_port:
            asyncio.create_task(self._start_network_receiver(session, network_port))
        
        logger.info(f"Started capture session {session_id} from devices {device_indices}")
        return True
    
    async def _capture_wasapi_loopback(self, session: CaptureSession):
        """Capture system audio directly via WASAPI loopback"""
        import pyaudio
        
        p = pyaudio.PyAudio()
        chunk_size = 1024
        streams = []
        buffers = [[] for _ in session.devices]
        
        try:
            # Find WASAPI host API
            wasapi_api_index = -1
            for i in range(p.get_host_api_count()):
                api = p.get_host_api_info_by_index(i)
                if 'WASAPI' in api['name']:
                    wasapi_api_index = i
                    break
            
            if wasapi_api_index == -1:
                raise RuntimeError("WASAPI not available")
            
            # Open loopback streams for each device
            for i, device_idx in enumerate(session.devices):
                dev_info = p.get_device_info_by_index(device_idx)
                
                # For WASAPI loopback, we need to open as output device for capture
                # This is a special PyAudio feature for WASAPI
                try:
                    stream = p.open(
                        format=pyaudio.paInt16,
                        channels=min(2, dev_info.get('maxOutputChannels', 2)),
                        rate=int(dev_info.get('defaultSampleRate', 44100)),
                        input=True,
                        input_device_index=device_idx,
                        frames_per_buffer=chunk_size,
                        as_loopback=True  # WASAPI loopback mode
                    )
                    streams.append((stream, i))
                    logger.info(f"Opened WASAPI loopback for device {device_idx}: {dev_info['name']}")
                except Exception as e:
                    logger.warning(f"Could not open WASAPI loopback for device {device_idx}: {e}")
                    # Fallback to regular input if available
                    if dev_info.get('maxInputChannels', 0) > 0:
                        stream = p.open(
                            format=pyaudio.paInt16,
                            channels=session.channels,
                            rate=session.sample_rate,
                            input=True,
                            input_device_index=device_idx,
                            frames_per_buffer=chunk_size
                        )
                        streams.append((stream, i))
            
            # Capture loop
            while session.is_recording:
                for stream, buf_idx in streams:
                    try:
                        data = stream.read(chunk_size, exception_on_overflow=False)
                        buffers[buf_idx].append(data)
                    except Exception as e:
                        logger.error(f"Read error: {e}")
                
                await asyncio.sleep(0.01)
                
                # Periodically mix and store
                if buffers[0] and len(buffers[0]) >= 50:
                    mixed = self._mix_pyaudio_buffers(buffers, session.sample_rate)
                    if mixed:
                        session.audio_data.append(mixed)
                    for buf in buffers:
                        buf.clear()
                        
        except Exception as e:
            logger.error(f"WASAPI loopback capture error: {e}")
            # Fallback to regular capture
            await self._capture_with_pyaudio(session)
        finally:
            for stream, _ in streams:
                try:
                    stream.stop_stream()
                    stream.close()
                except:
                    pass
            p.terminate()
    
    async def _capture_loop(self, session: CaptureSession):
        """Background capture loop"""
        if PYAUDIO_AVAILABLE:
            await self._capture_with_pyaudio(session)
        elif SOUNDDEVICE_AVAILABLE:
            await self._capture_with_sounddevice(session)
    
    async def _capture_with_sounddevice(self, session: CaptureSession):
        """Capture using sounddevice library"""
        import sounddevice as sd
        
        chunk_duration = 0.5
        chunk_samples = int(session.sample_rate * chunk_duration)
        
        streams = []
        buffers = [[] for _ in session.devices]
        
        def make_callback(buf_idx):
            def callback(indata, frames, time, status):
                if status:
                    logger.warning(f"Audio callback status: {status}")
                buffers[buf_idx].append(indata.copy())
            return callback
        
        try:
            for i, device_idx in enumerate(session.devices):
                stream = sd.InputStream(
                    device=device_idx,
                    channels=session.channels,
                    samplerate=session.sample_rate,
                    blocksize=chunk_samples,
                    callback=make_callback(i)
                )
                stream.start()
                streams.append(stream)
            
            while session.is_recording:
                await asyncio.sleep(chunk_duration)
                
                mixed = self._mix_audio_buffers(buffers, session.sample_rate)
                if mixed is not None:
                    session.audio_data.append(mixed)
                
                for buf in buffers:
                    buf.clear()
                    
        finally:
            for stream in streams:
                stream.stop()
                stream.close()
    
    async def _capture_with_pyaudio(self, session: CaptureSession):
        """Capture using pyaudio library"""
        import pyaudio
        
        p = pyaudio.PyAudio()
        chunk_size = 1024
        streams = []
        buffers = [[] for _ in session.devices]
        
        try:
            for i, device_idx in enumerate(session.devices):
                stream = p.open(
                    format=pyaudio.paInt16,
                    channels=session.channels,
                    rate=session.sample_rate,
                    input=True,
                    input_device_index=device_idx,
                    frames_per_buffer=chunk_size
                )
                streams.append(stream)
            
            while session.is_recording:
                for i, stream in enumerate(streams):
                    try:
                        data = stream.read(chunk_size, exception_on_overflow=False)
                        buffers[i].append(data)
                    except Exception as e:
                        logger.error(f"Read error: {e}")
                
                await asyncio.sleep(0.01)
                
                if len(buffers[0]) >= 50:
                    mixed = self._mix_pyaudio_buffers(buffers, session.sample_rate)
                    if mixed:
                        session.audio_data.append(mixed)
                    for buf in buffers:
                        buf.clear()
                        
        finally:
            for stream in streams:
                stream.stop_stream()
                stream.close()
            p.terminate()
    
    # ==========================================
    # Network Audio Streaming
    # ==========================================
    
    async def _start_network_receiver(self, session: CaptureSession, port: int):
        """Start receiving audio from network clients"""
        try:
            server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            server.bind(('0.0.0.0', port))
            server.listen(5)
            server.setblocking(False)
            
            self._network_server = server
            self._network_running = True
            
            logger.info(f"Network audio receiver started on port {port}")
            
            while session.is_recording and self._network_running:
                try:
                    # Accept new connections
                    try:
                        client_socket, address = server.accept()
                        client_socket.setblocking(False)
                        client_id = f"{address[0]}:{address[1]}"
                        self.network_clients[client_id] = NetworkAudioClient(
                            address=address[0],
                            port=address[1],
                            connected_at=datetime.now()
                        )
                        logger.info(f"Network client connected: {client_id}")
                        
                        # Start client handler
                        asyncio.create_task(self._handle_network_client(
                            session, client_socket, client_id
                        ))
                    except BlockingIOError:
                        pass
                    
                    await asyncio.sleep(0.1)
                    
                except Exception as e:
                    logger.error(f"Network receiver error: {e}")
                    break
                    
        except Exception as e:
            logger.error(f"Failed to start network receiver: {e}")
        finally:
            if self._network_server:
                self._network_server.close()
                self._network_server = None
    
    async def _handle_network_client(
        self, 
        session: CaptureSession, 
        client_socket: socket.socket,
        client_id: str
    ):
        """Handle incoming audio from a network client"""
        try:
            buffer = b''
            header_size = 8  # 4 bytes length + 4 bytes sample rate
            
            while session.is_recording and client_id in self.network_clients:
                try:
                    # Read header
                    while len(buffer) < header_size:
                        try:
                            data = client_socket.recv(4096)
                            if not data:
                                raise ConnectionResetError("Client disconnected")
                            buffer += data
                        except BlockingIOError:
                            await asyncio.sleep(0.01)
                            continue
                    
                    # Parse header
                    chunk_length = struct.unpack('!I', buffer[:4])[0]
                    chunk_sample_rate = struct.unpack('!I', buffer[4:8])[0]
                    buffer = buffer[header_size:]
                    
                    # Read audio chunk
                    while len(buffer) < chunk_length:
                        try:
                            data = client_socket.recv(4096)
                            if not data:
                                raise ConnectionResetError("Client disconnected")
                            buffer += data
                        except BlockingIOError:
                            await asyncio.sleep(0.01)
                            continue
                    
                    audio_chunk = buffer[:chunk_length]
                    buffer = buffer[chunk_length:]
                    
                    # Resample if needed and add to session
                    if chunk_sample_rate != session.sample_rate:
                        audio_chunk = self._resample_audio(
                            audio_chunk, chunk_sample_rate, session.sample_rate
                        )
                    
                    # Add to network client buffer
                    if client_id in self.network_clients:
                        self.network_clients[client_id].buffer.append(audio_chunk)
                        
                        # Mix network audio into session
                        if len(self.network_clients[client_id].buffer) >= 10:
                            mixed = b''.join(self.network_clients[client_id].buffer)
                            session.audio_data.append(mixed)
                            self.network_clients[client_id].buffer.clear()
                    
                except BlockingIOError:
                    await asyncio.sleep(0.01)
                except ConnectionResetError:
                    break
                    
        except Exception as e:
            logger.error(f"Network client handler error: {e}")
        finally:
            client_socket.close()
            if client_id in self.network_clients:
                del self.network_clients[client_id]
            logger.info(f"Network client disconnected: {client_id}")
    
    def _resample_audio(self, audio: bytes, from_rate: int, to_rate: int) -> bytes:
        """Resample audio data"""
        if from_rate == to_rate:
            return audio
        
        # Convert to numpy
        samples = np.frombuffer(audio, dtype=np.int16).astype(np.float32)
        
        # Calculate new length
        new_length = int(len(samples) * to_rate / from_rate)
        
        # Resample using linear interpolation
        indices = np.linspace(0, len(samples) - 1, new_length)
        resampled = np.interp(indices, np.arange(len(samples)), samples)
        
        return resampled.astype(np.int16).tobytes()
    
    def _mix_audio_buffers(self, buffers: List[List[np.ndarray]], sample_rate: int) -> Optional[bytes]:
        """Mix audio from multiple numpy buffers"""
        if not any(buffers):
            return None
        
        arrays = []
        for buf in buffers:
            if buf:
                arrays.append(np.concatenate(buf, axis=0))
        
        if not arrays:
            return None
        
        max_len = max(arr.shape[0] for arr in arrays)
        padded = []
        for arr in arrays:
            if arr.shape[0] < max_len:
                padding = np.zeros((max_len - arr.shape[0], arr.shape[1]))
                arr = np.concatenate([arr, padding], axis=0)
            padded.append(arr)
        
        mixed = np.mean(padded, axis=0)
        mixed = (mixed * 32767).astype(np.int16)
        
        return mixed.tobytes()
    
    def _mix_pyaudio_buffers(self, buffers: List[List[bytes]], sample_rate: int = 16000) -> Optional[bytes]:
        """Mix audio from multiple pyaudio buffers"""
        if not any(buffers):
            return None
        
        arrays = []
        for buf in buffers:
            if buf:
                data = b''.join(buf)
                arr = np.frombuffer(data, dtype=np.int16).astype(np.float32)
                arrays.append(arr)
        
        if not arrays:
            return None
        
        max_len = max(len(arr) for arr in arrays)
        padded = [np.pad(arr, (0, max_len - len(arr))) for arr in arrays]
        
        mixed = np.mean(padded, axis=0)
        mixed = np.clip(mixed, -32768, 32767).astype(np.int16)
        
        return mixed.tobytes()
    
    async def stop_capture(self, session_id: str) -> Optional[bytes]:
        """Stop capture and return audio data as WAV"""
        with self._lock:
            if session_id not in self.sessions:
                return None
            
            session = self.sessions[session_id]
            session.is_recording = False
        
        # Stop network receiver
        self._network_running = False
        
        await asyncio.sleep(0.5)
        
        if not session.audio_data:
            return None
        
        audio_bytes = b''.join(session.audio_data)
        
        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, 'wb') as wav:
            wav.setnchannels(session.channels)
            wav.setsampwidth(2)
            wav.setframerate(session.sample_rate)
            wav.writeframes(audio_bytes)
        
        wav_buffer.seek(0)
        
        with self._lock:
            del self.sessions[session_id]
        
        logger.info(f"Stopped capture session {session_id}, {len(audio_bytes)} bytes")
        return wav_buffer.read()
    
    def get_session_status(self, session_id: str) -> Optional[dict]:
        """Get status of a capture session"""
        with self._lock:
            if session_id not in self.sessions:
                return None
            
            session = self.sessions[session_id]
            return {
                "id": session.id,
                "is_recording": session.is_recording,
                "devices": session.devices,
                "sample_rate": session.sample_rate,
                "channels": session.channels,
                "data_size": sum(len(d) for d in session.audio_data),
                "use_wasapi_loopback": session.use_wasapi_loopback,
                "network_port": session.network_port,
                "network_clients": len(self.network_clients)
            }
    
    def get_capabilities(self) -> dict:
        """Get available capabilities"""
        return {
            "sounddevice": SOUNDDEVICE_AVAILABLE,
            "pyaudio": PYAUDIO_AVAILABLE,
            "wasapi_loopback": WASAPI_AVAILABLE,
            "network_streaming": True
        }


# Singleton instance
_audio_capture_service: Optional[AudioCaptureService] = None


def get_audio_capture_service() -> AudioCaptureService:
    global _audio_capture_service
    if _audio_capture_service is None:
        _audio_capture_service = AudioCaptureService()
    return _audio_capture_service
