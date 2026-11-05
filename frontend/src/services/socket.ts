import { io, Socket } from 'socket.io-client';
import { RoverStatus, Telemetry, RoverCommand, Alert } from '../types';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const socketUrl = window.location.port === '3000' ? 'http://localhost:8000' : window.location.origin;

    socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      timeout: 10000,
    });

    socket.on('connect', () => {
      console.log('🟢 [Socket.IO] Connected to AgriRover IoT Backend:', socket?.id);
    });

    socket.on('disconnect', (reason: string) => {
      console.warn('🔴 [Socket.IO] Disconnected from IoT Backend:', reason);
    });

    socket.on('connect_error', (err: Error) => {
      console.warn('⚠️ [Socket.IO] Connection error:', err.message);
    });
  }

  return socket;
}

export const socketService = {
  getSocket,

  onRoverStatus: (callback: (status: RoverStatus) => void): (() => void) => {
    const s = getSocket();
    const handler = (data: RoverStatus) => callback(data);
    s.on('rover:status', handler);
    s.on('rover_status', handler);
    return () => {
      s.off('rover:status', handler);
      s.off('rover_status', handler);
    };
  },

  onTelemetry: (callback: (telemetry: Telemetry) => void): (() => void) => {
    const s = getSocket();
    const handler = (data: Telemetry) => callback(data);
    s.on('rover:telemetry', handler);
    s.on('rover_telemetry', handler);
    return () => {
      s.off('rover:telemetry', handler);
      s.off('rover_telemetry', handler);
    };
  },

  onCommandIssued: (callback: (cmd: RoverCommand) => void): (() => void) => {
    const s = getSocket();
    const handler = (data: RoverCommand) => callback(data);
    s.on('rover:command:issued', handler);
    s.on('rover_command_issued', handler);
    return () => {
      s.off('rover:command:issued', handler);
      s.off('rover_command_issued', handler);
    };
  },

  onCommandAck: (callback: (ack: RoverCommand) => void): (() => void) => {
    const s = getSocket();
    const handler = (data: RoverCommand) => callback(data);
    s.on('rover:command:ack', handler);
    s.on('rover_command_ack', handler);
    return () => {
      s.off('rover:command:ack', handler);
      s.off('rover_command_ack', handler);
    };
  },

  onAlert: (callback: (alert: Alert) => void): (() => void) => {
    const s = getSocket();
    const handler = (data: Alert) => callback(data);
    s.on('rover:alert', handler);
    s.on('rover_alert', handler);
    return () => {
      s.off('rover:alert', handler);
      s.off('rover_alert', handler);
    };
  },
};
