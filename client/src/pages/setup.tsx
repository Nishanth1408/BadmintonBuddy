import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Users, Shield } from "lucide-react";
import logoPath from "@assets/Kanteerava_logo_1753355959908.jpg";

const setupSchema = z.object({
  managerName: z.string().min(1, "Manager name is required"),
  managerSkillLevel: z.number().min(1).max(10),
  managerMobile: z.string().min(10).max(15).regex(/^\+?[1-9]\d{1,14}$/, "Invalid mobile number format"),
});

type SetupForm = z.infer<typeof setupSchema>;

interface SetupPageProps {
  onSetupComplete: (user: any) => void;
}

export function SetupPage({ onSetupComplete }: SetupPageProps) {
  const { toast } = useToast();
  
  const form = useForm<SetupForm>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      managerName: "",
      managerSkillLevel: 5,
      managerMobile: "",
    },
  });

  const setupMutation = useMutation({
    mutationFn: async (data: SetupForm) => {
      const response = await apiRequest("POST", "/api/auth/setup", data);
      return await response.json();
    },
    onSuccess: (manager) => {
      toast({
        title: "Welcome, Manager!",
        description: "Your club has been set up successfully.",
      });
      onSetupComplete(manager);
    },
    onError: (error: any) => {
      console.error("Setup error:", error);
      toast({
        title: "Setup failed",
        description: error.message || "Failed to setup manager account",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SetupForm) => {
    setupMutation.mutate(data);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <img 
              src={logoPath} 
              alt="Kanteeravas Badminton Club Logo" 
              className="h-16 w-16 object-contain"
            />
          </div>
          <CardTitle className="text-2xl">Welcome to Kanteeravas Badminton Club</CardTitle>
          <CardDescription>
            Let's set up your club by creating the first manager account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="managerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Manager Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter your full name"
                        {...field}
                        disabled={setupMutation.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="managerSkillLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your Skill Level</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value.toString()}
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        disabled={setupMutation.isPending}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 10 }, (_, i) => i + 1).map((level) => (
                            <SelectItem key={level} value={level.toString()}>
                              <div className="flex items-center space-x-2">
                                <Badge className={`${getSkillLevelColor(level)} text-white text-xs`}>
                                  {getSkillLevelLabel(level)}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="managerMobile"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mobile Number</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter mobile number (e.g. +91xxxxxxxxxx)" 
                        {...field}
                        disabled={setupMutation.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={setupMutation.isPending}
                >
                  {setupMutation.isPending ? "Setting up..." : "Create Manager Account"}
                </Button>
                
                <div className="text-center text-sm text-gray-600">
                  <div className="flex items-center justify-center space-x-2">
                    <Users className="h-4 w-4" />
                    <span>You'll be able to add players and manage the club after setup</span>
                  </div>
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}