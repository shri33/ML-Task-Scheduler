import argparse
import pandas as pd
import numpy as np

def generate_kaggle_like_dataset(n_samples: int = 10000, seed: int = 42) -> pd.DataFrame:
    """
    Generates a realistic cloud/fog task execution dataset based on
    characteristics commonly found in Kaggle academic datasets.
    """
    rng = np.random.default_rng(seed)

    # 1. Base Task Sizes (SMALL=1, MEDIUM=2, LARGE=3)
    # Cloud environments usually have a long-tail distribution of small tasks
    task_size = rng.choice([1, 2, 3], size=n_samples, p=[0.6, 0.3, 0.1])

    # 2. Task Types (CPU=1, IO=2, MIXED=3)
    # Distribution based on simulated scientific/commercial cloud workloads
    task_type = rng.choice([1, 2, 3], size=n_samples, p=[0.5, 0.3, 0.2])

    # 3. Priority (1 to 5)
    priority = rng.choice([1, 2, 3, 4, 5], size=n_samples, p=[0.4, 0.3, 0.15, 0.1, 0.05])

    # 4. Resource Load (0.0 to 100.0)
    # Simulate diurnal patterns with a beta distribution (mostly mid-load, occasional spikes)
    resource_load = rng.beta(a=2.0, b=5.0, size=n_samples) * 100

    # --- Realistic Execution Time Model (Non-linear interactions) ---
    
    # Base execution baseline based purely on size (seconds)
    base_times = {1: 0.5, 2: 2.5, 3: 12.0}
    t_base = np.array([base_times[sz] for sz in task_size])

    # Type modifier (IO bounded tasks take longer on average due to latency)
    type_mod = np.where(task_type == 1, 1.0, np.where(task_type == 2, 1.8, 1.3))

    # Priority modifier (system gives more slices to high priority)
    # Lower priority (1) means longer wait/execution in congested states
    pri_mod = 1.0 + ((Math_clip(3 - priority, -2, 2)) * 0.15)
    
    # Load penalty is exponential. High load -> massive slowdown
    # If load goes above 80%, execution time spikes non-linearly
    load_penalty = 1.0 + (resource_load / 100.0) ** 2.5 * 3.0

    # Base predicted time
    ideal_time = t_base * type_mod * pri_mod * load_penalty

    # Add realistic heteroscedastic noise (variation grows with task duration)
    # Lognormal distribution mimics the right-skewed nature of execution times
    sigma = 0.2 + (resource_load / 400.0) # More variance under high load
    noise_factor = rng.lognormal(mean=0, sigma=sigma, size=n_samples)
    
    actual_time = ideal_time * noise_factor
    
    # Ensure no theoretically negative or impossibly fast times
    actual_time = np.maximum(actual_time, 0.05)

    df = pd.DataFrame({
        "taskSize": task_size,
        "taskType": task_type,
        "priority": priority,
        "resourceLoad": np.round(resource_load, 2),
        "actualTime": np.round(actual_time, 3)
    })

    return df

def Math_clip(val, min_val, max_val):
    return np.clip(val, min_val, max_val)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate Simulated Kaggle Cloud Task Dataset")
    parser.add_argument("--samples", type=int, default=15000, help="Number of rows to generate")
    parser.add_argument("--output", type=str, default="kaggle_cloud_tasks.csv", help="Output CSV filename")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    
    args = parser.parse_args()
    
    print(f"Generating {args.samples} samples mimicking Kaggle Cloud/Fog datasets...")
    df = generate_kaggle_like_dataset(n_samples=args.samples, seed=args.seed)
    
    print("\nDataset Sample:")
    print(df.head())
    
    print("\nStatistical Summary:")
    print(df.describe().round(2))
    
    df.to_csv(args.output, index=False)
    print(f"\n✅ Successfully saved realistic academic simulated dataset to {args.output}")
