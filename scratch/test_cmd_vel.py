import time
import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Twist
from sensor_msgs.msg import NavSatFix
from nav_msgs.msg import Odometry

class CmdVelTester(Node):
    def __init__(self):
        super().__init__('cmd_vel_tester')
        self.pub_cmd = self.create_publisher(Twist, '/skynav/cmd_vel', 10)
        self.sub_gps = self.create_subscription(NavSatFix, '/skynav/sensors/gps', self.on_gps, 10)
        self.sub_odom = self.create_subscription(Odometry, '/skynav/odometry', self.on_odom, 10)
        self.last_gps = None
        self.last_odom = None

    def on_gps(self, msg):
        self.last_gps = msg

    def on_odom(self, msg):
        self.last_odom = msg

def main():
    rclpy.init()
    node = CmdVelTester()
    cmd = Twist()
    cmd.linear.x = 2.0
    cmd.linear.y = -5.0
    cmd.linear.z = 1.0

    print("Publishing cmd_vel for 3 seconds...")
    t_end = time.time() + 3.0
    while time.time() < t_end:
        node.pub_cmd.publish(cmd)
        rclpy.spin_once(node, timeout_sec=0.1)

    if node.last_odom:
        p = node.last_odom.pose.pose.position
        v = node.last_odom.twist.twist.linear
        print(f"Odom Position: x={p.x:.2f}, y={p.y:.2f}, z={p.z:.2f}")
        print(f"Odom Velocity: vx={v.x:.2f}, vy={v.y:.2f}, vz={v.z:.2f}")
    if node.last_gps:
        print(f"GPS: Lat={node.last_gps.latitude:.6f}, Lng={node.last_gps.longitude:.6f}, Alt={node.last_gps.altitude:.2f}")

    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()
