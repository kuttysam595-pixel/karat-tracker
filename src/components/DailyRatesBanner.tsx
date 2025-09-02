import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Edit3, Save, X, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { logActivityWithContext } from '@/lib/activityLogger';

interface DailyRate {
  material: string;
  karat: string;
  n_price: number;
  o_price: number;
}

export const DailyRatesBanner = () => {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [rates, setRates] = useState<DailyRate[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingRates, setEditingRates] = useState<DailyRate[]>([]);
  const { user } = useAuth();

  const defaultRates: DailyRate[] = [
    { material: 'gold', karat: '24k', n_price: 0, o_price: 0 },
    { material: 'gold', karat: '22k', n_price: 0, o_price: 0 },
    { material: 'gold', karat: '18k', n_price: 0, o_price: 0 },
    { material: 'silver', karat: 'NA', n_price: 0, o_price: 0 },
  ];

  useEffect(() => {
    fetchRates();
  }, [selectedDate]);

  const fetchRates = async () => {
    const { data, error } = await supabase
      .from('daily_rates')
      .select('*')
      .eq('asof_date', selectedDate);

    if (error) {
      console.error('Error fetching rates:', error);
      return;
    }

    const ratesMap = new Map();
    data?.forEach(rate => {
      ratesMap.set(`${rate.material}_${rate.karat}`, rate);
    });

    const formattedRates = defaultRates.map(defaultRate => {
      const existing = ratesMap.get(`${defaultRate.material}_${defaultRate.karat}`);
      return existing ? {
        material: existing.material,
        karat: existing.karat,
        n_price: existing.n_price,
        o_price: existing.o_price
      } : defaultRate;
    });

    setRates(formattedRates);
    localStorage.setItem(`rates_${selectedDate}`, JSON.stringify(formattedRates));
  };

  const handleEdit = () => {
    setEditingRates([...rates]);
    setIsEditing(true);
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

      // Get existing rates to determine INSERT vs UPDATE
      const { data: existingRates } = await supabase
        .from('daily_rates')
        .select('*')
        .eq('asof_date', selectedDate);

      const { data, error } = await supabase
        .from('daily_rates')
        .upsert(ratesToUpsert, { onConflict: 'asof_date,material,karat' })
        .select();

      if (error) {
        throw error;
      }

      // Log activity for each rate that was inserted or updated
      if (data) {
        for (const newRate of data) {
          const existingRate = existingRates?.find(
            rate => rate.material === newRate.material && rate.karat === newRate.karat
          );
          
          if (existingRate) {
            // UPDATE operation
            await logActivityWithContext(
              user.username,
              'daily_rates',
              'UPDATE',
              newRate.id,
              existingRate,
              newRate
            );
          } else {
            // INSERT operation
            await logActivityWithContext(
              user.username,
              'daily_rates',
              'INSERT',
              newRate.id,
              undefined,
              newRate
            );
          }
        }
      }

      setRates(editingRates);
      setIsEditing(false);
      localStorage.setItem(`rates_${selectedDate}`, JSON.stringify(editingRates));
      toast.success('Daily rates updated successfully!');
    } catch (error) {
      console.error('Error saving rates:', error);
      toast.error('Failed to save rates');
    }
  };

  const handleCancel = () => {
    setEditingRates([]);
    setIsEditing(false);
  };

  const updateEditingRate = (index: number, field: 'n_price' | 'o_price', value: string) => {
    const newRates = [...editingRates];
    newRates[index] = {
      ...newRates[index],
      [field]: parseFloat(value) || 0
    };
    setEditingRates(newRates);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <Card className="mb-6 bg-gradient-to-r from-green-900 via-emerald-600 to-green-900 border-0 shadow-xl">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-full">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Daily Rates</h2>
              <p className="text-amber-100 text-sm">Current market prices</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-white" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-white/20 border-white/30 text-white placeholder-white/70 focus:bg-white/30"
                disabled={isEditing}
              />
            </div>
            {!isEditing ? (
              <Button
                onClick={handleEdit}
                size="sm"
                variant="secondary"
                className="bg-white/20 hover:bg-white/30 text-white border-white/30"
              >
                <Edit3 className="h-4 w-4 mr-2" />
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  onClick={handleSave}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
                <Button
                  onClick={handleCancel}
                  size="sm"
                  variant="secondary"
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {(isEditing ? editingRates : rates).map((rate, index) => (
            <div
              key={`${rate.material}_${rate.karat}`}
              className="bg-white/15 backdrop-blur-sm rounded-lg p-4 border border-white/20"
            >
              <h3 className="font-semibold text-white mb-3 text-center">
                {rate.material.charAt(0).toUpperCase() + rate.material.slice(1)} {rate.karat}
              </h3>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-amber-100">New Price</Label>
                  {isEditing ? (
                    <Input
                      type="number"
                      value={rate.n_price}
                      onChange={(e) => updateEditingRate(index, 'n_price', e.target.value)}
                      className="bg-white/20 border-white/30 text-white placeholder-white/50 text-sm"
                      placeholder="0"
                    />
                  ) : (
                    <p className="text-white font-semibold text-lg">
                      {rate.n_price > 0 ? formatCurrency(rate.n_price) : '₹0'}
                    </p>
                  )}
                </div>
                {rate.karat !== '18k' && (
                  <div>
                    <Label className="text-xs text-amber-100">Old Price</Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        value={rate.o_price}
                        onChange={(e) => updateEditingRate(index, 'o_price', e.target.value)}
                        className="bg-white/20 border-white/30 text-white placeholder-white/50 text-sm"
                        placeholder="0"
                      />
                    ) : (
                      <p className="text-amber-100 font-medium">
                        {rate.o_price > 0 ? formatCurrency(rate.o_price) : '₹0'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
