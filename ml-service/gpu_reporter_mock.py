import requests
import time
import random
import argparse

def start_mock_reporter(node_id, host, gpu_type, vram_total):
    print(f"Starting GPU Reporter for {node_id} on {host} (Type: {gpu_type}, VRAM: {vram_total}GB)")
    
    url = "http://localhost:5000/api/gpu/register" # Assuming backend runs on 5000
    
    # Initialize some mock state
    vram_used = random.uniform(0.5, 4.0)
    utilization = random.uniform(10.0, 30.0)
    
    while True:
        # Simulate slight fluctuations in GPU state
        vram_used += random.uniform(-0.5, 0.5)
        vram_used = max(0.5, min(vram_used, vram_total))
        
        utilization += random.uniform(-5.0, 5.0)
        utilization = max(0.0, min(utilization, 100.0))
        
        payload = {
            "id": node_id,
            "host": host,
            "gpuType": gpu_type,
            "vramTotal": vram_total,
            "vramUsed": round(vram_used, 2),
            "utilization": round(utilization, 2),
            "queue": 0
        }
        
        try:
            res = requests.post(url, json=payload, timeout=2)
            if res.status_code == 200:
                print(f"[{time.strftime('%H:%M:%S')}] Reported Heartbeat -> VRAM: {vram_used:.1f}GB/{vram_total}GB, Util: {utilization:.1f}%")
            else:
                print(f"[{time.strftime('%H:%M:%S')}] Failed to report: HTTP {res.status_code}")
        except requests.exceptions.RequestException as e:
            print(f"[{time.strftime('%H:%M:%S')}] Connection error: {e}")
            
        time.sleep(5)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Mock GPU Worker Node Reporter")
    parser.add_argument("--id", type=str, default="gpu-node-local", help="Node ID")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Node hostname/IP")
    parser.add_argument("--type", type=str, default="RTX-4090", help="GPU Type")
    parser.add_argument("--vram", type=float, default=24.0, help="Total VRAM in GB")
    
    args = parser.parse_args()
    start_mock_reporter(args.id, args.host, args.type, args.vram)
