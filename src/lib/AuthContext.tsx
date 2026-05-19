import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, query, collection, where, getDocs, deleteDoc } from 'firebase/firestore';
import { auth, db, UserProfile, Organization, handleFirestoreError, OperationType } from './firebase';

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

  const fetchProfileAndOrg = async (uid: string, email: string | null) => {
    try {
      // 1. Adoption/Invitation Sync Logic
      // If an email is present, check if there's a pre-provisioned profile (invitation)
      // that hasn't been adopted yet (ID != UID).
      if (email) {
        try {
          const q = query(collection(db, 'users'), where('email', '==', email.toLowerCase()));
          const snapshot = await getDocs(q);
          
          const invitation = snapshot.docs.find(d => d.id !== uid);
          
          if (invitation) {
            const invData = invitation.data();
            
            // Overwrite/Adopt: This replaces any accidental onboarding profile with the invited one
            await setDoc(doc(db, 'users', uid), {
              ...invData,
              updatedAt: serverTimestamp(),
              id: uid // Ensure the ID reflects the actual UID
            });
            
            // Remove the invitation placeholder
            await deleteDoc(invitation.ref);
          }
        } catch (error) {
          console.error("Adoption error:", error);
        }
      }

      // 2. Fetch the final authoritative profile
      let userDoc = await getDoc(doc(db, 'users', uid));

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
        await fetchProfileAndOrg(user.uid, user.email);
      } else {
        setProfile(null);
        setOrg(null);
        setSimulatedProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const refreshProfile = async () => {
    if (user) await fetchProfileAndOrg(user.uid, user.email);
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
