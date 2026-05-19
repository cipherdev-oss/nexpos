import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, query, collection, where, getDocs, deleteDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, UserProfile, Organization, handleFirestoreError, OperationType } from './firebase';
import { getAccentStyles } from './theme';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  org: Organization | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  impersonateUser: (profile: UserProfile) => void;
  stopImpersonating: () => void;
  isImpersonating: boolean;
  nukeEverything: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [simulatedProfile, setSimulatedProfile] = useState<UserProfile | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (org?.accentColor) {
      const styles = getAccentStyles(org.accentColor);
      Object.entries(styles).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value as string);
      });
    } else {
      // Default styles
      const styles = getAccentStyles('sky');
      Object.entries(styles).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value as string);
      });
    }
  }, [org?.accentColor]);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;
    let unsubscribeOrg: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      // Cleanup previous listeners
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeOrg) unsubscribeOrg();
      
      if (user) {
        // Adoption/Invitation Sync Logic (one-time check on login)
        if (user.email) {
          try {
            const q = query(collection(db, 'users'), where('email', '==', user.email.toLowerCase()));
            const snapshot = await getDocs(q);
            const invitation = snapshot.docs.find(d => d.id !== user.uid);
            if (invitation) {
              const invData = invitation.data();
              await setDoc(doc(db, 'users', user.uid), {
                ...invData,
                updatedAt: serverTimestamp(),
                id: user.uid
              });
              await deleteDoc(invitation.ref);
            }
          } catch (e) { console.error("Adoption error:", e); }
        }

        // Real-time Profile Listener
        unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), (userDoc) => {
          if (userDoc.exists()) {
            const userData = userDoc.data() as UserProfile;
            setProfile({ ...userData, id: userDoc.id });
            
            // Real-time Org Listener (Setup only if orgId changes or doesn't exist)
            if (userData.orgId) {
              // Note: We don't want to re-subscribe if orgId is same, but org data itself might change.
              // So we just always subscribe to the current orgId.
              if (unsubscribeOrg) unsubscribeOrg();
              unsubscribeOrg = onSnapshot(doc(db, 'orgs', userData.orgId), (orgDoc) => {
                if (orgDoc.exists()) {
                  setOrg({ ...(orgDoc.data() as Organization), id: orgDoc.id });
                } else {
                  setOrg(null);
                }
              });
            } else {
              setOrg(null);
            }
          } else {
            setProfile(null);
            setOrg(null);
          }
          setLoading(false);
        }, (err) => {
          console.error("Profile listen error:", err);
          setLoading(false);
        });
      } else {
        setProfile(null);
        setOrg(null);
        setSimulatedProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeOrg) unsubscribeOrg();
    };
  }, []);

  const refreshProfile = async () => {
    // With onSnapshot, manual refresh is largely redundant but we'll keep it for stability
  };

  const impersonateUser = (targetProfile: UserProfile) => {
    setSimulatedProfile(targetProfile);
  };

  const stopImpersonating = () => {
    setSimulatedProfile(null);
  };

  const nukeEverything = async () => {
    if (!user || !profile) return;

    try {
      if (profile.role === 'owner' && profile.orgId) {
        const orgId = profile.orgId;
        
        // 1. Delete all users in org
        const userQ = query(collection(db, 'users'), where('orgId', '==', orgId));
        const userSnap = await getDocs(userQ);
        for (const d of userSnap.docs) {
          await deleteDoc(d.ref);
        }

        // 2. Delete all products in org subcollection
        const productSnap = await getDocs(collection(db, 'orgs', orgId, 'products'));
        for (const d of productSnap.docs) {
          await deleteDoc(d.ref);
        }

        // 3. Delete all sales in org subcollection
        const saleSnap = await getDocs(collection(db, 'orgs', orgId, 'sales'));
        for (const d of saleSnap.docs) {
          await deleteDoc(d.ref);
        }

        // 4. Delete the organization
        await deleteDoc(doc(db, 'orgs', orgId));
      } else {
        // Just delete self
        await deleteDoc(doc(db, 'users', user.uid));
      }

      await auth.signOut();
      window.location.href = '/login';
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'nuke');
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile: simulatedProfile || profile, 
      org, 
      loading, 
      refreshProfile,
      impersonateUser,
      stopImpersonating,
      isImpersonating: !!simulatedProfile,
      nukeEverything
    }}>
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
