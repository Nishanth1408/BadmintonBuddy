import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { User, Crown, Users } from "lucide-react";
import type { Player, AuthUser } from "@shared/schema";

interface LoginPageProps {
  onLogin: (user: AuthUser) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const { toast } = useToast();
  
  const { data: players, isLoading } = useQuery({
    queryKey: ["/api/players"],
  });

  const loginMutation = useMutation({
    mutationFn: (userId: number) => 
      apiRequest(`/api/auth/login/${userId}`, {
        method: "POST",
      }),
    onSuccess: (user) => {
      toast({
        title: "Welcome back!",
        description: `Logged in as ${user.name}`,
      });
      onLogin(user);
    },
    onError: (error: any) => {
      console.error("Login error:", error);
      toast({
        title: "Login failed",
        description: error.message || "Failed to login",
        variant: "destructive",
      });
    },
  });

  const handleLogin = (playerId: number) => {
    loginMutation.mutate(playerId);
  };

  const getSkillLevelLabel = (level: number) => {
    if (level >= 1 && level <= 3) return `${level} - Beginner`;
    if (level >= 4 && level <= 7) return `${level} - Intermediate`;
    if (level >= 8 && level <= 10) return `${level} - Advanced`;
    return `${level}`;
  };

  const getSkillLevelColor = (level: number) => {
    if (level >= 1 && level <= 3) return "bg-green-500";
    if (level >= 4 && level <= 7) return "bg-yellow-500";
    if (level >= 8 && level <= 10) return "bg-red-500";
    return "bg-gray-500";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading players...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-blue-100 p-3 rounded-full">
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">Welcome to Kanteeravas Badminton Club</CardTitle>
          <CardDescription>
            Select your profile to continue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {players?.map((player: Player) => (
              <Button
                key={player.id}
                variant="outline"
                className="h-auto p-4 justify-start"
                onClick={() => handleLogin(player.id)}
                disabled={loginMutation.isPending}
              >
                <div className="flex items-center space-x-3 w-full">
                  <div className="flex-shrink-0">
                    {player.role === "manager" ? (
                      <Crown className="h-8 w-8 text-yellow-500" />
                    ) : (
                      <User className="h-8 w-8 text-blue-500" />
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-medium text-gray-900">{player.name}</div>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge variant={player.role === "manager" ? "default" : "secondary"} className="text-xs">
                        {player.role === "manager" ? "Manager" : "Player"}
                      </Badge>
                      <Badge className={`${getSkillLevelColor(player.skillLevel)} text-white text-xs`}>
                        {getSkillLevelLabel(player.skillLevel)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </Button>
            ))}
          </div>
          
          {(!players || players.length === 0) && (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No players found. Please contact your manager.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}