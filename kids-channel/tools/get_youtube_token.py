"""One-time step, run on your own computer: authorizes the pipeline to upload to your channel.

1. In Google Cloud Console create a project, enable "YouTube Data API v3", and create an
   OAuth client ID of type "Desktop app". Download its JSON as client_secret.json.
2. pip install google-auth-oauthlib
3. python tools/get_youtube_token.py client_secret.json
4. Sign in with the Google account that owns the channel and pick the channel.
5. Copy the three values it prints into GitHub > Settings > Secrets and variables > Actions.
"""

import json
import sys

from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ["https://www.googleapis.com/auth/youtube"]


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("uso: python tools/get_youtube_token.py client_secret.json")
    flow = InstalledAppFlow.from_client_secrets_file(sys.argv[1], SCOPES)
    creds = flow.run_local_server(port=0, prompt="consent", access_type="offline")
    with open(sys.argv[1]) as f:
        client = json.load(f)["installed"]
    print("\nGuarda estos tres valores como secretos del repositorio:\n")
    print(f"YT_CLIENT_ID={client['client_id']}")
    print(f"YT_CLIENT_SECRET={client['client_secret']}")
    print(f"YT_REFRESH_TOKEN={creds.refresh_token}")


if __name__ == "__main__":
    main()
