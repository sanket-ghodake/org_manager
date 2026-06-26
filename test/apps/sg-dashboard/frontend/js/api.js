// Resolve API Prefix
const baseUrl = `${window.location.protocol}//${window.location.host}`;
const pathParts = window.location.pathname.split("/").filter(Boolean);
const slug = pathParts[0] === "forge-apps" ? pathParts[1] : "";
export const apiPrefix = slug
  ? `${baseUrl}/forge-apps/${slug}/api`
  : `${baseUrl}/api`;

export async function fetchConfig() {
  const res = await fetch(`${apiPrefix}/config`);
  if (!res.ok)
    throw new Error("Failed to retrieve application SSO configurations.");
  return res.json();
}

export async function exchangeCode(code) {
  const res = await fetch(`${apiPrefix}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    throw new Error(`Auth exchange failed: ${res.statusText}`);
  }
  return res.json();
}

export async function syncUserDirectory(apiToken, users) {
  const res = await fetch(`${apiPrefix}/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({ users }),
  });
  if (!res.ok) {
    throw new Error("Failed to sync directory");
  }
  return res.json();
}

export async function fetchDashboards(
  apiToken,
  userId = "",
  includeDeleted = false,
) {
  let url = `${apiPrefix}/dashboards`;
  const params = [];
  if (userId) params.push(`userId=${encodeURIComponent(userId)}`);
  if (includeDeleted) params.push(`includeDeleted=true`);
  if (params.length > 0) url += `?${params.join("&")}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiToken}` },
  });
  if (!res.ok) throw new Error("Failed to retrieve user programs list.");
  return res.json();
}

export async function fetchMyDashboard(apiToken, dashboardId = "") {
  const url = dashboardId
    ? `${apiPrefix}/dashboard?dashboardId=${encodeURIComponent(dashboardId)}`
    : `${apiPrefix}/dashboard`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiToken}` },
  });
  if (!res.ok) throw new Error("Failed to retrieve dashboard.");
  return res.json();
}

export async function fetchUserDashboard(apiToken, userId, dashboardId = "") {
  const url = dashboardId
    ? `${apiPrefix}/dashboard/${userId}?dashboardId=${encodeURIComponent(dashboardId)}`
    : `${apiPrefix}/dashboard/${userId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiToken}` },
  });
  if (!res.ok) {
    const err = new Error("Failed to retrieve employee dashboard data.");
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function saveDashboard(apiToken, dashboardId, dashboardData) {
  const res = await fetch(`${apiPrefix}/dashboard/${dashboardId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({
      program_line: dashboardData.program_line,
      objective: dashboardData.objective,
      status: dashboardData.status,
      notes: dashboardData.notes,
    }),
  });
  if (!res.ok) throw new Error("Failed to update dashboard settings");
  return res.json();
}

export async function addDashboardItem(apiToken, dashboardId, itemData) {
  const res = await fetch(`${apiPrefix}/dashboard/${dashboardId}/items`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify(itemData),
  });
  if (!res.ok) throw new Error("Failed to add item");
  return res.json();
}

export async function updateDashboardItem(apiToken, itemId, updateData) {
  const res = await fetch(`${apiPrefix}/dashboard/items/${itemId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify(updateData),
  });
  if (!res.ok) throw new Error("Failed to update item");
  return res.json();
}

export async function deleteDashboardItem(apiToken, itemId) {
  const res = await fetch(`${apiPrefix}/dashboard/items/${itemId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${apiToken}` },
  });
  if (!res.ok) throw new Error("Failed to delete item");
  return res.json();
}

export async function fetchTeam(apiToken, managerId = "") {
  const url = managerId
    ? `${apiPrefix}/team?managerId=${encodeURIComponent(managerId)}`
    : `${apiPrefix}/team`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiToken}` },
  });
  if (!res.ok) throw new Error("Failed to fetch team");
  return res.json();
}

export async function fetchSubmissions(apiToken, employeeId = "") {
  const url = employeeId
    ? `${apiPrefix}/submissions?employeeId=${encodeURIComponent(employeeId)}`
    : `${apiPrefix}/submissions`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiToken}` },
  });
  if (!res.ok) throw new Error("Failed to fetch submissions");
  return res.json();
}

export async function fetchSubmissionsReviews(apiToken) {
  const url = `${apiPrefix}/submissions/reviews`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiToken}` },
  });
  if (!res.ok) throw new Error("Failed to fetch submissions reviews queue");
  return res.json();
}

export async function fetchSuggestions(apiToken, section) {
  const url = `${apiPrefix}/suggestions?section=${encodeURIComponent(section)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiToken}` },
  });
  if (!res.ok) throw new Error("Failed to fetch autocomplete suggestions");
  return res.json();
}

export async function freezeSubmissionReq(apiToken, requestId) {
  const res = await fetch(`${apiPrefix}/submissions/${requestId}/freeze`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || "Failed to freeze submission");
  }
  return res.json();
}

export async function submitDashboardReq(apiToken, requestId, dashboardId) {
  const res = await fetch(`${apiPrefix}/submissions/${requestId}/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({ dashboard_id: dashboardId }),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || "Failed to submit dashboard");
  }
  return res.json();
}

export async function directSubmitDashboard(apiToken, dashboardId) {
  const res = await fetch(`${apiPrefix}/submissions/direct`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({ dashboard_id: dashboardId }),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || "Failed to submit dashboard");
  }
  return res.json();
}

export async function reviewSubmission(apiToken, requestId, status, feedback) {
  const res = await fetch(`${apiPrefix}/submissions/${requestId}/review`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({ status, feedback }),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || "Failed to submit review");
  }
  return res.json();
}

export async function createSubmissionRequest(
  apiToken,
  employeeId,
  deadline,
  dashboardId,
) {
  const res = await fetch(`${apiPrefix}/submissions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({
      employee_id: employeeId,
      deadline,
      dashboard_id: dashboardId,
    }),
  });
  return res;
}

export async function fetchDirectory(apiToken, q = "", managerId = "") {
  const queryParams = new URLSearchParams();
  if (q) queryParams.append("q", q);
  if (managerId) queryParams.append("managerId", managerId);
  return fetch(`${apiPrefix}/directory?${queryParams.toString()}`, {
    headers: {
      Authorization: `Bearer ${apiToken}`,
    },
  });
}

export async function duplicateDashboard(apiToken, dashboardId) {
  const res = await fetch(`${apiPrefix}/dashboard/${dashboardId}/duplicate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiToken}` },
  });
  if (!res.ok) throw new Error("Failed to duplicate dashboard");
  return res.json();
}

export async function deleteDashboard(apiToken, dashboardId) {
  const res = await fetch(`${apiPrefix}/dashboard/${dashboardId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${apiToken}` },
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to delete dashboard");
  }
  return res.json();
}

export async function createDashboard(apiToken, programName) {
  const res = await fetch(`${apiPrefix}/dashboard`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({ program_line: programName }),
  });
  if (!res.ok) throw new Error("Failed to create new program dashboard");
  return res.json();
}

export async function syncDashboardItemLinks(
  apiToken,
  dashboardId,
  sourceId,
  targetIds,
) {
  const res = await fetch(`${apiPrefix}/dashboard/${dashboardId}/links`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({ source_id: sourceId, target_ids: targetIds }),
  });
  if (!res.ok) throw new Error("Failed to update linked skill gaps");
  return res.json();
}

export async function fetchDashboardHistory(apiToken) {
  const res = await fetch(`${apiPrefix}/dashboards/history`, {
    headers: { Authorization: `Bearer ${apiToken}` },
  });
  if (!res.ok)
    throw new Error("Failed to retrieve deleted dashboards history.");
  return res.json();
}

export async function restoreDashboard(apiToken, dashboardId) {
  const res = await fetch(`${apiPrefix}/dashboard/${dashboardId}/restore`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiToken}` },
  });
  if (!res.ok) throw new Error("Failed to restore dashboard.");
  return res.json();
}

export async function deleteDashboardPermanent(apiToken, dashboardId) {
  const res = await fetch(`${apiPrefix}/dashboard/${dashboardId}/permanent`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${apiToken}` },
  });
  if (!res.ok) throw new Error("Failed to permanently delete dashboard.");
  return res.json();
}

export async function fetchVersions(apiToken, dashboardId) {
  const res = await fetch(`${apiPrefix}/dashboard/${dashboardId}/versions`, {
    headers: { Authorization: `Bearer ${apiToken}` },
  });
  if (!res.ok) throw new Error("Failed to retrieve versions.");
  return res.json();
}

export async function saveVersion(apiToken, dashboardId, versionName) {
  const res = await fetch(`${apiPrefix}/dashboard/${dashboardId}/versions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({ version_name: versionName }),
  });
  if (!res.ok) throw new Error("Failed to save dashboard version.");
  return res.json();
}

export async function restoreVersion(apiToken, dashboardId, versionId) {
  const res = await fetch(
    `${apiPrefix}/dashboard/${dashboardId}/versions/${versionId}/restore`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}` },
    },
  );
  if (!res.ok) throw new Error("Failed to restore dashboard version.");
  return res.json();
}

export async function deleteVersion(apiToken, dashboardId, versionId) {
  const res = await fetch(
    `${apiPrefix}/dashboard/${dashboardId}/versions/${versionId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiToken}` },
    },
  );
  if (!res.ok) throw new Error("Failed to delete version.");
  return res.json();
}
