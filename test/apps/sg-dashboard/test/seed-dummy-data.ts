import fs from 'fs';
import path from 'path';

export async function seedDummyData(db: any) {
  try {
    // Find company_data.json using multiple fallback paths
    const pathsToCheck = [
      '/app/test-dummy/company_data.json',
      path.join(__dirname, '../../../../test/dummy-data/company_data.json'),
      path.join(__dirname, '../../../test/dummy-data/company_data.json'),
      path.join(process.cwd(), '../../test/dummy-data/company_data.json'),
      path.join(process.cwd(), 'test/dummy-data/company_data.json')
    ];

    let dataPath = '';
    for (const p of pathsToCheck) {
      if (fs.existsSync(p)) {
        dataPath = p;
        break;
      }
    }

    if (!dataPath) {
      console.warn('Main core app dummy data company_data.json not found in search paths. Skipping local seed.');
      return;
    }

    const mockData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    console.log(`Seeding local database with ${mockData.employees.length} users and dashboards aligned with main core application...`);

    // Enable WAL transaction to execute hundreds of inserts in milliseconds
    await db.execute('PRAGMA foreign_keys = OFF;');
    await db.execute('BEGIN TRANSACTION');

    const userRoleMap: Record<string, string> = {
      'super_admin': 'Admin',
      'admin': 'Admin',
      'read_only_admin': 'Admin',
      'user': 'Employee'
    };

    const userMap = new Map<string, any>();
    for (const emp of mockData.employees) {
      let role = userRoleMap[emp.role] || 'Employee';
      if (emp.designation && (
        emp.designation.includes('Manager') || 
        emp.designation.includes('Director') || 
        emp.designation.includes('VP') || 
        emp.designation.includes('CEO')
      )) {
        role = 'Manager';
      }
      userMap.set(emp.eid, {
        id: emp.eid, // Using EID mapping directly for seamless SSO resolution
        name: emp.name,
        email: emp.email,
        role,
        managerEid: emp.managerEid,
        designation: emp.designation || 'L3 Associate Analyst'
      });
    }

    // Insert all users
    for (const user of userMap.values()) {
      const managerLocalId = user.managerEid ? user.managerEid : null;
      await db.execute({
        sql: `INSERT OR REPLACE INTO users (id, name, email, role, manager_id, designation) VALUES (?, ?, ?, ?, ?, ?)`,
        args: [user.id, user.name, user.email, user.role, managerLocalId, user.designation]
      });
    }

    // Pools for realistic dashboard content generation
    const programLines = ['Core Engineering', 'NextGen Platforms', 'AI/ML Enablement', 'Security Hardening', 'Enterprise Cloud'];
    const statuses = ['On Track', 'At Risk', 'Off Track'];
    const skillPool = [
      { category: 'Strategic', title: 'Golang Microservices', desc: 'Designing and building high-concurrency RPC services using Bun/Go.' },
      { category: 'Strategic', title: 'Next.js 15 & SSR', desc: 'Leveraging Server Components and optimized server side rendering.' },
      { category: 'Core', title: 'React State Orchestration', desc: 'Advanced state management with Redux/Zustand and context providers.' },
      { category: 'Core', title: 'TypeScript Integration', desc: 'Strict typing structures and compilation rules across mono-repos.' },
      { category: 'Strategic', title: 'Kubernetes Orchestration', desc: 'Writing Helm charts and managing zero-downtime cluster configurations.' },
      { category: 'Core', title: 'PostgreSQL Architecture', desc: 'Indexing strategies, query optimization, and connection pooling rules.' },
      { category: 'Strategic', title: 'Docker Containers', desc: 'Multi-stage builds and optimized runtime layers.' },
      { category: 'Core', title: 'Fastify API Framework', desc: 'High-performance HTTP routing, JSON schema serialization, and plugins.' }
    ];

    const gapPool = [
      { category: 'Conceptual', title: 'Distributed Tracing', desc: 'Understanding OpenTelemetry instrumentation across microservices.' },
      { category: 'Technical', title: 'Rust Systems Programming', desc: 'Learning memory safety rules and compile-time check invariants.' },
      { category: 'Conceptual', title: 'GraphQL Federation', desc: 'Designing unified gateway graphs across separate GraphQL schemas.' },
      { category: 'Technical', title: 'E2E Cypress Testing', desc: 'Configuring parallel runner checks and automated session setups.' }
    ];

    const planPool = [
      { category: 'Mitigation:Training', title: 'Google Cloud Architect Prep', desc: 'Complete the official cloud infrastructure syllabus.' },
      { category: 'Mitigation:Mentorship', title: 'Rust Programming Workshop', desc: 'Pair programming with a staff engineer 1 hour weekly.' },
      { category: 'Mitigation:Internal Course', title: 'Advanced GraphQL Academy', desc: 'Take the federation course on internal portals.' },
      { category: 'Mitigation:Self Study', title: 'OpenTelemetry Deep Dive', desc: 'Read trace documentation and complete sandbox tasks.' }
    ];

    for (const user of userMap.values()) {
      if (user.role === 'Admin') continue; // Admins don't hold personal TRR plans

      const dashboardId = `dash-${user.id}`;
      const programLine = programLines[Math.floor(Math.random() * programLines.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const objective = `Accelerate technical excellence and lead delivery on ${programLine} deliverables for the next performance cycle.`;
      const notes = `Targeting completion of strategic goals by end of next quarter. Regular 1:1 check-ins established with manager.`;
      const updated_at = new Date().toISOString();

      await db.execute({
        sql: `INSERT OR REPLACE INTO dashboards (id, user_id, program_line, objective, status, notes, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [dashboardId, user.id, programLine, objective, status, notes, updated_at]
      });

      // Add a few skills
      const numSkills = 2 + Math.floor(Math.random() * 3);
      const shuffledSkills = [...skillPool].sort(() => 0.5 - Math.random());
      for (let i = 0; i < numSkills; i++) {
        const skill = shuffledSkills[i];
        await db.execute({
          sql: `INSERT OR REPLACE INTO dashboard_items (id, dashboard_id, section, category, title, description) VALUES (?, ?, ?, ?, ?, ?)`,
          args: [`item-sk-${user.id}-${i}`, dashboardId, 'key_skill', skill.category, skill.title, skill.desc]
        });
      }

      // Add a gap
      const gap = gapPool[Math.floor(Math.random() * gapPool.length)];
      await db.execute({
        sql: `INSERT OR REPLACE INTO dashboard_items (id, dashboard_id, section, category, title, description) VALUES (?, ?, ?, ?, ?, ?)`,
        args: [`item-gp-${user.id}`, dashboardId, 'gap', gap.category, gap.title, gap.desc]
      });

      // Add a plan
      const plan = planPool[Math.floor(Math.random() * planPool.length)];
      await db.execute({
        sql: `INSERT OR REPLACE INTO dashboard_items (id, dashboard_id, section, category, title, description) VALUES (?, ?, ?, ?, ?, ?)`,
        args: [`item-pl-${user.id}`, dashboardId, 'training_plan', plan.category, plan.title, plan.desc]
      });
    }

    // 3. Seed submission requests for direct reports
    const activeManagers = Array.from(userMap.values()).filter(u => u.managerEid);
    for (let i = 0; i < activeManagers.length; i++) {
      const emp = activeManagers[i];
      if (!emp.managerEid) continue;

      const subId = `sub-req-${emp.id}`;
      const deadlines = ['2026-07-01', '2026-08-15', '2026-06-30'];
      const deadline = deadlines[i % deadlines.length];
      
      const statOptions = ['Pending', 'Submitted', 'Approved', 'Needs Revision'];
      const status = statOptions[i % statOptions.length];

      let feedback = '';
      let submitted_at = null;
      let reviewed_at = null;

      if (status === 'Submitted') {
        submitted_at = new Date().toISOString().split('T')[0];
      } else if (status === 'Approved') {
        submitted_at = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        reviewed_at = new Date().toISOString().split('T')[0];
        feedback = 'Excellent progression on strategic objectives. The plan covers all crucial technical skills required for L5 progression. Signed off.';
      } else if (status === 'Needs Revision') {
        submitted_at = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        reviewed_at = new Date().toISOString().split('T')[0];
        feedback = 'Please add a concrete Mitigation Plan for the Rust systems programming skill gap. Let us discuss in our next 1:1.';
      }

      await db.execute({
        sql: `INSERT OR REPLACE INTO submission_requests (id, manager_id, employee_id, deadline, status, feedback, submitted_at, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [subId, emp.managerEid, emp.id, deadline, status, feedback, submitted_at, reviewed_at]
      });
    }

    await db.execute('COMMIT');
    await db.execute('PRAGMA foreign_keys = ON;');
    console.log('Local database seed complete.');
  } catch (err: any) {
    try {
      await db.execute('ROLLBACK');
    } catch (e) {}
    try {
      await db.execute('PRAGMA foreign_keys = ON;');
    } catch (e) {}
    console.error('Error seeding local database:', err);
  }
}
