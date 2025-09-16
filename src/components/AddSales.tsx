import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, ShoppingCart, Save, Calculator, Plus, Trash2, Package, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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

interface SaleEntry {
  id: string;
  formData: {
    asof_date: string;
    material: string;
    type: string;
    item_name: string;
    tag_no: string;
    customer_name: string;
    customer_phone: string;
    p_grams: string;
    p_purity: string;
    s_purity: string;
    wastage: string;
    s_cost: string;
    o1_gram: string;
    o1_purity: string;
    o2_gram: string;
    o2_purity: string;
  };
  calculations: {
    purchaseCost: number;
    sellingCost: number;
    oldCost: number;
    profit: number;
  };
  timestamp: Date;
}

export const AddSales = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rates, setRates] = useState<DailyRate[]>([]);
  const [showOldMaterials, setShowOldMaterials] = useState(false);
  const [is18Karat, setIs18Karat] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [saleEntries, setSaleEntries] = useState<SaleEntry[]>([]);
  const [basicInfoLocked, setBasicInfoLocked] = useState(false);

  const [formData, setFormData] = useState({
    asof_date: format(new Date(), 'yyyy-MM-dd'),
    material: '',
    type: '',
    item_name: '',
    tag_no: '',
    customer_name: '',
    customer_phone: '',
    p_grams: '',
    p_purity: '',
    s_purity: '',
    wastage: '',
    s_cost: '',
    o1_gram: '',
    o1_purity: '',
    o2_gram: '',
    o2_purity: ''
  });

  useEffect(() => {
    fetchRates();
  }, [formData.asof_date]);

  const fetchRates = async () => {
    // First try to get from localStorage cache
    const cachedRates = localStorage.getItem(`rates_${formData.asof_date}`);
    if (cachedRates) {
      setRates(JSON.parse(cachedRates));
      return;
    }

    // Fetch from database
    const { data, error } = await supabase
      .from('daily_rates')
      .select('*')
      .eq('asof_date', formData.asof_date);

    if (error) {
      console.error('Error fetching rates:', error);
      toast.error('Failed to fetch daily rates');
      return;
    }

    if (data && data.length > 0) {
      const formattedRates = data.map(rate => ({
        material: rate.material,
        karat: rate.karat,
        n_price: rate.n_price,
        o_price: rate.o_price
      }));
      setRates(formattedRates);
    } else {
      setRates([]);
      toast.error('No rates available for selected date. Please set daily rates first.');
    }
  };

  const getRateByMaterialAndKarat = (material: string, karat: string) => {
    return rates.find(rate => rate.material === material && rate.karat === karat);
  };

  const calculatePurchaseCost = () => {
    if (!formData.p_grams || !formData.p_purity || !formData.material) return 0;
    
    const grams = parseFloat(formData.p_grams);
    const purity = parseFloat(formData.p_purity) / 100;
    
    if (formData.material === 'gold') {
      const rate = getRateByMaterialAndKarat('gold', '24k');
      return rate ? rate.n_price * grams * purity : 0;
    } else {
      const rate = getRateByMaterialAndKarat('silver', '');
      return rate ? rate.n_price * grams * purity : 0;
    }
  };

  const calculateSellingCostFromWastage = (wastageValue: string, gramsValue: string) => {
    if (!gramsValue || !wastageValue || formData.material !== 'gold' || formData.type !== 'retail') return 0;
    
    const grams = parseFloat(gramsValue);
    const wastage = parseFloat(wastageValue) / 100;
    const sellingGrams = grams + (grams * wastage);
    const rate = is18Karat ? 
      getRateByMaterialAndKarat('gold', '18k') : 
      getRateByMaterialAndKarat('gold', '22k');
    return rate ? rate.n_price * sellingGrams : 0;
  };

  const calculateSellingCost = () => {
    if (!formData.p_grams || !formData.material) return 0;
    
    const grams = parseFloat(formData.p_grams);
    
    if (formData.material === 'gold') {
      if (formData.type === 'wholesale' && formData.s_purity) {
        const rate = getRateByMaterialAndKarat('gold', '24k');
        const purity = parseFloat(formData.s_purity) / 100;
        return rate ? rate.n_price * grams * purity : 0;
      } else if (formData.type === 'retail') {
        if (formData.s_cost) {
          return parseFloat(formData.s_cost);
        } else if (formData.wastage) {
          return calculateSellingCostFromWastage(formData.wastage, formData.p_grams);
        }
      }
    } else if (formData.material === 'silver') {
      const rate = getRateByMaterialAndKarat('silver', '');
      if (formData.type === 'wholesale' && formData.s_purity) {
        const purity = parseFloat(formData.s_purity) / 100;
        return rate ? rate.n_price * grams * purity : 0;
      } else if (formData.type === 'retail') {
        // Check if user has manually entered a selling cost for silver retail
        if (formData.s_cost) {
          return parseFloat(formData.s_cost);
        } else {
          // Fall back to calculated value if no manual entry
          return rate ? rate.n_price * grams : 0;
        }
      }
    }
  };

  const calculateWastageFromSellingCost = (sellingCostValue: string, gramsValue: string) => {
    if (!sellingCostValue || !gramsValue || formData.material !== 'gold' || formData.type !== 'retail') {
      return 0;
    }
    
    const sellingCost = parseFloat(sellingCostValue);
    const grams = parseFloat(gramsValue);
    const rate = is18Karat ? 
      getRateByMaterialAndKarat('gold', '18k') : 
      getRateByMaterialAndKarat('gold', '22k');
    
    if (!rate || rate.n_price === 0) return 0;
    
    // Formula: wastage% = ((selling_cost / (grams * rate)) - 1) * 100
    const wastage = ((sellingCost / (grams * rate.n_price)) - 1) * 100;
    return wastage;
  };

  const calculateOldCost = () => {
    let totalOldCost = 0;
    
    if (formData.o1_gram && formData.o1_purity) {
      const grams = parseFloat(formData.o1_gram);
      const purity = parseFloat(formData.o1_purity) / 100;
      
      if (formData.material === 'gold') {
        const rate = getRateByMaterialAndKarat('gold', '24k');
        totalOldCost += rate ? rate.o_price * grams * purity : 0;
      } else {
        const rate = getRateByMaterialAndKarat('silver', '');
        totalOldCost += rate ? rate.o_price * grams * purity : 0;
      }
    }
    
    if (formData.o2_gram && formData.o2_purity) {
      const grams = parseFloat(formData.o2_gram);
      const purity = parseFloat(formData.o2_purity) / 100;
      
      if (formData.material === 'gold') {
        const rate = getRateByMaterialAndKarat('gold', '24k');
        totalOldCost += rate ? rate.o_price * grams * purity : 0;
      } else {
        const rate = getRateByMaterialAndKarat('silver', '');
        totalOldCost += rate ? rate.o_price * grams * purity : 0;
      }
    }
    
    return totalOldCost;
  };

  const calculateProfit = () => {
    const sellingCost = calculateSellingCost();
    const purchaseCost = calculatePurchaseCost();
    const oldCost = calculateOldCost();

  
    if (oldCost !== undefined && oldCost !== null) {
      // Explicit formula with old cost
       return (sellingCost - purchaseCost) - oldCost;
    } else {
      // Fallback formula without old cost
      return sellingCost - purchaseCost;
    }
  };


  const resetCostCalculatedFields = () => {
    setFormData(prev => ({
      ...prev,
      s_purity: '',
      wastage: '',
      s_cost: '',
      o1_gram: '',
      o1_purity: '',
      o2_gram: '',
      o2_purity: ''
    }));
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      
      // Reset cost calculated fields when transaction type changes
      if (field === 'type') {
        newData.s_purity = '';
        newData.wastage = '';
        newData.s_cost = '';
      }
      
      // Auto-calculate selling cost when wastage changes (for gold retail)
      if (field === 'wastage' && newData.material === 'gold' && newData.type === 'retail' && value) {
        const calculatedCost = calculateSellingCostFromWastage(value, newData.p_grams);
        newData.s_cost = calculatedCost > 0 ? calculatedCost.toFixed(2) : '';
      }
      
      // Clear selling cost when wastage is cleared
      if (field === 'wastage' && !value && newData.material === 'gold' && newData.type === 'retail') {
        newData.s_cost = '';
      }
      
      return newData;
    });
  };

  const handleSellingCostChange = (value: string) => {
    setFormData(prev => {
      const newData = { ...prev, s_cost: value };
      
      // Auto-calculate wastage when selling cost changes (for gold retail)
      if (newData.material === 'gold' && newData.type === 'retail' && value && newData.p_grams) {
        const calculatedWastage = calculateWastageFromSellingCost(value, newData.p_grams);
        newData.wastage = calculatedWastage.toFixed(2);
      }
      
      // Clear wastage when selling cost is cleared
      if (!value && newData.material === 'gold' && newData.type === 'retail') {
        newData.wastage = '';
      }

      // Handle silver retail manual override - ensure calculated value is overridden
      if (newData.material === 'silver' && newData.type === 'retail') {
        // For silver retail, we simply override the calculated selling cost with user input
        // No additional calculations needed (no wastage for silver)
        newData.s_cost = value;
      }
      
      return newData;
    });
  };

  // Handle 18k checkbox change
  const handle18KaratChange = (checked: boolean) => {
    setIs18Karat(checked);
    
    // Recalculate based on current values using the new karat selection
    if (formData.material === 'gold' && formData.type === 'retail') {
      if (formData.wastage && formData.p_grams) {
        // Recalculate selling cost based on wastage with new karat
        const grams = parseFloat(formData.p_grams);
        const wastage = parseFloat(formData.wastage) / 100;
        const sellingGrams = grams + (grams * wastage);
        const rate = checked ? 
          getRateByMaterialAndKarat('gold', '18k') : 
          getRateByMaterialAndKarat('gold', '22k');
        const calculatedCost = rate ? rate.n_price * sellingGrams : 0;
        
        setFormData(prev => ({
          ...prev,
          s_cost: calculatedCost > 0 ? calculatedCost.toFixed(2) : ''
        }));
      } else if (formData.s_cost && formData.p_grams) {
        // Recalculate wastage based on selling cost with new karat
        const sellingCost = parseFloat(formData.s_cost);
        const grams = parseFloat(formData.p_grams);
        const rate = checked ? 
          getRateByMaterialAndKarat('gold', '18k') : 
          getRateByMaterialAndKarat('gold', '22k');
        
        if (rate && rate.n_price > 0) {
          const wastage = ((sellingCost / (grams * rate.n_price)) - 1) * 100;
          setFormData(prev => ({
            ...prev,
            wastage: wastage.toFixed(2)
          }));
        }
      }
    }
  };

  const checkDuplicateSale = async (asofDate: string, itemName: string, customerName: string, pGrams: number) => {
    try {
      const { data, error } = await supabase
        .from('sales_log')
        .select('inserted_by')
        .eq('asof_date', asofDate)
        .eq('item_name', itemName)
        .eq('customer_name', customerName)
        .eq('p_grams', pGrams)
        .limit(1);

      if (error) {
        console.error('Error checking for duplicate sale:', error);
        throw error;
      }

      // If any rows found, return the first one (duplicate exists)
      if (data && data.length > 0) {
        return data[0];
      }

      // No duplicates found
      return null;
    } catch (error) {
      console.error('Error checking for duplicate sale:', error);
      throw error;
    }
  };

  const addToBatch = () => {
    // Validate basic mandatory information first
    const basicInfoFields = ['asof_date', 'material', 'type', 'customer_name'];
    const missingBasicInfo = basicInfoFields.filter(field => !formData[field as keyof typeof formData]);

    if (missingBasicInfo.length > 0) {
      toast.error('Please fill all basic information (Date, Material, Type, Customer Name) before adding to batch');
      return;
    }

    // Validate all required fields
    const requiredFields = ['material', 'type', 'item_name', 'tag_no', 'customer_name', 'p_grams', 'p_purity'];
    const missingFields = requiredFields.filter(field => !formData[field as keyof typeof formData]);

    if (missingFields.length > 0) {
      toast.error('Please fill all required fields before adding to batch');
      return;
    }

    // Check for duplicates within the batch
    const isDuplicateInBatch = saleEntries.some(entry => 
      entry.formData.item_name === formData.item_name &&
      entry.formData.customer_name === formData.customer_name &&
      parseFloat(entry.formData.p_grams) === parseFloat(formData.p_grams)
    );

    if (isDuplicateInBatch) {
      toast.error(`Duplicate entry detected! This item (${formData.item_name} - ${formData.p_grams}g for ${formData.customer_name}) already exists in the batch.`);
      return;
    }

    // Enable batch mode and lock basic info when first item is added
    setBatchMode(true);
    setBasicInfoLocked(true);

    const newEntry: SaleEntry = {
      id: Date.now().toString(),
      formData: { ...formData },
      calculations: {
        purchaseCost: calculatePurchaseCost(),
        sellingCost: calculateSellingCost(),
        oldCost: calculateOldCost(),
        profit: calculateProfit()
      },
      timestamp: new Date()
    };

    setSaleEntries(prev => [...prev, newEntry]);
    
    // Only clear purchase and selling specific fields, keep customer info and other shared data
    setFormData(prev => ({
      ...prev,
      // Keep these values for the next item
      asof_date: prev.asof_date,
      material: prev.material,
      type: prev.type,
      customer_name: prev.customer_name,
      customer_phone: prev.customer_phone,
      // Reset only purchase and selling specific fields
      item_name: '',
      tag_no: '',
      p_grams: '',
      p_purity: '',
      s_purity: '',
      wastage: '',
      s_cost: '',
      o1_gram: '',
      o1_purity: '',
      o2_gram: '',
      o2_purity: ''
    }));
    
    // Reset component states that are item-specific
    setShowOldMaterials(false);
    setIs18Karat(false);

    toast.success('Item added to batch successfully!');
  };

  const clearBatch = () => {
    setSaleEntries([]);
    setBatchMode(false);
    setBasicInfoLocked(false);
    toast.success('Batch cleared');
  };

  const removeFromBatch = (entryId: string) => {
    setSaleEntries(prev => {
      const newEntries = prev.filter(entry => entry.id !== entryId);
      // If this was the last item, unlock basic info
      if (newEntries.length === 0) {
        setBatchMode(false);
        setBasicInfoLocked(false);
      }
      return newEntries;
    });
    toast.success('Item removed from batch');
  };

  const submitSingleSale = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || rates.length === 0) {
      toast.error('Daily rates not available for selected date');
      return;
    }

    // Validate required fields
    const requiredFields = ['material', 'type', 'item_name', 'tag_no', 'customer_name', 'p_grams', 'p_purity'];
    const missingFields = requiredFields.filter(field => !formData[field as keyof typeof formData]);
    
    if (missingFields.length > 0) {
      toast.error('Please fill all required fields');
      return;
    }

    setIsLoading(true);
    
    // Check for duplicate entry first (outside try-catch to handle errors properly)
    try {
      const duplicateEntry = await checkDuplicateSale(
        formData.asof_date,
        formData.item_name,
        formData.customer_name,
        parseFloat(formData.p_grams)
      );

      if (duplicateEntry) {
        toast.error(`Duplicate entry detected! This sale (${formData.item_name} - ${formData.p_grams}g for ${formData.customer_name}) was already entered by ${duplicateEntry.inserted_by}.`);
        setIsLoading(false);
        return;
      }
    } catch (error) {
      console.error('Error checking for duplicate sale:', error);
      toast.error('Failed to check for duplicate entries. Please try again.');
      setIsLoading(false);
      return;
    }

    try {
      const purchaseCost = calculatePurchaseCost();
      const sellingCost = calculateSellingCost();
      const oldCost = calculateOldCost();
      const profit = calculateProfit();

      const salesData = {
        inserted_by: user.username,
        asof_date: formData.asof_date,
        material: formData.material,
        type: formData.type,
        item_name: formData.item_name,
        tag_no: formData.tag_no,
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone,
        p_grams: parseFloat(formData.p_grams),
        p_purity: parseFloat(formData.p_purity),
        p_cost: purchaseCost,
        s_purity: formData.s_purity ? parseFloat(formData.s_purity) : null,
        wastage: formData.wastage ? parseFloat(formData.wastage) : null,
        s_cost: sellingCost,
        o1_gram: formData.o1_gram ? parseFloat(formData.o1_gram) : null,
        o1_purity: formData.o1_purity ? parseFloat(formData.o1_purity) : null,
        o2_gram: formData.o2_gram ? parseFloat(formData.o2_gram) : null,
        o2_purity: formData.o2_purity ? parseFloat(formData.o2_purity) : null,
        o_cost: oldCost,
        profit: profit
      };

      const { data, error } = await supabase
        .from('sales_log')
        .insert(salesData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Log the activity manually
      await logActivityWithContext(
        user.username,
        'sales_log',
        'INSERT',
        data.id,
        undefined,
        data
      );

      toast.success('Sale recorded successfully!');
    //  navigate('/dashboard');
      // Clear batch and form
      setSaleEntries([]);
      setFormData(prev => ({
        ...prev,
        material: '',
        type: '',
        item_name: '',
        tag_no: '',
        customer_name: '',
        customer_phone: '',
        p_grams: '',
        p_purity: '',
        s_purity: '',
        wastage: '',
        s_cost: '',
        o1_gram: '',
        o1_purity: '',
        o2_gram: '',
        o2_purity: ''
      }));

      setShowOldMaterials(false);
      setIs18Karat(false);
      setBatchMode(false);
      setBasicInfoLocked(false);

    } catch (error) {
      console.error('Error adding batch sales:', error);
      toast.error('Failed to record batch sales');
    } finally {
      setIsLoading(false);
    }
  };

  const submitBatchSales = async () => {
    if (saleEntries.length === 0) {
      toast.error('No items in batch to submit');
      return;
    }

    if (!user || rates.length === 0) {
      toast.error('Daily rates not available for selected date');
      return;
    }

    setIsLoading(true);
    
    // Check for duplicates in all batch entries first (outside try-catch to handle errors properly)
    try {
      const duplicateChecks = await Promise.all(
        saleEntries.map(async (entry) => {
          const duplicateEntry = await checkDuplicateSale(
            entry.formData.asof_date,
            entry.formData.item_name,
            entry.formData.customer_name,
            parseFloat(entry.formData.p_grams)
          );
          return { entry, duplicateEntry };
        })
      );

      // Find any duplicates
      const duplicates = duplicateChecks.filter(check => check.duplicateEntry !== null);
      
      if (duplicates.length > 0) {
        const duplicateMessages = duplicates.map(({ entry, duplicateEntry }) => 
          `${entry.formData.item_name} - ${entry.formData.p_grams}g for ${entry.formData.customer_name} (entered by ${duplicateEntry!.inserted_by})`
        );
        
        toast.error(`Duplicate entries detected! The following items were already entered today:\n${duplicateMessages.join('\n')}`);
        setIsLoading(false);
        return;
      }
    } catch (error) {
      console.error('Error checking for duplicate sales:', error);
      toast.error('Failed to check for duplicate entries. Please try again.');
      setIsLoading(false);
      return;
    }

    try {

      const salesData = saleEntries.map(entry => ({
        inserted_by: user.username,
        asof_date: entry.formData.asof_date,
        material: entry.formData.material,
        type: entry.formData.type,
        item_name: entry.formData.item_name,
        tag_no: entry.formData.tag_no,
        customer_name: entry.formData.customer_name,
        customer_phone: entry.formData.customer_phone,
        p_grams: parseFloat(entry.formData.p_grams),
        p_purity: parseFloat(entry.formData.p_purity),
        p_cost: entry.calculations.purchaseCost,
        s_purity: entry.formData.s_purity ? parseFloat(entry.formData.s_purity) : null,
        wastage: entry.formData.wastage ? parseFloat(entry.formData.wastage) : null,
        s_cost: entry.calculations.sellingCost,
        o1_gram: entry.formData.o1_gram ? parseFloat(entry.formData.o1_gram) : null,
        o1_purity: entry.formData.o1_purity ? parseFloat(entry.formData.o1_purity) : null,
        o2_gram: entry.formData.o2_gram ? parseFloat(entry.formData.o2_gram) : null,
        o2_purity: entry.formData.o2_purity ? parseFloat(entry.formData.o2_purity) : null,
        o_cost: entry.calculations.oldCost,
        profit: entry.calculations.profit
      }));

      const { data, error } = await supabase
        .from('sales_log')
        .insert(salesData)
        .select();

      if (error) {
        throw error;
      }

      // Log activity for each sale
      for (const sale of data) {
        await logActivityWithContext(
          user.username,
          'sales_log',
          'INSERT',
          sale.id,
          undefined,
          sale
        );
      }

      toast.success(`${saleEntries.length} sales recorded successfully!`);

      // Clear batch and form
      setSaleEntries([]);
      setFormData(prev => ({
        ...prev,
        material: '',
        type: '',
        item_name: '',
        tag_no: '',
        customer_name: '',
        customer_phone: '',
        p_grams: '',
        p_purity: '',
        s_purity: '',
        wastage: '',
        s_cost: '',
        o1_gram: '',
        o1_purity: '',
        o2_gram: '',
        o2_purity: ''
      }));

      setShowOldMaterials(false);
      setIs18Karat(false);
      setBatchMode(false);
      setBasicInfoLocked(false);

    } catch (error) {
      console.error('Error adding batch sales:', error);
      toast.error('Failed to record batch sales');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    // If we have batch entries, submit them, otherwise submit single sale
    if (saleEntries.length > 0) {
      submitBatchSales();
    } else {
      submitSingleSale(e);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const canEnterSales = rates.length > 0;

  // Calculate batch totals
  const batchTotals = saleEntries.reduce(
    (totals, entry) => ({
      purchaseCost: totals.purchaseCost + entry.calculations.purchaseCost,
      sellingCost: totals.sellingCost + entry.calculations.sellingCost,
      oldCost: totals.oldCost + entry.calculations.oldCost,
      profit: totals.profit + entry.calculations.profit,
      count: totals.count + 1
    }),
    { purchaseCost: 0, sellingCost: 0, oldCost: 0, profit: 0, count: 0 }
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 p-2 md:p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2 md:gap-4 mb-3 md:mb-6">
          <Button
            onClick={() => navigate('/dashboard')}
            variant="outline"
            size="sm"
            className="border-amber-300 text-amber-700 hover:bg-amber-100"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full">
              <ShoppingCart className="h-5 w-5 md:h-6 md:w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-800">Add Sales</h1>
              <p className="text-sm md:text-base text-slate-600">Record a new sales transaction</p>
            </div>
          </div>
        </div>

        {!canEnterSales && (
          <Card className="mb-3 md:mb-6 bg-red-50 border-red-200">
            <CardContent className="p-3 md:p-4">
              <p className="text-red-700 font-medium text-sm">
                ⚠️ Daily rates are not available for the selected date. Please set the daily rates first before recording sales.
              </p>
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 md:space-y-6">
          {/* Basic Information */}
          <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm relative">
            {basicInfoLocked && (
              <div className="absolute inset-0 bg-slate-300/50 backdrop-blur-sm rounded-lg z-10 flex items-center justify-center">
                <div className="bg-white/90 px-4 py-3 rounded-lg shadow-lg border border-slate-200 flex items-center gap-3">
                  <Lock className="h-5 w-5 text-red-500" />
                  <div>
                    <div className="font-medium text-slate-800">Basic Information Locked</div>
                    <div className="text-sm text-slate-600">Complete or clear batch to edit</div>
                  </div>
                </div>
              </div>
            )}
            <CardHeader className="pb-3 md:pb-6">
              <CardTitle className="text-lg md:text-xl text-slate-800 flex items-center gap-2">
                <Calculator className="h-4 w-4 md:h-5 md:w-5" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 md:space-y-6 pt-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                <div className="space-y-2">
                  <Label htmlFor="asof_date" className="text-slate-700 font-medium">Date *</Label>
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
                  <Label htmlFor="material" className="text-slate-700 font-medium">Material *</Label>
                  <Select value={formData.material} onValueChange={(value) => handleInputChange('material', value)} disabled={isLoading}>
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
                  <Label htmlFor="type" className="text-slate-700 font-medium">Transaction Type *</Label>
                  <Select value={formData.type} onValueChange={(value) => handleInputChange('type', value)} disabled={isLoading}>
                    <SelectTrigger className="border-slate-300 focus:border-green-400 focus:ring-green-400">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wholesale">Wholesale</SelectItem>
                      <SelectItem value="retail">Retail</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-2">
                  <Label htmlFor="customer_name" className="text-slate-700 font-medium">Customer Name *</Label>
                  <Input
                    id="customer_name"
                    type="text"
                    placeholder="Enter customer name"
                    value={formData.customer_name}
                    onChange={(e) => handleInputChange('customer_name', e.target.value)}
                    className="border-slate-300 focus:border-green-400 focus:ring-green-400"
                    disabled={isLoading || !canEnterSales}
                  />
                </div>
                <div className="space-y-2">
                <Label htmlFor="customer_phone" className="text-slate-700 font-medium">Customer Phone</Label>
                  <Input
                    id="customer_phone"
                    type="tel"
                    placeholder="Enter customer phone"
                    value={formData.customer_phone}
                    onChange={(e) => handleInputChange('customer_phone', e.target.value)}
                    className="border-slate-300 focus:border-green-400 focus:ring-green-400"
                    disabled={isLoading || !canEnterSales}
                  />
                </div>
              </div>

              {/* Daily Rates Display */}
              {rates.length > 0 && (
                <div className="mt-4 md:mt-6 p-3 md:p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                    {rates.map((rate, index) => (
                      <div key={index} className="text-center">
                        <span className="text-xs md:text-sm text-slate-600 capitalize">
                          {rate.material} {rate.karat && rate.karat !== '' ? rate.karat : ''}
                        </span>
                        <div className="text-lg md:text-xl font-bold text-slate-800">
                          {formatCurrency(rate.n_price)}
                        </div>
                        {rate.o_price > 0 && rate.o_price !== rate.n_price && (
                          <div className="text-xs md:text-sm text-slate-500">
                            Old: {formatCurrency(rate.o_price)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Purchase & Selling Details */}
          <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm">
            <CardHeader className="pb-3 md:pb-6">
              <CardTitle className="text-lg md:text-xl text-slate-800 flex items-center gap-2">
                <Calculator className="h-4 w-4 md:h-5 md:w-5" />
                Purchase & Selling Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 md:space-y-6 pt-0">
              {/* Purchase Details Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              <div className="space-y-2">
                  <Label htmlFor="item_name" className="text-slate-700 font-medium">Item Name *</Label>
                  <Input
                    id="item_name"
                    type="text"
                    placeholder="Enter item name"
                    value={formData.item_name}
                    onChange={(e) => handleInputChange('item_name', e.target.value)}
                    className="border-slate-300 focus:border-green-400 focus:ring-green-400"
                    disabled={isLoading || !canEnterSales}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tag_no" className="text-slate-700 font-medium">Tag Number *</Label>
                  <Input
                    id="tag_no"
                    type="text"
                    placeholder="Enter unique tag number"
                    value={formData.tag_no}
                    onChange={(e) => handleInputChange('tag_no', e.target.value)}
                    className="border-slate-300 focus:border-green-400 focus:ring-green-400"
                    disabled={isLoading || !canEnterSales}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p_grams" className="text-slate-700 font-medium">Purchase & Selling Grams *</Label>
                  <Input
                    id="p_grams"
                    type="number"
                    step="0.001"
                    placeholder="0.000"
                    value={formData.p_grams}
                    onChange={(e) => handleInputChange('p_grams', e.target.value)}
                    className="border-slate-300 focus:border-green-400 focus:ring-green-400"
                    disabled={isLoading || !canEnterSales}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p_purity" className="text-slate-700 font-medium">Purchase Purity (%) *</Label>
                  <Input
                    id="p_purity"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.p_purity}
                    onChange={(e) => handleInputChange('p_purity', e.target.value)}
                    className="border-slate-300 focus:border-green-400 focus:ring-green-400"
                    disabled={isLoading || !canEnterSales}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">Purchase Cost (Calculated)</Label>
                  <div className="p-3 bg-slate-100 rounded-md text-lg font-semibold text-slate-800">
                    {formatCurrency(calculatePurchaseCost())}
                  </div>
                </div>
              

              {/* Selling Details Row 
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <Label className="text-slate-600 text-sm font-normal">Selling Grams</Label>
                  <div className="px-2 py-1 bg-slate-50 rounded text-sm font-medium text-slate-700 border border-slate-200">
                    {formData.p_grams ? parseFloat(formData.p_grams).toFixed(3) : '0.000'} g
                  </div>
                </div> */}

                {/* Show selling purity for gold/silver wholesale */}
                {((formData.material === 'gold' || formData.material === 'silver') && formData.type === 'wholesale') && (
                  <div className="space-y-2">
                    <Label htmlFor="s_purity" className="text-slate-700 font-medium">Selling Purity (%)</Label>
                    <Input
                      id="s_purity"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.s_purity}
                      onChange={(e) => handleInputChange('s_purity', e.target.value)}
                      className="border-slate-300 focus:border-green-400 focus:ring-green-400"
                      disabled={isLoading || !canEnterSales}
                    />
                  </div>
                )}

                {/* Show 18k checkbox for gold retail */}
                {(formData.material === 'gold' && formData.type === 'retail') && (
                  <div className="flex items-center space-x-2 pt-6">
                    <Checkbox
                      id="is18k"
                      checked={is18Karat}
                      onCheckedChange={handle18KaratChange}
                      disabled={isLoading || !canEnterSales}
                    />
                    <Label htmlFor="is18k" className="text-slate-700 font-medium">
                      Selling 18 Karat
                    </Label>
                  </div>
                )}
              </div>

              {/* Wastage and Selling Cost for Gold Retail */}
              {(formData.material === 'gold' && formData.type === 'retail') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="wastage" className="text-slate-700 font-medium">Wastage (%)</Label>
                    <Input
                      id="wastage"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.wastage}
                      onChange={(e) => handleInputChange('wastage', e.target.value)}
                      className="border-slate-300 focus:border-green-400 focus:ring-green-400"
                      disabled={isLoading || !canEnterSales}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="s_cost_input" className="text-slate-700 font-medium">Selling Cost</Label>
                    <Input
                      id="s_cost_input"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.s_cost}
                      onChange={(e) => handleSellingCostChange(e.target.value)}
                      className="border-slate-300 focus:border-green-400 focus:ring-green-400 text-lg font-semibold"
                      disabled={isLoading || !canEnterSales}
                    />
                  </div>
                </div>
              )}

              {/* Selling Cost for Silver Retail */}
              {(formData.material === 'silver' && formData.type === 'retail') && (
                <div className="space-y-2">
                  <Label htmlFor="s_cost_silver" className="text-slate-700 font-medium">Selling Cost</Label>
                  <div className="relative">
                    <Input
                      id="s_cost_silver"
                      type="number"
                      step="0.01"
                      placeholder={calculateSellingCost() > 0 ? calculateSellingCost().toString() : "0.00"}
                      value={formData.s_cost || (calculateSellingCost() > 0 ? calculateSellingCost().toString() : "")}
                      onChange={(e) => handleSellingCostChange(e.target.value)}
                      className="border-slate-300 focus:border-green-400 focus:ring-green-400 text-lg font-semibold pr-16"
                      disabled={isLoading || !canEnterSales}
                    />
                    {(!formData.s_cost || formData.s_cost === "") && calculateSellingCost() > 0 && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-slate-500 font-normal">
                        {formatCurrency(calculateSellingCost())}
                      </div>
                    )}
                  </div>
                  {(!formData.s_cost || formData.s_cost === "") && calculateSellingCost() > 0 && (
                    <p className="text-sm text-slate-600">
                      Calculated: {formatCurrency(calculateSellingCost())} - You can override this value
                    </p>
                  )}
                </div>
              )}

              {/* Selling Cost for non-gold/non-silver retail or non-retail */}
              {!(formData.material === 'gold' && formData.type === 'retail') && !(formData.material === 'silver' && formData.type === 'retail') && (
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">Selling Cost (Calculated)</Label>
                  <div className="p-3 bg-slate-100 rounded-md text-lg font-semibold text-slate-800">
                    {formatCurrency(calculateSellingCost())}
                  </div>
                </div>
              )}
            </CardContent>

            {/* Add to Batch Button - Always visible */}
            <div className="p-4 bg-slate-50 border-t border-slate-200">
              <Button
                onClick={(e) => {
                  e.preventDefault();
                  addToBatch();
                }}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold"
                disabled={isLoading || !canEnterSales}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add to Batch
              </Button>
            </div>
            </Card>

          {/* Old Materials */}
          <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm">
            <CardHeader className="pb-3 md:pb-6">
              <CardTitle className="text-lg md:text-xl text-slate-800 flex items-center justify-between">
                Old Materials
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="showOldMaterials"
                    checked={showOldMaterials}
                    onCheckedChange={(checked) => {
                      setShowOldMaterials(checked as boolean);
                      // Reset old material fields when unchecking
                      if (!checked) {
                        setFormData(prev => ({
                          ...prev,
                          o1_gram: '',
                          o1_purity: '',
                          o2_gram: '',
                          o2_purity: ''
                        }));
                      }
                    }}
                    disabled={isLoading || !canEnterSales}
                  />
                  <Label htmlFor="showOldMaterials" className="text-xs md:text-sm font-normal">
                    Add Old Materials
                  </Label>
                </div>
              </CardTitle>
            </CardHeader>
            {showOldMaterials && (
              <CardContent className="space-y-4 md:space-y-6 pt-0">
                {/* Old Material 1 */}
                <div>
                  <h4 className="text-base md:text-lg font-medium text-slate-700 mb-3 md:mb-4">Old Material 1</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="o1_gram" className="text-slate-700 font-medium">Old Grams</Label>
                      <Input
                        id="o1_gram"
                        type="number"
                        step="0.001"
                        placeholder="0.000"
                        value={formData.o1_gram}
                        onChange={(e) => handleInputChange('o1_gram', e.target.value)}
                        className="border-slate-300 focus:border-green-400 focus:ring-green-400"
                        disabled={isLoading || !canEnterSales}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="o1_purity" className="text-slate-700 font-medium">Old Purity (%)</Label>
                      <Input
                        id="o1_purity"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.o1_purity}
                        onChange={(e) => handleInputChange('o1_purity', e.target.value)}
                        className="border-slate-300 focus:border-green-400 focus:ring-green-400"
                        disabled={isLoading || !canEnterSales}
                      />
                    </div>
                  </div>
                </div>

                {/* Old Material 2 */}
                <div>
                  <h4 className="text-base md:text-lg font-medium text-slate-700 mb-3 md:mb-4">Old Material 2</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="o2_gram" className="text-slate-700 font-medium">Old Grams</Label>
                      <Input
                        id="o2_gram"
                        type="number"
                        step="0.001"
                        placeholder="0.000"
                        value={formData.o2_gram}
                        onChange={(e) => handleInputChange('o2_gram', e.target.value)}
                        className="border-slate-300 focus:border-green-400 focus:ring-green-400"
                        disabled={isLoading || !canEnterSales}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="o2_purity" className="text-slate-700 font-medium">Old Purity (%)</Label>
                      <Input
                        id="o2_purity"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.o2_purity}
                        onChange={(e) => handleInputChange('o2_purity', e.target.value)}
                        className="border-slate-300 focus:border-green-400 focus:ring-green-400"
                        disabled={isLoading || !canEnterSales}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">Total Old Cost (Calculated)</Label>
                  <div className="p-3 bg-slate-100 rounded-md text-lg font-semibold text-slate-800">
                    {formatCurrency(calculateOldCost())}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Summary */}
          <Card className="shadow-xl border-0 bg-gradient-to-r from-green-50 to-emerald-50">
            <CardHeader className="pb-3 md:pb-6">
              <CardTitle className="text-lg md:text-xl text-slate-800">Transaction Summary</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6 text-center">
                <div>
                  <p className="text-sm text-slate-600">Purchase Cost</p>
                  <p className="text-lg font-bold text-slate-800">{formatCurrency(calculatePurchaseCost())}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Selling Cost</p>
                  <p className="text-lg font-bold text-slate-800">{formatCurrency(calculateSellingCost())}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Old Cost</p>
                  <p className="text-lg font-bold text-slate-800">{formatCurrency(calculateOldCost())}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Profit</p>
                  <p className={`text-xl font-bold ${calculateProfit() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(calculateProfit())}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Submit Buttons - Only for single sales */}
          <div className="flex gap-2 md:gap-4 pt-3 md:pt-4">
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
              className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold"
              disabled={isLoading || !canEnterSales || saleEntries.length > 0}
            >
              <Save className="h-4 w-4 mr-2" />
              {isLoading ? 'Completing...' : 'Complete Sales'}
            </Button>
            {saleEntries.length > 0 && (
              <Button
                type="button"
                onClick={submitBatchSales}
                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold"
                disabled={isLoading}
              >
                <Save className="h-4 w-4 mr-2" />
                Complete Batch ({saleEntries.length})
              </Button>
            )}
          </div>
        </form>

        {/* Batch Entries Display */}
        {saleEntries.length > 0 && (
          <Card className="mt-4 md:mt-6 shadow-xl border-0 bg-white/90 backdrop-blur-sm">
            <CardHeader className="pb-3 md:pb-6">
              <CardTitle className="text-lg md:text-xl text-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 md:h-5 md:w-5" />
                  Batch Entries ({saleEntries.length})
                </div>
                <Button
                  onClick={clearBatch}
                  variant="outline"
                  size="sm"
                  className="border-red-300 text-red-700 hover:bg-red-50"
                  disabled={isLoading}
                >
                  Clear All
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 md:space-y-4 pt-0">
              {saleEntries.map((entry, index) => (
                <div key={entry.id} className="border border-slate-200 rounded-lg p-3 md:p-4 bg-slate-50">
                  <div className="flex items-center justify-between mb-2 md:mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs md:text-sm font-medium text-slate-600">Item {index + 1}</span>
                      <span className="text-xs text-slate-500">
                        {entry.formData.item_name} - {entry.formData.p_grams}g
                      </span>
                    </div>
                    <Button
                      onClick={() => removeFromBatch(entry.id)}
                      variant="outline"
                      size="sm"
                      className="border-red-300 text-red-600 hover:bg-red-50 h-7 w-7 p-0"
                      disabled={isLoading}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 text-xs md:text-sm">
                    <div>
                      <span className="text-slate-600">Purchase:</span>
                      <div className="font-semibold text-slate-800 text-sm md:text-base">{formatCurrency(entry.calculations.purchaseCost)}</div>
                    </div>
                    <div>
                      <span className="text-slate-600">Selling:</span>
                      <div className="font-semibold text-slate-800 text-sm md:text-base">{formatCurrency(entry.calculations.sellingCost)}</div>
                    </div>
                    <div>
                      <span className="text-slate-600">Old Cost:</span>
                      <div className="font-semibold text-slate-800 text-sm md:text-base">{formatCurrency(entry.calculations.oldCost)}</div>
                    </div>
                    <div>
                      <span className="text-slate-600">Profit:</span>
                      <div className={`font-semibold text-sm md:text-base ${entry.calculations.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(entry.calculations.profit)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-2 text-xs text-slate-500">
                    Customer: {entry.formData.customer_name} | Tag: {entry.formData.tag_no}
                  </div>
                </div>
              ))}
              
              {/* Batch Totals */}
              <div className="border-t border-slate-300 pt-3 md:pt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 text-center">
                  <div>
                    <p className="text-xs md:text-sm text-slate-600">Total Purchase Cost</p>
                    <p className="text-base md:text-lg font-bold text-slate-800">{formatCurrency(batchTotals.purchaseCost)}</p>
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-slate-600">Total Selling Cost</p>
                    <p className="text-base md:text-lg font-bold text-slate-800">{formatCurrency(batchTotals.sellingCost)}</p>
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-slate-600">Total Old Cost</p>
                    <p className="text-base md:text-lg font-bold text-slate-800">{formatCurrency(batchTotals.oldCost)}</p>
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-slate-600">Total Profit</p>
                    <p className={`text-base md:text-lg font-bold ${batchTotals.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(batchTotals.profit)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
            
            {/* Complete Batch Button */}
            <div className="p-3 md:p-4 bg-slate-100">
              <Button
                onClick={submitBatchSales}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold"
                disabled={isLoading}
              >
                <Save className="h-4 w-4 mr-2" />
                {isLoading ? 'Completing Batch...' : `Complete All ${saleEntries.length} Sales`}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};