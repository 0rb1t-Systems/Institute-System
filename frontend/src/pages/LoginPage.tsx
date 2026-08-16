import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, LogIn, GraduationCap } from 'lucide-react';
import { getUserMessage } from '@/lib/mapError';
import { MESSAGES } from '@/lib/messages';

const LoginPage = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state?.tenantSuspended) {
      setError(MESSAGES.AUTH.TENANT_SUSPENDED);
    }
  }, [location.state]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    const trimmedIdentifier = identifier.trim();
    const trimmedPassword = password.trim();

    if (!trimmedIdentifier || !trimmedPassword) {
      setError(MESSAGES.AUTH.MISSING_CREDENTIALS);
      return;
    }

    setIsLoading(true);

    try {
      const { user, error: loginError } = await login(trimmedIdentifier, trimmedPassword);
      
      if (loginError || !user) {
          throw loginError || new Error('AUTH.INVALID_CREDENTIALS');
      }

      setIdentifier('');
      setPassword('');

      const userRole = user.role;
      if (userRole === 'super_admin') navigate('/super-admin');
      else if (userRole === 'student') navigate('/student/dashboard');
      else if (userRole === 'instructor') navigate('/instructor/dashboard');
      else if (userRole === 'affiliate') navigate('/affiliate');
      else navigate('/dashboard');
      
    } catch (err) {
      setError(getUserMessage(err, { context: 'LoginPage', fallback: MESSAGES.AUTH.INVALID_CREDENTIALS }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
      <Helmet>
        <title>Portal Login</title>
      </Helmet>

      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-indigo-500/5 blur-[120px]" />
        <div className="absolute bottom-[10%] right-[10%] w-[30%] h-[30%] rounded-full bg-blue-500/5 blur-[100px]" />
      </div>

      <Card className="w-full max-w-md bg-slate-900/80 border-slate-800 backdrop-blur-sm shadow-2xl relative z-10">
        <CardHeader className="space-y-2 text-center pb-8">
          <div className="flex justify-center mb-4">
             <div className="h-12 w-12 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-900/20">
                <GraduationCap className="h-7 w-7 text-white" />
             </div>
          </div>
          <CardTitle className="text-2xl font-bold text-white">Portal Login</CardTitle>
          <CardDescription className="text-slate-400">
            Sign in to your institution dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive" className="bg-red-950/50 border-red-900/50 text-red-200">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="identifier" className="text-slate-200">Email or Student ID</Label>
              <Input
                id="identifier"
                type="text"
                placeholder="e.g. email@example.com or Student ID"
                value={identifier}
                onChange={(e) => { setIdentifier(e.target.value); setError(''); }}
                className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500/20"
                disabled={isLoading}
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-slate-200">Password</Label>
                <Link 
                  to="#" 
                  className="text-xs text-indigo-400 hover:text-indigo-300"
                  onClick={(e) => { e.preventDefault(); setError(MESSAGES.AUTH.FORGOT_PASSWORD); }}
                >
                  Forgot Password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password (or Student ID if new)"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500/20"
                disabled={isLoading}
                required
              />
            </div>
            <div className="pt-2">
              <Button 
                  type="submit" 
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white transition-all" 
                  disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...
                  </>
                ) : (
                  <>Sign In <LogIn className="ml-2 h-4 w-4" /></>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center border-t border-slate-800 pt-6 space-y-3">
             <p className="text-xs text-slate-400 text-center">
                Sign in with your institution email and password.
             </p>
             <p className="text-sm text-slate-300 text-center">
                New institution?{' '}
                <Link to="/create-institution" className="text-indigo-400 hover:text-indigo-300 font-medium">
                  Create institution
                </Link>
             </p>
             <p className="text-xs text-slate-500 text-center space-x-3">
                <Link to="/privacy" className="text-indigo-400 hover:text-indigo-300">Privacy</Link>
                <span>·</span>
                <Link to="/terms" className="text-indigo-400 hover:text-indigo-300">Terms</Link>
             </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default LoginPage;
