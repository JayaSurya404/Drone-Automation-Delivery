import sys
try:
    import rclpy
    from rclpy.node import Node
    from geometry_msgs.msg import Twist
    from sensor_msgs.msg import NavSatFix, Imu, LaserScan
    from nav_msgs.msg import Odometry

    rclpy.init()
    node = Node('skynav_test_node')
    print("SUCCESS: rclpy and ROS 2 message packages imported and node initialized successfully!")
    rclpy.shutdown()
except Exception as e:
    print(f"FAILED: {e}")
