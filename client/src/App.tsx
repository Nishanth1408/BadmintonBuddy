import { Switch, Route } from "wouter";
import { useState, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "./pages/home";
import { SetupPage } from "./pages/setup";
import { LoginPage } from "./pages/login";
import NotFound from "./pages/not-found";
import Navbar from "@/components/navbar";
import type { AuthUser } from "@shared/schema";

function AuthWrapper() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    // Load user from localStorage on initial load
    try {
      const stored = localStorage.getItem('kanteerava_current_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [showLogin, setShowLogin] = useState(false);
  
  const { data: authStatus, isLoading, refetch } = useQuery<{initialized: boolean, user: AuthUser | null}>({
    queryKey: ["/api/auth/status"],
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Sync localStorage with server session - must be before any early returns
  useEffect(() => {
    if (authStatus?.user && (!currentUser || currentUser.id !== authStatus.user.id)) {
      setCurrentUser(authStatus.user);
      localStorage.setItem('kanteerava_current_user', JSON.stringify(authStatus.user));
    } else if (!authStatus?.user && currentUser) {
      // Server session is gone, clear localStorage
      setCurrentUser(null);
      localStorage.removeItem('kanteerava_current_user');
    }
  }, [authStatus?.user]);

  const handleLogin = (user: AuthUser) => {
    setCurrentUser(user);
    localStorage.setItem('kanteerava_current_user', JSON.stringify(user));
    setShowLogin(false);
    refetch();
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('kanteerava_current_user');
    refetch();
  };

  const handleOpenLogin = () => {
    setShowLogin(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // System not initialized - show setup page
  if (!authStatus?.initialized) {
    return (
      <SetupPage 
        onSetupComplete={(user: AuthUser) => {
          setCurrentUser(user);
          localStorage.setItem('kanteerava_current_user', JSON.stringify(user));
          queryClient.invalidateQueries({ queryKey: ["/api/auth/status"] });
        }} 
      />
    );
  }

  // Show login page if requested
  if (showLogin) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // Prioritize server session over localStorage
  const user = authStatus?.user || currentUser;

  // Show main app with navbar (public access)
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar 
        currentUser={user}
        onLogin={handleOpenLogin}
        onLogout={handleLogout}
      />
      <Switch>
        <Route path="/" component={() => <Home currentUser={user} activeTab="players" />} />
        <Route path="/players" component={() => <Home currentUser={user} activeTab="players" />} />
        <Route path="/matches" component={() => <Home currentUser={user} activeTab="matches" />} />
        <Route path="/stats" component={() => <Home currentUser={user} activeTab="stats" />} />
        <Route path="/pairs" component={() => <Home currentUser={user} activeTab="pairs" />} />
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function Router() {
  return <AuthWrapper />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
