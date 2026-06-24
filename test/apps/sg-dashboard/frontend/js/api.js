// Resolve API Prefix
const baseUrl = `${window.location.protocol}//${window.location.host}`;
const pathParts = window.location.pathname.split('/').filter(Boolean);
const slug = pathParts[0] === 'forge-apps' ? pathParts[1] : '';
export const apiPrefix = slug ? `${baseUrl}/forge-apps/${slug}/api` : `${baseUrl}/api`;

export async function fetchConfig() {
  const res = await fetch(`${apiPrefix}/config`);
  if (!res.ok) throw new Error('Failed to retrieve application SSO configurations.');
  return res.json();
}

export async function exchangeCode(code) {
  const res = await fetch(`${apiPrefix}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code })
  });
  if (!res.ok) {
    throw new Error(`Auth exchange failed: ${res.statusText}`);
  }
  return res.json();
}

export async function syncUserDirectory(apiToken, users) {
  const res = await fetch(`${apiPrefix}/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiToken}`
    },
    body: JSON.stringify({ users })
  });
  if (!res.ok) {
    throw new Error('Failed to sync directory');
  }
  return res.json();
}

export async function fetchMyDashboard(apiToken) {
  const res = await fetch(`${apiPrefix}/dashboard`, {
    headers: { 'Authorization': `Bearer ${apiToken}` }
  });
  if (!res.ok) throw new Error('Failed to retrieve dashboard.');
  return res.json();
}

export async function fetchUserDashboard(apiToken, userId) {
  const res = await fetch(`${apiPrefix}/dashboard/${userId}`, {
    headers: { 'Authorization': `Bearer ${apiToken}` }
  });
  if (!res.ok) throw new Error('Failed to retrieve employee dashboard data.');
  return res.json();
}

export async function saveDashboard(apiToken, dashboardId, dashboardData) {
  const res = await fetch(`${apiPrefix}/dashboard/${dashboardId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiToken}`
    },
    body: JSON.stringify({
      program_line: dashboardData.program_line,
      objective: dashboardData.objective,
      status: dashboardData.status,
      notes: dashboardData.notes
    })
  });
  if (!res.ok) throw new Error('Failed to update dashboard settings');
  return res.json();
}

export async function addDashboardItem(apiToken, dashboardId, itemData) {
  const res = await fetch(`${apiPrefix}/dashboard/${dashboardId}/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiToken}`
    },
    body: JSON.stringify(itemData)
  });
  if (!res.ok) throw new Error('Failed to add item');
  return res.json();
}

export async function updateDashboardItem(apiToken, itemId, updateData) {
  const res = await fetch(`${apiPrefix}/dashboard/items/${itemId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiToken}`
    },
    body: JSON.stringify(updateData)
  });
  if (!res.ok) throw new Error('Failed to update item');
  return res.json();
}

export async function deleteDashboardItem(apiToken, itemId) {
  const res = await fetch(`${apiPrefix}/dashboard/items/${itemId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${apiToken}` }
  });
  if (!res.ok) throw new Error('Failed to delete item');
  return res.json();
}

export async function fetchTeam(apiToken) {
  const res = await fetch(`${apiPrefix}/team`, {
    headers: { 'Authorization': `Bearer ${apiToken}` }
  });
  if (!res.ok) throw new Error('Failed to fetch team');
  return res.json();
}

export async function fetchSubmissions(apiToken) {
  const res = await fetch(`${apiPrefix}/submissions`, {
    headers: { 'Authorization': `Bearer ${apiToken}` }
  });
  if (!res.ok) throw new Error('Failed to fetch submissions');
  return res.json();
}

export async function submitDashboardReq(apiToken, requestId) {
  const res = await fetch(`${apiPrefix}/submissions/${requestId}/submit`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiToken}` }
  });
  if (!res.ok) throw new Error('Failed to submit dashboard');
  return res.json();
}

export async function createSubmissionRequest(apiToken, employeeId, deadline) {
  const res = await fetch(`${apiPrefix}/submissions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiToken}`
    },
    body: JSON.stringify({ employee_id: employeeId, deadline })
  });
  return res;
}

export async function fetchDirectory() {
  return fetch(`${baseUrl}/api/directory`);
}
