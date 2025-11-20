#!/usr/bin/env python3
"""
Simple webhook server for auto-deploying Park-Opticon backend
Run on Ubuntu server to automatically deploy when you push to GitHub
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import subprocess
import json
import hmac
import hashlib
import os

# Configuration
PORT = 9000
DEPLOY_SCRIPT = "/opt/parkopticon/deploy.sh"
SECRET = os.getenv("WEBHOOK_SECRET", "change_this_secret")  # Set in environment


class WebhookHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/deploy":
            self.send_response(404)
            self.end_headers()
            return

        # Read payload
        content_length = int(self.headers.get('Content-Length', 0))
        payload = self.rfile.read(content_length)

        # Verify signature (GitHub webhook secret)
        signature = self.headers.get('X-Hub-Signature-256')
        if signature:
            expected = 'sha256=' + hmac.new(
                SECRET.encode(),
                payload,
                hashlib.sha256
            ).hexdigest()
            
            if not hmac.compare_digest(signature, expected):
                self.send_response(401)
                self.end_headers()
                self.wfile.write(b"Invalid signature")
                return

        # Parse payload
        try:
            data = json.loads(payload)
            branch = data.get('ref', '').split('/')[-1]
            
            # Only deploy on main branch
            if branch != 'main':
                self.send_response(200)
                self.end_headers()
                self.wfile.write(f"Skipping deployment for branch: {branch}".encode())
                return

            # Run deployment script
            print(f"🚀 Deploying from branch: {branch}")
            result = subprocess.run(
                [DEPLOY_SCRIPT],
                capture_output=True,
                text=True,
                timeout=300
            )

            if result.returncode == 0:
                print("✅ Deployment successful")
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b"Deployment successful\n")
                self.wfile.write(result.stdout.encode())
            else:
                print(f"❌ Deployment failed: {result.stderr}")
                self.send_response(500)
                self.end_headers()
                self.wfile.write(b"Deployment failed\n")
                self.wfile.write(result.stderr.encode())

        except Exception as e:
            print(f"❌ Error: {e}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"Error: {e}".encode())

    def log_message(self, format, *args):
        print(f"[{self.log_date_time_string()}] {format % args}")


def run_server():
    server = HTTPServer(('0.0.0.0', PORT), WebhookHandler)
    print(f"🎯 Webhook server listening on port {PORT}")
    print(f"📍 Endpoint: http://<your-ip>:{PORT}/deploy")
    print(f"🔐 Secret: {'Set' if SECRET != 'change_this_secret' else 'NOT SET - Please set WEBHOOK_SECRET env var'}")
    print("")
    server.serve_forever()


if __name__ == "__main__":
    run_server()
