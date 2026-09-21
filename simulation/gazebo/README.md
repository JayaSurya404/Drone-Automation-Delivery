# SkyNav Gazebo Robotics Simulation & SITL Architecture

This module provides the primary robotics physics simulation engine for SkyNav Autonomous Drone Delivery.

## Architecture Overview

```text
                    ┌───────────────────────┐
                    │     SkyNav Backend    │
                    │  Mission / Orders     │
                    │  Customer / Admin     │
                    └───────────┬───────────┘
                                │
                         Simulation Command
                                │
                                ▼
                    ┌───────────────────────┐
                    │       Gazebo          │
                    │  Physics Simulation   │
                    │                       │
                    │ Real Terrain (DEM)    │
                    │ Real Buildings (OSM)  │
                    │ Roads (OSM SH-165)    │
                    │ Drone (6-DOF Quad)    │
                    │ Sensors (IMU/GPS/LiDAR│
                    └───────────┬───────────┘
                                │
                         ROS 2 Telemetry
                                │
                                ▼
                    ┌───────────────────────┐
                    │   Telemetry Bridge    │
                    │  (Port 8085 / REST/WS)│
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │    SkyNav Backend     │
                    └──────┬───────┬────────┘
                           │       │
                     Admin 2D   Customer
                           │       PWA
                           │
                      Admin Simulation
                      (Gazebo SITL HUD)
```

## Directory Contents

- `worlds/skynav_kurumbapalayam.sdf`: Gazebo world configured with WGS84 origin at Kurumbapalayam (11.1132°N, 77.0277°E, 374m MSL), ODE/Bullet 1000Hz solver, and real OSM building collision geometries (KVIMIS, SVB Tech Park, Lemon Tree, logistics hubs).
- `models/skynav_quad/`: 6-DOF quadrotor rigid body model with inertia tensor, 4 counter-rotating rotors, RTK-GPS sensor, 6-axis IMU (250Hz), and downward LiDAR altimeter.
- `bridge/gazebo_telemetry_bridge.py`: Python bridge providing bidirectional communication between Gazebo / ROS 2 topics and SkyNav Web Backend over HTTP REST and WebSocket on port 8085.
- `launch/skynav_gazebo.launch.py`: ROS 2 launch file for running the simulation suite.

## Running the Simulation

### Option A: Standalone Telemetry Bridge
Run the Python telemetry bridge directly:
```bash
python simulation/gazebo/bridge/gazebo_telemetry_bridge.py
```

### Option B: ROS 2 + Gazebo Harmonic
In your ROS 2 workspace:
```bash
ros2 launch simulation/gazebo/launch/skynav_gazebo.launch.py
```
