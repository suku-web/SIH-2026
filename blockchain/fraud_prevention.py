# Member 5 - Fraud Prevention Engine

from security_config import SECURITY_CONFIG


def prevent_fraud(risk_result):

    print("\n========================================")
    print("STEP 1: RECEIVE RISK RESULT")
    print("========================================")

    risk_score = risk_result.get("riskScore", 0)
    risk_level = risk_result.get("riskLevel", "LOW")

    print("Risk Score:", risk_score)
    print("Risk Level:", risk_level)

    print("\n========================================")
    print("STEP 2: DETECT FRAUD LEVEL")
    print("========================================")

    if risk_level == "CRITICAL" or risk_score >= 80:
        action = "BLOCK"
        message = "Transaction blocked due to critical fraud risk."

    elif risk_level == "HIGH" or risk_score >= 60:
        action = "CHALLENGE"
        message = "Additional verification required."

    elif risk_level == "MEDIUM" or risk_score >= 30:
        action = "MONITOR"
        message = "Transaction allowed under continuous monitoring."

    else:
        action = "ALLOW"
        message = "Transaction appears genuine."

    print("Detected Risk Level:", risk_level)

    print("\n========================================")
    print("STEP 3: SELECT PREVENTION ACTION")
    print("========================================")

    print("Selected Action:", action)

    print("\n========================================")
    print("STEP 4: GENERATE SECURITY MESSAGE")
    print("========================================")

    print("Security Message:", message)

    print("\n========================================")
    print("STEP 5: FINAL RESULT")
    print("========================================")

    print("Risk Score       :", risk_score)
    print("Risk Level       :", risk_level)
    print("Prevention Action:", action)
    print("Security Message :", message)

    return {
        "riskScore": risk_score,
        "riskLevel": risk_level,
        "preventionAction": action,
        "message": message
    }


if __name__ == "__main__":

    test_result = {
        "riskScore": 81.8,
        "riskLevel": "CRITICAL",
        "decision": "FRAUDULENT",
        "recommendedAction": "BLOCK"
    }

    prevent_fraud(test_result)