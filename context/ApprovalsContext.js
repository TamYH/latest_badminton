import React, { createContext, useState, useContext, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';

const ApprovalsContext = createContext(0);

export const useApprovals = () => useContext(ApprovalsContext);

export const ApprovalsProvider = ({ children }) => {
  const [pendingCount, setPendingCount] = useState(0);
  
  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const tournamentsQuery = query(
          collection(db, 'tournaments'),
          where('status', '==', 'unstarted')
        );
        
        const querySnapshot = await getDocs(tournamentsQuery);
        let totalPending = 0;
        
        querySnapshot.forEach(doc => {
          const data = doc.data();
          if (data.pendingRegistrations?.length) {
            totalPending += data.pendingRegistrations.length;
          }
        });
        
        setPendingCount(totalPending);
      } catch (error) {
        console.error("Error fetching pending count:", error);
      }
    };
    
    fetchPendingCount();
    
    // Set up a refresh interval (optional)
    const interval = setInterval(fetchPendingCount, 60000); // Refresh every minute
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <ApprovalsContext.Provider value={pendingCount}>
      {children}
    </ApprovalsContext.Provider>
  );
};