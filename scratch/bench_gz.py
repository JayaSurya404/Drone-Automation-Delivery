import time, subprocess

t0 = time.time()
req = 'name: "skynav_quad" position { x: 0.0 y: 0.0 z: 0.25 } orientation { x: 0.0 y: 0.0 z: 0.0 w: 1.0 }'
for _ in range(5):
    res = subprocess.run(['gz', 'service', '-s', '/world/skynav_kurumbapalayam/set_pose', '--reqtype', 'gz.msgs.Pose', '--reptype', 'gz.msgs.Boolean', '--timeout', '500', '--req', req], capture_output=True)
print(f"5 set_pose calls took: {time.time() - t0:.3f}s (avg: {(time.time()-t0)/5:.3f}s)")
