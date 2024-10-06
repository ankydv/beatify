import { Stack } from "expo-router";
import React from "react";

const index = () => {
  
  return (
    <Stack>
      <Stack.Screen name="Home" options={{ headerShown: false }} />
      <Stack.Screen name="Album" options={{ headerShown: false }} />
    </Stack>
  );
};

export default index;
