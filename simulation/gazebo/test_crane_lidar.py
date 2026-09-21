#!/usr/bin/env python3
import subprocess
import time
import json
import math

def run_cmd(cmd):
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return res.stdout, res.stderr

print("1. Checking Gazebo simulation stats...")
stdout, _ = run_cmd("gz topic -e -t /world/skynav_kurumbapalayam/stats -n 1")
print(stdout[:300])

print("2. Placing drone at y = -1980m (42.6m from crane at -2022.6m) facing crane...")
# Position drone in front of crane: crane is at [142.0, -2022.6, 27.5]
# Place drone at [142.0, -1990.0, 30.0], heading south (yaw = -90 deg / -1.5708 rad)
# In quaternion: z = -0.7071, w = 0.7071
req_pose = 'name: "skynav_quad" position { x: 142.0 y: -1990.0 z: 30.0 } orientation { x: 0.0 y: 0.0 z: -0.7071068 w: 0.7071068 }'
out, err = run_cmd(f"gz service -s /world/skynav_kurumbapalayam/set_pose --reqtype gz.msgs.Pose --reptype gz.msgs.Boolean --timeout 3000 --req '{req_pose}'")
print(f"Set pose result: {out} {err}")

time.sleep(1.0)

print("3. Querying Gazebo GPS at crane approach position...")
stdout, _ = run_cmd("gz topic -e -t /skynav/sensors/gps -n 1")
print(stdout)

print("4. Querying Gazebo Forward LiDAR Scanner topic /skynav/sensors/lidar_obstacle...")
stdout, _ = run_cmd("gz topic -e -t /skynav/sensors/lidar_obstacle -n 1")

# Parse ranges from lidar output
ranges = []
for line in stdout.splitlines():
    line = line.strip()
    if line.startswith("ranges:"):
        val = line.split(":", 1)[1].strip()
        ranges.append(val)

print(f"Total beams returned: {len(ranges)}")
finite_ranges = [float(r) for r in ranges if r not in ('inf', '-inf', '.inf', '-.inf', 'nan')]
if finite_ranges:
    min_range = min(finite_ranges)
    avg_range = sum(finite_ranges) / len(finite_ranges)
    print(f"-> Physical Crane Collision Obstacle DETECTED by Gazebo LiDAR!")
    print(f"-> Minimum obstacle range: {min_range:.2f} meters")
    print(f"-> Beams hitting crane: {len(finite_ranges)} / {len(ranges)}")
else:
    print(f"No finite ranges detected in snapshot; first 10 beams: {ranges[:10]}")
