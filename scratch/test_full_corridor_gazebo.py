#!/usr/bin/env python3
import time
import math
import subprocess
import rclpy
from rclpy.node import Node
from sensor_msgs.msg import NavSatFix, LaserScan
from nav_msgs.msg import Odometry

class GazeboVerifier(Node):
    def __init__(self):
        super().__init__('gazebo_verifier')
        self.latest_gps = None
        self.latest_lidar = None
        self.sub_gps = self.create_subscription(NavSatFix, '/skynav/sensors/gps', self.on_gps, 10)
        self.sub_lidar = self.create_subscription(LaserScan, '/skynav/sensors/lidar_obstacle', self.on_lidar, 10)

    def on_gps(self, msg):
        self.latest_gps = msg

    def on_lidar(self, msg):
        self.latest_lidar = msg

def set_gazebo_pose(x, y, z, yaw_deg=185.0):
    yaw_rad = math.radians(yaw_deg)
    qz = math.sin(yaw_rad / 2.0)
    qw = math.cos(yaw_rad / 2.0)
    req = f'name: "skynav_quad" position {{ x: {x:.2f} y: {y:.2f} z: {z:.2f} }} orientation {{ x: 0.0 y: 0.0 z: {qz:.6f} w: {qw:.6f} }}'
    res = subprocess.run(['gz', 'service', '-s', '/world/skynav_kurumbapalayam/set_pose', '--reqtype', 'gz.msgs.Pose', '--reptype', 'gz.msgs.Boolean', '--timeout', '2000', '--req', req], capture_output=True, text=True)
    return 'data: true' in res.stdout

def main():
    rclpy.init()
    node = GazeboVerifier()

    test_points = [
        ("T0 - SkyHub Launch Pad", 0.0, 0.0, 0.25, 185.0),
        ("T1 - Initial Climb (45m)", 0.0, 0.0, 45.0, 185.0),
        ("T2 - SH165 Corridor (1 km)", 50.0, -1000.0, 45.0, 183.0),
        ("T3 - Approaching Crane (2 km)", 142.0, -1990.0, 45.0, 180.0),
        ("T4 - Crane Avoidance (+85m E)", 227.0, -2022.6, 45.0, 180.0),
        ("T5 - Rejoining Airway (2.5 km)", 180.0, -2500.0, 45.0, 175.0),
        ("T6 - Southern Corridor (3.8 km)", 400.0, -3800.0, 45.0, 168.0),
        ("T7 - Kalapatti Approach (4.6 km)", 680.0, -4500.0, 45.0, 165.0),
        ("T8 - Touchdown Customer Pad (4.7 km)", 680.0, -4520.0, 0.25, 165.0),
    ]

    print("================================================================================")
    print("TESTING DIRECT GAZEBO SENSOR RESPONSES ACROSS 4.7 KM CORRIDOR")
    print("================================================================================\n")

    for name, x, y, z, yaw in test_points:
        success = set_gazebo_pose(x, y, z, yaw)
        time.sleep(0.5)
        node.latest_gps = None
        node.latest_lidar = None
        t_timeout = time.time() + 2.0
        while time.time() < t_timeout and (node.latest_gps is None or node.latest_lidar is None):
            rclpy.spin_once(node, timeout_sec=0.05)
        
        gps = node.latest_gps
        lidar = node.latest_lidar
        min_range = "inf"
        if lidar:
            finite = [r for r in lidar.ranges if not math.isinf(r) and not math.isnan(r)]
            if finite:
                min_range = f"{min(finite):.2f}m ({len(finite)} hits)"

        if gps:
            dist_hub = math.sqrt(x*x + y*y)
            print(f"[{name}]")
            print(f"  Gazebo ENU:   x={x:7.1f}m, y={y:7.1f}m, z={z:5.2f}m (dist from hub={dist_hub:6.1f}m)")
            print(f"  Gazebo GPS:   Lat={gps.latitude:.6f}°, Lng={gps.longitude:.6f}°, Alt={gps.altitude:.2f}m")
            print(f"  Gazebo LiDAR: Min Obstacle Distance: {min_range}")
            print()

    # Reset back to SkyHub
    set_gazebo_pose(0.0, 0.0, 0.25, 0.0)
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
