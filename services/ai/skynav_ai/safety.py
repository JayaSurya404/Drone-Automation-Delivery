"""
Advisory Safety Boundaries & Governance Rules for SkyNav AI Service.
Ensures AI outputs strictly respect digital-twin scope, safety disclaimers, and transparent reasoning.
"""

from __future__ import annotations
from typing import Dict, Any, List

ADVISORY_DISCLAIMER = (
    "SkyNav AI predictions are advisory recommendations only. "
    "Mandatory deterministic safety validation (geofences, battery reserve, payload, "
    "weather policies, and operator authorization) remains strictly authoritative."
)


def format_advisory_response(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Wraps any AI response payload with standard advisory governance metadata."""
    if "advisoryDisclaimer" not in payload:
        payload["advisoryDisclaimer"] = ADVISORY_DISCLAIMER
    return payload
