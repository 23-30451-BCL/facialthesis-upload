# Facial Recognition Service — Local Setup (Multi-Camera)

This service runs **on your local machine** (the one connected to the IP cameras).
It detects faces from one or more RTSP streams and logs attendance to the web app.

## 1. Install dependencies

```bash
pip install -r requirements.txt
```

**Optional — GPU acceleration (highly recommended if you have an NVIDIA GPU):**
```bash
pip uninstall onnxruntime
pip install onnxruntime-gpu
```
This makes recognition 5–10× faster (~2 ms per face vs ~15 ms on CPU).

## 2. Configure cameras and API

Copy the template and fill in your values:

```bash
cp .env.example .env
```

Then edit `.env`:

```env
API_URL=https://your-app.replit.app
API_KEY=your-facial-recognition-api-key

# Camera 1
CAM1_NAME=Camera 1
CAM1_IP=192.168.1.64
CAM1_USERNAME=admin
CAM1_PASSWORD=your_password
CAM1_PORT=554
CAM1_STREAM_PATH=/Streaming/Channels/102

# Camera 2 (add as many CAMn_* groups as needed)
CAM2_NAME=Camera 2
CAM2_IP=192.168.1.65
CAM2_USERNAME=admin
CAM2_PASSWORD=your_password
```

- `API_URL` — your published Replit app URL
- `API_KEY` — the value of `FACIAL_RECOGNITION_API_KEY` from your Replit Secrets
- `CAMn_*` — one block per camera. The system auto-discovers all defined cameras

> **Important:** Add `.env` to `.gitignore` — it contains passwords.

## 3. Set the API key in Replit

In your Replit project, add a Secret:

| Key | Value |
|-----|-------|
| `FACIAL_RECOGNITION_API_KEY` | any strong random string |

## 4. Run the service

```bash
python facial_recognition_service.py
```

## How it works

1. On startup, downloads all registered personnel photos from the web API into `registered_personnel/`
2. Connects to **every** configured camera in parallel (each on its own thread)
3. Runs DeepFace (ArcFace) recognition continuously on each stream
4. When a face matches, POSTs the Employee ID + camera name to `/api/logs`
   (60-second cooldown per person, alternating TIME IN / TIME OUT)
5. A single tiled window shows all camera feeds side-by-side with live overlays
6. The Staff Monitoring page polls `/api/logs` and updates automatically

## Multi-camera behavior

- Each camera runs independently — a network drop on one camera never affects the others
- Console output tags each event with the camera name:
  `[Logged] Name: Juan Dela Cruz | Camera: Camera 1 | Time: 08:01 AM | Type: TIME IN`
- The display window auto-tiles: 1 camera = full size, 2 = side-by-side, 3+ = grid
- To switch from home network to campus network, just change the IP values in `.env` — no code changes

## Department-based access control

- **Admin** users see all logs from all departments
- **User** accounts only see logs from their own department

## Notes

- All camera IPs must be reachable from the machine running this script
- Photos uploaded during registration are used directly — no manual file copying needed
- Duplicate logging within the cooldown window is automatically suppressed
