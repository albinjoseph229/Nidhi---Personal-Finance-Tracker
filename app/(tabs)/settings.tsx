import AsyncStorage from "@react-native-async-storage/async-storage";
import { makeRedirectUri } from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useState } from "react";
import { Button, Image, StyleSheet, Text, View } from "react-native";

WebBrowser.maybeCompleteAuthSession();

interface UserInfo {
  picture: string;
  name: string;
  email: string;
}

// ASYNC-STORAGE: Define a key for storing user data
const ASYNC_STORAGE_USER_KEY = "google-user-info";

export default function SettingsScreen() {
  const redirectUri = makeRedirectUri();

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId:
      "263626793831-jqeatncdqprc4q08caqd90aos5ief80g.apps.googleusercontent.com",
    redirectUri,
  });

  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  // ASYNC-STORAGE: New useEffect to load user data from storage when the app starts
  useEffect(() => {
    const loadUserInfoFromStorage = async () => {
      try {
        const jsonValue = await AsyncStorage.getItem(ASYNC_STORAGE_USER_KEY);
        if (jsonValue != null) {
          const user = JSON.parse(jsonValue);
          setUserInfo(user);
          console.log("✅ User data loaded from AsyncStorage.");
        }
      } catch (error) {
        console.error("❌ Failed to load user info from AsyncStorage:", error);
      }
    };

    loadUserInfoFromStorage();
  }, []);


  useEffect(() => {
    if (request) {
      console.log("🔵 Auth request is ready:", JSON.stringify(request, null, 2));
    } else {
      console.log("⚪️ Auth request is not ready yet.");
    }
  }, [request]);

  useEffect(() => {
    if (response) {
      console.log(
        "🔵 Authentication response received:",
        JSON.stringify(response, null, 2)
      );
    }
    if (response?.type === "success") {
      console.log("✅ Authentication successful!");
      const { authentication } = response;
      if (authentication) {
        console.log("🔵 Received access token. Fetching user info...");
        fetchUserInfo(authentication.accessToken);
      } else {
        console.error(
          "❌ Authentication successful, but no authentication object was received."
        );
      }
    } else if (response?.type === "error") {
      console.error("❌ Authentication error:", response.error);
    } else if (response?.type) {
      console.log(`🟡 Authentication result: ${response.type}`);
    }
  }, [response]);

  const fetchUserInfo = async (token: string) => {
    console.log(`🔵 Fetching user info with token...`);
    try {
      const response = await fetch("https://www.googleapis.com/userinfo/v2/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const user: UserInfo = await response.json();
      console.log("✅ User info fetched successfully:", JSON.stringify(user, null, 2));
      setUserInfo(user);

      // ASYNC-STORAGE: Save the user data to storage after fetching
      await AsyncStorage.setItem(ASYNC_STORAGE_USER_KEY, JSON.stringify(user));
      console.log("✅ User data saved to AsyncStorage.");
    } catch (error) {
      console.error("❌ Failed to fetch user info:", error);
    }
  };

  const handleSignIn = async () => {
    if (userInfo) {
      console.log("🔵 User is signing out.");
      // ASYNC-STORAGE: Remove the user data from storage on sign out
      await AsyncStorage.removeItem(ASYNC_STORAGE_USER_KEY);
      setUserInfo(null);
      console.log("✅ User data cleared from AsyncStorage.");
    } else {
      console.log("🔵 User is signing in, prompting for Google login...");
      promptAsync();
    }
  };

  return (
    <View style={styles.container}>
      {userInfo ? (
        <View style={styles.userInfoContainer}>
          <Image source={{ uri: userInfo.picture }} style={styles.profilePic} />
          <Text style={styles.welcomeText}>Welcome, {userInfo.name}!</Text>
          <Text style={styles.emailText}>{userInfo.email}</Text>
        </View>
      ) : (
        <Text style={styles.welcomeText}>Please sign in</Text>
      )}

      <Button
        title={userInfo ? "Sign Out" : "Sign in with Google"}
        onPress={handleSignIn}
        disabled={!request}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  userInfoContainer: {
    alignItems: "center",
    marginBottom: 30,
  },
  profilePic: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 15,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 5,
  },
  emailText: {
    fontSize: 16,
    color: "gray",
  },
});