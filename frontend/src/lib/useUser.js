import { useCallback, useEffect, useState } from "react";
import { webDocApi } from "./docApi";

// Signed-in user for the web app. undefined=loading, null=signed out.
export const useUser = () => {
  const [user, setUser] = useState(undefined);
  const refresh = useCallback(() => webDocApi.getUser().then(setUser), []);
  useEffect(() => { refresh(); }, [refresh]);
  return { user, setUser, refresh };
};
