import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuTrigger, 
  DropdownMenuItem,
  DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { User, LogOut, Settings, Crown, AlertTriangle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AuthUser } from "@shared/schema";

interface NavbarProps {
  currentUser: AuthUser | null;
  onLogin: () => void;
  onLogout: () => void;
}

export default function Navbar({ currentUser, onLogin, onLogout }: NavbarProps) {
  const { toast } = useToast();
  const [location] = useLocation();

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/logout");
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Logged out successfully",
        description: "You have been logged out of your account.",
      });
      onLogout();
    },
    onError: () => {
      toast({
        title: "Logout failed",
        description: "There was an error logging out.",
        variant: "destructive",
      });
    },
  });

  const resetDataMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/reset-data");
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Data reset successful",
        description: "All players, matches, and statistics have been deleted."
      });
      queryClient.invalidateQueries();
    },
    onError: () => {
      toast({
        title: "Reset failed",
        description: "There was an error resetting the data.",
        variant: "destructive",
      });
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const handleResetData = () => {
    resetDataMutation.mutate();
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const navItems = [
    { path: "/players", label: "Players", public: true },
    { path: "/matches", label: "Matches", public: true },
    { path: "/stats", label: "Statistics", public: true },
    { path: "/pairs", label: "Pairs", public: true },
  ];

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Navigation */}
          <div className="flex items-center space-x-8">
            <Link href="/">
              <div className="flex items-center space-x-2 cursor-pointer">
                <div className="bg-blue-600 text-white p-2 rounded-lg">
                  <Crown className="h-5 w-5" />
                </div>
                <span className="font-bold text-lg text-gray-900">
                  Kanteeravas Badminton Club
                </span>
              </div>
            </Link>

            {/* Navigation Items */}
            <div className="hidden md:flex items-center space-x-6">
              {navItems.map((item) => (
                <Link key={item.path} href={item.path}>
                  <button
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      location === item.path
                        ? "bg-blue-100 text-blue-700"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    }`}
                  >
                    {item.label}
                  </button>
                </Link>
              ))}
            </div>
          </div>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            {currentUser ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-blue-100 text-blue-700">
                        {getInitials(currentUser.name)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      <p className="text-sm font-medium">{currentUser.name}</p>
                      <div className="flex items-center space-x-2">
                        <Badge variant={currentUser.role === "manager" ? "default" : "secondary"} className="text-xs">
                          {currentUser.role === "manager" ? "Manager" : "Player"}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Level {currentUser.skillLevel}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  {currentUser?.role === "manager" && (
                    <>
                      <Dialog>
                        <DialogTrigger asChild>
                          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            <AlertTriangle className="mr-2 h-4 w-4" />
                            <span>Reset All Data</span>
                          </DropdownMenuItem>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Reset All Data</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="text-center">
                              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                              <h3 className="text-lg font-medium text-gray-900 mb-2">Are you sure?</h3>
                              <p className="text-gray-600 mb-4">
                                This will permanently delete all players, matches, and statistics. This action cannot be undone.
                              </p>
                            </div>
                            <div className="flex space-x-3">
                              <DialogTrigger asChild>
                                <Button variant="outline" className="flex-1">
                                  Cancel
                                </Button>
                              </DialogTrigger>
                              <Button
                                variant="destructive"
                                className="flex-1"
                                onClick={handleResetData}
                                disabled={resetDataMutation.isPending}
                              >
                                {resetDataMutation.isPending ? "Resetting..." : "Reset All Data"}
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onClick={handleLogout} disabled={logoutMutation.isPending}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>{logoutMutation.isPending ? "Logging out..." : "Log out"}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button onClick={onLogin} variant="default" size="sm">
                <User className="h-4 w-4 mr-2" />
                Login
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden border-t border-gray-200">
        <div className="px-2 pt-2 pb-3 space-y-1">
          {navItems.map((item) => (
            <Link key={item.path} href={item.path}>
              <button
                className={`block px-3 py-2 text-base font-medium rounded-md w-full text-left transition-colors ${
                  location === item.path
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                {item.label}
              </button>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}