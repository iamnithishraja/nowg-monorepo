import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Award,
  Plus,
  Edit,
  Trash2,
  DollarSign,
  Users,
  TrendingUp,
  RefreshCw,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { format } from "date-fns";

type Affiliate = {
  id: string;
  userId: string;
  code: string;
  commissionRate: string;
  totalEarnings: string;
  totalReferrals: number;
  isActive: boolean;
  createdAt: string;
};

type User = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
};

const affiliateSchema = z.object({
  userId: z.string().min(1, "User is required"),
  code: z.string().min(3, "Code must be at least 3 characters").max(50),
  commissionRate: z.string().min(1, "Commission rate is required"),
  isActive: z.boolean().default(true),
});

type AffiliateInput = z.infer<typeof affiliateSchema>;

export default function Affiliates() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAffiliate, setEditingAffiliate] = useState<Affiliate | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [affiliateToDelete, setAffiliateToDelete] = useState<string | null>(null);

  const { data: affiliates = [], isLoading } = useQuery<Affiliate[]>({
    queryKey: ["/api/affiliates"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const form = useForm<AffiliateInput>({
    resolver: zodResolver(affiliateSchema),
    defaultValues: {
      userId: "",
      code: "",
      commissionRate: "10.00",
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: AffiliateInput) => {
      return await apiRequest("/api/affiliates", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/affiliates"] });
      setDialogOpen(false);
      form.reset();
      toast({
        title: "Affiliate Created",
        description: "The affiliate has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AffiliateInput> }) => {
      return await apiRequest(`/api/affiliates/${id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/affiliates"] });
      setDialogOpen(false);
      setEditingAffiliate(null);
      form.reset();
      toast({
        title: "Affiliate Updated",
        description: "The affiliate has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/affiliates/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/affiliates"] });
      setDeleteDialogOpen(false);
      setAffiliateToDelete(null);
      toast({
        title: "Affiliate Deleted",
        description: "The affiliate has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const handleOpenDialog = (affiliate?: Affiliate) => {
    if (affiliate) {
      setEditingAffiliate(affiliate);
      form.reset({
        userId: affiliate.userId,
        code: affiliate.code,
        commissionRate: affiliate.commissionRate,
        isActive: affiliate.isActive,
      });
    } else {
      setEditingAffiliate(null);
      form.reset({
        userId: "",
        code: "",
        commissionRate: "10.00",
        isActive: true,
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = (data: AffiliateInput) => {
    if (editingAffiliate) {
      updateMutation.mutate({ id: editingAffiliate.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  // Calculate total metrics
  const totalEarnings = affiliates.reduce((sum, a) => sum + parseFloat(a.totalEarnings), 0);
  const totalReferrals = affiliates.reduce((sum, a) => sum + a.totalReferrals, 0);
  const activeAffiliates = affiliates.filter((a) => a.isActive).length;
  const avgCommission = affiliates.length > 0
    ? affiliates.reduce((sum, a) => sum + parseFloat(a.commissionRate), 0) / affiliates.length
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Affiliate Program</h1>
          <p className="text-sm text-muted-foreground">
            Manage affiliates, commission rates, and track referrals
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/affiliates"] })}
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => handleOpenDialog()} data-testid="button-create-affiliate">
            <Plus className="h-4 w-4 mr-2" />
            Add Affiliate
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm hover-elevate" data-testid="card-total-earnings">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 pb-4 border-b">
            <p className="text-sm font-medium text-muted-foreground">Total Earnings</p>
            <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-green-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">${totalEarnings.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total affiliate commissions
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover-elevate" data-testid="card-total-referrals">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 pb-4 border-b">
            <p className="text-sm font-medium text-muted-foreground">Total Referrals</p>
            <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalReferrals}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total referred users
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover-elevate" data-testid="card-active-affiliates">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 pb-4 border-b">
            <p className="text-sm font-medium text-muted-foreground">Active Affiliates</p>
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Award className="h-6 w-6 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{activeAffiliates}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Out of {affiliates.length} total
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm hover-elevate" data-testid="card-avg-commission">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 pb-4 border-b">
            <p className="text-sm font-medium text-muted-foreground">Avg Commission</p>
            <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{avgCommission.toFixed(2)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Average commission rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Affiliates Table */}
      <Card className="shadow-sm">
        <CardHeader className="pb-4 border-b">
          <h2 className="text-lg font-semibold">All Affiliates</h2>
          <p className="text-sm text-muted-foreground">
            {affiliates.length} affiliates in total
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading affiliates...
            </div>
          ) : affiliates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No affiliates found. Create one to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="table-affiliates">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Code
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      User
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Commission Rate
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Total Earnings
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Referrals
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Created
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {affiliates.map((affiliate) => {
                    const user = users.find((u) => u.id === affiliate.userId);
                    return (
                      <tr
                        key={affiliate.id}
                        className="border-b last:border-0 hover-elevate"
                        data-testid={`row-affiliate-${affiliate.id}`}
                      >
                        <td className="py-3 px-4">
                          <span className="font-mono text-sm font-medium">
                            {affiliate.code}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {user?.email || affiliate.userId.slice(0, 8)}
                        </td>
                        <td className="py-3 px-4 text-sm font-medium">
                          {parseFloat(affiliate.commissionRate).toFixed(2)}%
                        </td>
                        <td className="py-3 px-4 text-sm font-medium text-green-600 dark:text-green-400">
                          ${parseFloat(affiliate.totalEarnings).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {affiliate.totalReferrals}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant="outline"
                            className={
                              affiliate.isActive
                                ? "bg-green-500/10 text-green-500 border-green-500/20"
                                : "bg-gray-500/10 text-gray-500 border-gray-500/20"
                            }
                            data-testid={`badge-status-${affiliate.id}`}
                          >
                            {affiliate.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {format(new Date(affiliate.createdAt), "MMM dd, yyyy")}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDialog(affiliate)}
                              data-testid={`button-edit-${affiliate.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setAffiliateToDelete(affiliate.id);
                                setDeleteDialogOpen(true);
                              }}
                              data-testid={`button-delete-${affiliate.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-testid="dialog-affiliate-form">
          <DialogHeader>
            <DialogTitle>
              {editingAffiliate ? "Edit Affiliate" : "Create Affiliate"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="userId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>User</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={!!editingAffiliate}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-user">
                          <SelectValue placeholder="Select a user" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.email || `User ${user.id.slice(0, 8)}`}
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
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Affiliate Code</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., PARTNER123"
                        data-testid="input-code"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="commissionRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Commission Rate (%)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        placeholder="10.00"
                        data-testid="input-commission-rate"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row flex-wrap items-center justify-between gap-2 rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active Status</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Enable or disable this affiliate
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit"
                >
                  {editingAffiliate ? "Update" : "Create"} Affiliate
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Affiliate</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this affiliate? This action cannot be undone
              and will also delete all associated referrals.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => affiliateToDelete && deleteMutation.mutate(affiliateToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
