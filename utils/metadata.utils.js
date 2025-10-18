// src/utils/Metadata.js

class Metadata {
  constructor(metadata) {
    this.metadata = metadata;
    this.duration = 0;
  }

  // Example method to get the title of the track
  getTitle() {
    return this.metadata?.videoDetails?.title || "Unknown Title";
  }

  // Example method to get the artists as a formatted string
  getArtists() {
    let artist =  this.metadata?.videoDetails?.author || "Unknown Artist";
    artist = artist.replace(/\s*-\s*topic$/i, "");
    return artist;
  }

  // Example method to get the album name
  getAlbum() {
    return this.metadata?.album || "Unknown Album";
  }

  // Example method to get the duration in minutes and seconds
  getDuration() {
    const duration = this.metadata.duration; // Assuming duration is in seconds
    if (!duration) return "00:00";

    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  }

  // Example method to get streaming URL by itag
  getStreamingUrl() {
    const targetItags = [141, 251, 140, 171];
    if (
      !this.metadata.streamingData ||
      !this.metadata.streamingData.adaptiveFormats
    ) {
      return null;
    }

    const streamObject = this.metadata.streamingData.adaptiveFormats.find(
      (obj) => targetItags.includes(obj.itag)
    );
    if(streamObject) this.duration = streamObject.approxDurationMs/1000;
    return streamObject ? streamObject.url : null;
  }

  getThumb(size) {
    if (!(this.metadata?.videoDetails?.thumbnail?.thumbnails)) return null;
    thumbnails = this.metadata.videoDetails.thumbnail.thumbnails.sort();
    len = thumbnails.length;
    switch (size) {
      case "mini":
        return thumbnails[0];
      case "small":
        if (len > 1) return thumbnails[1];
      case "medium":
        if (len > 2) return thumbnails[2];
      case "large":
        if (len > 3) return thumbnails[3];
      default:
        return thumbnails[len - 1];
    }
  }
}

export default Metadata;
