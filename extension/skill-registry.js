import { yahooMailSkill } from './skills/yahoo-mail.js';

const SKILLS = Object.freeze([yahooMailSkill]);

export function skillForUrl(value) {
  let url;
  try { url = new URL(String(value || '')); } catch { return null; }
  return SKILLS.find(skill => skill.matches(url)) || null;
}

export function skillPlannerContext(value) {
  const skill = skillForUrl(value);
  if (!skill) return null;
  return {
    id: skill.id,
    name: skill.name,
    version: skill.version,
    domain: skill.domain,
    guidance: skill.guidance.slice(0, 20),
    destructiveLabels: skill.destructiveLabels.slice(0, 20),
  };
}

export function listSkills() {
  return SKILLS.map(({ id, name, version, domain }) => ({ id, name, version, domain }));
}
