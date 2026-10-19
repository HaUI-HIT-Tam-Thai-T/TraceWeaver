export function createHealthService(checkReadiness) {
  return {
    async isReady() {
      try { return await checkReadiness() === true; }
      catch { return false; }
    },
  };
}
