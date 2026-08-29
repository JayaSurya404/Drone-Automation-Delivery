import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { OrderProvider } from './context/OrderContext';
import { AddressProvider } from './context/AddressContext';
import { NotificationProvider } from './context/NotificationContext';
import { SupportProvider } from './context/SupportContext';
import { Navbar } from './components/common/Navbar';
import { Footer } from './components/common/Footer';
import { MobileNav } from './components/common/MobileNav';
import { ToastContainer } from './components/common/Toast';
import { AppRoutes } from './routes/AppRoutes';
import './styles/index.css';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <AddressProvider>
              <CartProvider>
                <WishlistProvider>
                  <OrderProvider>
                    <SupportProvider>
                      <div className="app-container">
                        <Navbar />
                        <main style={{ flex: 1 }}>
                          <AppRoutes />
                        </main>
                        <Footer />
                        <MobileNav />
                        <ToastContainer />
                      </div>
                    </SupportProvider>
                  </OrderProvider>
                </WishlistProvider>
              </CartProvider>
            </AddressProvider>
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

export default App;
