import { expect, test, describe, spyOn, afterEach } from "bun:test";
import { hasAppAccess } from "@backend/auth/permissionEngine";
import { db } from "@database/connection";

// Setup mocks for database execute
const mockDbExecute = spyOn(db, "execute");

afterEach(() => {
  mockDbExecute.mockClear();
});

const VALID_USER_ID = "10000000-0000-0000-0000-000000000099";
const VALID_APP_ID = "20000000-0000-0000-0000-000000000099";

describe("Application Authorization & Entitlements Engine", () => {

  test("Should deny access if the application is globally disabled", async () => {
    // 1st call: app slug lookup (resolved ID)
    // 2nd call: user context query for entitlements
    // 3rd call: app details fetch (isEnabled = false)
    let callCount = 0;
    mockDbExecute.mockImplementation(async (sqlObj: any) => {
      callCount++;
      if (callCount === 1) {
        return { rows: [{ id: VALID_APP_ID }], rowCount: 1 };
      }
      if (callCount === 2) {
        return { rows: [{ userId: VALID_USER_ID, designationId: "desig-123", teamIds: [], projectIds: [], groupIds: [], orgNodeIds: [] }], rowCount: 1 };
      }
      if (callCount === 3) {
        return { rows: [{ id: VALID_APP_ID, isEnabled: false, targetRules: { minJobLevel: 1 } }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const hasAccess = await hasAppAccess(VALID_USER_ID, "manager-operations");
    expect(hasAccess).toBe(false);
  });

  test("Should allow access based on minJobLevel targeting rules if no entitlements exist", async () => {
    // Test case: manager (job level 3) trying to access app targeting minJobLevel 3
    let callCount = 0;
    mockDbExecute.mockImplementation(async (sqlObj: any) => {
      callCount++;
      if (callCount === 1) {
        return { rows: [{ id: VALID_APP_ID }], rowCount: 1 };
      }
      if (callCount === 2) {
        // user context query
        return { rows: [{ userId: VALID_USER_ID, designationId: "desig-123", teamIds: [], projectIds: [], groupIds: [], orgNodeIds: [] }], rowCount: 1 };
      }
      if (callCount === 3) {
        // entitlements query (no matching rows returned)
        return { rows: [], rowCount: 0 };
      }
      if (callCount === 4) {
        // app details fetch (isEnabled = true, minJobLevel = 3)
        return { rows: [{ id: VALID_APP_ID, isEnabled: true, targetRules: { minJobLevel: 3 } }], rowCount: 1 };
      }
      if (callCount === 5) {
        // user details query (Designation: Manager)
        return { rows: [{ designation: "Manager Operations", designationId: "desig-123", verticalId: "vert-123" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const hasAccess = await hasAppAccess(VALID_USER_ID, "manager-operations");
    expect(hasAccess).toBe(true);
  });

  test("Should block access based on minJobLevel targeting rules if job level is too low", async () => {
    // Test case: staff (job level 1) trying to access app targeting minJobLevel 3
    let callCount = 0;
    mockDbExecute.mockImplementation(async (sqlObj: any) => {
      callCount++;
      if (callCount === 1) {
        return { rows: [{ id: VALID_APP_ID }], rowCount: 1 };
      }
      if (callCount === 2) {
        return { rows: [{ userId: VALID_USER_ID, designationId: "desig-123", teamIds: [], projectIds: [], groupIds: [], orgNodeIds: [] }], rowCount: 1 };
      }
      if (callCount === 3) {
        return { rows: [], rowCount: 0 };
      }
      if (callCount === 4) {
        return { rows: [{ id: VALID_APP_ID, isEnabled: true, targetRules: { minJobLevel: 3 } }], rowCount: 1 };
      }
      if (callCount === 5) {
        // user details query (Designation: Staff Member, level 1)
        return { rows: [{ designation: "Staff Member", designationId: "desig-123", verticalId: "vert-123" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const hasAccess = await hasAppAccess(VALID_USER_ID, "manager-operations");
    expect(hasAccess).toBe(false);
  });

  test("Explicit user-level GRANT entitlement should override targeting rules and permit access", async () => {
    // Test case: staff (level 1) accessing level 3 app, but has explicit user-level grant
    let callCount = 0;
    mockDbExecute.mockImplementation(async (sqlObj: any) => {
      callCount++;
      if (callCount === 1) {
        return { rows: [{ id: VALID_APP_ID }], rowCount: 1 };
      }
      if (callCount === 2) {
        return { rows: [{ userId: VALID_USER_ID, designationId: "desig-123", teamIds: [], projectIds: [], groupIds: [], orgNodeIds: [] }], rowCount: 1 };
      }
      if (callCount === 3) {
        // matching user-level grant entitlement is returned
        return { rows: [{ subjectType: "user", subjectId: VALID_USER_ID, accessType: "grant" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const hasAccess = await hasAppAccess(VALID_USER_ID, "manager-operations");
    expect(hasAccess).toBe(true);
  });

  test("Explicit user-level DENY entitlement should override targeting rules and block access", async () => {
    // Test case: manager (level 3) accessing level 3 app, but has explicit user-level deny
    let callCount = 0;
    mockDbExecute.mockImplementation(async (sqlObj: any) => {
      callCount++;
      if (callCount === 1) {
        return { rows: [{ id: VALID_APP_ID }], rowCount: 1 };
      }
      if (callCount === 2) {
        return { rows: [{ userId: VALID_USER_ID, designationId: "desig-123", teamIds: [], projectIds: [], groupIds: [], orgNodeIds: [] }], rowCount: 1 };
      }
      if (callCount === 3) {
        // matching user-level deny entitlement is returned
        return { rows: [{ subjectType: "user", subjectId: VALID_USER_ID, accessType: "deny" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const hasAccess = await hasAppAccess(VALID_USER_ID, "manager-operations");
    expect(hasAccess).toBe(false);
  });

});
