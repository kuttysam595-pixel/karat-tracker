
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Receipt, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { logActivityWithContext } from '@/lib/activityLogger';

export const AddExpense = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    asof_date: format(new Date(), 'yyyy-MM-dd'),
    expense_type: '',
    item_name: '',
    cost: '',
    udhaar: false
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error('User not authenticated');
      return;
    }

    if (!user || !formData.asof_date || !formData.expense_type || !formData.item_name || !formData.cost) {
      toast.error('Please fill all fields');
      return;
    }

    setIsLoading(true);
    try {

      // Check for duplicate expense entry
      const duplicateEntry = await checkDuplicateExpense(
        formData.asof_date,
        formData.expense_type,
        formData.item_name
      );

      if (duplicateEntry) {
        toast.error(`Duplicate expense detected! This expense (${formData.expense_type} - ${formData.item_name}) for today was already entered by ${duplicateEntry.inserted_by}.`);
        return;
      }

      const expenseData = {
        inserted_by: user.username,
        asof_date: formData.asof_date,
        expense_type: formData.expense_type,
        item_name: formData.item_name,
        cost: parseFloat(formData.cost),
        udhaar: formData.udhaar
      };

      const { data, error } = await supabase
        .from('expense_log')
        .insert(expenseData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Log the activity manually
      await logActivityWithContext(
        user.username,
        'expense_log',
        'INSERT',
        data.id,
        undefined,
        data
      );

      toast.success('Expense added successfully!');
      
      // Clear form fields except date
      setFormData(prev => ({
        ...prev,
        expense_type: '',
        item_name: '',
        cost: '',
        udhaar: false
      }));

    } catch (error) {
      console.error('Error adding expense:', error);
      toast.error('Failed to add expense');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const checkDuplicateExpense = async (asofDate: string, expenseType: string, itemName: string) => {
    const { data, error } = await supabase
      .from('expense_log')
      .select('inserted_by')
      .eq('asof_date', asofDate)
      .eq('expense_type', expenseType)
      .eq('item_name', itemName)
      .single();
  
    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      throw error;
    }
  
    return data;
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button
            onClick={() => navigate('/dashboard')}
            variant="outline"
            size="sm"
            className="border-amber-300 text-amber-700 hover:bg-amber-100"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full">
              <Receipt className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Add Expense</h1>
              <p className="text-slate-600">Record a new business expense</p>
            </div>
          </div>
        </div>

        <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-xl text-slate-800">Expense Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="asof_date" className="text-slate-700 font-medium">
                    Date *
                  </Label>
                  <Input
                    id="asof_date"
                    type="date"
                    value={formData.asof_date}
                    onChange={(e) => handleInputChange('asof_date', e.target.value)}
                    className="border-slate-300 focus:border-blue-400 focus:ring-blue-400"
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expense_type" className="text-slate-700 font-medium">
                    Expense Type *
                  </Label>
                  <Select value={formData.expense_type} onValueChange={(value) => handleInputChange('expense_type', value)}>
                    <SelectTrigger className="border-slate-300 focus:border-blue-400 focus:ring-blue-400">
                      <SelectValue placeholder="Select expense type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="direct">Direct</SelectItem>
                      <SelectItem value="indirect">Indirect</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="item_name" className="text-slate-700 font-medium">
                  Item Name *
                </Label>
                <Input
                  id="item_name"
                  type="text"
                  placeholder="Enter item name or description"
                  value={formData.item_name}
                  onChange={(e) => handleInputChange('item_name', e.target.value)}
                  className="border-slate-300 focus:border-blue-400 focus:ring-blue-400"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cost" className="text-slate-700 font-medium">
                  Cost (₹) *
                </Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  placeholder="Enter amount in rupees"
                  value={formData.cost}
                  onChange={(e) => handleInputChange('cost', e.target.value)}
                  className="border-slate-300 focus:border-blue-400 focus:ring-blue-400"
                  disabled={isLoading}
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="udhaar"
                  checked={formData.udhaar}
                  onChange={(e) => handleInputChange('udhaar', e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                  disabled={isLoading}
                />
                <Label htmlFor="udhaar" className="text-slate-700 font-medium">
                  Udhaar (Credit)
                </Label>
                <span className="text-sm text-slate-500">
                  Check if this is a credit/loan expense
                </span>
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/dashboard')}
                  className="flex-1 border-slate-300 text-slate-700"
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold"
                  disabled={isLoading}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isLoading ? 'Saving...' : 'Save Expense'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
