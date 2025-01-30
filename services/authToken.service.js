import { authApi } from "../configs/axios";

export const getAuthToken = async () => {
    try {
      const res = await authApi.post('/firebase?isFirebaseToken=false');
      const authtoken = res.data.authToken;
      return authtoken;
    }
    catch(error){
      console.error("Error signing in:", error);
    }
  }