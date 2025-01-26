'use client';

import { useState } from 'react';
import { Keypair } from '@solana/web3.js';
import { useRef, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Loader2, Copy, Key, Wallet, AlertTriangle, StopCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface GeneratedKeypair {
  publicKey: string;
  secretKey: number[];
}

export default function Home() {
  const workersRef = useRef<Worker[]>([]);
  const displayedAttemptsRef = useRef(0);
  const [displayedAttempts, setDisplayedAttempts] = useState(0);
  const [type, setType] = useState<'prefix' | 'suffix'>('prefix');
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const animationFrameRef = useRef<number>();
  const [generatedKeypair, setGeneratedKeypair] = useState<GeneratedKeypair | null>(null);
  const [threadCount, setThreadCount] = useState(4); // Default to 4 threads
  const { toast } = useToast();
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [estimatedTime, setEstimatedTime] = useState('');

  useEffect(() => {
    const updateDisplayedAttempts = () => {
      if (displayedAttemptsRef.current !== attempts) {
        const diff = attempts - displayedAttemptsRef.current;
        const increment = Math.ceil(diff / 10); // Smooth over ~10 frames
        displayedAttemptsRef.current = Math.min(
          displayedAttemptsRef.current + increment,
          attempts
        );
        setDisplayedAttempts(displayedAttemptsRef.current);
        
        if (displayedAttemptsRef.current < attempts) {
          animationFrameRef.current = requestAnimationFrame(updateDisplayedAttempts);
        }
      }
    };

    animationFrameRef.current = requestAnimationFrame(updateDisplayedAttempts);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [attempts]);

  const terminateAllWorkers = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    workersRef.current.forEach(worker => worker.terminate());
    workersRef.current = [];
  };

  const handleGenerate = async () => {
    const pattern = type === 'prefix' ? prefix : suffix;
    
    if (!pattern) {
      toast({
        title: 'Input Required',
        description: `Please enter a ${type}`,
        variant: 'destructive',
      });
      return;
    }

    // Calculate estimated time for any pattern
    const possibleCharsPerPosition = caseSensitive ? 58 : 34;
    const timeInSeconds = Math.pow(possibleCharsPerPosition, pattern.length) / (threadCount * 1000);
    
    // Show warning if estimated time is more than 1 minute
    if (timeInSeconds > 600) {
      const timeString = timeInSeconds > 3600 
        ? `${(timeInSeconds / 3600).toFixed(1)} hours` 
        : timeInSeconds > 60 
          ? `${(timeInSeconds / 60).toFixed(1)} minutes` 
          : `${timeInSeconds.toFixed(1)} seconds`;
      setEstimatedTime(timeString);
      setShowWarningDialog(true);
      return;
    }

    startGeneration();
  };

  const startGeneration = () => {
    setIsGenerating(true);
    setAttempts(0);
    setDisplayedAttempts(0);
    displayedAttemptsRef.current = 0;
    setGeneratedKeypair(null);
    terminateAllWorkers();
    
    try {
      let totalAttempts = 0;
      
      // Create multiple workers
      for (let i = 0; i < threadCount; i++) {
        const worker = new Worker(new URL('../lib/vanity.worker.ts', import.meta.url));
        workersRef.current.push(worker);

        worker.onmessage = (e) => {
          const { type, attempts: workerAttempts, publicKey, secretKey } = e.data;
          
          if (type === 'progress') {
            totalAttempts += workerAttempts;
            setAttempts(totalAttempts);
          } else if (type === 'complete') {
            setGeneratedKeypair({ publicKey, secretKey });
            setAttempts(prev => prev + workerAttempts);
            setIsGenerating(false);
            terminateAllWorkers();
          }
        };

        // Start each worker with a different starting index
        worker.postMessage({
          prefix: type === 'prefix' ? prefix : '',
          suffix: type === 'suffix' ? suffix : '',
          caseSensitive,
          startIndex: i * 1000 // Offset starting point to avoid duplicate work
        });

        worker.onerror = () => {
          throw new Error('Worker error');
        };
      }
    } catch (error) {
      console.error('Setup error:', error);
      setIsGenerating(false);
      terminateAllWorkers();
      toast({
        title: 'Error',
        description: 'Failed to generate address. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const stopGeneration = () => {
    if (workersRef.current.length > 0) {
      terminateAllWorkers();
      setIsGenerating(false);
      toast({
        title: 'Stopped',
        description: 'Address generation stopped',
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: 'Address copied to clipboard',
    });
  };

  const handleWarningConfirm = () => {
    setShowWarningDialog(false);
    startGeneration();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-background to-blue-50 dark:from-blue-950 dark:via-background dark:to-blue-950 p-4 relative overflow-hidden">
      <AlertDialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
        <AlertDialogContent className="bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl border-blue-200/20 dark:border-blue-500/20 w-[95%] max-w-md mx-auto rounded-lg sm:rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">Long Pattern Warning</AlertDialogTitle>
            <AlertDialogDescription className="text-base space-y-2">
              <span className="block mb-2">
                A {type === 'prefix' ? prefix.length : suffix.length}-character pattern with case sensitivity {caseSensitive ? 'enabled' : 'disabled'} could take approximately <span className="font-medium text-blue-500">{estimatedTime}</span> to generate.
              </span>
              <span className="block text-sm text-muted-foreground">
                This is a rough estimate based on the pattern length and thread count. The actual time may vary significantly.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-blue-200/20 dark:border-blue-500/20 sm:mr-3 hover:bg-destructive hover:text-destructive-foreground">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleWarningConfirm}
              className="bg-blue-500 hover:bg-blue-600"
            >
              Continue Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="absolute inset-0 bg-grid-white/[0.02] -z-10" />
      <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-blue-500/20 dark:from-blue-500/10 dark:to-blue-500/5 backdrop-blur-3xl -z-10" />
      <div className="max-w-2xl mx-auto space-y-6 pt-4 sm:space-y-8 sm:pt-8">
        <div className="space-y-2 text-center">
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-br from-blue-600 to-blue-400 dark:from-blue-400 dark:to-blue-600 bg-clip-text text-transparent">
              Solana Vanity Address Generator
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg max-w-md mx-auto">
              Generate custom Solana addresses with your desired pattern
            </p>
          </div>
          {isGenerating && (
            <div className="mt-4 sm:mt-6 px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-500/5 border border-blue-500/20 rounded-full inline-flex items-center gap-2 animate-pulse backdrop-blur-xl">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm font-medium tabular-nums">Attempts: {displayedAttempts.toLocaleString()}</span>
            </div>
          )}
        </div>

        <Card className="p-4 sm:p-6 md:p-8 backdrop-blur-xl bg-white/50 dark:bg-gray-950/50 border-blue-200/20 dark:border-blue-500/20 shadow-xl ring-1 ring-blue-500/10">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-lg font-medium">Pattern Type</Label>
              <RadioGroup
                value={type}
                onValueChange={(value) => setType(value as 'prefix' | 'suffix')}
                className="flex space-x-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="prefix" id="prefix" />
                  <Label htmlFor="prefix" className="text-base">Prefix</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="suffix" id="suffix" />
                  <Label htmlFor="suffix" className="text-base">Suffix</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="grid gap-4">
              {type === 'prefix' ? (
              <div className="space-y-2">
                <Label htmlFor="pattern" className="text-lg font-medium">Prefix Pattern</Label>
                <Input
                  id="pattern"
                  placeholder="Enter desired prefix"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  className="bg-white/50 dark:bg-gray-950/50 border-blue-200/20 dark:border-blue-500/20 text-lg h-12 focus:ring-blue-500/50"
                />
                <div className="flex items-center text-sm text-muted-foreground bg-orange-500/5 border border-orange-500/20 p-2 rounded-lg">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Patterns longer than 4 characters may take a very long time
                </div>
              </div>
              ) : (
              <div className="space-y-2">
                <Label htmlFor="pattern" className="text-lg font-medium">Suffix Pattern</Label>
                <Input
                  id="pattern"
                  placeholder="Enter desired suffix"
                  value={suffix}
                  onChange={(e) => setSuffix(e.target.value)}
                  className="bg-white/50 dark:bg-gray-950/50 border-blue-200/20 dark:border-blue-500/20 text-lg h-12 focus:ring-blue-500/50"
                />
                <div className="flex items-center text-sm text-muted-foreground bg-orange-500/5 border border-orange-500/20 p-2 rounded-lg">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Patterns longer than 4 characters may take a very long time
                </div>
              </div>
              )}

              <div className="flex items-center space-x-3 bg-blue-500/5 border border-blue-500/10 p-3 rounded-lg">
                <Switch
                  id="case-sensitive"
                  checked={caseSensitive}
                  onCheckedChange={setCaseSensitive}
                />
                <Label htmlFor="case-sensitive" className="text-base">Case Sensitive</Label>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="threads" className="text-lg font-medium">Thread Count</Label>
                <div className="space-y-4">
                  <Slider
                    id="threads"
                    min={1}
                    max={16}
                    step={1}
                    value={[threadCount]}
                    onValueChange={(value) => setThreadCount(value[0])}
                    className="w-full [&_[role=slider]]:bg-blue-500 [&_[role=slider]]:border-blue-600 [&_[role=slider]]:shadow-blue-500/20"
                  />
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Current: {threadCount} thread{threadCount > 1 ? 's' : ''}</span>
                    <span>1-16 threads</span>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground bg-blue-500/5 border border-blue-500/10 p-2 rounded-lg">
                    <p>Higher thread counts can speed up generation but require more CPU power. If you experience performance issues, try reducing the thread count.</p>
                  </div>
                </div>
              </div>
            </div>

            <Button
              className={`w-full h-12 text-lg font-medium shadow-lg hover:shadow-xl transition-all ${
                isGenerating ? 'bg-destructive hover:bg-destructive/90' : 'bg-blue-500 hover:bg-blue-600'
              }`}
              onClick={isGenerating ? stopGeneration : handleGenerate}>
              {isGenerating ? (
                <>
                  <StopCircle className="mr-2 h-5 w-5" />
                  Stop Generation
                </>
              ) : (
                <>
                  <Key className="mr-2 h-5 w-5" />
                  Generate Address
                </>
              )}
            </Button>
          </div>
        </Card>

        {!isGenerating && generatedKeypair && (
          <Card className="p-8 backdrop-blur-xl bg-white/50 dark:bg-gray-950/50 border-blue-200/20 dark:border-blue-500/20 shadow-xl ring-1 ring-blue-500/10">
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-lg font-medium">Public Address</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(generatedKeypair.publicKey)}
                    className="hover:bg-blue-500/10"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="p-4 bg-blue-500/5 rounded-lg font-mono text-sm break-all border border-blue-500/20">
                  {generatedKeypair.publicKey}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-lg font-medium">Private Key</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(Buffer.from(new Uint8Array(generatedKeypair.secretKey)).toString('hex'))}
                    className="hover:bg-blue-500/10"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="p-4 bg-blue-500/5 rounded-lg font-mono text-sm break-all border border-blue-500/20">
                  {Buffer.from(new Uint8Array(generatedKeypair.secretKey)).toString('hex')}
                </div>
              </div>

              <div className="flex items-center justify-center text-sm text-muted-foreground bg-blue-500/5 border border-blue-500/20 p-3 rounded-lg">
                <Wallet className="h-4 w-4 mr-2" />
                Generated in {attempts.toLocaleString()} attempts
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}