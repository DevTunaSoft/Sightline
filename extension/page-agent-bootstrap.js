(async () => {
  try {
    const moduleUrl = chrome.runtime.getURL('page-agent.js');
    const { startPageAgent } = await import(moduleUrl);
    startPageAgent(chrome.runtime);
  } catch (error) {
    console.error('Sightline page agent failed to start:', error);
  }
})();
