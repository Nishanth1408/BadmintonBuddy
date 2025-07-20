import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertPlayerSchema, type Player, type InsertPlayer } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface PlayerFormProps {
  player?: Player | null;
  onSuccess: () => void;
}

export default function PlayerForm({ player, onSuccess }: PlayerFormProps) {
  const { toast } = useToast();
  
  const form = useForm<InsertPlayer>({
    resolver: zodResolver(insertPlayerSchema),
    defaultValues: {
      name: player?.name || "",
      skillLevel: player?.skillLevel || 1,
    },
  });

  const createPlayerMutation = useMutation({
    mutationFn: async (data: InsertPlayer) => {
      console.log("Sending POST request with data:", data);
      return apiRequest("POST", "/api/players", data);
    },
    onSuccess: (result) => {
      console.log("Player created successfully:", result);
      queryClient.invalidateQueries({ queryKey: ["/api/players"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Player created successfully" });
      onSuccess();
      form.reset();
    },
    onError: (error) => {
      console.error("Failed to create player:", error);
      toast({ title: "Failed to create player", variant: "destructive" });
    },
  });

  const updatePlayerMutation = useMutation({
    mutationFn: async (data: InsertPlayer) => {
      return apiRequest("PUT", `/api/players/${player!.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/players"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Player updated successfully" });
      onSuccess();
    },
    onError: () => {
      toast({ title: "Failed to update player", variant: "destructive" });
    },
  });

  const onSubmit = (data: InsertPlayer) => {
    console.log("Form submitted with data:", data);
    if (player) {
      updatePlayerMutation.mutate(data);
    } else {
      createPlayerMutation.mutate(data);
    }
  };

  const isLoading = createPlayerMutation.isPending || updatePlayerMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Player Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter player name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="skillLevel"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Skill Level (1-10)</FormLabel>
              <Select 
                onValueChange={(value) => field.onChange(parseInt(value))} 
                value={field.value?.toString()}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select skill level" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(level => (
                    <SelectItem key={level} value={level.toString()}>
                      {level} - {level <= 3 ? 'Beginner' : level <= 7 ? 'Intermediate' : 'Advanced'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={onSuccess}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving..." : player ? "Update Player" : "Add Player"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
