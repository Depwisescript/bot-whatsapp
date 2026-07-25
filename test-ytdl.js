const ytdl = require('@distube/ytdl-core');

async function test() {
  try {
    const info = await ytdl.getInfo('BaW_jenozKc');
    console.log("Success! Title:", info.videoDetails.title);
  } catch (e) {
    console.error("Error:", e.message);
  }
}
test();
