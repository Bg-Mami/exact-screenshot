import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, XCircle, Scan, Volume2, VolumeX, Users, Minus, Plus } from "lucide-react";
import { toast } from "sonner";

interface Museum {
  id: string;
  name: string;
}

interface ValidationResult {
  valid: boolean;
  message: string;
  ticket_info?: {
    type: string;
    museum: string;
    remaining_credits: number;
    credits_used: number;
  };
}

const GateControl = () => {
  const { isAdmin, profile } = useAuth();
  const [museums, setMuseums] = useState<Museum[]>([]);
  const [selectedMuseum, setSelectedMuseum] = useState<string>("");
  const [qrInput, setQrInput] = useState("");
  const [creditsToUse, setCreditsToUse] = useState(1);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Audio refs
  const successAudioRef = useRef<HTMLAudioElement | null>(null);
  const errorAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Create audio elements
    successAudioRef.current = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Onbeyxsu2oI12W0pFTF5wgZujrKyomYp5aVxXW2h3ho+WmJSOg3VqYV9mbHR7gYWHhoN9d3JvbW5wc3Z5fH19fHt5d3V0c3Jxb25tbGtqaWhnZmVkY2JhYF9eXVxbWllYV1ZVVFNSUVBPTk1MS0pJSEdGRURDQkFAPz49PDs6OTg3NjU0MzIxMC8uLSwrKikoJyYlJCMiISAfHh0cGxoZGBcWFRQTEhEQDw4NDAsKCQgHBgUEAwIBAA==");
    errorAudioRef.current = new Audio("data:audio/wav;base64,UklGRl9vT19teleQsqqzsqqgsqqnlaOjnpqhnpyeoZuZmJiYl5aVlJOSkZCPjo2Mi4qJiIeGhYSDgoGAf359fHt6eXh3dnV0c3JxcG9ubWxramloZ2ZlZGNiYWBfXl1cW1pZWFdWVVRTUlFQT05NTEtKSUhHRkVEQ0JBQD8+PTw7Ojk4NzY1NDMyMTAvLi0sKyopKCcmJSQjIiEgHx4dHBsaGRgXFhUUExIREA8ODQwLCgkIBwYFBAMCAQA=");
  }, []);

  useEffect(() => {
    fetchMuseums();
  }, []);

  useEffect(() => {
    // Auto-select museum for non-admin users
    if (!isAdmin && profile?.assigned_museum_id) {
      setSelectedMuseum(profile.assigned_museum_id);
    }
  }, [isAdmin, profile]);

  useEffect(() => {
    // Keep focus on input for barcode scanner
    if (inputRef.current && !isProcessing) {
      inputRef.current.focus();
    }
  }, [validationResult, isProcessing]);

  const fetchMuseums = async () => {
    const { data } = await supabase
      .from('museums')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    
    if (data) setMuseums(data);
  };

  const playSound = (success: boolean) => {
    if (!soundEnabled) return;
    
    const audio = success ? successAudioRef.current : errorAudioRef.current;
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
  };

  const validateTicket = async (qrCode: string) => {
    if (!selectedMuseum) {
      toast.error("Lütfen önce müze seçin");
      return;
    }

    if (!qrCode.trim()) return;

    setIsProcessing(true);
    setValidationResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('validate-ticket-api', {
        body: { 
          qr_code: qrCode.trim(), 
          museum_id: selectedMuseum,
          credits_to_use: creditsToUse
        }
      });

      if (error) throw error;

      setValidationResult(data);
      playSound(data.valid);
      
      if (data.valid) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }

    } catch (error) {
      console.error('Validation error:', error);
      setValidationResult({
        valid: false,
        message: 'Doğrulama sırasında hata oluştu'
      });
      playSound(false);
    } finally {
      setIsProcessing(false);
      setQrInput("");
      // Reset after 3 seconds
      setTimeout(() => {
        setValidationResult(null);
        setCreditsToUse(1);
      }, 3000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      validateTicket(qrInput);
    }
  };

  const adjustCredits = (delta: number) => {
    setCreditsToUse(prev => Math.max(1, prev + delta));
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Geçiş Kontrol</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </Button>
        </div>

        {/* Museum Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Müze Seçimi</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedMuseum} onValueChange={setSelectedMuseum} disabled={!isAdmin && !!profile?.assigned_museum_id}>
              <SelectTrigger>
                <SelectValue placeholder="Müze seçin..." />
              </SelectTrigger>
              <SelectContent>
                {museums.map(museum => (
                  <SelectItem key={museum.id} value={museum.id}>
                    {museum.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Credits Control */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Kullanılacak Kontör
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => adjustCredits(-1)}
                disabled={creditsToUse <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="text-4xl font-bold w-20 text-center">{creditsToUse}</span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => adjustCredits(1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-center text-muted-foreground text-sm mt-2">
              Grup biletlerinde kaç kişi geçecekse o kadar kontör seçin
            </p>
          </CardContent>
        </Card>

        {/* QR Input */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Scan className="h-5 w-5" />
              QR Kod Okut
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="qr-input">Barkod okuyucu veya manuel giriş</Label>
              <Input
                id="qr-input"
                ref={inputRef}
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="QR kodu okutun veya yazın..."
                disabled={isProcessing || !selectedMuseum}
                autoFocus
                autoComplete="off"
              />
              <Button 
                onClick={() => validateTicket(qrInput)} 
                disabled={isProcessing || !qrInput || !selectedMuseum}
                className="w-full"
              >
                {isProcessing ? "Kontrol ediliyor..." : "Doğrula"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Result Display */}
        {validationResult && (
          <Card className={`border-4 ${validationResult.valid ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-red-500 bg-red-50 dark:bg-red-950'}`}>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center space-y-4">
                {validationResult.valid ? (
                  <CheckCircle className="h-32 w-32 text-green-500" />
                ) : (
                  <XCircle className="h-32 w-32 text-red-500" />
                )}
                
                <h2 className={`text-3xl font-bold ${validationResult.valid ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                  {validationResult.valid ? 'GEÇİŞ SERBEST' : 'GEÇİŞ REDDEDİLDİ'}
                </h2>
                
                <p className="text-xl text-center">{validationResult.message}</p>
                
                {validationResult.ticket_info && (
                  <div className="text-center space-y-1 text-muted-foreground">
                    <p>Bilet Türü: <span className="font-medium">{validationResult.ticket_info.type}</span></p>
                    <p>Kullanılan Kontör: <span className="font-medium">{validationResult.ticket_info.credits_used}</span></p>
                    <p>Kalan Kontör: <span className="font-medium">{validationResult.ticket_info.remaining_credits}</span></p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card className="bg-muted/50">
          <CardContent className="pt-4">
            <h3 className="font-medium mb-2">Kullanım Talimatları</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Barkod okuyucu ile QR kodu okutun, otomatik doğrulama yapılır</li>
              <li>• Grup biletlerinde geçecek kişi sayısı kadar kontör seçin</li>
              <li>• Yeşil ekran = Geçiş serbest, turnike açılabilir</li>
              <li>• Kırmızı ekran = Geçiş reddedildi</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GateControl;
