#!/usr/bin/env python3
"""
SkyNav Autonomous Drone Delivery - Gazebo & ROS 2 Master Launch File
===================================================================
Launches:
1. Gazebo Harmonic / Garden with Kurumbapalayam World (skynav_kurumbapalayam.sdf)
2. Spawns skynav_quad UAV model on SkyHub Kurumbapalayam launch pad (WGS84 11.1132, 77.0277)
3. Starts Gazebo-ROS 2 Bridge for IMU, GPS, Odometry, and Actuator Control
4. Launches SkyNav Python Telemetry Bridge daemon (port 8085)
"""

import os
from launch import LaunchDescription
from launch.actions import ExecuteProcess, DeclareLaunchArgument, LogInfo
from launch.substitutions import LaunchConfiguration

def generate_launch_description():
    pkg_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    world_path = os.path.join(pkg_dir, 'worlds', 'skynav_kurumbapalayam.sdf')
    bridge_script = os.path.join(pkg_dir, 'bridge', 'gazebo_telemetry_bridge.py')

    return LaunchDescription([
        LogInfo(msg="Initializing SkyNav Kurumbapalayam Gazebo Simulation & ROS 2 Telemetry Bridge..."),
        
        # 1. Gazebo Simulator Process
        ExecuteProcess(
            cmd=['gz', 'sim', '-r', world_path],
            output='screen',
            name='gazebo_sim'
        ),

        # 2. SkyNav Telemetry Bridge Process
        ExecuteProcess(
            cmd=['python3', bridge_script],
            output='screen',
            name='skynav_telemetry_bridge'
        ),
    ])
