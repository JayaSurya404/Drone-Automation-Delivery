import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { FAQItem, SupportTicket, SupportTicketCategory } from '../types/support';
import { api } from '../services/api';
import { storage } from '../services/storage';
import { INITIAL_FAQS, INITIAL_TICKETS } from '../services/mockData';

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
  const [faqs, setFaqs] = useState<FAQItem[]>(INITIAL_FAQS);
  const [tickets, setTickets] = useState<SupportTicket[]>(() => {
    return storage.get<SupportTicket[]>(storage.keys.SUPPORT_TICKETS, INITIAL_TICKETS);
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchTickets = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.support.getTickets();
      setTickets(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchFaqs = useCallback(async () => {
    const data = await api.support.getFaqs();
    setFaqs(data);
  }, []);

  useEffect(() => {
    fetchFaqs();
  }, [fetchFaqs]);

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
