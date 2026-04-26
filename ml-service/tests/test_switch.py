import requests
import time
import os

BASE_URL = "http://localhost:5001/api"

def test_model_switching():
    print("1. Checking current model info...")
    resp = requests.get(f"{BASE_URL}/api/model/info")
    initial_info = resp.json()
    print(f"   Current Model: {initial_info['modelType']} (Version: {initial_info['modelVersion']})")

    target_model = "xgboost" if initial_info['modelType'] != "xgboost" else "random_forest"
    
    print(f"\n2. Switching to {target_model}...")
    resp = requests.post(f"{BASE_URL}/api/model/switch", json={"modelType": target_model})
    switch_result = resp.json()
    print(f"   Switch Result: {switch_result['message']}")
    print(f"   New Model: {switch_result['modelType']} (Version: {switch_result['modelVersion']})")

    print("\n3. Verifying info endpoint picks up the change...")
    resp = requests.get(f"{BASE_URL}/api/model/info")
    new_info = resp.json()
    print(f"   Model Info: {new_info['modelType']} (Version: {new_info['modelVersion']})")
    
    if new_info['modelType'] == target_model:
        print("\n✅ SUCCESS: Model switched successfully!")
    else:
        print("\n❌ FAILURE: Model did not switch correctly.")

if __name__ == "__main__":
    try:
        test_model_switching()
    except Exception as e:
        print(f"Error during test: {e}")
