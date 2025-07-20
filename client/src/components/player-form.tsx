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
      skillLevel: (player?.skillLevel as "Beginner" | "Intermediate" | "Advanced") || "Beginner",
    },
  });

  const createPlayerMutation = useMutation({
    mutationFn: async (data: InsertPlayer) => {
      return apiRequest("POST", "/api/players", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/players"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Player created successfully" });
      onSuccess();
      form.reset();
    },
    onError: () => {
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
              <FormLabel>Skill Level</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select skill level" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Beginner">Beginner</SelectItem>
                  <SelectItem value="Intermediate">Intermediate</SelectItem>
                  <SelectItem value="Advanced">Advanced</SelectItem>
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
