import { useTheme } from "react-native-paper";
import React from "react";
import { View } from "react-native";
import TextTicker from "react-native-text-ticker";

const MarqueeText = ({style, children}) => {
    const theme = useTheme();
  return (
    <View style={{ width: "100%"}}>
      <TextTicker
        style={style}
        duration={10000}  // Time for full scroll
        loop
        bounce={false} // Continuous scrolling
        repeatSpacer={200} // Space before repeating
        marqueeDelay={1000} // Delay before animation starts
      >
        {children}
      </TextTicker>
    </View>
  );
};

export default MarqueeText;
