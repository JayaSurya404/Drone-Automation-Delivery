#!/usr/bin/env bash
# ==============================================================================
# SkyNav Autonomous Drone Delivery - Gazebo Garden & ROS 2 Provisioning Script
# Supported Platforms: Ubuntu 22.04 LTS (Jammy) / Ubuntu 24.04 LTS (Noble) / WSL2
# ==============================================================================

set -euo pipefail

echo "=============================================================================="
echo "          SKYNAV GAZEBO & ROS 2 ROBOTICS SIMULATION PROVISIONER               "
echo "=============================================================================="

# 1. Detect OS Distribution
if [ -f /etc/os-release ]; then
  . /etc/os-release
  OS_CODENAME="${UBUNTU_CODENAME:-$VERSION_CODENAME}"
else
  echo "❌ Error: Cannot detect Linux distribution."
  exit 1
fi

echo "Detected Ubuntu Release: ${OS_CODENAME}"

# 2. Select ROS 2 and Gazebo Versions
if [ "${OS_CODENAME}" = "jammy" ]; then
  ROS_DISTRO="humble"
  GZ_VERSION="garden"
elif [ "${OS_CODENAME}" = "noble" ]; then
  ROS_DISTRO="jazzy"
  GZ_VERSION="harmonic"
else
  echo "⚠️ Warning: Recommended Ubuntu releases are 22.04 (jammy) or 24.04 (noble)."
  ROS_DISTRO="humble"
  GZ_VERSION="garden"
fi

echo "Target ROS 2 Distribution: ${ROS_DISTRO}"
echo "Target Gazebo Version:      gz-sim (${GZ_VERSION})"

# 3. System Update & Prerequisites
echo "\n--- Step 1: Installing Core Dependencies ---"
sudo apt-get update -y
sudo apt-get install -y curl gnupg lsb-release build-essential python3-pip git wget

# 4. Add Open Source Robotics Foundation (OSRF) Gazebo Repository
echo "\n--- Step 2: Adding Gazebo Official Repository ---"
sudo wget https://packages.osrfoundation.org/gazebo.gpg -O /usr/share/keyrings/pkgs-osrf-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/pkgs-osrf-archive-keyring.gpg] http://packages.osrfoundation.org/gazebo/ubuntu-stable $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/gazebo-stable.list > /dev/null

# 5. Add ROS 2 Official Repository
echo "\n--- Step 3: Adding ROS 2 Repository ---"
sudo curl -sSL https://raw.githubusercontent.com/ros/rosdistro/master/ros.key -o /usr/share/keyrings/ros-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/ros-archive-keyring.gpg] http://packages.ros.org/ros2/ubuntu $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/ros2.list > /dev/null

sudo apt-get update -y

# 6. Install Gazebo & ROS 2 Packages
echo "\n--- Step 4: Installing Gazebo (${GZ_VERSION}) & ROS 2 (${ROS_DISTRO}) ---"
sudo apt-get install -y \
  gz-${GZ_VERSION} \
  ros-${ROS_DISTRO}-ros-base \
  ros-${ROS_DISTRO}-ros-gz \
  ros-${ROS_DISTRO}-actuator-msgs \
  python3-colcon-common-extensions

# 7. Setup Environment Variables
echo "\n--- Step 5: Configuring Environment Variables ---"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

export GZ_SIM_RESOURCE_PATH="${REPO_ROOT}/simulation/gazebo/models:${REPO_ROOT}/simulation/gazebo/worlds:${GZ_SIM_RESOURCE_PATH:-}"
export ROS_DOMAIN_ID=42

echo "GZ_SIM_RESOURCE_PATH=${GZ_SIM_RESOURCE_PATH}" >> ~/.bashrc
echo "source /opt/ros/${ROS_DISTRO}/setup.bash" >> ~/.bashrc

echo "\n=============================================================================="
echo "🎉 GAZEBO & ROS 2 ENVIRONMENT PROVISIONING COMPLETE!                          "
echo "=============================================================================="
echo "To launch the SkyNav Gazebo World and Telemetry Bridge:"
echo "  1. gz sim -r ${REPO_ROOT}/simulation/gazebo/worlds/skynav_kurumbapalayam.sdf"
echo "  2. python3 ${REPO_ROOT}/simulation/gazebo/bridge/gazebo_telemetry_bridge.py"
echo "=============================================================================="
