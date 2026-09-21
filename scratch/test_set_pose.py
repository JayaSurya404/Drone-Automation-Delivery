import subprocess

req = 'name: "skynav_quad" position { x: 0.0 y: 0.0 z: 0.25 }'
r = subprocess.run([
    'gz', 'service', '-s', '/world/skynav_kurumbapalayam/set_pose',
    '--reqtype', 'gz.msgs.Pose',
    '--reptype', 'gz.msgs.Boolean',
    '--timeout', '2000',
    '--req', req
], capture_output=True, text=True)
print('STDOUT:', r.stdout)
print('STDERR:', r.stderr)
