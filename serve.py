#!/usr/bin/env python3
"""Локальный сервер для просмотра лендинга.

Нужен вместо `python3 -m http.server`: встроенный обработчик не умеет
Range-запросы, а без них Chrome не проигрывает mp4 — видео висит в stalled.

    python3 serve.py [порт]
"""

import functools
import os
import re
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8777


class _Slice:
    """Отдаёт ровно n байт из открытого файла."""

    def __init__(self, f, n):
        self.f, self.n = f, n

    def read(self, size=-1):
        if self.n <= 0:
            return b""
        if size < 0 or size > self.n:
            size = self.n
        chunk = self.f.read(size)
        self.n -= len(chunk)
        return chunk

    def close(self):
        self.f.close()


class RangeHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        rng = self.headers.get("Range")
        path = self.translate_path(self.path)

        if not rng or not os.path.isfile(path):
            return super().send_head()

        m = re.match(r"bytes=(\d*)-(\d*)", rng)
        if not m:
            return super().send_head()

        size = os.path.getsize(path)
        start = int(m.group(1)) if m.group(1) else 0
        end = min(int(m.group(2)), size - 1) if m.group(2) else size - 1

        f = open(path, "rb")
        f.seek(start)

        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        return _Slice(f, end - start + 1)

    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write(f"{self.command} {self.path}\n")


if __name__ == "__main__":
    handler = functools.partial(RangeHandler, directory=ROOT)
    print(f"http://127.0.0.1:{PORT}/  (Ctrl+C — остановить)")
    try:
        ThreadingHTTPServer(("127.0.0.1", PORT), handler).serve_forever()
    except KeyboardInterrupt:
        pass
