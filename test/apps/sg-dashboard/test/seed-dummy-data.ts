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
    const programLines = ['AI/ML Enablement', 'Cloud Architecture', 'Engineering Excellence', 'Security Hardening', 'Enterprise Cloud'];
    const skillPool = [
      { category: 'Critical', title: 'Golang Microservices', desc: 'Designing and building high-concurrency RPC services using Bun/Go.' },
      { category: 'Medium', title: 'Next.js 15 & SSR', desc: 'Leveraging Server Components and optimized server side rendering.' },
      { category: 'Low', title: 'React State Orchestration', desc: 'Advanced state management with Redux/Zustand and context providers.' },
      { category: 'Critical', title: 'TypeScript Integration', desc: 'Strict typing structures and compilation rules across mono-repos.' },
      { category: 'Medium', title: 'Kubernetes Orchestration', desc: 'Writing Helm charts and managing zero-downtime cluster configurations.' },
      { category: 'Low', title: 'PostgreSQL Architecture', desc: 'Indexing strategies, query optimization, and connection pooling rules.' },
      { category: 'Critical', title: 'Docker Containers', desc: 'Multi-stage builds and optimized runtime layers.' },
      { category: 'Medium', title: 'Fastify API Framework', desc: 'High-performance HTTP routing, JSON schema serialization, and plugins.' }
    ];

    const gapPool = [
      { category: 'Critical', title: 'Distributed Tracing', desc: 'Understanding OpenTelemetry instrumentation across microservices.' },
      { category: 'Medium', title: 'Rust Systems Programming', desc: 'Learning memory safety rules and compile-time check invariants.' },
      { category: 'Low', title: 'GraphQL Federation', desc: 'Designing unified gateway graphs across separate GraphQL schemas.' },
      { category: 'Critical', title: 'E2E Cypress Testing', desc: 'Configuring parallel runner checks and automated session setups.' }
    ];

    const planPool = [
      { category: 'Critical', title: 'Google Cloud Architect Prep', desc: 'Complete the official cloud infrastructure syllabus.' },
      { category: 'Medium', title: 'Rust Programming Workshop', desc: 'Pair programming with a staff engineer 1 hour weekly.' },
      { category: 'Low', title: 'Advanced GraphQL Academy', desc: 'Take the federation course on internal portals.' },
      { category: 'Medium', title: 'OpenTelemetry Deep Dive', desc: 'Read trace documentation and complete sandbox tasks.' }
    ];

    for (const user of userMap.values()) {
      if (user.role === 'Admin') continue; // Admins don't hold personal TRR plans

      // Create two dashboards for each user to showcase the multiple dashboard capability
      const dashboardsToCreate = [
        { id: `dash-${user.id}-1`, programLine: 'AI/ML Enablement' },
        { id: `dash-${user.id}-2`, programLine: 'Cloud Architecture' }
      ];

      for (const d of dashboardsToCreate) {
        const dashboardId = d.id;
        const programLine = d.programLine;
        const objective = `Accelerate technical excellence and lead delivery on ${programLine} deliverables for the next performance cycle.`;
        const notes = `Targeting completion of strategic goals by end of next quarter. Regular 1:1 check-ins established with manager.`;
        const updated_at = new Date().toISOString();

        await db.execute({
          sql: `INSERT OR REPLACE INTO dashboards (id, user_id, program_line, objective, notes, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
          args: [dashboardId, user.id, programLine, objective, notes, updated_at]
        });

        // Add a few skills
        const numSkills = 2 + Math.floor(Math.random() * 3);
        const shuffledSkills = [...skillPool].sort(() => 0.5 - Math.random());
        for (let i = 0; i < numSkills; i++) {
          const skill = shuffledSkills[i];
          const subType = i % 2 === 0 ? 'Core' : 'Strategic';
          const combinedCategory = `${subType}:${skill.category}`;
          await db.execute({
            sql: `INSERT OR REPLACE INTO dashboard_items (id, dashboard_id, section, category, title, description) VALUES (?, ?, ?, ?, ?, ?)`,
            args: [`item-sk-${user.id}-${dashboardId}-${i}`, dashboardId, 'key_skill', combinedCategory, skill.title, skill.desc]
          });
        }

        // Add a gap
        const gap = gapPool[Math.floor(Math.random() * gapPool.length)];
        await db.execute({
          sql: `INSERT OR REPLACE INTO dashboard_items (id, dashboard_id, section, category, title, description) VALUES (?, ?, ?, ?, ?, ?)`,
          args: [`item-gp-${user.id}-${dashboardId}`, dashboardId, 'gap', gap.category, gap.title, gap.desc]
        });

        // Add plans
        const numPlans = 1 + Math.floor(Math.random() * 2);
        const shuffledPlans = [...planPool].sort(() => 0.5 - Math.random());
        for (let i = 0; i < numPlans; i++) {
          const plan = shuffledPlans[i];
          const subType = i % 2 === 0 ? 'Strategic' : 'Tactical';
          const combinedCategory = `${subType}:${plan.category}`;
          await db.execute({
            sql: `INSERT OR REPLACE INTO dashboard_items (id, dashboard_id, section, category, title, description) VALUES (?, ?, ?, ?, ?, ?)`,
            args: [`item-pl-${user.id}-${dashboardId}-${i}`, dashboardId, 'training_plan', combinedCategory, plan.title, plan.desc]
          });
        }
      }
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
