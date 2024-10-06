class Track {
    
    constructor(track) {
      this.track = track;
      this.title = track.title;
      this.album = track.album;
      this.artists = this.getArtists();
    }
  
    getArtists() {
        const artists = this.track.artists;
        if(!artists || artists.length === 0)
            return '';
        return artists.map(artist => artist.name).join(' ');
    }
  
    getThumbUrl(size) {
      if(this.track === null)
        return 'track cannot be null'
      if(!(this.track.thumbnail || this.track.thumbnails)) return null;
      thumbnails = this.track.thumbnails ? this.track.thumbnails.sort() : this.track.thumbnail.sort();
      switch(size){
            case 'mini':
                return thumbnails[0].url;
            case 'small':
                return thumbnails[1].url;
            case 'medium':
                return thumbnails[2].url;
            case 'large':
                return thumbnails[3].url;
            default:
              return thumbnails[4].url;
        }
    }
  }
  
  export default Track;
  