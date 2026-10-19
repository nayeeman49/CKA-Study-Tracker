// Builds content/docs/19-CKA-Mock-Exam-Papers/*.md from content/mock-src/examN.txt
const fs = require('fs'), path = require('path');
const SRC = path.join(__dirname, '..', 'content', 'mock-src');
const OUT = path.join(__dirname, '..', 'content', 'docs', '19-CKA-Mock-Exam-Papers');
const DOMAINS = { 'Cluster Architecture': 25, 'Workloads & Scheduling': 15, 'Storage': 10, 'Services & Networking': 20, 'Troubleshooting': 30 };
const SUB = {
  1: 'Standard paper: a balanced mix of the most common exam tasks.',
  2: 'Standard paper: certificates, Gateway API, Kustomize and CRDs.',
  3: 'Standard paper: scheduling, storage classes, TLS and CNI.',
  4: 'Harder paper: cluster build, external etcd, aggregation and deeper troubleshooting.'
};
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (f.endsWith('.md')) fs.unlinkSync(path.join(OUT, f));
for (let n = 1; n <= 4; n++) {
  const raw = fs.readFileSync(path.join(SRC, `exam${n}.txt`), 'utf8');
  const blocks = raw.split(/^### Q \| /m).slice(1).map(b => {
    const nl = b.indexOf('\n'); const [w, dom, ctx] = b.slice(0, nl).split('|').map(s => s.trim());
    const [task, sol] = b.slice(nl + 1).split(/^--- solution ---\s*$/m);
    return { w: +w, dom, ctx, task: task.trim(), sol: (sol || '').trim() };
  });
  const sum = blocks.reduce((a, q) => a + q.w, 0);
  if (sum !== 100) throw new Error(`exam${n}: weights ${sum}`);
  const by = {}; blocks.forEach(q => by[q.dom] = (by[q.dom] || 0) + q.w);
  for (const d in DOMAINS) if (by[d] !== DOMAINS[d]) throw new Error(`exam${n}: ${d} ${by[d]}`);
  let md = `# CKA Mock Exam ${n}\n\n> ${SUB[n]}\n\n`;
  md += `**Time:** 2 hours  |  **Questions:** ${blocks.length}  |  **Total:** 100%  |  **Pass mark:** 66%\n\n`;
  md += `**Rules (as in the real exam):** you may use the Kubernetes documentation (kubernetes.io/docs, kubernetes.io/blog, helm.sh/docs and the Gateway API docs). Each task names the cluster to use, so always run the given \`kubectl config use-context\` first. Skip hard tasks and return to them; partial credit is given. Try the whole paper before opening any solution.\n\n`;
  md += `| Domain | Weight |\n|---|---|\n` + Object.keys(DOMAINS).map(d => `| ${d} | ${DOMAINS[d]}% |`).join('\n') + `\n\n`;
  md += `**Setup tips:** \`alias k=kubectl\`, \`export do="--dry-run=client -o yaml"\`, \`source <(kubectl completion bash)\`. These are probably already set in the exam terminal.\n\n---\n\n`;
  blocks.forEach((q, i) => {
    md += `## Question ${i + 1} (${q.w}%)\n\n`;
    md += `**Domain:** ${q.dom}\n\n`;
    md += `> Context: \`kubectl config use-context ${q.ctx}\`\n\n`;
    md += q.task + '\n\n';
    md += `<details><summary>Show solution</summary>\n\n${q.sol}\n\n</details>\n\n---\n\n`;
  });
  md += `*These solutions are written for practice. Always verify commands against the official documentation and your cluster version.*\n`;
  fs.writeFileSync(path.join(OUT, `0${n}-CKA-Mock-Exam-${n}.md`), md);
}
console.log('mock papers built');
