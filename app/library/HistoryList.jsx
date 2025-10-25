import { View } from "react-native"
import MusicListItem from "@/components/songListItem";
import { useDispatch } from "react-redux";
import { loadAndPlayTrack } from "@/state/slices/audio.slice";

const HistoryList = ({histories}) => {

    const dispatch = useDispatch();

    const playSong = (song) => {
        dispatch(loadAndPlayTrack({ track: song, isQueueTrack: false }));
    }

  return (
    <View style={{}} >
        {histories?.map((history, index) => (
        <MusicListItem 
            key={index}
            title={history.song.title}
            subtitle={history.song.author}
            imageUrl={history.song.thumbnail.thumbnails[0].url}
            onPress={() => playSong(history.song)}
        />))}
    </View>
  )
}

export default HistoryList;