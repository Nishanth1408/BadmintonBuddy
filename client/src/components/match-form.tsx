import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertMatchSchema, type Player, type InsertMatch, type DoublesTeam, type Match } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface MatchFormProps {
  preselectedTeamA?: [number, number];
  onSuccess: () => void;
  embedded?: boolean;
  availableTeams?: DoublesTeam[];
  editingMatch?: Match | null;
  onUpdate?: (data: Partial<Match>) => void;
}

export default function MatchForm({ preselectedTeamA, onSuccess, embedded = false, availableTeams = [], editingMatch, onUpdate }: MatchFormProps) {
  const { toast } = useToast();
  const [useTeamMode, setUseTeamMode] = useState(availableTeams.length >= 2);
  const [selectedTeamA, setSelectedTeamA] = useState<DoublesTeam | null>(null);
  const [selectedTeamB, setSelectedTeamB] = useState<DoublesTeam | null>(null);
  
  const { data: players = [] } = useQuery<Player[]>({
    queryKey: ["/api/players"],
  });

  const form = useForm<InsertMatch>({
    resolver: zodResolver(insertMatchSchema),
    defaultValues: {
      teamAPlayer1Id: editingMatch?.teamAPlayer1Id || preselectedTeamA?.[0] || 0,
      teamAPlayer2Id: editingMatch?.teamAPlayer2Id || preselectedTeamA?.[1] || 0,
      teamBPlayer1Id: editingMatch?.teamBPlayer1Id || 0,
      teamBPlayer2Id: editingMatch?.teamBPlayer2Id || 0,
      teamAScore: editingMatch?.teamAScore || 0,
      teamBScore: editingMatch?.teamBScore || 0,
      winnerId: editingMatch?.winnerId || 1,
    },
  });

  const createMatchMutation = useMutation({
    mutationFn: async (data: InsertMatch) => {
      const response = await apiRequest("POST", "/api/matches", data);
      return await response.json();
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
    // Validate that all players are selected and different
    const playerIds = [data.teamAPlayer1Id, data.teamAPlayer2Id, data.teamBPlayer1Id, data.teamBPlayer2Id];
    
    // Check if all players are selected (non-zero)
    if (playerIds.some(id => !id || id === 0)) {
      toast({ 
        title: "Incomplete team selection", 
        description: "Please select all four players",
        variant: "destructive" 
      });
      return;
    }
    
    // Check if all players are different
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
    
    // Handle edit vs create
    if (editingMatch && onUpdate) {
      onUpdate({ ...data, winnerId });
    } else {
      createMatchMutation.mutate({ ...data, winnerId });
    }
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

  // Handle team selection in team mode
  const handleTeamASelection = (teamIndex: string) => {
    const team = availableTeams[parseInt(teamIndex)];
    if (team) {
      setSelectedTeamA(team);
      form.setValue("teamAPlayer1Id", team.player1.id);
      form.setValue("teamAPlayer2Id", team.player2.id);
    }
  };

  const handleTeamBSelection = (teamIndex: string) => {
    const team = availableTeams[parseInt(teamIndex)];
    if (team) {
      setSelectedTeamB(team);
      form.setValue("teamBPlayer1Id", team.player1.id);
      form.setValue("teamBPlayer2Id", team.player2.id);
    }
  };

  // Get available teams for Team B (exclude Team A)
  const getAvailableTeamsForB = () => {
    if (!selectedTeamA) return availableTeams;
    return availableTeams.filter(team => 
      !(team.player1.id === selectedTeamA.player1.id && team.player2.id === selectedTeamA.player2.id) &&
      !(team.player1.id === selectedTeamA.player2.id && team.player2.id === selectedTeamA.player1.id)
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Mode Toggle */}
        {availableTeams.length >= 2 && (
          <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium">Selection Mode:</span>
            <Button
              type="button"
              variant={useTeamMode ? "default" : "outline"}
              size="sm"
              onClick={() => setUseTeamMode(true)}
            >
              Team Selection
            </Button>
            <Button
              type="button"
              variant={!useTeamMode ? "default" : "outline"}
              size="sm"
              onClick={() => setUseTeamMode(false)}
            >
              Individual Players
            </Button>
          </div>
        )}

        {useTeamMode && availableTeams.length >= 2 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Team A Selection */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 flex items-center">
                <span className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm mr-2">A</span>
                Team A
              </h4>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Team</label>
                <Select onValueChange={handleTeamASelection}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose Team A" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTeams.map((team, index) => (
                      <SelectItem key={index} value={index.toString()}>
                        {team.player1.name} & {team.player2.name} 
                        <span className="text-xs text-gray-500 ml-2">
                          (Levels {team.player1.skillLevel} & {team.player2.skillLevel})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedTeamA && (
                <div className="p-3 bg-blue-50 rounded border">
                  <p className="text-sm font-medium">{selectedTeamA.player1.name} & {selectedTeamA.player2.name}</p>
                  <p className="text-xs text-gray-600">
                    Skill Levels: {selectedTeamA.player1.skillLevel} & {selectedTeamA.player2.skillLevel}
                  </p>
                </div>
              )}
            </div>

            {/* Team B Selection */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 flex items-center">
                <span className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center text-sm mr-2">B</span>
                Team B
              </h4>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Team</label>
                <Select onValueChange={handleTeamBSelection} disabled={!selectedTeamA}>
                  <SelectTrigger>
                    <SelectValue placeholder={selectedTeamA ? "Choose Team B" : "Select Team A first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableTeamsForB().map((team, index) => {
                      const originalIndex = availableTeams.findIndex(t => 
                        t.player1.id === team.player1.id && t.player2.id === team.player2.id
                      );
                      return (
                        <SelectItem key={originalIndex} value={originalIndex.toString()}>
                          {team.player1.name} & {team.player2.name}
                          <span className="text-xs text-gray-500 ml-2">
                            (Levels {team.player1.skillLevel} & {team.player2.skillLevel})
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {selectedTeamB && (
                <div className="p-3 bg-red-50 rounded border">
                  <p className="text-sm font-medium">{selectedTeamB.player1.name} & {selectedTeamB.player2.name}</p>
                  <p className="text-xs text-gray-600">
                    Skill Levels: {selectedTeamB.player1.skillLevel} & {selectedTeamB.player2.skillLevel}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
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
                            {player.name} (Level {player.skillLevel})
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
                          {player.name} (Level {player.skillLevel})
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
                          {player.name} (Level {player.skillLevel})
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
                          {player.name} (Level {player.skillLevel})
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
        )}

        {/* Score Entry for Team Mode */}
        {useTeamMode && (selectedTeamA && selectedTeamB) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="teamAScore"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Team A Score</FormLabel>
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

            <FormField
              control={form.control}
              name="teamBScore"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Team B Score</FormLabel>
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
        )}

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
              {createMatchMutation.isPending ? 
                (editingMatch ? "Updating..." : "Recording...") : 
                (editingMatch ? "Update Match" : "Record Match")
              }
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
              {createMatchMutation.isPending ? 
                (editingMatch ? "Updating..." : "Recording...") : 
                (editingMatch ? "Update Match" : "Record Match")
              }
            </Button>
          </div>
        )}
      </form>
    </Form>
  );
}
