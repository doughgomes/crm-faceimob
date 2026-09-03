import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { Lock, Mail, Eye, EyeOff } from "lucide-react";
import logoWhite from "@/assets/logo-faceimob-white.png";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  const handleForgot = async () => {
    const target = email.trim();
    if (!target) return toast({ title: "Informe seu e-mail", description: "Digite o e-mail no campo acima e clique em 'Esqueceu sua senha?'.", variant: "destructive" });
    setSendingReset(true);
    const { error } = await supabase.auth.resetPasswordForEmail(target, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSendingReset(false);
    if (error) return toast({ title: "Falha ao enviar", description: error.message, variant: "destructive" });
    toast({ title: "E-mail enviado", description: "Verifique sua caixa de entrada para redefinir a senha." });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);
    if (error) {
      toast({
        title: "Não foi possível entrar",
        description: "Confira seu e-mail e senha.",
        variant: "destructive",
      });
      return;
    }

    sessionStorage.setItem("faceimob-just-logged", "true");
    navigate("/dashboard");
  };

  return (
    <div className="h-[100svh] w-full flex items-center justify-center bg-background p-4 overflow-hidden">
      <div className="w-full max-w-sm">
        <Card className="border border-border shadow-elevate">
          <CardHeader className="text-center pb-6">
            <div className="mb-4">
              <img src={logoWhite} alt="Faceimob" className="h-10 object-contain mx-auto" />
            </div>
            <CardDescription>
              Acesse sua plataforma de gestão imobiliária
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  className="pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Senha"
                  className="pl-10 pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Entrando..." : "Entrar"}
              </Button>
              <button
                type="button"
                onClick={handleForgot}
                disabled={sendingReset}
                className="w-full text-sm text-muted-foreground hover:text-primary transition-colors disabled:opacity-60"
              >
                {sendingReset ? "Enviando..." : "Esqueceu sua senha?"}
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
