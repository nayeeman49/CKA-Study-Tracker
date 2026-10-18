// Builds data/curriculum.json from the course repo's docs/ folder.
// Domains and weights come from the CNCF CKA curriculum v1.35 PDF.
const fs = require('fs');
const path = require('path');

const DOCS = path.join(__dirname, '..', 'content', 'docs');

const DOMAINS = [
  { id: 'arch',     name: 'Cluster Architecture, Installation & Configuration', weight: 25, color: '#6366f1' },
  { id: 'workloads',name: 'Workloads & Scheduling',                              weight: 15, color: '#0ea5e9' },
  { id: 'network',  name: 'Services & Networking',                               weight: 20, color: '#10b981' },
  { id: 'storage',  name: 'Storage',                                             weight: 10, color: '#f59e0b' },
  { id: 'trouble',  name: 'Troubleshooting',                                     weight: 30, color: '#ef4444' },
  { id: 'practice', name: 'Exam Practice (mixed domains)',                       weight: 0,  color: '#8b5cf6' },
];

// Folder -> domain. A few lessons are re-mapped below.
const SECTION_DOMAIN = {
  '02-Core-Concepts': 'workloads',
  '03-Scheduling': 'workloads',
  '04-Logging-and-Monitoring': 'trouble',
  '05-Application-Lifecycle-Management': 'workloads',
  '06-Cluster-Maintenance': 'arch',
  '07-Security': 'arch',
  '08-Storage': 'storage',
  '09-Networking': 'network',
  '10-Design-and-Install-Kubernetes-Cluster': 'arch',
  '11-Install-Kubernetes-the-kubeadm-way': 'arch',
  '12-Troubleshooting': 'trouble',
  '13-Other-Topics': 'trouble',
  '14-Lightning-Labs': 'practice',
  '15-Mock-Exams': 'practice',
  '17-tips-and-tricks': 'practice',
  '18-Beyond-the-Course': 'arch',
};
const ULTIMATE = { '02-Troubleshooting': 'trouble', '04-Storage': 'storage', '05-Services-Networking': 'network', '09-general': 'arch' };

const OVERRIDES = [
  [/Network-Policies/i, 'network'],
  [/Services|Service-Networking/i, 'network'],
  [/Namespaces|Imperative/i, 'workloads'],
  [/Cluster-Architecture|ETCD|Kube-API|Controller-Manager|Kube-Scheduler|Kubelet|Kube-Proxy|Docker-vs/i, 'arch'],
  [/Monitor-Cluster|Application-Logs/i, 'trouble'],
  [/testing-network/i, 'network'],
  [/Gateway-API/i, 'network'],
  [/Autoscaling/i, 'workloads'],
];

const SKIP = /Down?load-Presentation|Dowload-Presentation|Attachments|Section-Introduction|Course-Introduction|Certification\.md|Practice-Test-Introduction|Important-update|^README/i;

function pretty(file) {
  return file
    .replace(/\.md$/, '')
    .replace(/^\d+[.-]/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\bPractice Test\b/i, 'Lab:')
    .replace(/\bkubeconfig\b/i, 'KubeConfig')
    .replace(/\s+/g, ' ')
    .trim();
}

function kindOf(name, rel) {
  if (/Mock[- ]?Exam[- ]?\d\.md$|^15-Mock-Exams\/0[235]/i.test(rel) && !/Solution/i.test(rel)) return 'mock';
  if (/Lightning-Lab-\d/i.test(rel) || /Ultimate-Mocks.*docs/i.test(rel)) return 'lab';
  if (/Practice-Test|Practice-Tests|^Labs?-/i.test(name) || /Troubleshoot-Network/i.test(name)) return 'lab';
  return 'lesson';
}
const MINUTES = { lesson: 15, lab: 30, mock: 120 };
const LONGER = { 'Helm-and-Kustomize': 25, 'Gateway-API': 25 };

const lessons = [];
function walk(dir, rel = '') {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }))) {
    const p = path.join(dir, e.name);
    const r = path.posix.join(rel, e.name);
    if (e.isDirectory()) walk(p, r);
    else if (e.name.endsWith('.md')) lessons.push(r);
  }
}
walk(DOCS);

// Lab pages are question-and-answer pages, not hands-on labs: name them accordingly.
function labTitle(t, kind, top) {
  if (kind !== 'lab') return t;
  if (top === '16-Ultimate-Mocks') return 'Mock Q&A: ' + t;
  return 'Lab Q&A: ' + t.replace(/^Lab:\s*/i, '').replace(/^Practice Tests?\s*/i, '');
}
const sections = new Map();
for (const rel of lessons) {
  const parts = rel.split('/');
  const top = parts[0];
  const name = parts[parts.length - 1];
  if (SKIP.test(name)) continue;
  if (top === '01-Introduction' || top === '15-Mock-Exams' || top === '14-Lightning-Labs') continue; // removed sections; // Mock Exams section intentionally removed
  if (top === '16-Ultimate-Mocks' && name === 'README.md') continue;
  if (name === 'README.md' && top !== '17-tips-and-tricks') continue;

  let domain, sectionTitle;
  if (top === '16-Ultimate-Mocks') {
    domain = ULTIMATE[parts[1]] || 'practice';
    sectionTitle = 'Ultimate Mocks';
  } else {
    domain = SECTION_DOMAIN[top] || 'practice';
    for (const [re, d] of OVERRIDES) if (re.test(name) && top !== '15-Mock-Exams') { domain = d; break; }
    sectionTitle = top === '18-Beyond-the-Course' ? 'Additional topics (revised CKA)' : pretty(top);
  }
  const kind = kindOf(name, rel);
  const key = top;
  if (!sections.has(key)) sections.set(key, { id: key, title: sectionTitle, lessons: [] });
  sections.get(key).lessons.push({
    id: rel.replace(/\.md$/, ''),
    title: labTitle(pretty(name), kind, top),
    domain,
    kind,
    minutes: LONGER[name.replace(/^\d+[.-]/, '').replace(/\.md$/, '')] || MINUTES[kind],
    ...(top === '18-Beyond-the-Course' ? { isNew: true } : {}),
  });
}

for (const sec of sections.values()) sec.notes = fs.existsSync(path.join(__dirname, '..', 'content', 'notes', sec.id.replace(/\//g, '__') + '.md'));
const secList = [...sections.values()];
const beyond = secList.findIndex(x => x.id === '18-Beyond-the-Course');
if (beyond >= 0) { const [b] = secList.splice(beyond, 1); const t = secList.findIndex(x => x.id === '12-Troubleshooting'); secList.splice(t + 1, 0, b); } // placed right after Troubleshooting
const out = { examVersion: 'CKA v1.35', domains: DOMAINS, sections: secList };
fs.mkdirSync(path.join(__dirname, '..', 'data'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'data', 'curriculum.json'), JSON.stringify(out, null, 2));
const all = out.sections.flatMap(s => s.lessons);
const byDomain = {};
for (const l of all) byDomain[l.domain] = (byDomain[l.domain] || 0) + 1;
console.log(`${out.sections.length} sections, ${all.length} items`, byDomain,
  'total hours:', Math.round(all.reduce((a, l) => a + l.minutes, 0) / 60));
