const username = "leetcode";
(async () => {
  try {
    const r = await fetch(`https://alfa-leetcode-api.onrender.com/${username}/submission`);
    console.log('status', r.status);
    const text = await r.text();
    console.log(text.slice(0, 3000));
  } catch (e) {
    console.error(e);
  }
})();
