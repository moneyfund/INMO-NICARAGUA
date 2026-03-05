(async function loadSiteStatus() {
  const statusNode = document.getElementById('status-message');

  try {
    const response = await fetch('./data/site.json');
    const data = await response.json();
    statusNode.textContent = data.message;
  } catch (error) {
    statusNode.textContent = 'Unable to load status data.';
  }
})();
