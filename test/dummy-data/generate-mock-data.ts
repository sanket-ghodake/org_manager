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
  { name: "SG Forge Ltd" }
];

const verticals: Vertical[] = [
  { name: "Executive" },
  { name: "Engineering" },
  { name: "Product Management" },
  { name: "Sales & Operations" },
  { name: "Human Resources" },
  { name: "Finance" }
];

const jobLevels: JobLevel[] = [
  { name: "L12 CEO" },
  { name: "L10 VP of Engineering" },
  { name: "L10 VP of Product" },
  { name: "L10 VP of Operations" },
  { name: "L8 Director of Engineering" },
  { name: "L8 Director of Product" },
  { name: "L8 Director of Operations" },
  { name: "L8 Director of HR" },
  { name: "L8 Director of Finance" },
  { name: "L6 Engineering Manager" },
  { name: "L6 Product Manager" },
  { name: "L6 Operations Manager" },
  { name: "L6 Sales Manager" },
  { name: "L6 HR Manager" },
  { name: "L6 Finance Manager" },
  { name: "L5 Senior Software Engineer" },
  { name: "L5 Senior Product Specialist" },
  { name: "L5 Senior Sales Executive" },
  { name: "L5 Senior Operations Specialist" },
  { name: "L4 Software Engineer II" },
  { name: "L4 Product Analyst" },
  { name: "L4 Operations Analyst" },
  { name: "L3 Software Engineer I" },
  { name: "L3 Associate Analyst" }
];

const maleNames = [
  "Aarav", "Vihaan", "Aditya", "Sai", "Ishaan", "Krishna", "Arjun", "Kabir", "Reyansh", "Aryan",
  "Aarush", "Vivaan", "Pranav", "Rohan", "Dev", "Rahul", "Karan", "Siddharth", "Aman", "Rishi",
  "Neil", "Yash", "Dhruv", "Ansh", "Kunwar", "Shaurya", "Kshitiz", "Tushar", "Ayush", "Madhav",
  "Kartik", "Ganesh", "Sanjay", "Suresh", "Ramesh", "Vijay", "Anil", "Sunil", "Rajesh", "Sameer",
  "Amit", "Nikhil", "Vikram", "Abhishek", "Harsh", "Pratham", "Utkarsh", "Varun", "Mayank"
];

const femaleNames = [
  "Ananya", "Diya", "Priya", "Riya", "Aadhya", "Saanvi", "Kavya", "Kiara", "Myra", "Aanya",
  "Pari", "Ira", "Sara", "Avani", "Prisha", "Shruti", "Sneha", "Aditi", "Pooja", "Meera",
  "Neha", "Ritu", "Swati", "Jyoti", "Kriti", "Shreya", "Nisha", "Gauri", "Tanya", "Mehak",
  "Tanvi", "Riddhi", "Siddhi", "Payal", "Kajal", "Aanchal", "Ishita", "Bhavna", "Divya",
  "Komal", "Priyanka", "Nidhi", "Garima", "Sakshi", "Mansha", "Bhumika", "Rashmi", "Alka"
];

const allNames = [...maleNames, ...femaleNames];

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateMockCompany(count = 70): {
  subsidiaries: Subsidiary[];
  verticals: Vertical[];
  jobLevels: JobLevel[];
  employees: Employee[];
} {
  const employees: Employee[] = [];
  const subsidiary = "SG Forge Ltd";

  // 1. Separate Admins (10 Admins + 2 Super Admins)
  // E0001: Aarav (super_admin)
  // E0011: Ananya (super_admin)
  // 10 Admins: E0002, E0012 to E0020
  const superAdmins: Employee[] = [
    {
      eid: "E0001",
      name: "Aarav",
      email: "superadmin1@sgforge.com",
      role: "super_admin",
      designation: "",
      vertical: "",
      subsidiary: "",
      managerEid: null,
    },
    {
      eid: "E0011",
      name: "Ananya",
      email: "superadmin2@sgforge.com",
      role: "super_admin",
      designation: "",
      vertical: "",
      subsidiary: "",
      managerEid: null,
    }
  ];

  const admins: Employee[] = [
    { eid: "E0002", name: "Vihaan", email: "it-admin@sgforge.com", role: "admin", designation: "", vertical: "", subsidiary: "", managerEid: null },
    { eid: "E0012", name: "Ishaan", email: "hr-admin@sgforge.com", role: "admin", designation: "", vertical: "", subsidiary: "", managerEid: null },
    { eid: "E0013", name: "Krishna", email: "finance-admin@sgforge.com", role: "admin", designation: "", vertical: "", subsidiary: "", managerEid: null },
    { eid: "E0014", name: "Arjun", email: "security-admin@sgforge.com", role: "admin", designation: "", vertical: "", subsidiary: "", managerEid: null },
    { eid: "E0015", name: "Diya", email: "ops-admin@sgforge.com", role: "admin", designation: "", vertical: "", subsidiary: "", managerEid: null },
    { eid: "E0016", name: "Priya", email: "support-admin@sgforge.com", role: "admin", designation: "", vertical: "", subsidiary: "", managerEid: null },
    { eid: "E0017", name: "Riya", email: "audit-admin@sgforge.com", role: "read_only_admin", designation: "", vertical: "", subsidiary: "", managerEid: null },
    { eid: "E0018", name: "Aadhya", email: "dev-admin@sgforge.com", role: "admin", designation: "", vertical: "", subsidiary: "", managerEid: null },
    { eid: "E0019", name: "Kavya", email: "provision-admin@sgforge.com", role: "admin", designation: "", vertical: "", subsidiary: "", managerEid: null },
    { eid: "E0020", name: "Kabir", email: "billing-admin@sgforge.com", role: "admin", designation: "", vertical: "", subsidiary: "", managerEid: null }
  ];

  employees.push(...superAdmins);
  employees.push(...admins);

  // 2. Working Corporate Hierarchy (E0003, E0004, E0005, E0006, E0007, E0008, E0009, E0010, E0021+)
  // L12: CEO
  const ceo: Employee = {
    eid: "E0003",
    name: "Reyansh",
    email: "reyansh@sgforge.com",
    role: "user",
    designation: "L12 CEO",
    vertical: "Executive",
    subsidiary,
    managerEid: null
  };
  employees.push(ceo);

  // L10: VPs
  const vpEng: Employee = { eid: "E0004", name: "Saanvi", email: "saanvi@sgforge.com", role: "user", designation: "L10 VP of Engineering", vertical: "Engineering", subsidiary, managerEid: "E0003" };
  const vpProd: Employee = { eid: "E0025", name: "Aditya", email: "aditya@sgforge.com", role: "user", designation: "L10 VP of Product", vertical: "Product Management", subsidiary, managerEid: "E0003" };
  const vpOps: Employee = { eid: "E0026", name: "Rohan", email: "rohan@sgforge.com", role: "user", designation: "L10 VP of Operations", vertical: "Sales & Operations", subsidiary, managerEid: "E0003" };
  employees.push(vpEng, vpProd, vpOps);

  // L8: Directors
  const dirEng1: Employee = { eid: "E0008", name: "Vivaan", email: "vivaan@sgforge.com", role: "user", designation: "L8 Director of Engineering", vertical: "Engineering", subsidiary, managerEid: "E0004" };
  const dirEng2: Employee = { eid: "E0009", name: "Pranav", email: "pranav@sgforge.com", role: "user", designation: "L8 Director of Engineering", vertical: "Engineering", subsidiary, managerEid: "E0004" };
  const dirProd: Employee = { eid: "E0010", name: "Kiara", email: "kiara@sgforge.com", role: "user", designation: "L8 Director of Product", vertical: "Product Management", subsidiary, managerEid: "E0025" };
  const dirOps: Employee = { eid: "E0021", name: "Dev", email: "dev@sgforge.com", role: "user", designation: "L8 Director of Operations", vertical: "Sales & Operations", subsidiary, managerEid: "E0026" };
  const dirHR: Employee = { eid: "E0022", name: "Rahul", email: "rahul@sgforge.com", role: "user", designation: "L8 Director of HR", vertical: "Human Resources", subsidiary, managerEid: "E0003" };
  const dirFinance: Employee = { eid: "E0023", name: "Aditi", email: "aditi@sgforge.com", role: "user", designation: "L8 Director of Finance", vertical: "Finance", subsidiary, managerEid: "E0003" };
  employees.push(dirEng1, dirEng2, dirProd, dirOps, dirHR, dirFinance);

  // L6: Managers
  const mgrEng1: Employee = { eid: "E0005", name: "Aditya", email: "aditya_mgr@sgforge.com", role: "user", designation: "L6 Engineering Manager", vertical: "Engineering", subsidiary, managerEid: "E0008" };
  const mgrEng2: Employee = { eid: "E0027", name: "Siddharth", email: "siddharth@sgforge.com", role: "user", designation: "L6 Engineering Manager", vertical: "Engineering", subsidiary, managerEid: "E0008" };
  const mgrEng3: Employee = { eid: "E0028", name: "Aman", email: "aman@sgforge.com", role: "user", designation: "L6 Engineering Manager", vertical: "Engineering", subsidiary, managerEid: "E0009" };
  const mgrEng4: Employee = { eid: "E0029", name: "Rishi", email: "rishi@sgforge.com", role: "user", designation: "L6 Engineering Manager", vertical: "Engineering", subsidiary, managerEid: "E0009" };
  const mgrProd: Employee = { eid: "E0030", name: "Neil", email: "neil@sgforge.com", role: "user", designation: "L6 Product Manager", vertical: "Product Management", subsidiary, managerEid: "E0010" };
  const mgrOps: Employee = { eid: "E0031", name: "Yash", email: "yash@sgforge.com", role: "user", designation: "L6 Operations Manager", vertical: "Sales & Operations", subsidiary, managerEid: "E0021" };
  const mgrSales: Employee = { eid: "E0032", name: "Dhruv", email: "dhruv@sgforge.com", role: "user", designation: "L6 Sales Manager", vertical: "Sales & Operations", subsidiary, managerEid: "E0021" };
  const mgrHR: Employee = { eid: "E0033", name: "Ansh", email: "ansh@sgforge.com", role: "user", designation: "L6 HR Manager", vertical: "Human Resources", subsidiary, managerEid: "E0022" };
  const mgrFinance: Employee = { eid: "E0034", name: "Kunwar", email: "kunwar@sgforge.com", role: "user", designation: "L6 Finance Manager", vertical: "Finance", subsidiary, managerEid: "E0023" };
  employees.push(mgrEng1, mgrEng2, mgrEng3, mgrEng4, mgrProd, mgrOps, mgrSales, mgrHR, mgrFinance);

  // L5: Team Leads / Senior ICs
  const leadEng0: Employee = { eid: "E0006", name: "Rohan", email: "rohan_eng@sgforge.com", role: "user", designation: "L5 Senior Software Engineer", vertical: "Engineering", subsidiary, managerEid: "E0005" };
  const leadEng1: Employee = { eid: "E0007", name: "Sai", email: "sai@sgforge.com", role: "user", designation: "L4 Software Engineer II", vertical: "Engineering", subsidiary, managerEid: "E0005" };
  const leadEng2: Employee = { eid: "E0035", name: "Shaurya", email: "shaurya@sgforge.com", role: "user", designation: "L5 Senior Software Engineer", vertical: "Engineering", subsidiary, managerEid: "E0005" };
  const leadEng3: Employee = { eid: "E0036", name: "Kshitiz", email: "kshitiz@sgforge.com", role: "user", designation: "L5 Senior Software Engineer", vertical: "Engineering", subsidiary, managerEid: "E0027" };
  const leadEng4: Employee = { eid: "E0037", name: "Tushar", email: "tushar@sgforge.com", role: "user", designation: "L5 Senior Software Engineer", vertical: "Engineering", subsidiary, managerEid: "E0027" };
  const leadEng5: Employee = { eid: "E0038", name: "Ayush", email: "ayush@sgforge.com", role: "user", designation: "L5 Senior Software Engineer", vertical: "Engineering", subsidiary, managerEid: "E0028" };
  const leadEng6: Employee = { eid: "E0039", name: "Madhav", email: "madhav@sgforge.com", role: "user", designation: "L5 Senior Software Engineer", vertical: "Engineering", subsidiary, managerEid: "E0028" };
  const leadEng7: Employee = { eid: "E0040", name: "Kartik", email: "kartik@sgforge.com", role: "user", designation: "L5 Senior Software Engineer", vertical: "Engineering", subsidiary, managerEid: "E0029" };
  const leadEng8: Employee = { eid: "E0041", name: "Ganesh", email: "ganesh@sgforge.com", role: "user", designation: "L5 Senior Software Engineer", vertical: "Engineering", subsidiary, managerEid: "E0029" };
  const leadProd: Employee = { eid: "E0042", name: "Sanjay", email: "sanjay@sgforge.com", role: "user", designation: "L5 Senior Product Specialist", vertical: "Product Management", subsidiary, managerEid: "E0030" };
  const leadSales: Employee = { eid: "E0043", name: "Suresh", email: "suresh@sgforge.com", role: "user", designation: "L5 Senior Sales Executive", vertical: "Sales & Operations", subsidiary, managerEid: "E0032" };
  const leadOps: Employee = { eid: "E0044", name: "Sunil", email: "sunil@sgforge.com", role: "user", designation: "L5 Senior Operations Specialist", vertical: "Sales & Operations", subsidiary, managerEid: "E0031" };
  employees.push(leadEng0, leadEng1, leadEng2, leadEng3, leadEng4, leadEng5, leadEng6, leadEng7, leadEng8, leadProd, leadSales, leadOps);

  // Remaining list of managers and leads to assign reporting ICs to
  const engLeads = [leadEng0, leadEng1, leadEng2, leadEng3, leadEng4, leadEng5, leadEng6, leadEng7, leadEng8];
  const prodLeads = [leadProd];
  const opsSalesLeads = [leadOps, leadSales];
  const hrManagers = [mgrHR];
  const financeManagers = [mgrFinance];

  // 3. Generate Individual Contributors (E0045 to E0085)
  let nameIndex = 0;
  for (let i = 45; i <= 85; i++) {
    const eid = `E${String(i).padStart(4, "0")}`;
    const name = allNames[nameIndex % allNames.length];
    nameIndex++;
    const email = `${name.toLowerCase()}.${i}@sgforge.com`;

    // Assign vertical and designation
    let vertical = "Engineering";
    let designation = "L4 Software Engineer II";
    let managerEid = getRandomElement(engLeads).eid;

    const randVal = Math.random();
    if (randVal < 0.6) {
      // Engineering (60%)
      vertical = "Engineering";
      designation = Math.random() < 0.5 ? "L4 Software Engineer II" : "L3 Software Engineer I";
      managerEid = getRandomElement(engLeads).eid;
    } else if (randVal < 0.75) {
      // Product Management (15%)
      vertical = "Product Management";
      designation = Math.random() < 0.5 ? "L4 Product Analyst" : "L3 Associate Analyst";
      managerEid = getRandomElement(prodLeads).eid;
    } else if (randVal < 0.9) {
      // Sales & Operations (15%)
      vertical = "Sales & Operations";
      designation = Math.random() < 0.5 ? "L4 Operations Analyst" : "L3 Associate Analyst";
      managerEid = getRandomElement(opsSalesLeads).eid;
    } else if (randVal < 0.95) {
      // Human Resources (5%)
      vertical = "Human Resources";
      designation = "L4 Operations Analyst";
      managerEid = getRandomElement(hrManagers).eid;
    } else {
      // Finance (5%)
      vertical = "Finance";
      designation = "L4 Operations Analyst";
      managerEid = getRandomElement(financeManagers).eid;
    }

    employees.push({
      eid,
      name,
      email,
      role: "user",
      designation,
      vertical,
      subsidiary,
      managerEid
    });
  }

  return {
    subsidiaries,
    verticals,
    jobLevels,
    employees
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

const mockData = generateMockCompany();

writeJSON(mockData, path.join(outputDir, "company_data.json"));
writeCSV(mockData.employees, path.join(outputDir, "company_data.csv"));

console.log(`Generated mock dataset:`);
console.log(`- JSON format: test/dummy-data/company_data.json`);
console.log(`- CSV format:  test/dummy-data/company_data.csv`);
