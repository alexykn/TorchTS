# TorchTS Model Management

This document describes the model management system that automatically handles loading and unloading of the Kokoro TTS model to optimize memory usage in Docker deployments.

## Overview

The TorchTS backend now includes an intelligent model lifecycle manager that:

- **Loads models on-demand** when TTS requests are made
- **Automatically unloads models** after a period of inactivity to free memory
- **Handles concurrent requests** safely during model loading/unloading
- **Provides API endpoints** for monitoring and controlling model state

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MODEL_UNLOAD_TIMEOUT` | `300` | Seconds of inactivity before unloading model |
| `MODEL_DEVICE` | auto-detect | Device to load model on (`cuda`, `cpu`, or empty for auto) |
| `TORCHTS_DB_URL` | `sqlite:///data/torchts.db` | Database connection string |
| `LOG_LEVEL` | `INFO` | Logging level |
| `FORCE_GC_AFTER_REQUEST` | `false` | Force garbage collection after requests |
| `CLEAR_CUDA_CACHE` | `true` | Clear CUDA cache after model unload |

### Docker Compose Configuration

For CPU-only deployment:
```yaml
environment:
  - MODEL_UNLOAD_TIMEOUT=300
  - MODEL_DEVICE=cpu
```

For GPU deployment:
```yaml
environment:
  - MODEL_UNLOAD_TIMEOUT=180  # Shorter timeout for GPU
  - MODEL_DEVICE=cuda
```

## Model Lifecycle

### 1. Initial State
- Server starts with no model loaded in memory
- First TTS request triggers model loading
- Loading takes 10-30 seconds depending on device

### 2. Active State
- Model remains in memory while processing requests
- Each request resets the inactivity timer
- Multiple concurrent requests are handled safely

### 3. Unload State
- After `MODEL_UNLOAD_TIMEOUT` seconds of inactivity
- Model is automatically unloaded from memory
- GPU memory is cleared (if using CUDA)
- Subsequent requests trigger reload

## API Endpoints

### Get Model Status
```http
GET /model/status
```

Returns current model state and memory usage:
```json
{
  "model_loaded": true,
  "device": "cuda",
  "unload_timeout": 300,
  "time_since_last_activity": 45.2,
  "is_loading": false,
  "available_languages": ["a", "b", "e", "f", "h", "i", "j", "p", "z"],
  "gpu_memory_allocated": 1234567890,
  "gpu_memory_reserved": 2345678901
}
```

### Force Model Unload
```http
POST /model/unload
```

Immediately unloads the model to free memory:
```json
{
  "message": "Model unloaded successfully"
}
```

### Update Timeout
```http
POST /model/timeout
Content-Type: application/json

{
  "timeout_seconds": 600
}
```

Updates the unload timeout (minimum 60 seconds):
```json
{
  "message": "Timeout updated to 600 seconds"
}
```

## Memory Optimization Tips

### For Low-Memory Systems
```bash
# Aggressive unloading (2 minutes)
MODEL_UNLOAD_TIMEOUT=120
FORCE_GC_AFTER_REQUEST=true
```

### For High-Performance Systems
```bash
# Keep model loaded longer (10 minutes)
MODEL_UNLOAD_TIMEOUT=600
FORCE_GC_AFTER_REQUEST=false
```

### For GPU Systems
```bash
# Balance performance and memory
MODEL_UNLOAD_TIMEOUT=300
MODEL_DEVICE=cuda
CLEAR_CUDA_CACHE=true
```

## Monitoring

### Memory Usage
Monitor model memory usage through the `/model/status` endpoint:

```bash
curl http://localhost:5005/model/status | jq '.gpu_memory_allocated'
```

### Docker Stats
Monitor container memory usage:

```bash
docker stats torchts-backend-1
```

### Logs
Model loading/unloading events are logged:

```
[green]Model loaded successfully in 12.34s[/green]
[yellow]Unloading model due to inactivity[/yellow]
[green]Model unloaded successfully[/green]
```

## Troubleshooting

### Model Won't Load
- Check device availability: `nvidia-smi` for GPU
- Verify memory availability (model needs ~2-4GB)
- Check logs for specific error messages

### High Memory Usage
- Reduce `MODEL_UNLOAD_TIMEOUT`
- Enable `FORCE_GC_AFTER_REQUEST`
- Monitor with `/model/status` endpoint

### Slow First Request
- This is expected behavior - model loading takes time
- Consider keeping model loaded with higher timeout
- Use `/model/status` to check loading progress

### CUDA Out of Memory
- Reduce `MODEL_UNLOAD_TIMEOUT`
- Ensure `CLEAR_CUDA_CACHE=true`
- Force unload with `POST /model/unload`

## Performance Characteristics

| Scenario | Model Load Time | Memory Usage | First Request Latency |
|----------|----------------|--------------|---------------------|
| CPU (4 cores) | 20-30s | ~2GB | 25-35s |
| GPU (RTX 3080) | 10-15s | ~3GB VRAM | 15-20s |
| GPU (A100) | 5-10s | ~3GB VRAM | 8-15s |

## Best Practices

1. **Set appropriate timeout**: Balance memory savings vs. response time
2. **Monitor memory usage**: Use `/model/status` and Docker stats
3. **Consider usage patterns**: Frequent use = higher timeout
4. **Test your hardware**: Measure load times for your specific setup
5. **Use health checks**: Monitor `/model/status` in production