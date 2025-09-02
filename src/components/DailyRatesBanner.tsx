import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Edit, Save, X, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { logActivity } from '@/utils/activityLogger';

interface Rate {
  id: string;
  material: string;
  karat: string;
  n_price: number;
  o_price: number;
}

export const DailyRatesBanner = () => {
  const [rates, setRates] = useState<Rate[]>([]);
  const [editingRates, setEditingRates] = useState<Rate[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const { user } = useAuth();

  useEffect(() => {
    fetchRates();
  }, [selectedDate]);

  const fetchRates = async () => {
    try {
      const { data, error } = await supabase
        .from('daily_rates')
        .select('*')
        .eq('asof_date', selectedDate);

      if (error) {
        throw error;
      }

      if (data) {
        setRates(data);
        setEditingRates(data.map(rate => ({ ...rate })));
      }
    } catch (error) {
      console.error('Error fetching daily rates:', error);
      toast.error('Failed to fetch daily rates');
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingRates(rates.map(rate => ({ ...rate })));
  };

  const handleInputChange = (index: number, field: string, value: string) => {
    const newRates = [...editingRates];
    newRates[index][field] = value;
    setEditingRates(newRates);
  };

  const handleSave = async () => {
    if (!user) {
      toast.error('You must be logged in to save rates');
      return;
    }

    try {
      const ratesToUpsert = editingRates.map(rate => ({
        inserted_by: user.username,
        asof_date: selectedDate,
        material: rate.material,
        karat: rate.karat,
        n_price: rate.n_price,
        o_price: rate.o_price,
      }));

      const { error } = await supabase
        .from('daily_rates')
        .upsert(ratesToUpsert, { onConflict: 'asof_date,material,karat' });

      if (error) {
        throw error;
      }

      // Log the activity
      await logActivity({
        username: user.username,
        role: user.role,
        action: 'upsert',
        table_name: 'daily_rates',
        description: `Updated daily rates for ${selectedDate}`,
        metadata: {
          date: selectedDate,
          ratesCount: ratesToUpsert.length,
          rates: ratesToUpsert
        }
      });

      toast.success('Daily rates saved successfully!');
      setIsEditing(false);
      fetchRates();
    } catch (error) {
      console.error('Error saving rates:', error);
      toast.error('Failed to save rates');
    }
  };

  return (
    <Card className="shadow-md border-0 bg-white/80 backdrop-blur-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-full">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800">Daily Gold & Silver Rates</h2>
          </div>
          <div className="flex items-center gap-4">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="max-w-xs border-slate-300 focus:border-amber-400 focus:ring-amber-400 text-sm"
              disabled={isEditing}
            />
            {isEditing ? (
              <>
                <Button
                  onClick={handleSave}
                  size="sm"
                  className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-semibold"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  size="sm"
                  className="border-slate-300 text-slate-700"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                onClick={handleEdit}
                variant="outline"
                size="sm"
                className="border-amber-300 text-amber-700 hover:bg-amber-100"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Rates
              </Button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Material
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Karat
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  New Price (₹)
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Old Price (₹)
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {editingRates.map((rate, index) => (
                <tr key={rate.id}>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <Badge className="bg-slate-100 text-slate-700 border-0">{rate.material}</Badge>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {rate.karat}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <Input
                      type="number"
                      value={rate.n_price}
                      onChange={(e) => handleInputChange(index, 'n_price', e.target.value)}
                      className="w-24 border-slate-300 focus:border-amber-400 focus:ring-amber-400 text-sm"
                      disabled={!isEditing}
                    />
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <Input
                      type="number"
                      value={rate.o_price}
                      onChange={(e) => handleInputChange(index, 'o_price', e.target.value)}
                      className="w-24 border-slate-300 focus:border-amber-400 focus:ring-amber-400 text-sm"
                      disabled={!isEditing}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
