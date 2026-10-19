import React, { memo, useMemo } from "react";
import { ImageBackground, PixelRatio, StyleSheet, View } from "react-native";

const BASE_DENSITY = 3;

// memo + hoisted blurRadius: BlurImageBg re-rendered on every 500ms progress
// tick, and getBlurRadius() re-ran PixelRatio.get() per render. blurRadius is
// static per device — compute once.
const BlurImageBg = memo(function BlurImageBg({ uri, children }) {

  const blurRadius = useMemo(() => {
    const pixelDensity = PixelRatio.get();
    return 10 * Math.pow((BASE_DENSITY / pixelDensity), 2);
  }, []);

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
      blurRadius={blurRadius}
      imageStyle={{ opacity: 0.6 }}
    >
      {children}
    </ImageBackground>
  );
});

export default BlurImageBg;

const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: 'black'
    },
    absolute: {
        ...StyleSheet.absoluteFillObject,
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      },
});
