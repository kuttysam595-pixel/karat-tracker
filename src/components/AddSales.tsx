
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ShoppingCart, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { logActivity } from '@/utils/activityLogger';

export const AddSales = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    asof_date: format(new Date(), 'yyyy-MM-dd'),
    customer_name: '',
    customer_phone: '',
    tag_no: '',
    item_name: '',
    material: '',
    type: '',
    p_grams: '',
    p_purity: '',
    p_cost: '',
    s_purity: '',
    wastage: '',
    s_cost: '',
    o_cost: '',
    o1_gram: '',
    o1_purity: '',
    o2_gram: '',
    o2_purity: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.customer_name || !formData.customer_phone || !formData.tag_no || 
        !formData.item_name || !formData.material || !formData.type || !formData.p_grams || 
        !formData.p_purity || !formData.p_cost || !formData.s_cost) {
      toast.error('Please fill all required fields');
      return;
    }

    setIsLoading(true);
    try {
      // Calculate profit
      const purchaseCost = parseFloat(formData.p_cost) || 0;
      const sellingCost = parseFloat(formData.s_cost) || 0;
      const oldCost = parseFloat(formData.o_cost) || 0;
      const profit = sellingCost - purchaseCost - oldCost;

      const salesData = {
        inserted_by: user.username,
        asof_date: formData.asof_date,
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone,
        tag_no: formData.tag_no,
        item_name: formData.item_name,
        material: formData.material,
        type: formData.type,
        p_grams: parseFloat(formData.p_grams),
        p_purity: parseFloat(formData.p_purity),
        p_cost: purchaseCost,
        s_purity: formData.s_purity ? parseFloat(formData.s_purity) : null,
        wastage: formData.wastage ? parseFloat(formData.wastage) : null,
        s_cost: sellingCost,
        profit: profit,
        o_cost: oldCost || null,
        o1_gram: formData.o1_gram ? parseFloat(formData.o1_gram) : null,
        o1_purity: formData.o1_purity ? parseFloat(formData.o1_purity) : null,
        o2_gram: formData.o2_gram ? parseFloat(formData.o2_gram) : null,
        o2_purity: formData.o2_purity ? parseFloat(formData.o2_purity) : null
      };

      const { data, error } = await supabase
        .from('sales_log')
        .insert(salesData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Log the activity
      await logActivity({
        username: user.username,
        role: user.role,
        action: 'insert',
        table_name: 'sales_log',
        row_id: data.id,
        description: `Added sale: ${formData.item_name} to ${formData.customer_name} - ₹${formData.s_cost} (Profit: ₹${profit.toFixed(2)})`,
        metadata: { ...salesData, profit }
      });

      toast.success('Sale added successfully!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error adding sale:', error);
      toast.error('Failed to add sale');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 p-4">
      <div className="max-w-4xl mx-auto">
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
            <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full">
              <ShoppingCart className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Add Sales</h1>
              <p className="text-slate-600">Record a new sales transaction</p>
            </div>
          </div>
        </div>

        <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-xl text-slate-800">Sales Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Customer Information */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="asof_date" className="text-slate-700 font-medium">
                    Date *
                  </Label>
                  <Input
                    id="asof_date"
                    type="date"
                    value={formData.asof_date}
                    onChange={(e) => handleInputChange('asof_date', e.target.value)}
                    className="border-slate-300 focus:border-green-400 focus:ring-green-400"
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer_name" className="text-slate-700 font-medium">
                    Customer Name *
                  </Label>
                  <Input
                    id="customer_name"
                    type="text"
                    placeholder="Enter customer name"
                    value={formData.customer_name}
                    onChange={(e) => handleInputChange('customer_name', e.target.value)}
                    className="border-slate-300 focus:border-green-400 focus:ring-green-400"
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer_phone" className="text-slate-700 font-medium">
                    Customer Phone *
                  </Label>
                  <Input
                    id="customer_phone"
                    type="text"
                    placeholder="Enter phone number"
                    value={formData.customer_phone}
                    onChange={(e) => handleInputChange('customer_phone', e.target.value)}
                    className="border-slate-300 focus:border-green-400 focus:ring-green-400"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Item Information */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="tag_no" className="text-slate-700 font-medium">
                    Tag No *
                  </Label>
                  <Input
                    id="tag_no"
                    type="text"
                    placeholder="Enter tag number"
                    value={formData.tag_no}
                    onChange={(e) => handleInputChange('tag_no', e.target.value)}
                    className="border-slate-300 focus:border-green-400 focus:ring-green-400"
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="item_name" className="text-slate-700 font-medium">
                    Item Name *
                  </Label>
                  <Input
                    id="item_name"
                    type="text"
                    placeholder="Enter item name"
                    value={formData.item_name}
                    onChange={(e) => handleInputChange('item_name', e.target.value)}
                    className="border-slate-300 focus:border-green-400 focus:ring-green-400"
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="material" className="text-slate-700 font-medium">
                    Material *
                  </Label>
                  <Select value={formData.material} onValueChange={(value) => handleInputChange('material', value)}>
                    <SelectTrigger className="border-slate-300 focus:border-green-400 focus:ring-green-400">
                      <SelectValue placeholder="Select material" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gold">Gold</SelectItem>
                      <SelectItem value="silver">Silver</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type" className="text-slate-700 font-medium">
                    Type *
                  </Label>
                  <Input
                    id="type"
                    type="text"
                    placeholder="Enter type"
                    value={formData.type}
                    onChange={(e) => handleInputChange('type', e.target.value)}
                    className="border-slate-300 focus:border-green-400 focus:ring-green-400"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Purchase Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="p_grams" className="text-slate-700 font-medium">
                    Purchase Grams *
                  </Label>
                  <Input
                    id="p_grams"
                    type="number"
                    step="0.001"
                    placeholder="Enter grams"
                    value={formData.p_grams}
                    onChange={(e) => handleInputChange('p_grams', e.target.value)}
                    className="border-slate-300 focus:border-green-400 focus:ring-green-400"
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p_purity" className="text-slate-700 font-medium">
                    Purchase Purity *
                  </Label>
                  <Input
                    id="p_purity"
                    type="number"
                    step="0.01"
                    placeholder="Enter purity"
                    value={formData.p_purity}
                    onChange={(e) => handleInputChange('p_purity', e.target.value)}
                    className="border-slate-300 focus:border-green-400 focus:ring-green-400"
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p_cost" className="text-slate-700 font-medium">
                    Purchase Cost (₹) *
                  </Label>
                  <Input
                    id="p_cost"
                    type="number"
                    step="0.01"
                    placeholder="Enter purchase cost"
                    value={formData.p_cost}
                    onChange={(e) => handleInputChange('p_cost', e.target.value)}
                    className="border-slate-300 focus:border-green-400 focus:ring-green-400"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Selling Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="s_purity" className="text-slate-700 font-medium">
                    Selling Purity
                  </Label>
                  <Input
                    id="s_purity"
                    type="number"
                    step="0.01"
                    placeholder="Enter selling purity"
                    value={formData.s_purity}
                    onChange={(e) => handleInputChange('s_purity', e.target.value)}
                    className="border-slate-300 focus:border-green-400 focus:ring-green-400"
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wastage" className="text-slate-700 font-medium">
                    Wastage
                  </Label>
                  <Input
                    id="wastage"
                    type="number"
                    step="0.001"
                    placeholder="Enter wastage"
                    value={formData.wastage}
                    onChange={(e) => handleInputChange('wastage', e.target.value)}
                    className="border-slate-300 focus:border-green-400 focus:ring-green-400"
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="s_cost" className="text-slate-700 font-medium">
                    Selling Cost (₹) *
                  </Label>
                  <Input
                    id="s_cost"
                    type="number"
                    step="0.01"
                    placeholder="Enter selling cost"
                    value={formData.s_cost}
                    onChange={(e) => handleInputChange('s_cost', e.target.value)}
                    className="border-slate-300 focus:border-green-400 focus:ring-green-400"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Old Gold Details */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="o_cost" className="text-slate-700 font-medium">
                    Old Cost (₹)
                  </Label>
                  <Input
                    id="o_cost"
                    type="number"
                    step="0.01"
                    placeholder="Enter old cost"
                    value={formData.o_cost}
                    onChange={(e) => handleInputChange('o_cost', e.target.value)}
                    className="border-slate-300 focus:border-green-400 focus:ring-green-400"
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="o1_gram" className="text-slate-700 font-medium">
                    Old Gold 1 Grams
                  </Label>
                  <Input
                    id="o1_gram"
                    type="number"
                    step="0.001"
                    placeholder="Enter grams"
                    value={formData.o1_gram}
                    onChange={(e) => handleInputChange('o1_gram', e.target.value)}
                    className="border-slate-300 focus:border-green-400 focus:ring-green-400"
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="o1_purity" className="text-slate-700 font-medium">
                    Old Gold 1 Purity
                  </Label>
                  <Input
                    id="o1_purity"
                    type="number"
                    step="0.01"
                    placeholder="Enter purity"
                    value={formData.o1_purity}
                    onChange={(e) => handleInputChange('o1_purity', e.target.value)}
                    className="border-slate-300 focus:border-green-400 focus:ring-green-400"
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="o2_gram" className="text-slate-700 font-medium">
                    Old Gold 2 Grams
                  </Label>
                  <Input
                    id="o2_gram"
                    type="number"
                    step="0.001"
                    placeholder="Enter grams"
                    value={formData.o2_gram}
                    onChange={(e) => handleInputChange('o2_gram', e.target.value)}
                    className="border-slate-300 focus:border-green-400 focus:ring-green-400"
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="o2_purity" className="text-slate-700 font-medium">
                    Old Gold 2 Purity
                  </Label>
                  <Input
                    id="o2_purity"
                    type="number"
                    step="0.01"
                    placeholder="Enter purity"
                    value={formData.o2_purity}
                    onChange={(e) => handleInputChange('o2_purity', e.target.value)}
                    className="border-slate-300 focus:border-green-400 focus:ring-green-400"
                    disabled={isLoading}
                  />
                </div>
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
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold"
                  disabled={isLoading}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isLoading ? 'Saving...' : 'Save Sale'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
