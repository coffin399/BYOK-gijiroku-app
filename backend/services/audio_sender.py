"""
Audio Sender Service
Send audio from this PC to another PC running the GIJIROKU app
"""

import asyncio
import logging
import socket
import struct
import threading
from typing import Optional, List
from dataclasses import dataclass

logger = logging.getLogger(__name__)

try:
    import pyaudio
    PYAUDIO_AVAILABLE = True
except ImportError:
    PYAUDIO_AVAILABLE = False


@dataclass
class SenderSession:
    """Active sender session"""
    id: str
    device_index: int
    target_host: str
    target_port: int
    sample_rate: int
    channels: int
    is_sending: bool = False


class AudioSenderService:
    """
    Send audio to another PC over the network
    """
    
    def __init__(self):
        self.sessions: dict[str, SenderSession] = {}
        self._lock = threading.Lock()
    
    async def start_sending(
        self,
        session_id: str,
        device_index: int,
        target_host: str,
        target_port: int,
        sample_rate: int = 16000,
        channels: int = 1,
        use_wasapi_loopback: bool = False
    ) -> bool:
        """
        Start sending audio to target host
        
        Args:
            session_id: Unique session identifier
            device_index: Audio device index to capture from
            target_host: Target PC IP address
            target_port: Target PC port
            sample_rate: Sample rate
            channels: Number of channels
            use_wasapi_loopback: Use WASAPI loopback for system audio
        """
        if not PYAUDIO_AVAILABLE:
            raise RuntimeError("PyAudio not available")
        
        with self._lock:
            if session_id in self.sessions:
                raise ValueError(f"Session {session_id} already exists")
            
            session = SenderSession(
                id=session_id,
                device_index=device_index,
                target_host=target_host,
                target_port=target_port,
                sample_rate=sample_rate,
                channels=channels,
                is_sending=True
            )
            self.sessions[session_id] = session
        
        asyncio.create_task(self._send_loop(session, use_wasapi_loopback))
        
        logger.info(f"Started sending audio to {target_host}:{target_port}")
        return True
    
    async def _send_loop(self, session: SenderSession, use_wasapi_loopback: bool):
        """Send audio to target host"""
        import pyaudio
        
        p = pyaudio.PyAudio()
        client_socket = None
        stream = None
        
        try:
            # Connect to target
            client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            client_socket.connect((session.target_host, session.target_port))
            logger.info(f"Connected to {session.target_host}:{session.target_port}")
            
            # Get device info
            dev_info = p.get_device_info_by_index(session.device_index)
            
            # Open audio stream
            if use_wasapi_loopback:
                try:
                    stream = p.open(
                        format=pyaudio.paInt16,
                        channels=min(2, dev_info.get('maxOutputChannels', 2)),
                        rate=int(dev_info.get('defaultSampleRate', session.sample_rate)),
                        input=True,
                        input_device_index=session.device_index,
                        frames_per_buffer=1024,
                        as_loopback=True
                    )
                    actual_rate = int(dev_info.get('defaultSampleRate', session.sample_rate))
                except Exception as e:
                    logger.warning(f"WASAPI loopback failed, using regular input: {e}")
                    stream = p.open(
                        format=pyaudio.paInt16,
                        channels=session.channels,
                        rate=session.sample_rate,
                        input=True,
                        input_device_index=session.device_index,
                        frames_per_buffer=1024
                    )
                    actual_rate = session.sample_rate
            else:
                stream = p.open(
                    format=pyaudio.paInt16,
                    channels=session.channels,
                    rate=session.sample_rate,
                    input=True,
                    input_device_index=session.device_index,
                    frames_per_buffer=1024
                )
                actual_rate = session.sample_rate
            
            # Send loop
            while session.is_sending:
                try:
                    # Read audio
                    audio_data = stream.read(1024, exception_on_overflow=False)
                    
                    # Create packet: [length (4 bytes)][sample_rate (4 bytes)][audio data]
                    header = struct.pack('!II', len(audio_data), actual_rate)
                    packet = header + audio_data
                    
                    # Send
                    client_socket.sendall(packet)
                    
                except Exception as e:
                    logger.error(f"Send error: {e}")
                    break
                
                await asyncio.sleep(0.01)
                
        except Exception as e:
            logger.error(f"Sender error: {e}")
        finally:
            if stream:
                stream.stop_stream()
                stream.close()
            if client_socket:
                client_socket.close()
            p.terminate()
            
            with self._lock:
                if session.id in self.sessions:
                    del self.sessions[session.id]
    
    async def stop_sending(self, session_id: str) -> bool:
        """Stop sending audio"""
        with self._lock:
            if session_id not in self.sessions:
                return False
            
            self.sessions[session_id].is_sending = False
        
        await asyncio.sleep(0.5)
        
        with self._lock:
            if session_id in self.sessions:
                del self.sessions[session_id]
        
        return True
    
    def get_session_status(self, session_id: str) -> Optional[dict]:
        """Get sender session status"""
        with self._lock:
            if session_id not in self.sessions:
                return None
            
            session = self.sessions[session_id]
            return {
                "id": session.id,
                "device_index": session.device_index,
                "target_host": session.target_host,
                "target_port": session.target_port,
                "is_sending": session.is_sending
            }


# Singleton
_audio_sender_service: Optional[AudioSenderService] = None


def get_audio_sender_service() -> AudioSenderService:
    global _audio_sender_service
    if _audio_sender_service is None:
        _audio_sender_service = AudioSenderService()
    return _audio_sender_service



