#!/usr/bin/env python3
"""
Tiny development server for the project root so the app can fetch
`/data/words_is.txt` in the browser. Runs an HTTP server (port 8000 by default)
and opens the game at the right URL.
"""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import argparse
import os
import socket
import webbrowser


def find_free_port(start: int) -> int:
    port = start
    while True:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                port += 1


def main():
    parser = argparse.ArgumentParser(description="Serve project for local dev")
    parser.add_argument("--port", type=int, default=int(os.getenv("PORT", 8000)))
    parser.add_argument("--no-open", action="store_true", help="Do not open browser")
    args = parser.parse_args()

    # Serve from repository root (workspace root)
    root = Path(__file__).resolve().parents[1]
    os.chdir(root)

    port = find_free_port(args.port)
    server = ThreadingHTTPServer(("127.0.0.1", port), SimpleHTTPRequestHandler)
    index = root / "index.html"
    # If index.html is not at root, try to locate it (fallbacks)
    if not index.exists():
        # common fallback: project inside a subfolder named similar to 'Verkefni 1'
        candidates = list(root.glob("**/index.html"))
        if candidates:
            index = candidates[0]
    # Build URL relative to server root
    rel = "/" + str(index.relative_to(root)).replace(" ", "%20")
    url = f"http://127.0.0.1:{port}{rel}"
    print("Serving", root)
    # Show both potential dictionary locations
    print("Data path:", root / "data" / "words_is.txt")
    print("Alt data path:", root / "scripts" / "data" / "words_is.txt")
    print(f"\nOpen the game at: {url}\n")
    if not args.no_open:
        try:
            webbrowser.open(url)
        except Exception:
            pass
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down…")


if __name__ == "__main__":
    main()

