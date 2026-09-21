#!/usr/bin/env python3
import subprocess

req = 'name: "skynav_quad" position { x: 0.0 y: 0.0 z: 0.25 } orientation { x: 0.0 y: 0.0 z: 0.0 w: 1.0 }'
res = subprocess.run(['gz', 'service', '-s', '/world/skynav_kurumbapalayam/set_pose', '--reqtype', 'gz.msgs.Pose', '--reptype', 'gz.msgs.Boolean', '--timeout', '3000', '--req', req], capture_output=True, text=True)
print(res.stdout, res.stderr)
