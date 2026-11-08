import { skillForUrl } from './skill-registry.js';

export function detectSkillBlocker(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const skill = skillForUrl(snapshot.url);
  if (!skill || typeof skill.detectBlocker !== 'function') return null;
  return skill.detectBlocker(snapshot);
}
