import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { initDb, query } from './db';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());

const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

initDb().then(() => console.log('DB Initialized')).catch(console.error);

// API
app.post('/api/rooms', async (req, res) => {
  const { username } = req.body;
  const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
  try {
    const emptyBoard = Array(9).fill(null);
    await query('INSERT INTO rooms (room_id, board) VALUES ($1, $2)', [roomId, JSON.stringify(emptyBoard)]);
    const result = await query('INSERT INTO players (room_id, username, symbol) VALUES ($1, $2, $3) RETURNING user_id', [roomId, username, 'X']);
    res.json({ roomId, userId: result.rows[0].user_id, symbol: 'X' });
  } catch (err) { res.status(500).send('Error'); }
});

app.post('/api/rooms/:roomId/join', async (req, res) => {
  const { roomId } = req.params;
  const { username } = req.body;
  try {
    const roomCheck = await query('SELECT * FROM rooms WHERE room_id = $1', [roomId]);
    if (roomCheck.rows.length === 0) return res.status(404).send('Not found');
    const result = await query('INSERT INTO players (room_id, username, symbol) VALUES ($1, $2, $3) RETURNING user_id', [roomId, username, 'O']);
    res.json({ roomId, userId: result.rows[0].user_id, symbol: 'O' });
  } catch (err) { res.status(500).send('Error'); }
});

// Final middleware for SPA - avoid using string wildcards to prevent path-to-regexp crashes
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.includes('.') || req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

// Socket logic
const playAgainRequesters: Record<string, Set<string>> = {};
io.on('connection', (socket) => {
  socket.on('join-room', async ({ roomId, userId }) => {
    socket.join(roomId);
    const players = await query('SELECT username, symbol FROM players WHERE room_id = $1', [roomId]);
    const roomData = await query('SELECT board, is_x_next, x_wins, o_wins, ties FROM rooms WHERE room_id = $1', [roomId]);
    if (roomData.rows[0]) {
      socket.emit('sync-state', { board: roomData.rows[0].board, isXNext: roomData.rows[0].is_x_next, scores: { X: roomData.rows[0].x_wins, O: roomData.rows[0].o_wins, T: roomData.rows[0].ties } });
    }
    io.to(roomId).emit('player-info', players.rows);
  });

  socket.on('make-move', async ({ roomId, index, symbol, winner }) => {
    try {
      const roomData = await query('SELECT board, is_x_next FROM rooms WHERE room_id = $1', [roomId]);
      if (!roomData.rows[0]) return;
      const board = roomData.rows[0].board;
      if (board[index] || (symbol === 'X' && !roomData.rows[0].is_x_next) || (symbol === 'O' && roomData.rows[0].is_x_next)) return;
      board[index] = symbol;
      const nextX = symbol === 'O';
      let q = winner ? `UPDATE rooms SET board = $1, is_x_next = $2, ${winner === 'X' ? 'x_wins = x_wins + 1' : winner === 'O' ? 'o_wins = o_wins + 1' : 'ties = ties + 1'} WHERE room_id = $3` : `UPDATE rooms SET board = $1, is_x_next = $2 WHERE room_id = $3`;
      await query(q, [JSON.stringify(board), nextX, roomId]);
      const updated = await query('SELECT x_wins, o_wins, ties FROM rooms WHERE room_id = $1', [roomId]);
      io.to(roomId).emit('board-update', { board, isXNext: nextX, scores: { X: updated.rows[0].x_wins, O: updated.rows[0].o_wins, T: updated.rows[0].ties } });
    } catch (err) { console.error(err); }
  });

  socket.on('request-play-again', async ({ roomId, userId }) => {
    if (!playAgainRequesters[roomId]) playAgainRequesters[roomId] = new Set();
    playAgainRequesters[roomId].add(userId);
    const playersInRoom = await query('SELECT user_id FROM players WHERE room_id = $1', [roomId]);
    if (playAgainRequesters[roomId].size >= playersInRoom.rows.length && playersInRoom.rows.length >= 2) {
      const emptyBoard = Array(9).fill(null);
      await query('UPDATE rooms SET board = $1, is_x_next = TRUE WHERE room_id = $2', [JSON.stringify(emptyBoard), roomId]);
      playAgainRequesters[roomId].clear();
      io.to(roomId).emit('reset-board', { board: emptyBoard, isXNext: true });
    } else {
      socket.to(roomId).emit('opponent-wants-again');
    }
  });

  socket.on('disconnecting', async () => {
    const rooms = Array.from(socket.rooms);
    for (const roomId of rooms) {
      if (roomId !== socket.id) {
        setTimeout(async () => {
          const roomSize = (await io.in(roomId).allSockets()).size;
          if (roomSize === 0) {
            await query('DELETE FROM players WHERE room_id = $1', [roomId]);
            await query('DELETE FROM rooms WHERE room_id = $1', [roomId]);
            delete playAgainRequesters[roomId];
          }
        }, 10000);
      }
    }
  });
});

const PORT = Number(process.env.PORT) || 3001;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
