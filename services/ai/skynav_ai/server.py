"""
HTTP REST Server & ASGI Application for SkyNav Advisory AI Service.
Provides REST endpoints on port 8000.
Supports standard library http.server execution and optional FastAPI / ASGI servers.
"""

from __future__ import annotations
import json
import logging
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
import sys
from typing import Dict, Any, Tuple

from .service import ai_service
from .models import Coordinate, RouteCandidate, WeatherConditions

logging.basicConfig(level=logging.INFO, format="[skynav-ai] %(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger("skynav-ai")


class AiRequestHandler(BaseHTTPRequestHandler):
    """
    REST request handler for SkyNav Advisory AI microservice.
    """

    def _set_headers(self, status: int = 200, content_type: str = "application/json"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(204)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        if path == "/health" or path == "":
            self._set_headers(200)
            self.wfile.write(json.dumps({"status": "ok", "service": "skynav-ai", "version": "1.0.0"}).encode("utf-8"))
        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "NOT_FOUND", "message": f"Endpoint '{path}' not found."}).encode("utf-8"))

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        # Read JSON request payload
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length <= 0:
            self._set_headers(400)
            self.wfile.write(json.dumps({"error": "INVALID_BODY", "message": "Request body must not be empty."}).encode("utf-8"))
            return

        try:
            body_bytes = self.rfile.read(content_length)
            payload = json.loads(body_bytes.decode("utf-8"))
        except Exception as e:
            self._set_headers(400)
            self.wfile.write(json.dumps({"error": "MALFORMED_JSON", "message": str(e)}).encode("utf-8"))
            return

        try:
            status, res = self._route_post(path, payload)
            self._set_headers(status)
            self.wfile.write(json.dumps(res).encode("utf-8"))
        except Exception as e:
            logger.error(f"Error handling {path}: {e}", exc_info=True)
            self._set_headers(500)
            self.wfile.write(json.dumps({"error": "INTERNAL_AI_ERROR", "message": str(e)}).encode("utf-8"))

    def _route_post(self, path: str, payload: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
        # 1. Route Scoring
        if path == "/api/v1/ai/routes/score":
            candidates_raw = payload.get("candidates", [])
            candidates: list[RouteCandidate] = []
            for c in candidates_raw:
                wps = [Coordinate(latitude=w["latitude"], longitude=w["longitude"], altitudeMeters=w.get("altitudeMeters", 0.0), address=w.get("address")) for w in c.get("waypoints", [])]
                candidates.append(RouteCandidate(
                    id=c["id"],
                    name=c.get("name"),
                    waypoints=wps,
                    cruiseAltitudeMeters=c.get("cruiseAltitudeMeters", 60.0),
                    targetSpeedMps=c.get("targetSpeedMps", 15.0)
                ))

            w_raw = payload.get("weather")
            weather = None
            if w_raw:
                weather = WeatherConditions(
                    windSpeedMps=w_raw.get("windSpeedMps", 0.0),
                    windDirectionDegrees=w_raw.get("windDirectionDegrees", 0.0),
                    windGustMps=w_raw.get("windGustMps", 0.0),
                    precipitationMmPerHour=w_raw.get("precipitationMmPerHour", 0.0),
                    visibilityMeters=w_raw.get("visibilityMeters", 10000.0),
                    temperatureCelsius=w_raw.get("temperatureCelsius", 20.0)
                )

            res = ai_service.score_routes(
                organization_id=payload.get("organizationId", "default"),
                candidates=candidates,
                package_weight_grams=payload.get("packageWeightGrams", 0.0),
                drone_max_payload_grams=payload.get("droneMaxPayloadGrams", 5000.0),
                drone_battery_percent=payload.get("droneBatteryPercent", 100.0),
                weather=weather,
                priority=payload.get("priority", "STANDARD")
            )
            return 200, res

        # 2. ETA Prediction
        elif path == "/api/v1/ai/eta/predict":
            cp = payload["currentPosition"]
            dest = payload["destination"]
            cur_pos = Coordinate(latitude=cp["latitude"], longitude=cp["longitude"], altitudeMeters=cp.get("altitudeMeters", 0.0))
            destination = Coordinate(latitude=dest["latitude"], longitude=dest["longitude"], altitudeMeters=dest.get("altitudeMeters", 0.0))

            wps = None
            if "waypoints" in payload and payload["waypoints"]:
                wps = [Coordinate(latitude=w["latitude"], longitude=w["longitude"], altitudeMeters=w.get("altitudeMeters", 0.0)) for w in payload["waypoints"]]

            w_raw = payload.get("weather")
            weather = None
            if w_raw:
                weather = WeatherConditions(
                    windSpeedMps=w_raw.get("windSpeedMps", 0.0),
                    windDirectionDegrees=w_raw.get("windDirectionDegrees", 0.0)
                )

            res = ai_service.predict_eta(
                organization_id=payload.get("organizationId", "default"),
                current_position=cur_pos,
                destination=destination,
                current_speed_mps=payload.get("currentSpeedMps", 0.0),
                waypoints=wps,
                package_weight_grams=payload.get("packageWeightGrams", 0.0),
                cruise_speed_mps=payload.get("cruiseSpeedMps", 15.0),
                weather=weather
            )
            return 200, res

        # 3. Battery Prediction
        elif path == "/api/v1/ai/battery/predict":
            res = ai_service.predict_battery(
                organization_id=payload.get("organizationId", "default"),
                drone_id=payload.get("droneId", "default"),
                current_battery_percent=payload.get("currentBatteryPercent", 100.0),
                route_distance_meters=payload.get("routeDistanceMeters", 0.0),
                package_weight_grams=payload.get("packageWeightGrams", 0.0),
                drone_max_payload_grams=payload.get("droneMaxPayloadGrams", 5000.0),
                headwind_mps=payload.get("headwindMps", 0.0),
                is_round_trip=payload.get("isRoundTrip", True)
            )
            return 200, res

        # 4. Predictive Maintenance
        elif path == "/api/v1/ai/maintenance/predict":
            res = ai_service.predict_maintenance(
                organization_id=payload.get("organizationId", "default"),
                drone_id=payload.get("droneId", "default"),
                call_sign=payload.get("callSign", "DRONE-001"),
                model=payload.get("model", "Default Model"),
                flight_hours=payload.get("flightHours", 0.0),
                battery_cycles=payload.get("batteryCycles", 0),
                battery_health_percent=payload.get("batteryHealthPercent", 100.0),
                emergency_events_count=payload.get("emergencyEventsCount", 0),
                last_maintenance_at=payload.get("lastMaintenanceAt"),
                recent_max_motor_temp_celsius=payload.get("recentMaxMotorTemperatureCelsius"),
                recent_vibration_rms=payload.get("recentVibrationRms")
            )
            return 200, res

        # 5. Weather Risk
        elif path == "/api/v1/ai/weather/risk":
            res = ai_service.assess_weather_risk(
                latitude=payload.get("latitude", 0.0),
                longitude=payload.get("longitude", 0.0),
                wind_speed_mps=payload.get("windSpeedMps", 0.0),
                wind_direction_degrees=payload.get("windDirectionDegrees", 0.0),
                wind_gust_mps=payload.get("windGustMps", 0.0),
                precipitation_mm_per_hour=payload.get("precipitationMmPerHour", 0.0),
                visibility_meters=payload.get("visibilityMeters", 10000.0),
                temperature_celsius=payload.get("temperatureCelsius", 20.0),
                thunderstorm_risk=payload.get("thunderstormRisk", False)
            )
            return 200, res

        # 6. Demand Forecasting
        elif path == "/api/v1/ai/forecasting/demand":
            res = ai_service.forecast_demand(
                organization_id=payload.get("organizationId", "default"),
                forecast_horizon_hours=payload.get("forecastHorizonHours", 24),
                base_hourly_orders=payload.get("baseHourlyOrders", 12.0),
                active_fleet_size=payload.get("activeFleetSize", 5),
                target_date=payload.get("targetDate")
            )
            return 200, res

        # 7. Vision Frame Analysis
        elif path == "/api/v1/ai/vision/analyze-frame":
            res = ai_service.analyze_vision_frame(
                organization_id=payload.get("organizationId", "default"),
                frame_id=payload.get("frameId", "frame-001"),
                drone_id=payload.get("droneId", "default"),
                telemetry=payload.get("telemetry", {}),
                camera_source=payload.get("cameraSource", "DOWNWARD_NAV_CAM"),
                image_base64=payload.get("imageBase64"),
                synthetic_scene_description=payload.get("syntheticSceneDescription"),
                target_delivery_location=payload.get("targetDeliveryLocation")
            )
            return 200, res

        # 8. Vision Landing Zone Assessment
        elif path == "/api/v1/ai/vision/assess-landing":
            res = ai_service.assess_landing_zone(
                organization_id=payload.get("organizationId", "default"),
                drone_id=payload.get("droneId", "default"),
                telemetry=payload.get("telemetry", {}),
                camera_source=payload.get("cameraSource", "DOWNWARD_NAV_CAM"),
                expected_radius_meters=payload.get("expectedRadiusMeters", 3.0),
                synthetic_scene_description=payload.get("syntheticSceneDescription")
            )
            return 200, res

        # 9. Vision Destination Verification
        elif path == "/api/v1/ai/vision/verify-destination":
            res = ai_service.verify_destination(
                organization_id=payload.get("organizationId", "default"),
                drone_id=payload.get("droneId", "default"),
                destination=payload.get("destination", {}),
                telemetry=payload.get("telemetry", {}),
                camera_source=payload.get("cameraSource", "DOWNWARD_NAV_CAM"),
                synthetic_scene_description=payload.get("syntheticSceneDescription")
            )
            return 200, res

        # 10. Vision Hazard Detection
        elif path == "/api/v1/ai/vision/detect-hazards":
            res = ai_service.detect_hazards(
                organization_id=payload.get("organizationId", "default"),
                drone_id=payload.get("droneId", "default"),
                telemetry=payload.get("telemetry", {}),
                camera_source=payload.get("cameraSource", "FORWARD_OBSTACLE_CAM"),
                minimum_confidence=payload.get("minimumConfidence", 0.5),
                synthetic_scene_description=payload.get("syntheticSceneDescription")
            )
            return 200, res

        else:
            return 404, {"error": "NOT_FOUND", "message": f"Endpoint '{path}' does not exist."}


def run_server(host: str = "0.0.0.0", port: int = 8000):
    """Starts the HTTP server on specified host and port."""
    server_address = (host, port)
    httpd = HTTPServer(server_address, AiRequestHandler)
    logger.info(f"SkyNav Advisory AI Microservice running at http://{host}:{port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        logger.info("Shutting down AI server...")
        httpd.server_close()


if __name__ == "__main__":
    port = 8000
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    run_server(port=port)
