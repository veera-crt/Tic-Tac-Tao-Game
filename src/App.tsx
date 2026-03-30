import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, User, Cpu, X, Circle, Users, Copy, Check, MessageSquare } from 'lucide-react';
import confetti from 'canvas-confetti';
import { io, Socket } from 'socket.io-client';
import type { Player, Difficulty } from './logic/minimax';
import { checkWinner, getBestMove } from './logic/minimax';
import './index.css';

type GameMode = 'AI' | 'FRIEND';

const SERVER_URL = ''; // Relative URL for same-origin

const App: React.FC = () => {
  // Splash Screen State
  const [showWelcome, setShowWelcome] = useState<boolean>(true);
  
  // Common State
  const [mode, setMode] = useState<GameMode>('AI');
  const [board, setBoard] = useState<Player[]>(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState<boolean>(true);
  const [winnerInfo, setWinnerInfo] = useState<{ winner: Player; line: number[] | null }>({
    winner: null,
    line: null,
  });
  const [scores, setScores] = useState({ X: 0, O: 0, T: 0 });

  // Loading & Request states
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [opponentReadyToRestart, setOpponentReadyToRestart] = useState<boolean>(false);
  const [readyToRestart, setReadyToRestart] = useState<boolean>(false);

  // AI Mode State
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [isThinking, setIsThinking] = useState<boolean>(false);

  // Friend Mode State
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string>('');
  const [mySymbol, setMySymbol] = useState<'X' | 'O' | null>(null);
  const [players, setPlayers] = useState<{ username: string; symbol: string }[]>([]);
  const [showRoomOverlay, setShowRoomOverlay] = useState<boolean>(false);
  const [inputRoomId, setInputRoomId] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Auto-hide Welcome Screen
  useEffect(() => {
    const timer = setTimeout(() => setShowWelcome(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Initialize Socket
  useEffect(() => {
    const newSocket = io(SERVER_URL);
    setSocket(newSocket);
    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('player-info', (playersList) => setPlayers(playersList));
    socket.on('board-update', ({ board: newBoard, isXNext: nextX, scores: updatedScores }) => {
      setBoard(newBoard);
      setIsXNext(nextX);
      if (updatedScores) setScores(updatedScores);
    });
    socket.on('sync-state', ({ board: newBoard, isXNext: nextX, scores: currentScores }) => {
      setBoard(newBoard);
      setIsXNext(nextX);
      setScores(currentScores);
    });
    socket.on('opponent-wants-again', () => setOpponentReadyToRestart(true));
    socket.on('reset-board', ({ board: newBoard, isXNext: nextX }) => {
      setBoard(newBoard);
      setIsXNext(nextX);
      setWinnerInfo({ winner: null, line: null });
      setOpponentReadyToRestart(false);
      setReadyToRestart(false);
    });
    return () => {
      socket.off('player-info');
      socket.off('board-update');
      socket.off('sync-state');
      socket.off('opponent-wants-again');
      socket.off('reset-board');
    };
  }, [socket]);

  const resetGame = useCallback(() => {
    if (mode === 'AI') {
      setBoard(Array(9).fill(null));
      setIsXNext(true);
      setWinnerInfo({ winner: null, line: null });
    } else if (roomId && currentUserId) {
      setReadyToRestart(true);
      socket?.emit('request-play-again', { roomId, userId: currentUserId });
    }
  }, [mode, roomId, currentUserId, socket]);

  useEffect(() => {
    if (mode === 'AI' && !isXNext && !winnerInfo.winner) {
      setIsThinking(true);
      const timer = setTimeout(() => {
        const move = getBestMove(board, difficulty);
        if (move !== -1) {
          const newBoard = [...board];
          newBoard[move] = 'O';
          setBoard(newBoard);
        }
        setIsXNext(true);
        setIsThinking(false);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isXNext, board, difficulty, winnerInfo.winner, mode]);

  useEffect(() => {
    const result = checkWinner(board);
    if (result.winner && !winnerInfo.winner) {
      setWinnerInfo(result);
      if (result.winner === 'X') {
        if (mode === 'AI' || (mode === 'FRIEND' && mySymbol === 'X')) {
          confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#38bdf8', '#818cf8', '#f8fafc'] });
        }
        if (mode === 'AI') setScores(prev => ({ ...prev, X: prev.X + 1 }));
      } else if (result.winner === 'O') {
        if (mode === 'FRIEND' && mySymbol === 'O') {
          confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#f472b6', '#818cf8', '#f8fafc'] });
        }
        if (mode === 'AI') setScores(prev => ({ ...prev, O: prev.O + 1 }));
      } else if (result.winner === 'T' && mode === 'AI') {
        setScores(prev => ({ ...prev, T: prev.T + 1 }));
      }
    }
  }, [board, mode, mySymbol, winnerInfo.winner]);

  const handleClick = (index: number) => {
    if (board[index] || winnerInfo.winner || isThinking) return;
    if (mode === 'AI') {
      if (!isXNext) return;
      const newBoard = [...board];
      newBoard[index] = 'X';
      setBoard(newBoard);
      setIsXNext(false);
    } else {
      if (!roomId || mySymbol !== (isXNext ? 'X' : 'O')) return;
      const newBoard = [...board];
      newBoard[index] = mySymbol;
      const res = checkWinner(newBoard);
      socket?.emit('make-move', { roomId, index, symbol: mySymbol, winner: res.winner });
    }
  };

  const createRoom = async () => {
    if (!username) return alert('Enter username');
    setIsCreating(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      setRoomId(data.roomId);
      setCurrentUserId(data.userId);
      setMySymbol('X');
      setShowRoomOverlay(false);
      socket?.emit('join-room', { roomId: data.roomId, userId: data.userId });
    } catch (err) { console.error(err); }
    finally { setIsCreating(false); }
  };

  const joinRoom = async () => {
    if (!username || !inputRoomId) return alert('Enter username and room ID');
    setIsJoining(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/rooms/${inputRoomId.toUpperCase()}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setRoomId(data.roomId);
      setCurrentUserId(data.userId);
      setMySymbol('O');
      setShowRoomOverlay(false);
      socket?.emit('join-room', { roomId: data.roomId, userId: data.userId });
    } catch (err: any) { alert(err.message || 'Room not found'); }
    finally { setIsJoining(false); }
  };

  const copyRoomId = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getPlayerName = (symbol: 'X' | 'O') => {
    if (mode === 'AI') return symbol === 'X' ? 'YOU' : 'AI';
    return players.find(p => p.symbol === symbol)?.username || (symbol === 'X' ? 'P1' : 'P2');
  };

  return (
    <div className="container">
      {/* Welcome Splash Screen */}
      {showWelcome && (
        <div className="welcome-overlay">
          <div className="welcome-content">
            <h2 className="welcome-title">Welcome</h2>
            <div className="welcome-divider"></div>
            <p className="welcome-credits">Developed by <span className="dev-name">veerapandi</span></p>
          </div>
        </div>
      )}

      <div className="mode-selector">
        <button className={`mode-btn ${mode === 'AI' ? 'active' : ''}`} onClick={() => { setMode('AI'); resetGame(); setRoomId(null); setScores({ X: 0, O: 0, T: 0 }); }}>
          <Cpu size={16} /> AI
        </button>
        <button className={`mode-btn ${mode === 'FRIEND' ? 'active' : ''}`} onClick={() => { setMode('FRIEND'); if (!roomId) setShowRoomOverlay(true); }}>
          <Users size={16} /> Friend
        </button>
      </div>

      <h1>Tic Tac Toe</h1>

      {mode === 'AI' ? (
        <div className="difficulty-selector">
          {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
            <button key={d} className={`difficulty-btn ${difficulty === d ? 'active' : ''}`} onClick={() => { setDifficulty(d); resetGame(); }}>
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
      ) : (
        <div className="room-panel">
          {roomId ? (
            <>
              <div className="room-id-display" onClick={copyRoomId}>
                {roomId} {copied ? <Check size={16} color="#4ade80" /> : <Copy size={16} />}
              </div>
              <div className="player-names">
                <span style={{ color: mySymbol === 'X' ? 'var(--accent-blue)' : '' }}>{getPlayerName('X')} (X)</span>
                <span style={{ color: mySymbol === 'O' ? 'var(--accent-pink)' : '' }}>{getPlayerName('O')} (O)</span>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', opacity: 0.7 }}>Select Friend mode to join a room</div>
          )}
        </div>
      )}

      <div className="scoreboard">
        <div className="score-card">
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', opacity: '0.7', fontWeight: '700' }}>
            <User size={12} /> {getPlayerName('X')} (X)
          </span>
          <span>{scores.X}</span>
        </div>
        <div className="score-card">
          <span style={{ fontSize: '0.75rem', opacity: '0.7', fontWeight: '700' }}>TIES</span>
          <span>{scores.T}</span>
        </div>
        <div className="score-card">
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', opacity: '0.7', fontWeight: '700' }}>
            {mode === 'AI' ? <Cpu size={12} /> : <User size={12} />} {getPlayerName('O')} (O)
          </span>
          <span>{scores.O}</span>
        </div>
      </div>

      {mode === 'FRIEND' && roomId && !winnerInfo.winner && (
        <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '-1rem' }}>
          {mySymbol === (isXNext ? 'X' : 'O') ? "It's your turn!" : "Waiting for opponent..."}
        </div>
      )}

      {mode === 'FRIEND' && roomId && !winnerInfo.winner && players.length < 2 && (
        <div style={{ color: 'var(--accent-blue)', fontSize: '0.9rem', animation: 'pulse 1.5s infinite' }}>Waiting for friend to join...</div>
      )}

      <div className="board">
        {board.map((val, i) => (
          <div
            key={i}
            className={`cell ${val === 'X' ? 'x' : val === 'O' ? 'o' : ''} ${winnerInfo.line?.includes(i) ? 'winning' : ''}`}
            onClick={() => handleClick(i)}
          >
            {val === 'X' && <X size={48} />}
            {val === 'O' && <Circle size={40} />}
          </div>
        ))}
      </div>

      <div className="actions">
        <button className="btn btn-primary" onClick={resetGame} disabled={readyToRestart}>
          {readyToRestart ? <RefreshCw size={20} className="spin" /> : <RefreshCw size={20} />}
          {readyToRestart ? 'Waiting...' : 'Play Again'}
        </button>
      </div>

      {opponentReadyToRestart && !readyToRestart && (
        <div className="status-msg" style={{ background: 'rgba(56, 189, 248, 0.2)', padding: '0.5rem', borderRadius: '0.5rem', marginTop: '0.5rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <MessageSquare size={14} />
          Opponent wants to play again!
        </div>
      )}

      {winnerInfo.winner && (
        <div style={{ marginTop: '0.5rem', fontWeight: 600, fontSize: '1.1rem' }}>
          {winnerInfo.winner === 'T' ? "It's a Tie!" : winnerInfo.winner === 'X' ? `${getPlayerName('X')} Won!` : `${getPlayerName('O')} Won!`}
        </div>
      )}

      {!winnerInfo.winner && board.every(c => c === null) && roomId && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--accent-blue)' }}>
          Game Start! Player X starts first.
        </div>
      )}

      {showRoomOverlay && (
        <div className="overlay">
          <div className="room-panel" style={{ background: '#1e293b', border: '1px solid var(--accent-blue)' }}>
            <h3 style={{ marginBottom: '1rem', textAlign: 'center' }}>Multiplayer</h3>
            <input type="text" placeholder="Your Name" className="input-field" value={username} onChange={(e) => setUsername(e.target.value)} disabled={isCreating || isJoining} />
            <button className="btn btn-primary" onClick={createRoom} disabled={isCreating || isJoining} style={{ marginTop: '1rem' }}>{isCreating ? 'Creating...' : 'Create Room'}</button>
            <div style={{ borderTop: '1px solid var(--glass-border)', margin: '1rem 0' }}></div>
            <input type="text" placeholder="Room Code" className="input-field" value={inputRoomId} onChange={(e) => setInputRoomId(e.target.value)} disabled={isCreating || isJoining} />
            <button className="btn" style={{ background: 'var(--cell-bg)', color: 'white', marginTop: '0.5rem' }} onClick={joinRoom} disabled={isCreating || isJoining}>{isJoining ? 'Joining...' : 'Join Room'}</button>
            {!isCreating && !isJoining && (
              <button className="btn" style={{ background: 'transparent', color: '#94a3b8', fontSize: '0.8rem' }} onClick={() => setShowRoomOverlay(false)}>Cancel</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
