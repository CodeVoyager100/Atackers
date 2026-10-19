# Same-Wi-Fi Co-op (Experimental)

Two friends can play on the red team against bots. One computer runs a free local
server and its browser hosts the simulation. The other device receives the match
state and sends controls. No account registration, paid service, or extra Python
packages are required.

## Start

1. Install Python 3.10 or newer on the hosting computer.
2. Open a terminal in this game folder and run:

   ```powershell
   python lan-server.py --port 8765
   ```

3. On the host, open `http://localhost:8765` in Chrome or Edge.
4. Find the host computer's Wi-Fi IPv4 address using `ipconfig`.
5. On your friend's device, open `http://HOST-IP:8765`, for example
   `http://192.168.1.20:8765`. Both devices must use the same Wi-Fi.
6. Choose a player before connecting. Host: open **Friends**, then **Create Room**.
7. Friend: open **Friends**, enter the six-character room code, then **Join Room**.
8. When the host sees the friend has joined, press **Co-op Battle**.

If Windows asks about firewall access, allow Python only on your trusted private
network. Do not forward this port on your router or expose the server publicly.
Guest Wi-Fi or wireless client isolation can prevent devices from connecting.

## Controls and Matches

- The Team Room shows host/guest names, selected fighters, connection status,
  and the allied bot slot. The host's battle button becomes available once a
  friend joins.
- The room code appears in the upper-right corner. Use **Copy code** to share
  it; the **Room** button also displays it during a match.
- Existing keyboard, mouse, and touch controls work. The host must keep the game
  tab open and visible; a background tab may be slowed by the browser.
- Two humans plus one allied bot face three enemy bots in a 3v3 match.
- LAN matches use base character stats and the joining player's first owned
  gadget. The host remains authoritative; this is for trusted friends only.
- LAN matches do not award currencies, medals, daily wins, or ranked progress.
- After a match, reopen **Friends** and start another Co-op Battle in the same room.
- Leaving or losing the host connection ends the session. A guest disconnect
  is detected within about 30 seconds. There is no host migration or reconnect.
- Stop the server with Ctrl+C. Solo play remains available without the server.

## Prototype Limits

This uses ten HTTP snapshots per second over the LAN, not internet matchmaking.
There is no interpolation or prediction yet, so the guest can look less smooth.
Companion visuals and some special effects are not fully synchronized yet, and
guest firing cadence is currently standardized. Test character abilities before
using them in an event.

This is a first co-op playtest, not yet a tournament system. More human slots,
opposing player teams, spectators, reconnection, and championship brackets are
future work.

The HTTP server serves this game's files only, but it is not a production service.
Progress stored under a `file://` page is separate from the localhost/LAN address;
opening the LAN page does not erase your original saved game.