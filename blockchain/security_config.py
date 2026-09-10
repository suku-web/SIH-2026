# Member 5 - Security Configuration

SECURITY_CONFIG = {
    "risk_thresholds": {
        "LOW": 30,
        "MEDIUM": 60,
        "HIGH": 80,
        "CRITICAL": 100
    },

    "actions": {
        "LOW": "ALLOW",
        "MEDIUM": "MONITOR",
        "HIGH": "CHALLENGE",
        "CRITICAL": "BLOCK"
    },

    "clone_detection": {
        "fake_probability_threshold": 70
    },

    "speaker_verification": {
        "minimum_match_score": 70
    },

    "audit": {
        "enabled": True,
        "tamper_detection": True
    }
}


def get_security_config():
    return SECURITY_CONFIG