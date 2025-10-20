"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useNearWallet } from "@/context/NearWalletContext";
import { getProfilesFromSocialDb } from "@/api/social";

const SocialAccountContext = createContext(null);

export const useSocialAccount = () => {
  const context = useContext(SocialAccountContext);
  if (!context) {
    throw new Error(
      "useSocialAccount must be used within a SocialAccountProvider"
    );
  }
  return context;
};

export const SocialAccountProvider = ({ children }) => {
  const { accountId } = useNearWallet();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!accountId) {
        setProfile(null);
        return;
      }

      try {
        const profileData = await getProfilesFromSocialDb(accountId);
        setProfile(profileData);
      } catch (err) {
        console.error("Error fetching profile:", err);
        setProfile(null);
      }
    };

    fetchProfile();
  }, [accountId]);

  const refreshProfile = async () => {
    if (!accountId) return;

    try {
      const profileData = await getProfilesFromSocialDb(accountId);
      setProfile(profileData);
    } catch (err) {
      console.error("Error refreshing profile:", err);
    }
  };

  const value = {
    profile,
    refreshProfile,
  };

  return (
    <SocialAccountContext.Provider value={value}>
      {children}
    </SocialAccountContext.Provider>
  );
};
