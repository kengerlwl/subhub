export default {
  async scheduled(event, env, ctx) {
    const resp = await fetch('https://sub.156354.xyz/api/collect');
    const data = await resp.json();
    console.log(`[SubHub Cron] ${data.message || 'collect triggered'}`);
  },
};
