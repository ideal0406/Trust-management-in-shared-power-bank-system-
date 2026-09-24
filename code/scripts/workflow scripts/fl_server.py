import flwr as fl
import json
from collections import defaultdict

LEDGER_FILE = 'ledger.json'

def aggregate_scores(updates):
    """Aggregate scores returned by clients and update the ledger."""
    if not updates:
        return
    user_scores = defaultdict(list)
    for client_scores in updates:
        for did, score in client_scores.items():
            user_scores[did].append(score)

    with open(LEDGER_FILE, 'r+') as f:
        ledger = json.load(f)
        for did, scores in user_scores.items():
            avg_score = sum(scores) / len(scores)
            if did in ledger and ledger[did]['role'] == 'user':
                ledger[did]['trustScore'] = round(avg_score, 4)
                print(f"✅ Server updated the trust score of {did} to {avg_score:.4f}")
        f.seek(0)
        json.dump(ledger, f, indent=2)
        f.truncate()

class AggregateStrategy(fl.server.strategy.FedAvg):
    def __init__(self):
        super().__init__(
            fraction_fit=1.0,          # All clients participate in fit
            fraction_evaluate=1.0,     # All clients participate in evaluate
            min_fit_clients=1,         # At least 1 client is required to start fit
            min_evaluate_clients=1,    # At least 1 client is required to start evaluate
            min_available_clients=1,   # At least 1 client must be online to start a round
        )

    def aggregate_evaluate(self, server_round, results, failures):
        updates = []
        for client_proxy, eval_res in results:
            if eval_res.metrics:
                updates.append(eval_res.metrics)
        aggregate_scores(updates)
        return 0.0, {}

if __name__ == "__main__":
    strategy = AggregateStrategy()
    fl.server.start_server(
        server_address="0.0.0.0:8080",
        config=fl.server.ServerConfig(num_rounds=10),
        strategy=strategy,
    )
