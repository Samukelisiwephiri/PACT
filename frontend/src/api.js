// Define your base API URL. 
// It uses environment variables if available, otherwise falls back to localhost.
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error('Unable to reach the PACT authentication server. Make sure the backend is running.');
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('The authentication server returned an invalid response.');
  }
  if (!response.ok) {
    const error = new Error(data.error || `Authentication failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function authRequest(path, options = {}) {
  return apiRequest(`/api/auth${path}`, options);
}

export async function getCurrentUser() {
  try {
    return await authRequest('/me');
  } catch (error) {
    if (error.status === 401) return null;
    throw error;
  }
}

export function registerAccount(account) {
  return authRequest('/register', {
    method: 'POST',
    body: JSON.stringify(account),
  });
}

export function loginWithEmail(credentials) {
  return authRequest('/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
}

export function loginWithGoogle(credential) {
  return authRequest('/google', {
    method: 'POST',
    body: JSON.stringify({ credential }),
  });
}

export function logout() {
  return authRequest('/logout', { method: 'POST' });
}

export async function getPayFastConfig() {
  return apiRequest('/api/payments/config');
}

export async function createPayFastCheckout(details) {
  return apiRequest('/api/payments/checkout', {
    method: 'POST',
    body: JSON.stringify(details),
  });
}

export async function getPayFastPayment(reference) {
  return apiRequest(`/api/payments/${encodeURIComponent(reference)}`);
}

// Function to fetch all contributions for the ledger
export async function getContributions() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/contributions`);
    if (!response.ok) {
      throw new Error('Failed to fetch contributions');
    }
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    return [];
  }
}

// Function to send a new contribution (triggered when someone presses '#' on the ESP32 simulator)
export async function addContribution(contributionData) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/contributions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(contributionData),
    });
    if (!response.ok) {
      throw new Error('Failed to save contribution');
    }
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}