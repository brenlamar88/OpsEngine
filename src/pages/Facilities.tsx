import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function Facilities() {
  const { data: facilities, isLoading } = useQuery({
    queryKey: ["facilities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("facilities")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-2xl font-bold">Facilities</h1>
      <p className="mt-2 text-muted-foreground mb-6">View all facilities and departments.</p>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {facilities?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No facilities found
                  </TableCell>
                </TableRow>
              ) : (
                facilities?.map((facility) => (
                  <TableRow key={facility.id}>
                    <TableCell className="font-medium">{facility.name}</TableCell>
                    <TableCell>{facility.code}</TableCell>
                    <TableCell>
                      <Badge variant={facility.is_active ? "default" : "secondary"}>
                        {facility.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
