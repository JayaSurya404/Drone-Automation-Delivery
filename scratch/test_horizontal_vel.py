import time
import math
import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Twist
from nav_msgs.msg import Odometry
from sensor_msgs.msg import NavSatFix

class TestVelNode(Node):
    def __init__(self):
        super().__init__('test_vel_node')
        self.pub = self.create_publisher(Twist, '/skynav/cmd_vel', 10)
        self.last_odom = None
        self.last_gps = None
        self.sub_odom = self.create_subscription(Odometry, '/skynav/odometry', self.on_odom, 10)
        self.sub_gps = self.create_subscription(NavSatFix, '/skynav/sensors/gps', self.on_gps, 10)

    def on_odom(self, msg):
        self.last_odom = msg

    def on_gps(self, msg):
        self.last_gps = msg

def main():
    rclpy.init()
    node = TestVelNode()
    
    # 1. Climb
    cmd = Twist()
    cmd.linear.z = 3.5
    print("Climbing at 3.5 m/s for 2 seconds...")
    t0 = time.time()
    while time.time() - t0 < 2.0:
        node.pub.publish(cmd)
        rclpy.spin_once(node, timeout_sec=0.05)

    # 2. Cruise horizontally y = -13.88 m/s (50 km/h)
    cmd = Twist()
    cmd.linear.z = 0.0
    cmd.linear.y = -13.88
    print("Flying horizontally at y = -13.88 m/s (50 km/h) for 4 seconds...")
    t0 = time.time()
    while time.time() - t0 < 4.0:
        node.pub.publish(cmd)
        rclpy.spin_once(node, timeout_sec=0.05)

    if node.last_odom:
        p = node.last_odom.pose.pose.position
        v = node.last_odom.twist.twist.linear
        h_spd = math.sqrt(v.x**2 + v.y**2) * 3.6
        print(f"Odom Pos: x={p.x:.2f}, y={p.y:.2f}, z={p.z:.2f}")
    if node.last_gps:
        print(f"Gazebo GPS: Lat={node.last_gps.latitude:.6f}, Lng={node.last_gps.longitude:.6f}, Alt={node.last_gps.altitude:.2f}")

    # Stop velocity
    zero_cmd = Twist()
    for _ in range(5):
        node.pub.publish(zero_cmd)
        rclpy.spin_once(node, timeout_sec=0.02)

    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
