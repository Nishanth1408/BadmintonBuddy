import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Smartphone, Timer, ArrowLeft } from "lucide-react";
import type { AuthUser, Player } from "@shared/schema";

const otpSchema = z.object({
  code: z.string().length(6, "OTP must be 6 digits"),
});

type OTPForm = z.infer<typeof otpSchema>;

interface OTPVerificationProps {
  player: Player;
  onVerificationSuccess: (user: AuthUser) => void;
  onGoBack: () => void;
}

export default function OTPVerification({ player, onVerificationSuccess, onGoBack }: OTPVerificationProps) {
  const { toast } = useToast();
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
  const [canResend, setCanResend] = useState(false);

  const form = useForm<OTPForm>({
    resolver: zodResolver(otpSchema),
    defaultValues: {
      code: "",
    },
  });

  // Timer countdown
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const verifyOTPMutation = useMutation({
    mutationFn: async (data: OTPForm) => {
      const response = await apiRequest("POST", "/api/auth/verify-otp", {
        playerId: player.id,
        code: data.code,
      });
      return await response.json();
    },
    onSuccess: (user: AuthUser) => {
      toast({
        title: "Login successful!",
        description: `Welcome back, ${user.name}!`,
      });
      onVerificationSuccess(user);
    },
    onError: () => {
      toast({
        title: "Invalid OTP",
        description: "Please check your code and try again.",
        variant: "destructive",
      });
      form.reset();
    },
  });

  const resendOTPMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/send-otp", {
        playerId: player.id,
      });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "OTP sent",
        description: "A new verification code has been sent to your mobile.",
      });
      setTimeLeft(300);
      setCanResend(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Failed to send OTP",
        description: "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: OTPForm) => {
    verifyOTPMutation.mutate(data);
  };

  const isLoading = verifyOTPMutation.isPending || resendOTPMutation.isPending;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-green-100 p-3 rounded-full">
              <Smartphone className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">Enter Verification Code</CardTitle>
          <CardDescription>
            We've sent a 6-digit code to {player.mobileNumber}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Verification Code</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter 6-digit code"
                        maxLength={6}
                        className="text-center text-2xl tracking-widest"
                        {...field}
                        disabled={isLoading}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
                <Timer className="h-4 w-4" />
                <span>Code expires in {formatTime(timeLeft)}</span>
              </div>

              <div className="space-y-3">
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={isLoading || form.watch("code").length !== 6}
                >
                  {verifyOTPMutation.isPending ? "Verifying..." : "Verify Code"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={!canResend || isLoading}
                  onClick={() => resendOTPMutation.mutate()}
                >
                  {resendOTPMutation.isPending ? "Sending..." : "Resend Code"}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={onGoBack}
                  disabled={isLoading}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Login
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}