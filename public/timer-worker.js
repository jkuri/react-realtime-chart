let intervalId;

self.onmessage = (e) => {
  const { action, interval } = e.data;

  if (action === "start") {
    intervalId = setInterval(() => {
      self.postMessage({ type: "tick", timestamp: Date.now() });
    }, interval);
  } else if (action === "stop") {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }
};
