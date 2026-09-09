# Member 5 - Blockchain Audit Verification

import hashlib
import json


def generate_hash(record):
    data = {
        "recordId": record["recordId"],
        "timestamp": record["timestamp"],
        "claimedIdentity": record["claimedIdentity"],
        "riskScore": record["riskScore"],
        "riskLevel": record["riskLevel"],
        "decision": record["decision"],
        "recommendedAction": record["recommendedAction"]
    }

    encoded_data = json.dumps(
        data,
        sort_keys=True
    ).encode("utf-8")

    return hashlib.sha256(encoded_data).hexdigest()


def verify_audit_record(record):

    print("\n========================================")
    print("STEP 1: LOAD AUDIT RECORD")
    print("========================================")

    print("Audit record loaded successfully.")

    print("\n========================================")
    print("STEP 2: READ STORED HASH")
    print("========================================")

    stored_hash = record.get("hash")

    if not stored_hash:
        print("ERROR: Hash not found.")

        return {
            "valid": False,
            "message": "Audit record does not contain a hash."
        }

    print("Stored hash found.")
    print("Stored Hash:", stored_hash)

    print("\n========================================")
    print("STEP 3: GENERATE HASH")
    print("========================================")

    calculated_hash = generate_hash(record)

    print("New hash generated.")
    print("Calculated Hash:", calculated_hash)

    print("\n========================================")
    print("STEP 4: COMPARE HASHES")
    print("========================================")

    if calculated_hash == stored_hash:

        print("Hash comparison: MATCH")

        result = {
            "valid": True,
            "message": "Audit record is authentic and has not been tampered with."
        }

    else:

        print("Hash comparison: MISMATCH")

        result = {
            "valid": False,
            "message": "WARNING: Audit record may have been tampered with."
        }

    print("\n========================================")
    print("STEP 5: FINAL VERIFICATION")
    print("========================================")

    print("Verification Status:", result["valid"])
    print("Message:", result["message"])

    return result


if __name__ == "__main__":

    test_record = {
        "recordId": "RISK-TEST123",
        "timestamp": "2026-09-08T05:34:29.279957+00:00",
        "claimedIdentity": "CFO",
        "riskScore": 81.8,
        "riskLevel": "CRITICAL",
        "decision": "FRAUDULENT",
        "recommendedAction": "BLOCK"
    }

    # Create a valid hash for testing
    test_record["hash"] = generate_hash(test_record)

    verify_audit_record(test_record)