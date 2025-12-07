from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit, join_room, leave_room
import random
import string

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*")

# Store room data: {room_id: {players: [sid1, sid2], board: [...], turn: 'X'}}
rooms = {}

def generate_room_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('create_game')
def on_create_game():
    room_id = generate_room_code()
    rooms[room_id] = {
        'players': [request.sid],
        'board': [''] * 9,
        'turn': 'X'
    }
    join_room(room_id)
    emit('game_created', {'room_id': room_id, 'player': 'X'})
    print(f"Room Created: {room_id} by {request.sid}")

@socketio.on('join_game')
def on_join_game(data):
    room_id = data['room_id']
    if room_id in rooms:
        room = rooms[room_id]
        if len(room['players']) < 2:
            room['players'].append(request.sid)
            join_room(room_id)
            emit('game_joined', {'room_id': room_id, 'player': 'O'})
            emit('player_joined', {'player': 'O'}, to=room_id)
            print(f"Player {request.sid} joined Room: {room_id}")
            
            # Start the game
            emit('game_start', {'turn': 'X'}, to=room_id)
        else:
            emit('error', {'message': 'Room full'})
    else:
        emit('error', {'message': 'Room not found'})

@socketio.on('make_move')
def on_make_move(data):
    room_id = data['room_id']
    index = data['index']
    player = data['player']

    if room_id in rooms:
        room = rooms[room_id]
        if room['turn'] == player and room['board'][index] == '':
            room['board'][index] = player
            room['turn'] = 'O' if player == 'X' else 'X'
            emit('update_board', {'index': index, 'player': player, 'next_turn': room['turn']}, to=room_id)
            
            # Check win/draw logic could be here, but for simplicity we rely on clients to check mostly, 
            # or we can add it here for security. Let's trust clients for now or add simple check.
            # Actually, better to broadcast move and let clients run check_winner logic visually.
        else:
            # Invalid move
            pass

@socketio.on('restart_request')
def on_restart_request(data):
    room_id = data['room_id']
    if room_id in rooms:
        rooms[room_id]['board'] = [''] * 9
        rooms[room_id]['turn'] = 'X'
        emit('game_reset', {'turn': 'X'}, to=room_id)

@socketio.on('disconnect')
def on_disconnect():
    # Handle user disconnect - remove from room, notify other player
    for room_id, room in rooms.items():
        if request.sid in room['players']:
            room['players'].remove(request.sid)
            emit('opponent_left', to=room_id)
            if len(room['players']) == 0:
                del rooms[room_id]
            break

if __name__ == '__main__':
    socketio.run(app, debug=True, port=8080)
