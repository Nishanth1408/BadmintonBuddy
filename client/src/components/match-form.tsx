import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertMatchSchema, type Player, type InsertMatch } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface MatchFormProps {
  preselectedTeamA?: [number, number];
  onSuccess: () => void;
  embedded?: boolean;
}

export default function MatchForm({ preselectedTeamA, onSuccess, embedded = false }: MatchFormProps) {
  const { toast } = useToast();
  
  const { data: players = [] } = useQuery<Player[]>({
    queryKey: ["/api/players"],
  });

  const form = useForm<InsertMatch>({
    resolver: zodResolver(insertMatchSchema),
    defaultValues: {
      teamAPlayer1Id: preselectedTeamA?.[0] || 0,
      teamAPlayer2Id: preselectedTeamA?.[1] || 0,
      teamBPlayer1Id: 0,
      teamBPlayer2Id: 0,
      teamAScore: 0,
      teamBScore: 0,
      winnerId: 1,
    },
  });

  const createMatchMutation = useMutation({
    mutationFn: async (data: InsertMatch) => {
      return apiRequest("POST", "/api/matches", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Match recorded successfully" });
      if (!embedded) {
        onSuccess();
      }
      form.reset();
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to record match", 
        description: error.message || "Please check your input and try again",
        variant: "destructive" 
      });
    },
  });

  const onSubmit = (data: InsertMatch) => {
    // Validate that all players are different
    const playerIds = [data.teamAPlayer1Id, data.teamAPlayer2Id, data.teamBPlayer1Id, data.teamBPlayer2Id];
    const uniquePlayerIds = new Set(playerIds);
    
    if (uniquePlayerIds.size !== 4) {
      toast({ 
        title: "Invalid team selection", 
        description: "All four players must be different",
        variant: "destructive" 
      });
      return;
    }

    // Determine winner based on scores
    const winnerId = data.teamAScore > data.teamBScore ? 1 : 2;
    createMatchMutation.mutate({ ...data, winnerId });
  };

  const watchedValues = form.watch();
  const selectedPlayerIds = new Set([
    watchedValues.teamAPlayer1Id,
    watchedValues.teamAPlayer2Id,
    watchedValues.teamBPlayer1Id,
    watchedValues.teamBPlayer2Id,
  ].filter(id => id > 0));

  const getAvailablePlayers = (excludeIds: number[] = []) => {
    return players.filter(player => !excludeIds.includes(player.id));
  };

  if (players.length < 4) {
    return (
      <div className="text-center p-6">
        <p className="text-gray-600">You need at least 4 players to record a match.</p>
        <p className="text-sm text-gray-500 mt-2">Add more players to get started.</p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Team A */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 flex items-center">
              <span className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm mr-2">A</span>
              Team A
            </h4>
            
            <FormField
              control={form.control}
              name="teamAPlayer1Id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Player 1</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(parseInt(value))} 
                    value={field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Player 1" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {getAvailablePlayers(Array.from(selectedPlayerIds).filter(id => id !== field.value)).map(player => (
                        <SelectItem key={player.id} value={player.id.toString()}>
                          {player.name} ({player.skillLevel})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="teamAPlayer2Id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Player 2</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(parseInt(value))} 
                    value={field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Player 2" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {getAvailablePlayers(Array.from(selectedPlayerIds).filter(id => id !== field.value)).map(player => (
                        <SelectItem key={player.id} value={player.id.toString()}>
                          {player.name} ({player.skillLevel})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="teamAScore"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Score</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="Team A Score" 
                      min="0"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Team B */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 flex items-center">
              <span className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center text-sm mr-2">B</span>
              Team B
            </h4>
            
            <FormField
              control={form.control}
              name="teamBPlayer1Id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Player 1</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(parseInt(value))} 
                    value={field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Player 1" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {getAvailablePlayers(Array.from(selectedPlayerIds).filter(id => id !== field.value)).map(player => (
                        <SelectItem key={player.id} value={player.id.toString()}>
                          {player.name} ({player.skillLevel})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="teamBPlayer2Id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Player 2</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(parseInt(value))} 
                    value={field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Player 2" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {getAvailablePlayers(Array.from(selectedPlayerIds).filter(id => id !== field.value)).map(player => (
                        <SelectItem key={player.id} value={player.id.toString()}>
                          {player.name} ({player.skillLevel})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="teamBScore"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Score</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="Team B Score" 
                      min="0"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {!embedded && (
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={onSuccess}
              disabled={createMatchMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMatchMutation.isPending}>
              {createMatchMutation.isPending ? "Recording..." : "Record Match"}
            </Button>
          </div>
        )}

        {embedded && (
          <div className="flex justify-end">
            <Button 
              type="submit" 
              disabled={createMatchMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {createMatchMutation.isPending ? "Recording..." : "Record Match"}
            </Button>
          </div>
        )}
      </form>
    </Form>
  );
}
