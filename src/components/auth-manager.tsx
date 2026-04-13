
'use client';

import {
  useUser,
  useAuth,
  useFirestore,
  setDocumentNonBlocking,
} from '@/firebase';
import {
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  type UserCredential,
} from 'firebase/auth';
import { doc } from 'firebase/firestore';
import { Button } from './ui/button';
import { LogIn, LogOut } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Logo } from './logo';

export function AuthManager() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  
  // Separate state for sign-in
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  
  // Separate state for sign-up
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');

  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('signin');

  useEffect(() => {
    if (!isAuthModalOpen) {
      // Delay to allow fade-out animation to complete before clearing state
      setTimeout(() => {
        setSignInEmail('');
        setSignInPassword('');
        setSignUpEmail('');
        setSignUpPassword('');
        setActiveTab('signin');
        setIsProcessing(false);
      }, 300);
    }
  }, [isAuthModalOpen]);


  const handleUserDocCreation = (userCredential: UserCredential) => {
    const user = userCredential.user;
    if (firestore && user) {
      const userDocRef = doc(firestore, 'users', user.uid);
      const userData = {
        id: user.uid,
        email: user.email,
      };
      setDocumentNonBlocking(userDocRef, userData, { merge: true });
    }
  };

  const handleSignIn = () => {
    if (!signInEmail || !signInPassword) {
      toast({
        variant: 'destructive',
        title: 'Missing fields',
        description: 'Please enter both email and password.',
      });
      return;
    }
    setIsProcessing(true);
    signInWithEmailAndPassword(auth, signInEmail, signInPassword)
      .then(() => {
        toast({ title: 'Signed In', description: `Welcome back, ${signInEmail}!` });
        setIsAuthModalOpen(false);
      })
      .catch((error: any) => {
        if (
          error.code === 'auth/invalid-credential' ||
          error.code === 'auth/wrong-password' ||
          error.code === 'auth/user-not-found'
        ) {
          toast({
            variant: 'destructive',
            title: 'Sign-in failed',
            description: 'Incorrect email or password. Please try again.',
          });
        } else {
          toast({
            variant: 'destructive',
            title: 'Authentication failed',
            description: error.message,
          });
        }
      })
      .finally(() => {
        setIsProcessing(false);
      });
  };

  const handleSignUp = () => {
    if (!signUpEmail || !signUpPassword) {
        toast({
            variant: "destructive",
            title: "Missing fields",
            description: "Please enter both email and password."
        });
        return;
    }
    if (signUpPassword.length < 6) {
        toast({
            variant: "destructive",
            title: "Sign-up failed",
            description: "Password must be at least 6 characters long."
        });
        return;
    }
    setIsProcessing(true);
    createUserWithEmailAndPassword(auth, signUpEmail, signUpPassword)
        .then((newUserCredential) => {
            handleUserDocCreation(newUserCredential);
            toast({ title: "Account Created!", description: `Welcome to The Sword and Pen, ${signUpEmail}!` });
            setIsAuthModalOpen(false);
        })
        .catch((error: any) => {
            if (error.code === 'auth/email-already-in-use') {
                toast({
                    variant: "destructive",
                    title: "Sign-up failed",
                    description: "This email is already in use. Try signing in instead."
                });
            } else {
                toast({
                    variant: "destructive",
                    title: "Sign-up failed",
                    description: error.message
                });
            }
        })
        .finally(() => {
            setIsProcessing(false);
        });
  };

  if (isUserLoading) {
    return (
      <Button variant="outline" size="sm" disabled>
        Loading...
      </Button>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <p className="hidden text-sm text-muted-foreground md:block">
          {user.email}
        </p>
        <Button variant="ghost" size="icon" onClick={() => signOut(auth)}>
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button variant="outline" onClick={() => setIsAuthModalOpen(true)}>
        <LogIn className="mr-2" />
        Sign In
      </Button>
      <Dialog open={isAuthModalOpen} onOpenChange={setIsAuthModalOpen}>
        <DialogContent>
          <DialogHeader className="flex flex-col items-center">
            <Logo className="h-12 w-12 text-primary mb-2" />
            <DialogTitle className="text-xl font-headline font-bold">The Sword and Pen</DialogTitle>
            <DialogDescription className="text-center">
              Sign in or create an account to save your personal notes and highlights.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="email-signin" className="text-right">
                    Email
                  </Label>
                  <Input
                    id="email-signin"
                    type="email"
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="password-signin" className="text-right">
                    Password
                  </Label>
                  <Input
                    id="password-signin"
                    type="password"
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    className="col-span-3"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleSignIn} disabled={isProcessing} className="w-full">
                  {isProcessing ? 'Signing In...' : 'Sign In'}
                </Button>
              </DialogFooter>
            </TabsContent>
            <TabsContent value="signup">
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="email-signup" className="text-right">
                        Email
                    </Label>
                    <Input
                        id="email-signup"
                        type="email"
                        value={signUpEmail}
                        onChange={(e) => setSignUpEmail(e.target.value)}
                        className="col-span-3"
                    />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="password-signup" className="text-right">
                        Password
                    </Label>
                    <Input
                        id="password-signup"
                        type="password"
                        value={signUpPassword}
                        onChange={(e) => setSignUpPassword(e.target.value)}
                        className="col-span-3"
                    />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSignUp} disabled={isProcessing} className="w-full">
                        {isProcessing ? 'Creating Account...' : 'Create Account'}
                    </Button>
                </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
