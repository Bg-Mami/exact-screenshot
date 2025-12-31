import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { useTicketStore } from '@/store/ticketStore';
import { TICKET_TYPES } from '@/types/ticket';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QrCode, CheckCircle2, XCircle, Scan } from 'lucide-react';
import { cn } from '@/lib/utils';

const ValidateTicket = () => {
  const [inputCode, setInputCode] = useState('');
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    message: string;
    ticketType?: string;
  } | null>(null);
  const { validateTicket } = useTicketStore();

  const handleValidate = () => {
    if (!inputCode.trim()) return;
    
    const result = validateTicket(inputCode.trim().toUpperCase());
    
    if (result.ticket) {
      const typeInfo = TICKET_TYPES.find(t => t.type === result.ticket!.type);
      setValidationResult({
        valid: result.valid,
        message: result.message,
        ticketType: typeInfo?.label,
      });
    } else {
      setValidationResult({
        valid: false,
        message: result.message,
      });
    }

    // Auto-clear after 5 seconds
    setTimeout(() => {
      setValidationResult(null);
      setInputCode('');
    }, 5000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleValidate();
    }
  };

  return (
    <Layout>
      <div className="space-y-8 max-w-2xl mx-auto">
        {/* Header */}
        <div className="animate-fade-in text-center">
          <h1 className="text-3xl font-bold text-foreground">Bilet Doğrulama</h1>
          <p className="text-muted-foreground mt-1">
            Turnike için QR kod veya bilet kodunu girin
          </p>
        </div>

        {/* Validation Result */}
        {validationResult ? (
          <div className={cn(
            "p-8 rounded-3xl text-center animate-scale-in",
            validationResult.valid 
              ? "bg-success text-success-foreground" 
              : "bg-destructive text-destructive-foreground"
          )}>
            <div className="mb-4">
              {validationResult.valid ? (
                <CheckCircle2 className="w-24 h-24 mx-auto animate-bounce" />
              ) : (
                <XCircle className="w-24 h-24 mx-auto animate-pulse" />
              )}
            </div>
            <h2 className="text-2xl font-bold mb-2">
              {validationResult.valid ? 'GİRİŞ ONAYLANDI' : 'GİRİŞ REDDEDİLDİ'}
            </h2>
            <p className="text-lg opacity-90">{validationResult.message}</p>
            {validationResult.ticketType && (
              <p className="mt-2 text-sm opacity-80">
                Bilet Türü: {validationResult.ticketType}
              </p>
            )}
          </div>
        ) : (
          /* Input Form */
          <div className="space-y-6 animate-slide-up">
            {/* Scanner Simulation */}
            <div className="bg-card rounded-3xl border border-border p-8 text-center">
              <div className="w-48 h-48 mx-auto mb-6 border-4 border-dashed border-primary/30 rounded-2xl flex items-center justify-center bg-primary/5">
                <div className="text-center">
                  <Scan className="w-16 h-16 mx-auto text-primary/50 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    QR Kod Tarayıcı
                  </p>
                </div>
              </div>
              
              <p className="text-muted-foreground mb-6">
                veya bilet kodunu manuel olarak girin
              </p>

              <div className="flex gap-3 max-w-md mx-auto">
                <div className="relative flex-1">
                  <QrCode className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="TKT-XXXXXXXXXXXX"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                    onKeyPress={handleKeyPress}
                    className="pl-12 h-14 text-lg font-mono uppercase"
                  />
                </div>
                <Button 
                  size="lg" 
                  onClick={handleValidate}
                  disabled={!inputCode.trim()}
                  className="px-8 gradient-primary border-0"
                >
                  Doğrula
                </Button>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-secondary/50 rounded-2xl p-6">
              <h3 className="font-semibold text-foreground mb-3">Kullanım</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  QR kod okuyucuyu biletteki koda tutun
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Veya bilet kodunu (TKT-...) manuel olarak girin
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Yeşil onay = Giriş serbest, Kırmızı = Giriş yasak
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Her bilet sadece bir kez kullanılabilir
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ValidateTicket;
