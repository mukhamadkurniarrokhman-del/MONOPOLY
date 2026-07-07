import { useEffect, useState } from 'react';
import { useGameStore } from './store/useGameStore.js';
import Home from './components/Home.jsx';
import Lobby from './components/Lobby.jsx';
import GameScreen from './components/GameScreen.jsx';
import { initAudio, isMuted, setMuted } from './audio/audioManager.js';
import './network/socket.js'; // establish connection + listeners

function MuteButton() {
  const [muted, setMutedState] = useState(isMuted());
  return (
    <button
      data-testid="btn-mute"
      onClick={() => {
        setMuted(!muted);
        setMutedState(!muted);
      }}
      title={muted ? 'Nyalakan suara' : 'Bisukan suara'}
      className="fixed top-4 right-44 z-50 rounded-full border border-white/15 bg-space-900/80 px-3 py-1 text-xs backdrop-blur transition hover:bg-white/10"
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
}

function ConnectionBadge() {
  const connection = useGameStore((s) => s.connection);
  const styles = {
    connected: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    connecting: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
    disconnected: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
    error: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
  };
  const labels = {
    connected: '● Terhubung ke server',
    connecting: '● Menghubungkan…',
    disconnected: '● Terputus',
    error: '● Server tidak ditemukan',
  };
  return (
    <span
      data-testid="conn-status"
      data-state={connection}
      className={`fixed top-4 right-4 z-50 rounded-full border px-3 py-1 text-xs font-medium ${styles[connection]}`}
    >
      {labels[connection]}
    </span>
  );
}

export default function App() {
  const screen = useGameStore((s) => s.screen);
  useEffect(() => initAudio(), []);

  if (screen === 'game') {
    return (
      <>
        <ConnectionBadge />
        <MuteButton />
        <GameScreen />
      </>
    );
  }
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <ConnectionBadge />
      <MuteButton />
      {screen === 'home' && <Home />}
      {screen === 'lobby' && <Lobby />}
    </div>
  );
}
