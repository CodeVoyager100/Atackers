import argparse
import json
import mimetypes
import secrets
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parent
ROOMS = {}
ROOM_LOCK = threading.Lock()
MAX_BODY = 2_000_000
TIMEOUT = 30


class LanHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        return

    def respond(self, status, data):
        payload = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        url = urlsplit(self.path)
        if url.path.startswith('/lan/'):
            self.respond(405, {'error': 'Use POST for room requests.'})
            return
        relative = unquote(url.path).lstrip('/') or 'index.html'
        target = (ROOT / relative).resolve()
        allowed = (
            relative in {'index.html', 'style.css', 'game.js', 'game-data.js', 'lan-game.js'}
            or relative.startswith(('images/', 'sounds/', 'logo animation UI/'))
        )
        if not target.is_relative_to(ROOT) or not allowed or not target.is_file():
            self.send_error(404)
            return
        payload = target.read_bytes()
        self.send_response(200)
        content_type = mimetypes.guess_type(target.name)[0] or 'application/octet-stream'
        self.send_header('Content-Type', content_type)
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_POST(self):
        origin = self.headers.get('Origin')
        if origin and urlsplit(origin).netloc != self.headers.get('Host'):
            self.respond(403, {'error': 'Open the game from this server address.'})
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length <= 0 or length > MAX_BODY:
                self.respond(413, {'error': 'Invalid request size.'})
                return
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict):
                raise ValueError('Expected an object')
        except (ValueError, UnicodeDecodeError):
            self.respond(400, {'error': 'Invalid request.'})
            return

        with ROOM_LOCK:
            now = time.monotonic()
            for code in list(ROOMS):
                if now - ROOMS[code]['host_seen'] > TIMEOUT:
                    del ROOMS[code]
            path = urlsplit(self.path).path
            if path == '/lan/create':
                if len(ROOMS) >= 16:
                    self.respond(503, {'error': 'Too many rooms. Try again later.'})
                    return
                code = secrets.token_hex(3).upper()
                while code in ROOMS:
                    code = secrets.token_hex(3).upper()
                token = secrets.token_urlsafe(24)
                ROOMS[code] = {
                    'host': token, 'guest': None, 'host_seen': now, 'guest_seen': now,
                    'guest_info': None, 'input': {}, 'snapshot': None,
                }
                self.respond(200, {'code': code, 'token': token})
                return

            code = str(data.get('code', '')).upper()
            room = ROOMS.get(code)
            if not room:
                self.respond(404, {'error': 'Room closed or not found.'})
                return
            if path == '/lan/join':
                if room['guest'] is not None:
                    self.respond(409, {'error': 'This two-player room is full.'})
                    return
                if room['snapshot'] and room['snapshot'].get('playing'):
                    self.respond(409, {'error': 'Wait for the current battle to end.'})
                    return
                token = secrets.token_urlsafe(24)
                room['guest'] = token
                room['guest_seen'] = now
                room['guest_info'] = {
                    'name': str(data.get('name', 'Friend'))[:20],
                    'characterId': str(data.get('characterId', 'default'))[:40],
                    'gadget': str(data.get('gadget', ''))[:40],
                }
                self.respond(200, {'code': code, 'token': token})
                return

            token = self.headers.get('Authorization', '').removeprefix('Bearer ')
            role = 'host' if token == room['host'] else 'guest' if token and token == room['guest'] else None
            if role is None:
                self.respond(403, {'error': 'Invalid room session.'})
                return
            if path == '/lan/leave':
                if role == 'host':
                    del ROOMS[code]
                else:
                    room['guest'] = None
                    room['guest_info'] = None
                    room['input'] = {}
                self.respond(200, {'ok': True})
                return
            if path != '/lan/sync':
                self.respond(404, {'error': 'Unknown room action.'})
                return
            room[f'{role}_seen'] = now
            if role == 'host':
                snapshot = data.get('snapshot')
                if isinstance(snapshot, dict):
                    room['snapshot'] = snapshot
                if room['guest'] and now - room['guest_seen'] > TIMEOUT:
                    room['guest'] = None
                    room['guest_info'] = None
                    room['input'] = {}
                self.respond(200, {'guest': room['guest_info'], 'input': room['input']})
            else:
                controls = data.get('input')
                if isinstance(controls, dict):
                    room['input'] = controls
                self.respond(200, {'snapshot': room['snapshot']})


def main():
    parser = argparse.ArgumentParser(description='Atackers two-player LAN server')
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args()
    server = ThreadingHTTPServer(('0.0.0.0', args.port), LanHandler)
    print(f'Atackers LAN: http://localhost:{args.port}', flush=True)
    print('Friends: open http://YOUR-LAN-IP:' + str(args.port) + ' on the same Wi-Fi.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()