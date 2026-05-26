import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { 
  ServiceDevelopmentData, 
  Territory, 
  TERRITORIES, 
  SERVICE_DEV_METRICS 
} from '@/hooks/useServiceDevelopment';

interface NumberInputProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  useDropdown?: boolean;
  max?: number;
}

const NumberInput = ({ label, value, onChange, useDropdown = false, max = 100 }: NumberInputProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value?.toString() || '');

  // Sync inputValue when value changes externally
  if (!isEditing && inputValue !== (value?.toString() || '') && inputValue !== '') {
    setInputValue(value?.toString() || '');
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    const num = parseFloat(val);
    if (!isNaN(num)) {
      onChange(num);
    } else if (val === '') {
      onChange(0);
    }
  };

  const handleSelectChange = (val: string) => {
    if (val === 'custom') {
      setIsEditing(true);
      return;
    }
    const num = parseInt(val, 10);
    onChange(num);
    setInputValue(num.toString());
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (inputValue === '' || isNaN(parseFloat(inputValue))) {
      setInputValue('0');
    }
  };

  if (useDropdown && !isEditing) {
    return (
      <div className="flex items-center justify-between gap-2 py-1.5">
        <Label className="text-sm flex-1">{label}</Label>
        <div className="w-28">
          <Select value={value?.toString() || '0'} onValueChange={handleSelectChange}>
            <SelectTrigger className="h-8 text-right font-mono text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60 bg-popover">
              {Array.from({ length: max + 1 }, (_, i) => (
                <SelectItem key={i} value={i.toString()}>
                  {i}
                </SelectItem>
              ))}
              <SelectItem value="custom">Type custom...</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <Label className="text-sm flex-1">{label}</Label>
      <div className="relative w-28">
        <Input
          type="number"
          className="h-8 text-right font-mono text-sm"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsEditing(true)}
          onBlur={handleBlur}
        />
      </div>
    </div>
  );
};

interface ServiceDevelopmentSectionProps {
  data: ServiceDevelopmentData;
  updateField: (territory: Territory, metricKey: string, value: number | string) => void;
  comments?: string;
  onCommentsChange?: (value: string) => void;
}

const TERRITORY_COLORS: Record<Territory, { border: string; bg: string; header: string }> = {
  Red: { border: 'border-red-500/30', bg: 'bg-red-500/5', header: 'bg-red-500/10' },
  White: { border: 'border-slate-400/30', bg: 'bg-slate-400/5', header: 'bg-slate-400/10' },
  Blue: { border: 'border-blue-500/30', bg: 'bg-blue-500/5', header: 'bg-blue-500/10' },
};

const TerritoryPanel = ({ 
  territory, 
  data, 
  updateField 
}: { 
  territory: Territory; 
  data: ServiceDevelopmentData; 
  updateField: (territory: Territory, metricKey: string, value: number | string) => void;
}) => {
  const territoryData = data[territory];

  return (
    <div className="space-y-0.5">
      {SERVICE_DEV_METRICS.map(metric => {
        if (metric.type === 'text') {
          return (
            <div key={metric.key} className="flex items-center justify-between gap-2 py-1.5">
              <Label className="text-sm flex-1">{metric.label}</Label>
              <Input
                className="h-8 w-28 text-sm"
                value={(territoryData[metric.key] as string) || ''}
                onChange={(e) => updateField(territory, metric.key, e.target.value)}
              />
            </div>
          );
        }
        return (
          <NumberInput
            key={metric.key}
            label={metric.label}
            value={(territoryData[metric.key] as number) || 0}
            onChange={(v) => updateField(territory, metric.key, v)}
            useDropdown
          />
        );
      })}
    </div>
  );
};

export function ServiceDevelopmentSection({ data, updateField, comments, onCommentsChange }: ServiceDevelopmentSectionProps) {
  return (
    <Card className="border-yellow-500/30 bg-yellow-500/5 col-span-1 lg:col-span-2 xl:col-span-3">
      <CardHeader className="py-3 bg-yellow-500/10">
        <CardTitle className="text-sm font-semibold">Service Development</CardTitle>
      </CardHeader>
      <CardContent className="py-3">
        <Tabs defaultValue="Red" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger 
              value="Red" 
              className="data-[state=active]:bg-red-500/20 data-[state=active]:text-red-700 dark:data-[state=active]:text-red-300"
            >
              Red Territory
            </TabsTrigger>
            <TabsTrigger 
              value="White"
              className="data-[state=active]:bg-slate-400/20 data-[state=active]:text-slate-700 dark:data-[state=active]:text-slate-300"
            >
              White Territory
            </TabsTrigger>
            <TabsTrigger 
              value="Blue"
              className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-300"
            >
              Blue Territory
            </TabsTrigger>
          </TabsList>
          {TERRITORIES.map(territory => (
            <TabsContent key={territory} value={territory} className="mt-0">
              <div className={`rounded-lg p-4 ${TERRITORY_COLORS[territory].border} ${TERRITORY_COLORS[territory].bg}`}>
                <TerritoryPanel 
                  territory={territory} 
                  data={data} 
                  updateField={updateField} 
                />
              </div>
            </TabsContent>
          ))}
        </Tabs>
        
        {/* Comments Section */}
        <div className="mt-4 pt-4 border-t border-yellow-500/20">
          <Label className="text-sm font-medium">Comments</Label>
          <Textarea
            className="mt-2 min-h-[80px]"
            placeholder="Add any notes or comments about service development..."
            value={comments || ''}
            onChange={(e) => onCommentsChange?.(e.target.value)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
