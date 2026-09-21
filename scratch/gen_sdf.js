const fs = require('fs');
const buildings = JSON.parse(fs.readFileSync('scratch/gazebo_osm_buildings.json', 'utf8'));

let bModelsXml = '';
for (const b of buildings) {
  bModelsXml += `
    <!-- OSM Building: ${b.name} (Footprint: ${b.w}m x ${b.d}m, Height: ${b.h}m) -->
    <model name="${b.name}">
      <static>true</static>
      <pose>${b.x} ${b.y} ${b.z} 0 0 0</pose>
      <link name="link">
        <collision name="col">
          <geometry>
            <box>
              <size>${b.w} ${b.d} ${b.h}</size>
            </box>
          </geometry>
        </collision>
        <visual name="vis">
          <geometry>
            <box>
              <size>${b.w} ${b.d} ${b.h}</size>
            </box>
          </geometry>
          <material>
            <ambient>${b.color} 1</ambient>
            <diffuse>${b.color} 1</diffuse>
          </material>
        </visual>
      </link>
    </model>`;
}

const sdfHeader = `<?xml version="1.0" ?>
<sdf version="1.8">
  <world name="skynav_kurumbapalayam">
    <physics name="1ms" type="ode">
      <max_step_size>0.001</max_step_size>
      <real_time_factor>1.0</real_time_factor>
      <real_time_update_rate>1000</real_time_update_rate>
      <ode>
        <solver>
          <type>quick</type>
          <iters>50</iters>
          <sor>1.3</sor>
        </solver>
        <constraints>
          <cfm>0.0</cfm>
          <erp>0.2</erp>
          <contact_max_correcting_vel>100.0</contact_max_correcting_vel>
          <contact_surface_layer>0.001</contact_surface_layer>
        </constraints>
      </ode>
    </physics>

    <!-- Standard Gazebo System Plugins -->
    <plugin filename="gz-sim-physics-system" name="gz::sim::systems::Physics"/>
    <plugin filename="gz-sim-user-commands-system" name="gz::sim::systems::UserCommands"/>
    <plugin filename="gz-sim-scene-broadcaster-system" name="gz::sim::systems::SceneBroadcaster"/>
    <plugin filename="gz-sim-sensors-system" name="gz::sim::systems::Sensors">
      <render_engine>ogre2</render_engine>
    </plugin>
    <plugin filename="gz-sim-imu-system" name="gz::sim::systems::Imu"/>
    <plugin filename="gz-sim-navsat-system" name="gz::sim::systems::NavSat"/>
    <plugin filename="gz-sim-altimeter-system" name="gz::sim::systems::Altimeter"/>

    <!-- Geographic Origin: SkyHub Kurumbapalayam, Coimbatore, India -->
    <spherical_coordinates>
      <surface_model>EARTH_WGS84</surface_model>
      <latitude_deg>11.113200</latitude_deg>
      <longitude_deg>77.027700</longitude_deg>
      <elevation>374.0</elevation>
      <heading_deg>0.0</heading_deg>
    </spherical_coordinates>

    <!-- Sun Lighting -->
    <light type="directional" name="sun">
      <cast_shadows>true</cast_shadows>
      <pose>0 0 500 0.3 0.6 0</pose>
      <diffuse>0.9 0.9 0.85 1</diffuse>
      <specular>0.2 0.2 0.2 1</specular>
      <attenuation>
        <range>1000</range>
        <constant>0.9</constant>
        <linear>0.01</linear>
        <quadratic>0.001</quadratic>
      </attenuation>
      <direction>-0.4 0.2 -1.0</direction>
    </light>

    <!-- Ground Plane (Coimbatore Kurumbapalayam Base Elevation) -->
    <model name="kurumbapalayam_ground">
      <static>true</static>
      <link name="ground_link">
        <collision name="ground_collision">
          <geometry>
            <plane>
              <normal>0 0 1</normal>
              <size>10000 10000</size>
            </plane>
          </geometry>
          <surface>
            <friction>
              <ode>
                <mu>100</mu>
                <mu2>50</mu2>
              </ode>
            </friction>
          </surface>
        </collision>
        <visual name="ground_visual">
          <geometry>
            <plane>
              <normal>0 0 1</normal>
              <size>10000 10000</size>
            </plane>
          </geometry>
          <material>
            <ambient>0.25 0.35 0.22 1.0</ambient>
            <diffuse>0.3 0.4 0.25 1.0</diffuse>
          </material>
        </visual>
      </link>
    </model>

    <!-- SkyHub Kurumbapalayam Launch & Docking Base -->
    <model name="skyhub_launch_docking_pad">
      <static>true</static>
      <pose>0 0 0.1 0 0 0</pose>
      <link name="pad_link">
        <collision name="pad_col">
          <geometry>
            <cylinder>
              <radius>4.0</radius>
              <length>0.2</length>
            </cylinder>
          </geometry>
        </collision>
        <visual name="pad_vis">
          <geometry>
            <cylinder>
              <radius>4.0</radius>
              <length>0.2</length>
            </cylinder>
          </geometry>
          <material>
            <ambient>0.1 0.15 0.25 1.0</ambient>
            <diffuse>0.2 0.3 0.5 1.0</diffuse>
          </material>
        </visual>
      </link>
    </model>

    <!-- Autonomous SkyNav Delivery UAV (Spawned on SkyHub Kurumbapalayam Launch Pad) -->
    <include>
      <uri>model://skynav_quad</uri>
      <name>skynav_quad</name>
      <pose>0 0 0.25 0 0 0</pose>
    </include>
`;

const sdfFooter = `
    <!-- Customer Destination Drop Pad (1 km Destination: Kurumbapalayam South / KVIMIS Drop Zone) -->
    <!-- WGS84: 11.104200 N, 77.028112 E (Local ENU Pose: x=45.0m East, y=-995.0m South, z=0.08m) -->
    <model name="customer_1km_drop_pad">
      <static>true</static>
      <pose>45.0 -995.0 0.08 0 0 0</pose>
      <link name="pad_link">
        <collision name="col">
          <geometry>
            <cylinder>
              <radius>3.5</radius>
              <length>0.1</length>
            </cylinder>
          </geometry>
        </collision>
        <visual name="vis">
          <geometry>
            <cylinder>
              <radius>3.5</radius>
              <length>0.1</length>
            </cylinder>
          </geometry>
          <material>
            <ambient>0.1 0.6 0.3 1</ambient>
            <diffuse>0.15 0.8 0.4 1</diffuse>
          </material>
        </visual>
      </link>
    </model>

    <!-- Secondary Customer Destination Drop Pad (Kalapatti South Drop Zone: 4.71 km) -->
    <model name="customer_kalapatti_drop_pad">
      <static>true</static>
      <pose>680 -4520 0.05 0 0 0</pose>
      <link name="pad_link">
        <collision name="col">
          <geometry>
            <cylinder>
              <radius>3.5</radius>
              <length>0.1</length>
            </cylinder>
          </geometry>
        </collision>
        <visual name="vis">
          <geometry>
            <cylinder>
              <radius>3.5</radius>
              <length>0.1</length>
            </cylinder>
          </geometry>
          <material>
            <ambient>0.1 0.5 0.2 1</ambient>
            <diffuse>0.15 0.7 0.3 1</diffuse>
          </material>
        </visual>
      </link>
    </model>

    <!-- Physical Controlled Test Obstacle: Tower Construction Crane (OBS-CRANE-01) -->
    <!-- Positioned along the 1 km delivery airway at y=-550m to trigger real LaserScan detection & detour -->
    <!-- WGS84: 11.1082 N, 77.0279 E (Local ENU Pose: x=22.0m East, y=-550.0m South, z=27.5m, Height=55m) -->
    <model name="controlled_test_obstacle_crane">
      <static>true</static>
      <pose>22.0 -550.0 27.5 0 0 0</pose>
      <link name="crane_mast_link">
        <collision name="crane_mast_col">
          <geometry>
            <cylinder>
              <radius>4.5</radius>
              <length>55.0</length>
            </cylinder>
          </geometry>
        </collision>
        <visual name="crane_mast_vis">
          <geometry>
            <cylinder>
              <radius>4.5</radius>
              <length>55.0</length>
            </cylinder>
          </geometry>
          <material>
            <ambient>0.9 0.6 0.1 1.0</ambient>
            <diffuse>1.0 0.7 0.15 1.0</diffuse>
          </material>
        </visual>
        <!-- Crane Jib Arm (Horizontal Boom spanning 36m diameter / 18m radius) -->
        <collision name="crane_jib_col">
          <pose>0 0 26.5 0 0 0</pose>
          <geometry>
            <box>
              <size>36.0 3.0 2.5</size>
            </box>
          </geometry>
        </collision>
        <visual name="crane_jib_vis">
          <pose>0 0 26.5 0 0 0</pose>
          <geometry>
            <box>
              <size>36.0 3.0 2.5</size>
            </box>
          </geometry>
          <material>
            <ambient>0.9 0.1 0.1 1.0</ambient>
            <diffuse>1.0 0.15 0.15 1.0</diffuse>
          </material>
        </visual>
      </link>
    </model>

  </world>
</sdf>
`;

const completeSdf = sdfHeader + bModelsXml + '\n' + sdfFooter;
fs.writeFileSync('simulation/gazebo/worlds/skynav_kurumbapalayam.sdf', completeSdf);
console.log('Successfully wrote simulation/gazebo/worlds/skynav_kurumbapalayam.sdf with 24 OSM building collision models!');
