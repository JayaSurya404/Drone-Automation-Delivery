#!/usr/bin/env python3
import time
import math
import rclpy
from rclpy.node import Node
from sensor_msgs.msg import NavSatFix, Imu, LaserScan
from nav_msgs.msg import Odometry
from geometry_msgs.msg import Twist

class GazeboLiveSubscriber(Node):
    def __init__(self):
        super().__init__('gazebo_live_sub_test')
        self.gps_count = 0
        self.last_gps = None
        self.imu_count = 0
        self.last_imu = None
        self.lidar_count = 0
        self.last_lidar = None
        self.odom_count = 0
        self.last_odom = None

        self.sub_gps = self.create_subscription(NavSatFix, '/skynav/sensors/gps', self.on_gps, 10)
        self.sub_imu = self.create_subscription(Imu, '/skynav/sensors/imu', self.on_imu, 10)
        self.sub_lidar = self.create_subscription(LaserScan, '/skynav/sensors/lidar_obstacle', self.on_lidar, 10)
        self.sub_odom = self.create_subscription(Odometry, '/skynav/odometry', self.on_odom, 10)

    def on_gps(self, msg):
        self.gps_count += 1
        self.last_gps = msg

    def on_imu(self, msg):
        self.imu_count += 1
        self.last_imu = msg

    def on_lidar(self, msg):
        self.lidar_count += 1
        self.last_lidar = msg

    def on_odom(self, msg):
        self.odom_count += 1
        self.last_odom = msg

def main():
    rclpy.init()
    node = GazeboLiveSubscriber()
    print("Listening for Gazebo live messages on ROS 2 topics for 3 seconds...")
    t_end = time.time() + 3.0
    while time.time() < t_end:
        rclpy.spin_once(node, timeout_sec=0.1)

    print(f"\nResults after 3 seconds:")
    print(f"GPS Messages Received: {node.gps_count}")
    if node.last_gps:
        print(f"  Latest GPS: Lat={node.last_gps.latitude:.6f}, Lng={node.last_gps.longitude:.6f}, Alt={node.last_gps.altitude:.2f}m")
    
    print(f"IMU Messages Received: {node.imu_count}")
    if node.last_imu:
        az = node.last_imu.linear_acceleration.z
        print(f"  Latest IMU: Accel Z={az:.3f} m/s^2")

    print(f"LiDAR Messages Received: {node.lidar_count}")
    if node.last_lidar:
        finite = [r for r in node.last_lidar.ranges if not math.isinf(r) and not math.isnan(r)]
        print(f"  Latest LiDAR: Total beams={len(node.last_lidar.ranges)}, Obstacle hits={len(finite)}")

    print(f"Odometry Messages Received: {node.odom_count}")
    if node.last_odom:
        pos = node.last_odom.pose.pose.position
        print(f"  Latest Odom Position: x={pos.x:.2f}m, y={pos.y:.2f}m, z={pos.z:.2f}m")

    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
