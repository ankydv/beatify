import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

async function getVisitorData() {
    try {
        const response = await axios.get('https://www.youtube.com');
        const html = response.data;
        const match = html.match(/"visitorData":"(.*?)"/);
        if (match && match[1]) {
            await AsyncStorage.setItem('visitorData', match[1]);
            return match[1];
        } else {
            throw new Error('visitorData not found');
        }
    } catch (error) {
        throw new Error('Failed to fetch YouTube homepage');
    }
}

export default getVisitorData;