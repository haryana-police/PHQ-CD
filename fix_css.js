const fs = require('fs');

const cssPath = 'frontend/src/index.css';
let content = fs.readFileSync(cssPath, 'utf8');

// Find the position of '.show-all-btn.expanded' end
const searchStr = '.show-all-btn.expanded {\r\n  background: rgba(99, 102, 241, 0.12);\r\n  border-color: var(--primary-light);\r\n  color: var(--primary-light);\r\n}\r\n';
const pos = content.indexOf(searchStr);

if (pos !== -1) {
  content = content.substring(0, pos + searchStr.length);
  
  const correctCSS = `
.global-filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  background: #1e293b;
  padding: 12px 24px;
  border-bottom: 1px solid #334155;
  align-items: flex-end;
}
.filter-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.filter-group label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: #94a3b8;
}
.filter-input {
  background: #0f172a;
  border: 1px solid #334155;
  color: #f1f5f9;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 0.875rem;
  outline: none;
}
.filter-input:focus {
  border-color: #3b82f6;
}
.filter-actions {
  margin-left: auto;
}
.btn-reset {
  background: transparent;
  color: #ef4444;
  border: 1px solid #ef4444;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-reset:hover {
  background: rgba(239, 68, 68, 0.1);
}
`;
  
  fs.writeFileSync(cssPath, content + correctCSS, 'utf8');
  console.log('CSS fixed successfully.');
} else {
  // try fallback search
  const fallbackStr = '.show-all-btn.expanded {';
  const pos2 = content.indexOf(fallbackStr);
  if (pos2 !== -1) {
    // keep until the closing brace
    const endPos = content.indexOf('}', pos2);
    content = content.substring(0, endPos + 1);
    
    const correctCSS = `
.global-filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  background: #1e293b;
  padding: 12px 24px;
  border-bottom: 1px solid #334155;
  align-items: flex-end;
}
.filter-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.filter-group label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: #94a3b8;
}
.filter-input {
  background: #0f172a;
  border: 1px solid #334155;
  color: #f1f5f9;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 0.875rem;
  outline: none;
}
.filter-input:focus {
  border-color: #3b82f6;
}
.filter-actions {
  margin-left: auto;
}
.btn-reset {
  background: transparent;
  color: #ef4444;
  border: 1px solid #ef4444;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-reset:hover {
  background: rgba(239, 68, 68, 0.1);
}
`;
    fs.writeFileSync(cssPath, content + correctCSS, 'utf8');
    console.log('CSS fixed via fallback.');
  } else {
    console.log('Could not find anchor string in CSS.');
  }
}
