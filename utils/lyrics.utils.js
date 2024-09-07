export const parseSyncedLyrics = (syncedLyrics) => {
    const lyricsArray = syncedLyrics?.split('\n').map((line) => {
      const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2})\]\s*(.*)/);
      if (match) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const milliseconds = parseInt(match[3], 10);
        const timeInSeconds = minutes * 60 + seconds + milliseconds / 100;
  
        return {
          time: timeInSeconds, // Time in seconds
          text: match[4],      // Lyric text
        };
      }
      return null;
    });
  
    return lyricsArray.filter((line) => line !== null); // Filter out null values
  };