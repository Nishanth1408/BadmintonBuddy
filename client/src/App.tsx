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
import type { AuthUser } from "@shared/schema";

function AuthWrapper() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  
  const { data: authStatus, isLoading } = useQuery({
    queryKey: ["/api/auth/status"],
    staleTime: 0,
    refetchOnMount: "always",
  });

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
          queryClient.invalidateQueries({ queryKey: ["/api/auth/status"] });
        }} 
      />
    );
  }

  // No user logged in - show login page
  if (!authStatus?.user && !currentUser) {
    return (
      <LoginPage 
        onLogin={(user: AuthUser) => {
          setCurrentUser(user);
        }} 
      />
    );
  }

  const user = currentUser || authStatus?.user;

  // User logged in - show main app
  return (
    <Switch>
      <Route path="/" component={() => <Home currentUser={user} />} />
      <Route component={NotFound} />
    </Switch>
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
