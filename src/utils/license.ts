// Simple and robust cryptographic-like license generator
export function generateLicenseKey(email: string): string {
  const cleanEmail = email.toLowerCase().trim();
  
  // Custom hash 1
  let hash1 = 0;
  const salt1 = "ELITECAJA_2026_SECURE_SALT_A";
  const combined1 = cleanEmail + salt1;
  for (let i = 0; i < combined1.length; i++) {
    const char = combined1.charCodeAt(i);
    hash1 = ((hash1 << 5) - hash1) + char;
    hash1 = hash1 & hash1; // Convert to 32bit integer
  }
  const hex1 = Math.abs(hash1).toString(16).toUpperCase().padStart(8, '0');
  
  // Custom hash 2
  let hash2 = 5381;
  const salt2 = "ELITECAJA_2026_SECURE_SALT_B";
  const combined2 = salt2 + cleanEmail;
  for (let i = 0; i < combined2.length; i++) {
    const char = combined2.charCodeAt(i);
    hash2 = ((hash2 << 5) + hash2) + char;
    hash2 = hash2 & hash2; // Convert to 32bit integer
  }
  const hex2 = Math.abs(hash2).toString(16).toUpperCase().padStart(8, '0');
  
  const segment1 = hex1.substring(0, 4);
  const segment2 = hex1.substring(4, 8);
  const segment3 = hex2.substring(0, 4);
  const segment4 = hex2.substring(4, 8);
  
  return `EC-${segment1}-${segment2}-${segment3}-${segment4}`;
}

export function validateLicense(license: any, firebaseUser: any): boolean {
  if (!license || license.status !== 'active') {
    return false;
  }
  
  const email = license.cloudEmail || (firebaseUser && firebaseUser.email);
  if (!email) {
    return false;
  }
  
  const cleanEmail = email.toLowerCase().trim();
  const expectedKey = generateLicenseKey(cleanEmail);
  
  return license.licenseKey === expectedKey && license.cloudEmail?.toLowerCase().trim() === cleanEmail;
}
