import fs from "fs";
import path from "path";

interface Subsidiary {
  name: string;
}

interface Vertical {
  name: string;
}

interface JobLevel {
  name: string;
}

interface Employee {
  eid: string;
  name: string;
  email: string;
  role: string;
  designation: string;
  vertical: string;
  subsidiary: string;
  managerEid: string | null;
}

const subsidiaries: Subsidiary[] = [
  { name: "Acme Corp Ltd" },
  { name: "Initech LLC" },
  { name: "Hooli Inc" },
];

const verticals: Vertical[] = [
  { name: "Engineering" },
  { name: "Marketing & Growth" },
  { name: "Sales & Operations" },
  { name: "Product Management" },
  { name: "Human Resources" },
];

const jobLevels: JobLevel[] = [
  { name: "VP of Engineering" },
  { name: "Engineering Manager" },
  { name: "Lead Software Architect" },
  { name: "Senior Frontend Engineer" },
  { name: "Senior Backend Engineer" },
  { name: "Product Director" },
  { name: "Product Manager" },
  { name: "HR Lead" },
  { name: "Operations Director" },
];

const firstNames = ["James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Elizabeth", "William", "Linda", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen"];
const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin"];

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateCompanyMockData(count = 50): {
  subsidiaries: Subsidiary[];
  verticals: Vertical[];
  jobLevels: JobLevel[];
  employees: Employee[];
} {
  const employees: Employee[] = [];
  
  // Create leaders first (VP / Directors) as potential manager references
  const leaders: Employee[] = [
    {
      eid: "E1001",
      name: "Arthur Pendragon",
      email: "arthur@acmecorp.com",
      role: "super_admin",
      designation: "VP of Engineering",
      vertical: "Engineering",
      subsidiary: "Acme Corp Ltd",
      managerEid: null,
    },
    {
      eid: "E1002",
      name: "Guinevere Vance",
      email: "guinevere@acmecorp.com",
      role: "admin",
      designation: "Product Director",
      vertical: "Product Management",
      subsidiary: "Acme Corp Ltd",
      managerEid: null,
    },
    {
      eid: "E1003",
      name: "Lancelot DuLac",
      email: "lancelot@acmecorp.com",
      role: "admin",
      designation: "Operations Director",
      vertical: "Sales & Operations",
      subsidiary: "Initech LLC",
      managerEid: null,
    }
  ];

  employees.push(...leaders);

  for (let i = 4; i <= count; i++) {
    const eid = `E${String(i).padStart(4, "0")}`;
    const firstName = getRandomElement(firstNames);
    const lastName = getRandomElement(lastNames);
    const name = `${firstName} ${lastName}`;
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@acmecorp.com`;
    const subsidiary = getRandomElement(subsidiaries).name;
    const vertical = getRandomElement(verticals).name;
    
    // Assign reasonable designations based on vertical
    let designation = "Software Engineer";
    if (vertical === "Engineering") {
      designation = getRandomElement(["Senior Frontend Engineer", "Senior Backend Engineer", "Lead Software Architect", "Engineering Manager"]);
    } else if (vertical === "Product Management") {
      designation = getRandomElement(["Product Manager"]);
    } else if (vertical === "Human Resources") {
      designation = "HR Lead";
    } else {
      designation = getRandomElement(["Operations Director", "Lead Sales Manager"]);
    }

    // Assign manager: managers are usually leaders or manager designations
    let managerEid: string | null = getRandomElement(leaders).eid;
    if (designation === "VP of Engineering" || designation === "Product Director" || designation === "Operations Director") {
      managerEid = null;
    }

    employees.push({
      eid,
      name,
      email,
      role: "user",
      designation,
      vertical,
      subsidiary,
      managerEid,
    });
  }

  return {
    subsidiaries,
    verticals,
    jobLevels,
    employees,
  };
}

function writeCSV(employees: Employee[], outputPath: string) {
  const headers = ["EID", "Name", "Email", "Role", "Designation", "Vertical", "Subsidiary", "Manager EID"];
  const rows = employees.map(emp => [
    emp.eid,
    `"${emp.name}"`,
    emp.email,
    emp.role,
    `"${emp.designation}"`,
    `"${emp.vertical}"`,
    `"${emp.subsidiary}"`,
    emp.managerEid || ""
  ]);

  const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  fs.writeFileSync(outputPath, csvContent, "utf-8");
}

function writeJSON(data: any, outputPath: string) {
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), "utf-8");
}

const outputDir = path.join(__dirname);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const mockData = generateCompanyMockData(50);

writeJSON(mockData, path.join(outputDir, "company_data.json"));
writeCSV(mockData.employees, path.join(outputDir, "company_data.csv"));

console.log(`Successfully generated mock organizational dataset:`);
console.log(`- JSON format: test/dummy-data/company_data.json`);
console.log(`- CSV format:  test/dummy-data/company_data.csv`);
