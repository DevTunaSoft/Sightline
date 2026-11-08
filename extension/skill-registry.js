import { yahooMailSkill } from './skills/yahoo-mail.js';

const SKILLS = Object.freeze([yahooMailSkill]);

export function skillForUrl(value) {
  let url;
  try { url = new URL(String(value || '')); } catch { return null; }
  return SKILLS.find(skill => skill.matches(url)) || null;
}

export function skillPlannerContext(value, snapshot = null) {
  const skill = skillForUrl(value);
  if (!skill) return null;
  return {
    id: skill.id,
    name: skill.name,
    version: skill.version,
    domain: skill.domain,
    guidance: skill.guidance.slice(0, 20),
    destructiveLabels: skill.destructiveLabels.slice(0, 20),
    pageHints: typeof skill.analyzeSnapshot === 'function' ? skill.analyzeSnapshot(snapshot) : null,
  };
}

export function listSkills() {
  return SKILLS.map(({ id, name, version, domain }) => ({ id, name, version, domain }));
}

export function verifySkillActionEffect({ before, after, action, target } = {}) {
  const skill = skillForUrl(before?.url || after?.url);
  if (!skill || typeof skill.verifyActionEffect !== 'function') {
    return { applicable: false, verified: null, evidence: [] };
  }
  return skill.verifyActionEffect({ before, after, action, target });
}

export function checkSkillDestructiveScope({ snapshot, goal, action, target } = {}) {
  const skill = skillForUrl(snapshot?.url);
  if (!skill || typeof skill.checkDestructiveScope !== 'function') {
    return { applicable: false, allowed: true };
  }
  return skill.checkDestructiveScope({ snapshot, goal, action, target });
}
