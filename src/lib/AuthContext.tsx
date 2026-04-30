import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, UserProfile, Organization, handleFirestoreError } from './firebase';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  org: Organization | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfileAndOrg = async (uid: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        const userData = userDoc.data() as UserProfile;
        setProfile({ ...userData, id: userDoc.id });
        
        if (userData.orgId) {
          const orgDoc = await getDoc(doc(db, 'orgs', userData.orgId));
          if (orgDoc.exists()) {
            setOrg({ ...(orgDoc.data() as Organization), id: orgDoc.id });
          }
        }
      } else {
        setProfile(null);
        setOrg(null);
      }
    } catch (error) {
      console.error('Error fetching profile/org:', error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        await fetchProfileAndOrg(user.uid);
      } else {
        setProfile(null);
        setOrg(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const refreshProfile = async () => {
    if (user) await fetchProfileAndOrg(user.uid);
  };

  return (
    <AuthContext.Provider value={{ user, profile, org, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
