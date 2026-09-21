import rclpy
import time
from sensor_msgs.msg import NavSatFix

rclpy.init()
node = rclpy.create_node('tst')
msg = None

def cb(m):
    global msg
    msg = m

node.create_subscription(NavSatFix, '/skynav/sensors/gps', cb, 10)
for _ in range(20):
    rclpy.spin_once(node, timeout_sec=0.1)
    if msg:
        break

if msg:
    print(f'GPS: lat={msg.latitude:.6f}, lng={msg.longitude:.6f}, alt={msg.altitude:.2f}')
else:
    print('GPS: No message received')

node.destroy_node()
rclpy.shutdown()
