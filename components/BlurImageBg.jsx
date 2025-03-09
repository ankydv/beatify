import React from "react";
import { ImageBackground, PixelRatio, StyleSheet, View } from "react-native";

const BlurImageBg = ({ uri, children }) => {

  const BASE_DENSITY = 3; 
  const getBlurRadius = (baseBlur = 10) => {
      const pixelDensity = PixelRatio.get();
      return baseBlur * Math.pow((BASE_DENSITY / pixelDensity),2);
  };

  if(!uri) return (
    <View style={styles.container}>
      {children}
    </View>
  );

  return (
    <ImageBackground
      source={{ uri }}
      style={styles.container}
      resizeMode="cover"
      blurRadius={getBlurRadius()}
      imageStyle={{ opacity: 0.6 }}
    >
      {children}
    </ImageBackground>
  );
};

export default BlurImageBg;

const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    absolute: {
        ...StyleSheet.absoluteFillObject,
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      },
});
