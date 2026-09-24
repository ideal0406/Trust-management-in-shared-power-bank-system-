import flwr as fl
import json
import os
import subprocess
import numpy as np
from collections import defaultdict

EVENT_FILE = 'events.json'
ALPHA = 0.003  # Successful return coefficient
BETA = 0.006   # Failed return coefficient


def clip_score(score):
    return max(0.0, min(1.0, score))


class PowerBankClient(fl.client.NumPyClient):
    def __init__(self, powerbank_did):
        self.powerbank_did = powerbank_did
        self.local_updates = {}

    def get_parameters(self, config):
        return [np.array([0.0])]

    def fit(self, parameters, config):
        print(f"[{self.powerbank_did}] fit started")
        if not os.path.exists(EVENT_FILE):
            return self.get_parameters(config), 1, {}

        with open(EVENT_FILE, 'r') as f:
            try:
                events = json.load(f)
            except json.JSONDecodeError:
                events = []

        if not events:
            return self.get_parameters(config), 1, {}

        with open(EVENT_FILE, 'w') as f:
            f.write('[]')

        user_events = defaultdict(list)
        for e in events:
            user_events[e['user_did']].append(bool(e['success']))

        for user_did, outcomes in user_events.items():
            try:
                result = subprocess.run(
                    ['node', 'get-score-cli.mjs', user_did],
                    capture_output=True, text=True, check=True
                )
                current_score = float(result.stdout.strip())
            except Exception as e:
                print(f"Failed to get score: {e}")
                current_score = 0.8

            new_score = current_score
            success_count = 0
            failure_count = 0
            for success in outcomes:
                if success:
                    # T_u^(r+1) = clip(T_u^(r) + alpha * (1 - T_u^(r)), 0, 1)
                    new_score = clip_score(new_score + ALPHA * (1 - new_score))
                    success_count += 1
                else:
                    # T_u^(r+1) = clip(T_u^(r) - beta * T_u^(r), 0, 1)
                    new_score = clip_score(new_score - BETA * new_score)
                    failure_count += 1

            new_score = round(new_score, 4)

            cmd = ['node', 'update-score-cli.mjs', user_did, str(new_score)]
            subprocess.run(cmd)
            self.local_updates[user_did] = new_score
            print(
                f"User {user_did}: successful returns {success_count}, "
                f"failed returns {failure_count}, new score {new_score}"
            )

        print(f"[{self.powerbank_did}] fit finished")
        return self.get_parameters(config), len(events), {}

    def evaluate(self, parameters, config):
        metrics = self.local_updates.copy()
        self.local_updates.clear()
        return 0.0, 1, metrics


if __name__ == "__main__":
    import sys
    if len(sys.argv) != 2:
        print("Usage: python fl_client.py <powerbankDID>")
        sys.exit(1)
    powerbank_did = sys.argv[1]
    fl.client.start_numpy_client(
        server_address="127.0.0.1:8080",
        client=PowerBankClient(powerbank_did)
    )
