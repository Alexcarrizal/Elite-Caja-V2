export const generateLicensePin = (machineId: string) => {
  let hash = 0;
  // A simple deterministic hash based on machineId
  const str = (machineId || '').trim().toUpperCase() + "-ELITE-POS-SECRET-KEY-2024";
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  
  // Return an 8-character uppercase hex string
  return Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
};
