import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { FAQItem, SupportTicket, SupportTicketCategory } from '../types/support';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

interface SupportContextType {
  faqs: FAQItem[];
  tickets: SupportTicket[];
  isLoading: boolean;
  createTicket: (data: {
    orderId?: string;
    category: SupportTicketCategory;
    subject: string;
    description: string;
    attachmentName?: string;
  }) => Promise<SupportTicket>;
  fetchTickets: () => Promise<void>;
}

const SupportContext = createContext<SupportContextType | undefined>(undefined);

export const SupportProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchTickets = useCallback(async () => {
    if (!isAuthenticated) {
      setTickets([]);
      return;
    }
    setIsLoading(true);
    try {
      const data = await api.support.getTickets();
      setTickets(data);
    } catch (err) {
      console.error('Failed to fetch support tickets:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const fetchFaqs = useCallback(async () => {
    try {
      const data = await api.support.getFaqs();
      setFaqs(data);
    } catch (err) {
      console.error('Failed to fetch FAQs:', err);
    }
  }, []);

  useEffect(() => {
    fetchFaqs();
  }, [fetchFaqs]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const createTicket = async (data: {
    orderId?: string;
    category: SupportTicketCategory;
    subject: string;
    description: string;
    attachmentName?: string;
  }): Promise<SupportTicket> => {
    setIsLoading(true);
    try {
      const newTicket = await api.support.createTicket(data);
      setTickets((prev) => [newTicket, ...prev]);
      return newTicket;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SupportContext.Provider value={{ faqs, tickets, isLoading, createTicket, fetchTickets }}>
      {children}
    </SupportContext.Provider>
  );
};

export const useSupport = (): SupportContextType => {
  const context = useContext(SupportContext);
  if (!context) {
    throw new Error('useSupport must be used within a SupportProvider');
  }
  return context;
};
