import { tokenManager } from "@/utils/token.utils";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import * as SecureStore from "expo-secure-store";

export const authenticateUser = createAsyncThunk(
  "auth/authenticateUser",
  async ({ accessToken, refreshToken, expiresIn }, { dispatch }) => {
    const currentTime = Math.floor(Date.now() / 1000);
    // Save tokens using tokenManager
    await tokenManager.saveTokens(accessToken, refreshToken, expiresIn + currentTime);
    // Set isLoggedIn status in SecureStore
    await SecureStore.setItemAsync("isLoggedIn", "true");
    dispatch(login());
  }
);

export const loadAuthState = createAsyncThunk("auth/loadAuthState", async () => {
  const isLoggedIn = await SecureStore.getItemAsync("isLoggedIn");
  return isLoggedIn === "true"; // Convert string to boolean
});

const authSlice = createSlice({
  name: "auth",
  initialState: { isLoggedIn: false },
  reducers: {
    login: (state) => {
      state.isLoggedIn = true;
    },
    logout: (state) => {
      SecureStore.setItemAsync("isLoggedIn", "false");
      tokenManager.clearTokens();
      state.isLoggedIn = false;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(loadAuthState.fulfilled, (state, action) => {
      state.isLoggedIn = action.payload;
    });
  },
});

export const { login, logout } = authSlice.actions;
export default authSlice.reducer;
