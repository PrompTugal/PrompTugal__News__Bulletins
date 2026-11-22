# voice-local.py: the open-source voice for Explorer videos (bulletins.d@PrompTugal.dinis, 22 Nov 2026).
# Dinis, 22 Nov: "use open source models for the initial voice generation".
# Kokoro-82M (Apache-2.0 weights; kokoro-onnx, MIT; onnxruntime, MIT), run on the CPU, offline, at no cost. Kokoro
# reads exactly the text it is given, so there is no transcript to check; each phrase is voiced on its own, so the
# caller knows when every phrase starts and ends.
# Input (stdin, JSON): {"model": path, "voices": path, "voice": "bm_george", "lang": "en-gb",
#                       "out": dir, "phrases": [{"text": "...", "speed": 1.0}, ...]}
# Output: <out>/pNNN.pcm (16-bit, 24 kHz, mono) per phrase, and on stdout JSON
#         {"rate": 24000, "phrases": [{"file", "samples", "voiced": [first, last]}]}, the voiced span found by loudness.
import json, os, sys
import numpy as np
from kokoro_onnx import Kokoro

job = json.load(sys.stdin)
k = Kokoro(job["model"], job["voices"])
out, res = job["out"], []
os.makedirs(out, exist_ok=True)
for i, p in enumerate(job["phrases"]):
    audio, rate = k.create(p["text"], voice=job.get("voice", "bm_george"), speed=float(p.get("speed", 1.0)), lang=job.get("lang", "en-gb"))
    a = np.clip(np.asarray(audio, dtype=np.float32), -1, 1)
    pcm = (a * 32767).astype("<i2")
    f = os.path.join(out, "p%03d.pcm" % i)
    pcm.tofile(f)
    # The voiced span: the first and last 10 ms window louder than 3% of the phrase's peak.
    win = max(1, rate // 100)
    n = len(a) // win
    env = np.array([np.sqrt(np.mean(a[j * win:(j + 1) * win] ** 2)) for j in range(n)]) if n else np.array([0.0])
    thr = max(1e-4, 0.03 * float(env.max()))
    loud = np.nonzero(env > thr)[0]
    first, last = (int(loud[0] * win), int(min(len(a), (loud[-1] + 1) * win))) if len(loud) else (0, len(a))
    res.append({"file": f, "samples": int(len(a)), "voiced": [first, last]})
print(json.dumps({"rate": int(rate), "phrases": res}))
