"use client";

import { useUser, useAuth, useFirestore, setDocumentNonBlocking } from "@/firebase";
import { signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, UserCredential } from "firebase/auth";
import { doc } from 'firebase/firestore';
import { Button } from "./ui/button";
import { LogIn, LogOut } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export function AuthManager() {
    const { user, isUserLoading } = useUser();
    const auth = useAuth();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isSigningIn, setIsSigningIn] = useState(false);

    const handleUserCreation = (userCredential: UserCredential) => {
        const user = userCredential.user;
        if (firestore && user) {
            const userDocRef = doc(firestore, "users", user.uid);
            const userData = {
                id: user.uid,
                email: user.email,
            };
            // This is a non-blocking call. We don't wait for it to finish.
            setDocumentNonBlocking(userDocRef, userData, { merge: true });
        }
    };
    
    const handleAuth = async () => {
        if (!email || !password) {
            toast({ variant: "destructive", title: "Missing fields", description: "Please enter email and password." });
            return;
        }
        setIsSigningIn(true);
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            toast({ title: "Signed In", description: `Welcome back!` });
            setIsAuthModalOpen(false);
        } catch (error: any) {
            if (error.code === 'auth/user-not-found') {
                 if (password.length < 6) {
                    toast({ variant: "destructive", title: "Sign-up failed", description: "Password must be at least 6 characters long." });
                    setIsSigningIn(false);
                    return;
                }
                try {
                    const newUserCredential = await createUserWithEmailAndPassword(auth, email, password);
                    handleUserCreation(newUserCredential); // Create user doc in Firestore
                    toast({ title: "Account Created", description: "Welcome to Verse Insights!" });
                    setIsAuthModalOpen(false);
                } catch (signUpError: any) {
                    toast({ variant: "destructive", title: "Sign-up failed", description: signUpError.message });
                }
            } else if (error.code === 'auth/invalid-credential') {
                toast({ variant: "destructive", title: "Sign-in failed", description: "Incorrect email or password. Please try again." });
            }
            else {
                toast({ variant: "destructive", title: "Sign-in failed", description: error.message });
            }
        } finally {
            setIsSigningIn(false);
        }
    };

    if (isUserLoading) {
        return <Button variant="outline" size="sm" disabled>Loading...</Button>;
    }

    if (user) {
        return (
            <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground hidden md:block">{user.email}</p>
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
                    <DialogHeader>
                        <DialogTitle>Sign In or Create Account</DialogTitle>
                        <DialogDescription>Enter your email and password. An account will be created if you don't have one.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="email-auth" className="text-right">Email</Label>
                            <Input id="email-auth" value={email} onChange={(e) => setEmail(e.target.value)} className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="password-auth" className="text-right">Password</Label>
                            <Input id="password-auth" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="col-span-3" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleAuth} disabled={isSigningIn}>{isSigningIn ? "Processing..." : "Continue"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
