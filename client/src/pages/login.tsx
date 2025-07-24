import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { User, Crown, Users, Smartphone } from "lucide-react";
import OTPVerification from "@/components/otp-verification";
import type { Player, AuthUser } from "@shared/schema";

interface LoginPageProps {
  onLogin: (user: AuthUser) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const { toast } = useToast();
  const [playerName, setPlayerName] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [showOTPVerification, setShowOTPVerification] = useState(false);
  
  const { data: players, isLoading } = useQuery({
    queryKey: ["/api/players"],
  });

  const sendOTPMutation = useMutation({
    mutationFn: async (playerId: number) => {
      const response = await apiRequest("POST", "/api/auth/send-otp", { playerId });
      return await response.json();
    },
    onSuccess: (_, playerId) => {
      const player = (players as Player[])?.find((p: Player) => p.id === playerId);
      if (player) {
        setSelectedPlayer(player);
        setShowOTPVerification(true);
        toast({
          title: "OTP sent",
          description: `Verification code sent to ${player.mobileNumber}`,
        });
      }
    },
    onError: (error: any) => {
      console.error("Send OTP error:", error);
      toast({
        title: "Failed to send OTP",
        description: error.message || "Failed to send verification code",
        variant: "destructive",
      });
    },
  });

  const handleSubmitName = () => {
    if (!playerName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter your name to continue",
        variant: "destructive",
      });
      return;
    }

    const player = (players as Player[])?.find((p: Player) => 
      p.name.toLowerCase().trim() === playerName.toLowerCase().trim()
    );

    if (!player) {
      toast({
        title: "Player not found",
        description: "No player found with that name. Please check your spelling or contact your manager.",
        variant: "destructive",
      });
      return;
    }

    sendOTPMutation.mutate(player.id);
  };

  const handleOTPVerificationSuccess = (user: AuthUser) => {
    setShowOTPVerification(false);
    setSelectedPlayer(null);
    onLogin(user);
  };

  const handleGoBackToLogin = () => {
    setShowOTPVerification(false);
    setSelectedPlayer(null);
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

  // Show OTP verification if a player is selected
  if (showOTPVerification && selectedPlayer) {
    return (
      <OTPVerification
        player={selectedPlayer}
        onVerificationSuccess={handleOTPVerificationSuccess}
        onGoBack={handleGoBackToLogin}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-blue-100 p-3 rounded-full">
              <User className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">Welcome to Kanteeravas Badminton Club</CardTitle>
          <CardDescription>
            Enter your name to receive SMS verification code
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="playerName">Your Name</Label>
            <Input
              id="playerName"
              type="text"
              placeholder="Enter your full name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSubmitName();
                }
              }}
            />
          </div>
          
          <Button 
            onClick={handleSubmitName}
            disabled={sendOTPMutation.isPending || !playerName.trim()}
            className="w-full"
          >
            {sendOTPMutation.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Sending OTP...
              </>
            ) : (
              <>
                <Smartphone className="h-4 w-4 mr-2" />
                Continue with SMS
              </>
            )}
          </Button>
          
          {(!players || (players as Player[]).length === 0) && (
            <div className="text-center py-4">
              <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">No players found. Please contact your manager.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}