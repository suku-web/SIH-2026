# Member 5 - Blockchain / Audit Module

import hashlib
import json
import uuid
from datetime import datetime, timezone


def create_audit_record(risk_result, claimed_identity=None):
    """
    Creates a tamper-evident audit record
    for the final Risk Engine decision.
    """

    timestamp = datetime.now(timezone.utc).isoformat()

    record = {
        "recordId": "RISK-" + str(uuid.uuid4())[:8],
        "timestamp": timestamp,
        "claimedIdentity": claimed_identity,
        "riskScore": risk_result["riskScore"],
        "riskLevel": risk_result["riskLevel"],
        "decision": risk_result["decision"],
        "recommendedAction": risk_result["recommendedAction"]
    }

    # Convert record into a consistent string
    record_string = json.dumps(record, sort_keys=True)

    # Generate SHA-256 hash
    record_hash = hashlib.sha256(
        record_string.encode("utf-8")
    ).hexdigest()

    # Store hash in the audit record
    record["hash"] = record_hash

    return record


def verify_audit_record(record):
    """
    Checks whether the audit record has been modified.
    """

    stored_hash = record.get("hash")

    # Remove the stored hash before recalculating
    data = record.copy()
    data.pop("hash", None)

    record_string = json.dumps(data, sort_keys=True)

    calculated_hash = hashlib.sha256(
        record_string.encode("utf-8")
    ).hexdigest()

    return stored_hash == calculated_hash


# --------------------------------
# TEST
# --------------------------------

if __name__ == "__main__":

    test_risk_result = {
        "riskScore": 81.8,
        "riskLevel": "CRITICAL",
        "decision": "FRAUDULENT",
        "recommendedAction": "BLOCK_AND_REVIEW"
    }

    audit_record = create_audit_record(
        test_risk_result,
        claimed_identity="user123"
    )

    print("Blockchain / Audit Record:")
    print(json.dumps(audit_record, indent=4))

    print("\nIntegrity Check:")
    print(verify_audit_record(audit_record))