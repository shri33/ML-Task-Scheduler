import http from "k6/http";
import { sleep, check } from "k6";

export const options = {
  vus: 50,
  duration: "120s"
};

export default function () {
  const payload = JSON.stringify({
    task: "heavy",
    cpuRequired: Math.floor(Math.random() * 4) + 1,
    memoryRequired: Math.floor(Math.random() * 2048) + 512
  });

  const res = http.post("http://localhost/api/predict", payload, {
    headers: { "Content-Type": "application/json" }
  });

  check(res, {
    "status is 200": (r) => r.status === 200,
    "has prediction": (r) => JSON.parse(r.body).executionTime !== undefined
  });

  sleep(0.5);
}
