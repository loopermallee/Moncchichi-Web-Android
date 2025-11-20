class SoundService {
    private audioContext: AudioContext | null = null;
    private thinkingInterval: any = null;

    private getContext(): AudioContext {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        return this.audioContext;
    }

    public playClick() {
        try {
            const ctx = this.getContext();
            if (ctx.state === 'suspended') {
                ctx.resume();
            }

            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            // High pitched, short "pop"
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(800, ctx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.05);

            gainNode.gain.setValueAtTime(0.05, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

            oscillator.start();
            oscillator.stop(ctx.currentTime + 0.05);
        } catch (e) {
            // Audio context might be blocked or not supported
        }
    }

    public playInteraction() {
        try {
            const ctx = this.getContext();
            if (ctx.state === 'suspended') {
                ctx.resume();
            }

            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            // Lower, softer "thud" for generic interactions
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(200, ctx.currentTime);
            
            gainNode.gain.setValueAtTime(0.03, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

            oscillator.start();
            oscillator.stop(ctx.currentTime + 0.08);
        } catch (e) {
            // Ignore
        }
    }

    public playTick() {
        try {
            const ctx = this.getContext();
            if (ctx.state === 'suspended') ctx.resume();

            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            // Crisp mechanical click for sliders
            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(2000, ctx.currentTime);
            
            gainNode.gain.setValueAtTime(0.015, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);

            oscillator.start();
            oscillator.stop(ctx.currentTime + 0.03);
        } catch (e) {
            // Ignore
        }
    }

    public playNavigation() {
        try {
            const ctx = this.getContext();
            if (ctx.state === 'suspended') ctx.resume();

            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            // Airy "swish" for navigation
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(300, ctx.currentTime);
            oscillator.frequency.linearRampToValueAtTime(500, ctx.currentTime + 0.1);
            
            gainNode.gain.setValueAtTime(0.04, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

            oscillator.start();
            oscillator.stop(ctx.currentTime + 0.12);
        } catch (e) {
            // Ignore
        }
    }

    public startThinking() {
        if (this.thinkingInterval) return;
        
        const playBlip = () => {
             try {
                const ctx = this.getContext();
                if (ctx.state === 'suspended') ctx.resume();

                const oscillator = ctx.createOscillator();
                const gainNode = ctx.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(ctx.destination);

                // Random "computing" bleeps
                oscillator.type = 'sine';
                const freq = 1000 + Math.random() * 200;
                oscillator.frequency.setValueAtTime(freq, ctx.currentTime);
                
                gainNode.gain.setValueAtTime(0.008, ctx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

                oscillator.start();
                oscillator.stop(ctx.currentTime + 0.05);
            } catch (e) {}
        };

        playBlip();
        this.thinkingInterval = setInterval(playBlip, 180);
    }

    public stopThinking() {
        if (this.thinkingInterval) {
            clearInterval(this.thinkingInterval);
            this.thinkingInterval = null;
        }
    }
}

export const soundService = new SoundService();