const play = require('play-dl');
async function test() {
  try {
    const stream = await play.stream('https://www.youtube.com/watch?v=BaW_jenozKc');
    console.log("Success! Stream URL:", stream.url);
  } catch (e) {
    console.error("Error:", e.message);
  }
}
test();
