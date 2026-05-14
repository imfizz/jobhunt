export const RESUME = {
  name: "Francis Albert Ilacad",
  phone: "+639060766219",
  email: process.env.GMAIL_FROM_EMAIL || "your-email@gmail.com",
  website: "https://www.francisilacad.com",
  location: "Quezon City, PH",
  openTo: "Remote roles (PH or international)",
  minSalaryPHP: 120000,

  summary: `High-performance Fullstack Developer & Site Reliability Engineer (SRE) with over 4 years of experience architecting scalable, mission-critical systems for the aviation and government sectors. Proven track record at Cebu Pacific in driving operational productivity (56% increase) and system reliability (80% downtime reduction) through advanced automation and cloud-native solutions. Expert in React, Node.js, and SRE methodologies, with a deep focus on bridging the gap between innovative user experiences and robust backend stability.`,

  experience: [
    {
      title: "Site Reliability Engineer (SRE) L3",
      company: "Blackfort Consulting Inc.",
      location: "Taguig City",
      period: "August 2025 – Present",
      summary: "Oversee high-availability operations and deployment automation for enterprise (internal) and commercial (revenue-generating) aviation applications.",
      highlights: [
        "Spearheaded the 'Unstamped Payment Initiative' by architecting a custom C# utility to parse PNR logs, reducing resolution time from several days to 2-3 hours",
        "Engineered 'GroundControl' initiatives using PowerShell and PM2 to automate self-healing and monitoring of Node.js applications post-OS migration",
        "Developed an automated PowerShell EFT system for FTPAustralia ensuring secure manifest data transfers preventing multi-million-dollar regulatory fines",
        "Manages UAT-to-Production deployments for 50+ live applications via Azure DevOps and Apigee",
        "Acts as L3 escalation point for revenue-critical payment systems including CyberSource fraud prevention and external banking gateways"
      ]
    },
    {
      title: "Fullstack Developer",
      company: "Blackfort Consulting Inc.",
      location: "Taguig City",
      period: "July 2024 – August 2025",
      summary: "Led the design and implementation of highly customized internal collaboration tools and robust API proxies.",
      highlights: [
        "Built the 'AOG (Aircraft on Ground) Use Case' — automated alerting and coordination system integrated with AIMS, significantly mitigating repair delays",
        "Created 'Potable Water' and 'GSE/GPU Monitoring' systems providing real-time data driving down fuel consumption per flight",
        "Designed the 'Ramp Ops Card' system, digitizing legacy paper-based tracking into real-time Slack-integrated forms, increasing ramp productivity by 56%",
        "Developed the 'VIP Onboard Use Case' automating passenger tracking via SQL Stored Procedures and Slack API",
        "Optimized the core OMNIX booking engine during major NSK baseline upgrades for the airline's primary revenue-generating platform"
      ]
    },
    {
      title: "Mid-Level Web Developer",
      company: "WPH Digital Pte. Ltd.",
      location: "Singapore",
      period: "August 2022 – July 2024",
      summary: "Architected production-grade digital solutions for government-level governance and cultural engagement hubs.",
      highlights: [
        "Engineered 'ELKO' — a multi-tenant Digital Asset Management (DAM) system with AI-powered auto-tagging using Amazon Rekognition, contributing to 5% annual revenue increase",
        "Led frontend architecture for Enterprise Singapore building a responsive styling library using Sitecore/SASS that increased development velocity by 25%",
        "Managed full-cycle development for Heritage Activation Nodes (HAN) platform — interactive cultural mapping system delivered under zero-defect requirements"
      ]
    }
  ],

  education: {
    school: "Quezon City University",
    degree: "BS in Information Technology",
    location: "Quezon City",
    graduated: "June 2022"
  },

  skills: {
    frontend: ["React.js", "Next.js", "JavaScript", "TypeScript", "HTML", "CSS", "SASS", "Tailwind CSS", "Sitecore"],
    backend: ["Node.js", "Express.js", "REST", "GraphQL", "SharePoint"],
    databases: ["MongoDB", "MySQL", "DynamoDB", "Firebase"],
    cloud: ["AWS (Lambda, API Gateway, DynamoDB, Cognito, S3, CloudWatch)", "Azure DevOps", "Apigee"],
    devops: ["Docker", "CI/CD", "Git", "GitHub", "SonarQube"],
    testing: ["Cypress", "BRE"],
    other: ["PowerShell", "C#", "Figma"]
  }
};

export function resumeAsString(): string {
  const exp = RESUME.experience.map(e =>
    `${e.title} — ${e.company} (${e.period})\n${e.summary}\n${e.highlights.map(h => `  • ${h}`).join('\n')}`
  ).join('\n\n');

  const skillCategories = Object.entries(RESUME.skills).map(([k, v]) => `${k}: ${v.join(', ')}`).join('\n');

  return `Name: ${RESUME.name}
Location: ${RESUME.location}
Contact: ${RESUME.phone} | ${RESUME.website}

SUMMARY
${RESUME.summary}

EXPERIENCE
${exp}

EDUCATION
${RESUME.education.degree} — ${RESUME.education.school}, ${RESUME.education.graduated}

SKILLS
${skillCategories}`;
}
