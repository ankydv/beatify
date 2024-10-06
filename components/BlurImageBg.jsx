import { BlurView } from "@react-native-community/blur";
import React, { useEffect, useState } from "react";
import { ImageBackground, StyleSheet } from "react-native";

const BlurImageBg = ({ uri, overlayOpacity = 0.52, children }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [readyToRenderBlur, setReadyToRenderBlur] = useState(false);

  useEffect(() => {
    if (imageLoaded) {
      const delayTimeout = setTimeout(() => {
        setReadyToRenderBlur(true);
      }, 90);
      return () => clearTimeout(delayTimeout);
    }
  }, [imageLoaded]);

  return (
    <ImageBackground
      source={{ uri }}
      style={styles.container}
      resizeMode="cover"
      onLoadEnd={() => setImageLoaded(true)}
    >
      {readyToRenderBlur && (
        <BlurView
          style={styles.absolute}
          blurType={"dark"}
          blurAmount={32}
          reducedTransparencyFallbackColor="white"
          blurRadius={25}
          downsampleFactor={25}
          overlayColor={`rgba(0, 0, 0, ${overlayOpacity})`}
        />
      )}
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
