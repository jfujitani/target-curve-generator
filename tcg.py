#!/usr/bin/env python3
"""Launch server for Target Curve Generator (tcg) Web App.

Run with no arguments to launch the local server and open the web studio in your browser:
    python3 tcg.py

Optional port argument:
    python3 tcg.py --port 8080
"""
import http.server
import socketserver
import sys
import webbrowser
from pathlib import Path


def serve_web_app(port: int = 8080, open_browser: bool = True) -> int:
    web_dir = Path(__file__).parent / "web"
    if not web_dir.exists():
        print(f"Error: web directory not found at {web_dir}", file=sys.stderr)
        return 1

    class CustomHandler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(web_dir), **kwargs)

        def log_message(self, format, *args):
            # Quiet console output
            pass

    socketserver.TCPServer.allow_reuse_address = True
    try:
        with socketserver.TCPServer(("", port), CustomHandler) as httpd:
            url = f"http://localhost:{port}/"
            print(f"--- Target Curve Generator (tcg) ---")
            print(f"Running locally at: {url}")
            print(f"Press Ctrl+C to stop.")
            if open_browser:
                try:
                    webbrowser.open(url)
                except Exception:
                    pass
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping web server.")
        return 0
    except OSError as e:
        print(f"Port {port} is unavailable ({e}). Specify another port with --port <NUM>.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    port = 8080
    if "--port" in sys.argv:
        try:
            p_idx = sys.argv.index("--port")
            port = int(sys.argv[p_idx + 1])
        except Exception:
            pass
    sys.exit(serve_web_app(port=port))
