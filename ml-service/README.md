# ML Service for Task Scheduling

This service provides ML-powered predictions for task execution time.

## Setup

```bash
# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (Linux/Mac)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

## Running

```bash
python app.py
```

The service will start on port 5001.

## API Endpoints

### Health Check
```
GET /api/health
```

### Predict Execution Time
```
POST /api/predict
Content-Type: application/json

{
    "taskSize": 2,      // 1=SMALL, 2=MEDIUM, 3=LARGE
    "taskType": 1,      // 1=CPU, 2=IO, 3=MIXED
    "priority": 4,      // 1-5
    "resourceLoad": 45  // 0-100
}
```

Response:
```json
{
    "predictedTime": 4.23,
    "confidence": 0.87,
    "modelVersion": "v20260105120000"
}
```

### Model Info
```
GET /api/model/info
```

## Model Details

- **Algorithm**: Random Forest Regressor
- **Features**: taskSize, taskType, priority, resourceLoad
- **Output**: Predicted execution time in seconds
